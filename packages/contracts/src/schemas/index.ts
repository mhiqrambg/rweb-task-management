import { z } from 'zod';
import { copy } from '../copy';
import type { ValidationDetail } from '../types/index';

/**
 * Shared validators: the API uses them at the HTTP boundary, both frontends use them as form
 * validators, so the message a field shows is the same one the server would return
 * (R-B2, 06 §4, FR-UI-005/006/012).
 *
 * Every object is strict: an unknown key is a rejection, not something to ignore (06 §1.1).
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export const emailField = z
  .string()
  .trim()
  .min(1, copy.valid.email.required)
  .max(254, copy.valid.email.format)
  .refine((value) => EMAIL.test(value), copy.valid.email.format)
  // 06 §4: lowercased for storage, so uniqueness is case-insensitive on both sides.
  .transform((value) => value.toLowerCase());

export const passwordField = z
  .string()
  .min(1, copy.valid.password.required)
  .min(12, copy.valid.password.length)
  .max(128, copy.valid.password.length);

export const displayNameField = z.string().trim().min(1).max(100);

export const taskStatusField = z.enum(['todo', 'in_progress', 'completed'], {
  message: copy.valid.status.invalid,
});

export const taskPriorityField = z.enum(['low', 'medium', 'high'], {
  message: copy.valid.priority.invalid,
});

const calendarDateField = z
  .string()
  .trim()
  .refine((value) => isCalendarDate(value), copy.valid.dueDate.invalid);

const dueDateField = z
  .union([calendarDateField, z.literal(''), z.null()])
  .transform((value) => (value === '' ? null : value));

export const registerSchema = z.strictObject({
  email: emailField,
  password: passwordField,
  displayName: displayNameField.optional(),
});

export const loginSchema = z.strictObject({
  email: emailField,
  password: passwordField,
});

export const createTaskSchema = z.strictObject({
  title: z.string().trim().min(1, copy.valid.title.required).max(200, copy.valid.title.length),
  description: z
    .string()
    .max(5000, copy.valid.description.length)
    .nullable()
    .optional()
    .transform((value) => (value === '' ? null : value)),
  status: taskStatusField.optional(),
  priority: taskPriorityField.optional(),
  dueDate: dueDateField.optional(),
});

export const updateTaskSchema = z
  .strictObject({
    title: z.string().trim().min(1, copy.valid.title.required).max(200, copy.valid.title.length).optional(),
    description: z
      .string()
      .max(5000, copy.valid.description.length)
      .nullable()
      .optional()
      .transform((value) => (value === '' ? null : value)),
    status: taskStatusField.optional(),
    priority: taskPriorityField.optional(),
    dueDate: dueDateField.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, copy.error.form);

export const createNoteSchema = z.strictObject({
  title: z.string().trim().min(1, copy.valid.title.required).max(200, copy.valid.title.length),
  body: z.string().trim().min(1, copy.valid.body.required).max(20000, copy.valid.body.length),
  pinned: z.boolean().optional(),
});

export const updateNoteSchema = z
  .strictObject({
    title: z.string().trim().min(1, copy.valid.title.required).max(200, copy.valid.title.length).optional(),
    body: z.string().trim().min(1, copy.valid.body.required).max(20000, copy.valid.body.length).optional(),
    pinned: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, copy.error.form);

export const uploadTargetSchema = z.strictObject({
  targetType: z.enum(['task', 'note'], { message: copy.error.form }),
  targetId: z.uuid({ message: copy.error.form }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type UploadTargetInput = z.infer<typeof uploadTargetSchema>;

/** Parse a form body into `{ value }` or `{ errors: Record<field, message> }`. */
export function parseForm<Schema extends z.ZodType>(
  schema: Schema,
  data: Record<string, unknown>,
): { ok: true; value: z.output<Schema> } | { ok: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, value: result.data };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    const key = typeof field === 'string' ? field : 'form';
    errors[key] ??= issue.message;
  }
  return { ok: false, errors };
}

/** Q-02: a missing display name defaults to the email local part, never over 100 characters. */
export function defaultDisplayName(email: string): string {
  const [localPart = ''] = email.split('@');
  return localPart.slice(0, 100);
}

/**
 * A failed parse as the wire `details[]` (06 §1.3, §4): a stable machine `code` plus deck copy.
 * Zod's own English is never passed through, and a field without a specific mapping is generic.
 */
export function validationDetails(error: z.ZodError): ValidationDetail[] {
  const details: ValidationDetail[] = [];
  for (const issue of error.issues) {
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) {
        details.push({ field: key, code: 'unknown_field', message: copy.valid.unknownField });
      }
      continue;
    }
    const [first] = issue.path;
    const field = typeof first === 'string' && first.length > 0 ? first : 'body';
    details.push({ field, code: detailCode(field, issue), message: detailMessage(field, issue) });
  }
  return details;
}

/**
 * Wire shape of a 422 `details[]` entry and of the error envelope that carries it, as
 * validators — the API writes them, clients parse them at the fetch boundary (07 §6).
 * `file` is optional because only upload errors carry it.
 */
export const validationDetailSchema = z.object({
  field: z.string(),
  code: z.string(),
  message: z.string(),
  file: z.string().optional(),
});

export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
    details: z.array(validationDetailSchema),
  }),
});

type Issue = z.ZodError['issues'][number];

function detailCode(field: string, issue: Issue): string {
  if (field === 'email') {
    if (issue.code === 'invalid_type' || issue.code === 'too_small') return 'required';
    if (issue.code === 'too_big') return 'too_long';
    return 'email_format';
  }
  if (field === 'password') {
    if (issue.code === 'invalid_type') return 'required';
    if (issue.code === 'too_small') return Number(issue.minimum) === 1 ? 'required' : 'password_policy';
    return 'password_policy';
  }
  if (issue.code === 'invalid_type' || issue.code === 'too_small') return 'required';
  if (issue.code === 'too_big') return 'too_long';
  return 'invalid_value';
}

function detailMessage(field: string, issue: Issue): string {
  if (issue.code !== 'invalid_type') return issue.message;
  if (field === 'email') return copy.valid.email.required;
  if (field === 'password') return copy.valid.password.required;
  return copy.error.form;
}
