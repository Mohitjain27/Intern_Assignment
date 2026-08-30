import IORedis from 'ioredis';
import { env } from './env';

let redisClient: IORedis | null = null;

export function getRedisClient(): IORedis {
  if (!redisClient) {
    redisClient = new IORedis(env.redisUrl, {
      maxRetriesPerRequest: null, // required for BullMQ
      enableReadyCheck: false,
      lazyConnect: false,
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connected');
    });

    redisClient.on('error', (error) => {
      console.error('❌ Redis error:', error.message);
    });

    redisClient.on('reconnecting', () => {
      console.log('🔄 Redis reconnecting...');
    });
  }

  return redisClient;
}

export function createRedisConnection(): IORedis {
  return new IORedis(env.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('Redis disconnected');
  }
}
