import { describe, expect, it } from 'vitest';
import { copy } from '../src/copy';
import {
  errorEnvelopeSchema,
  loginSchema,
  registerSchema,
  validationDetails,
  validationMessage,
} from '../src/index';

/**
 * A 422 that names one field must say what is wrong with it. The generic
 * "check the highlighted fields" banner is only correct when several fields failed, and it is
 * the fallback for a details-less 422.
 */
describe('validationMessage', () => {
  it('returns the single failing field message when exactly one field failed', () => {
    const parsed = registerSchema.safeParse({ email: 'short@example.test', password: 'too short' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const details = validationDetails(parsed.error);
    expect(details).toHaveLength(1);
    expect(validationMessage(details)).toBe('Use at least 12 characters.');
  });

  it('falls back to the generic form copy when several fields failed', () => {
    const parsed = registerSchema.safeParse({});
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const details = validationDetails(parsed.error);
    expect(details.length).toBeGreaterThan(1);
    expect(validationMessage(details)).toBe(copy.error.form);
  });

  it('falls back to the generic form copy when no details were reported', () => {
    expect(validationMessage([])).toBe(copy.error.form);
  });

  it('names the email field for a malformed address', () => {
    const parsed = loginSchema.safeParse({ email: 'foo@', password: 'correct horse battery' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const details = validationDetails(parsed.error);
    expect(details).toHaveLength(1);
    expect(validationMessage(details)).toBe('Enter a valid email address.');
  });
});

describe('errorEnvelopeSchema', () => {
  it('parses a real 422 envelope with details', () => {
    const parsed = errorEnvelopeSchema.safeParse({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Use at least 12 characters.',
        requestId: 'stale',
        details: [{ field: 'password', code: 'password_policy', message: 'Use at least 12 characters.' }],
      },
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.error.details[0]?.field).toBe('password');
  });

  it('rejects an envelope whose details are missing or malformed', () => {
    expect(
      errorEnvelopeSchema.safeParse({ error: { code: 'VALIDATION_FAILED', message: 'x', requestId: 'y' } })
        .success,
    ).toBe(false);
    expect(
      errorEnvelopeSchema.safeParse({
        error: { code: 'VALIDATION_FAILED', message: 'x', requestId: 'y', details: [{ field: 1 }] },
      }).success,
    ).toBe(false);
  });
});