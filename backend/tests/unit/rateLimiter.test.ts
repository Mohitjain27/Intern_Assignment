import {
  checkAndIncrementHourlyLimit,
  getHourKey,
  secondsUntilNextHour,
} from '../../src/utils/rateLimiter';

// Mock IORedis
jest.mock('../../src/config/redis', () => ({
  getRedisClient: () => ({
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    decr: jest.fn().mockResolvedValue(0),
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
  }),
}));

describe('rateLimiter', () => {
  describe('getHourKey', () => {
    it('returns YYYY-MM-DD-HH format', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const key = getHourKey(date);
      expect(key).toMatch(/^\d{4}-\d{2}-\d{2}-\d{2}$/);
    });

    it('uses current time when no date provided', () => {
      const key = getHourKey();
      expect(key).toMatch(/^\d{4}-\d{2}-\d{2}-\d{2}$/);
    });
  });

  describe('secondsUntilNextHour', () => {
    it('returns positive number', () => {
      const seconds = secondsUntilNextHour();
      expect(seconds).toBeGreaterThan(0);
      expect(seconds).toBeLessThanOrEqual(3600);
    });

    it('returns approximately 3600 at start of hour', () => {
      const startOfHour = new Date();
      startOfHour.setMinutes(0, 0, 0);
      const seconds = secondsUntilNextHour(startOfHour);
      expect(seconds).toBeLessThanOrEqual(3600);
    });
  });

  describe('checkAndIncrementHourlyLimit', () => {
    it('returns allowed=true when count is within limit', async () => {
      const result = await checkAndIncrementHourlyLimit('sender-1', 100);
      expect(result.allowed).toBe(true);
      expect(result.count).toBe(1);
      expect(result.resetAt).toBeInstanceOf(Date);
    });

    it('returns resetAt as next hour', async () => {
      const result = await checkAndIncrementHourlyLimit('sender-1', 100);
      const nextHour = new Date();
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
      expect(result.resetAt.getHours()).toBe(nextHour.getHours());
    });
  });
});
