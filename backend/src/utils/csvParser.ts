import { parse } from 'csv-parse/sync';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ParsedRecipients {
  valid: string[];
  invalid: string[];
  duplicates: number;
  total: number;
}

/**
 * Parse CSV or plain text content to extract email addresses.
 * Handles:
 * - CSV files with or without headers
 * - Plain text (one email per line)
 * - Comma-separated emails
 * - Various column positions
 */
export function parseRecipients(content: string, mimeType?: string): ParsedRecipients {
  const allEmails: string[] = [];

  try {
    // Try CSV parsing first
    const records = parse(content, {
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });

    for (const record of records) {
      for (const cell of record) {
        const cellStr = String(cell).trim().toLowerCase();
        // Check if cell looks like an email
        if (EMAIL_REGEX.test(cellStr)) {
          allEmails.push(cellStr);
        }
      }
    }
  } catch {
    // Fallback: parse as plain text, split by various delimiters
    const lines = content.split(/[\n\r,;]+/);
    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();
      if (EMAIL_REGEX.test(trimmed)) {
        allEmails.push(trimmed);
      }
    }
  }

  // Separate valid and invalid
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  let duplicates = 0;

  for (const email of allEmails) {
    if (!EMAIL_REGEX.test(email)) {
      invalid.push(email);
      continue;
    }

    if (seen.has(email)) {
      duplicates++;
      continue;
    }

    seen.add(email);
    valid.push(email);
  }

  return {
    valid,
    invalid,
    duplicates,
    total: allEmails.length,
  };
}

/**
 * Validate a single email address
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim().toLowerCase());
}

/**
 * Validate and clean a list of email addresses
 */
export function validateEmailList(emails: string[]): ParsedRecipients {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  let duplicates = 0;

  for (const raw of emails) {
    const email = raw.trim().toLowerCase();

    if (!EMAIL_REGEX.test(email)) {
      invalid.push(email);
      continue;
    }

    if (seen.has(email)) {
      duplicates++;
      continue;
    }

    seen.add(email);
    valid.push(email);
  }

  return { valid, invalid, duplicates, total: emails.length };
}
