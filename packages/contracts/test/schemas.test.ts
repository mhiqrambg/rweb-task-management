import { describe, expect, it } from 'vitest';
import { copy } from '../src/copy';
import {
  defaultDisplayName,
  loginSchema,
  registerSchema,
  validationDetails,
} from '../src/index';

describe('registerSchema', () => {
  it('accepts a valid pair, lowercases the email and leaves displayName absent', () => {
    const parsed = registerSchema.parse({
      email: '  Erika@Example.TEST ',
      password: 'correct horse battery',
    });
    expect(parsed.email).toBe('erika@example.test');
    expect(parsed.displayName).toBeUndefined();
  });

  it('rejects an 11-character password with the password_policy code', () => {
    const result = registerSchema.safeParse({ email: 'a@b.test', password: 'short horse' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(validationDetails(result.error)[0]).toMatchObject({
      field: 'password',
      code: 'password_policy',
      message: copy.valid.password.length,
    });
  });

  it('reports an empty password as required, not as a policy violation', () => {
    const result = registerSchema.safeParse({ email: 'a@b.test', password: '' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(validationDetails(result.error)[0]).toMatchObject({
      field: 'password',
      code: 'required',
      message: copy.valid.password.required,
    });
  });

  it('rejects unknown keys as the mass-assignment guard', () => {
    const result = registerSchema.safeParse({
      email: 'a@b.test',
      password: 'correct horse battery',
      userId: 'attacker',
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(validationDetails(result.error)).toContainEqual({
      field: 'userId',
      code: 'unknown_field',
      message: copy.valid.unknownField,
    });
  });

  it('rejects a malformed email with the email_format code and deck copy', () => {
    const result = loginSchema.safeParse({ email: 'foo@', password: 'correct horse battery' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(validationDetails(result.error)[0]).toMatchObject({
      field: 'email',
      code: 'email_format',
      message: copy.valid.email.format,
    });
  });

  it('applies the same password policy to login', () => {
    expect(loginSchema.safeParse({ email: 'a@b.test', password: 'short' }).success).toBe(false);
  });
});

describe('defaultDisplayName', () => {
  it('uses the email local part and never exceeds 100 characters', () => {
    expect(defaultDisplayName('erika@example.test')).toBe('erika');
    expect(defaultDisplayName(`${'x'.repeat(120)}@example.test`)).toHaveLength(100);
  });
});
