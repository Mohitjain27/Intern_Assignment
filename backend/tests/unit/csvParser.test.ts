import { parseRecipients, validateEmailList, isValidEmail } from '../../src/utils/csvParser';

describe('csvParser', () => {
  describe('isValidEmail', () => {
    it('validates correct emails', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('user+tag@domain.co.uk')).toBe(true);
      expect(isValidEmail('USER@DOMAIN.COM')).toBe(true);
    });

    it('rejects invalid emails', () => {
      expect(isValidEmail('not-an-email')).toBe(false);
      expect(isValidEmail('@no-user.com')).toBe(false);
      expect(isValidEmail('no-domain@')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('parseRecipients', () => {
    it('parses comma-separated CSV', () => {
      const csv = 'alice@example.com,bob@example.com,charlie@example.com';
      const result = parseRecipients(csv);
      expect(result.valid).toHaveLength(3);
      expect(result.valid).toContain('alice@example.com');
    });

    it('parses newline-separated emails', () => {
      const text = 'alice@example.com\nbob@example.com\ncharlie@example.com';
      const result = parseRecipients(text);
      expect(result.valid).toHaveLength(3);
    });

    it('deduplicates emails', () => {
      const csv = 'alice@example.com,alice@example.com,bob@example.com';
      const result = parseRecipients(csv);
      expect(result.valid).toHaveLength(2);
      expect(result.duplicates).toBe(1);
    });

    it('filters out invalid emails', () => {
      const csv = 'valid@example.com,not-an-email,also@valid.com';
      const result = parseRecipients(csv);
      expect(result.valid).toHaveLength(2);
    });

    it('normalizes emails to lowercase', () => {
      const result = parseRecipients('UPPER@EXAMPLE.COM,lower@example.com');
      expect(result.valid).toContain('upper@example.com');
      expect(result.valid).toContain('lower@example.com');
    });

    it('returns stats', () => {
      const result = parseRecipients('alice@test.com,not-email');
      expect(result.total).toBeGreaterThan(0);
      expect(result.valid.length + result.invalid.length + result.duplicates).toBeLessThanOrEqual(result.total + 1);
    });
  });

  describe('validateEmailList', () => {
    it('validates an array of emails', () => {
      const result = validateEmailList([
        'alice@example.com',
        'bob@example.com',
        'not-valid',
        'alice@example.com', // duplicate
      ]);
      expect(result.valid).toHaveLength(2);
      expect(result.invalid).toHaveLength(1);
      expect(result.duplicates).toBe(1);
    });
  });
});
