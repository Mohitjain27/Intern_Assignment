import { getRedisClient } from '../config/redis';
import { env } from '../config/env';

// Returns the hour key in format YYYY-MM-DD-HH
export function getHourKey(date: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}`;
}

// Returns seconds until next hour
export function secondsUntilNextHour(now: Date = new Date()): number {
  const nextHour = new Date(now);
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
  return Math.ceil((nextHour.getTime() - now.getTime()) / 1000);
}

// Returns milliseconds until next hour
export function msUntilNextHour(now: Date = new Date()): number {
  const nextHour = new Date(now);
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
  return nextHour.getTime() - now.getTime();
}

/**
 * Check and increment hourly send count for a sender.
 * Returns true if within limit, false if limit exceeded.
 * Uses atomic Redis INCR to be safe across multiple workers.
 */
export async function checkAndIncrementHourlyLimit(
  senderId: string,
  limit: number,
  now: Date = new Date()
): Promise<{ allowed: boolean; count: number; resetAt: Date }> {
  const redis = getRedisClient();
  const key = `rl:sender:${senderId}:${getHourKey(now)}`;

  // Atomic increment
  const count = await redis.incr(key);

  // Set expiry on first increment (extra buffer of 1 hour)
  if (count === 1) {
    const ttl = secondsUntilNextHour(now) + 3600;
    await redis.expire(key, ttl);
  }

  const nextHour = new Date(now);
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);

  // limit = 0 means unlimited — skip rate limiting entirely
  if (limit > 0 && count > limit) {
    // Decrement since we won't send
    await redis.decr(key);
    return { allowed: false, count: count - 1, resetAt: nextHour };
  }

  return { allowed: true, count, resetAt: nextHour };
}

/**
 * Get current hourly count for a sender (read-only).
 */
export async function getHourlyCount(
  senderId: string,
  now: Date = new Date()
): Promise<number> {
  const redis = getRedisClient();
  const key = `rl:sender:${senderId}:${getHourKey(now)}`;
  const count = await redis.get(key);
  return count ? parseInt(count) : 0;
}

/**
 * Acquire minimum delay slot for a sender.
 * Uses Redis SET NX to ensure minimum delay between sends.
 * Returns true if slot acquired (ok to send), false if still in delay window.
 */
export async function acquireMinDelaySlot(senderId: string, delayMsOverride?: number): Promise<boolean> {
  const redis = getRedisClient();
  const key = `delay:sender:${senderId}`;
  const delayMs = delayMsOverride !== undefined ? delayMsOverride : env.worker.minEmailDelayMs;

  // delayMs = 0 means no inter-email delay required — always allow
  if (delayMs <= 0) return true;

  const result = await redis.set(key, '1', 'PX', delayMs, 'NX');
  return result === 'OK';
}

/**
 * Check if notification for rate limit already sent this hour.
 * Prevents spam - only sends one Slack notification per sender per hour.
 */
export async function checkAndMarkRateLimitNotified(
  senderId: string,
  now: Date = new Date()
): Promise<boolean> {
  const redis = getRedisClient();
  const key = `slack:notified:${senderId}:${getHourKey(now)}`;

  const result = await redis.set(key, '1', 'EX', secondsUntilNextHour(now) + 3600, 'NX');
  return result === 'OK'; // true = first notification this hour (should send)
}
