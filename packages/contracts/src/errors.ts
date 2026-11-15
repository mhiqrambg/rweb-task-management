import { copy } from './copy';
import type { ErrorCode, ValidationDetail } from './types/index';

/** HTTP status of each code in the closed set (06 §1.2-§1.3). */
export const errorStatus: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 422,
  UNAUTHENTICATED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

/**
 * Interface copy for an error code: cause plus the next step, never a status code or a stack
 * (R-F4, design/06 §1). Field-level detail from the API still wins when present.
 */
export function errorMessage(code: ErrorCode): string {
  switch (code) {
    case 'UNAUTHENTICATED':
      return copy.auth.error.sessionExpired;
    case 'CONFLICT':
      return copy.auth.error.emailTaken;
    case 'RATE_LIMITED':
      return copy.auth.error.rateLimited;
    case 'VALIDATION_FAILED':
      return copy.error.form;
    case 'NOT_FOUND':
      return copy.state.notFound.body;
    case 'PAYLOAD_TOO_LARGE':
      return copy.upload.reject.sizeShort;
    case 'UNSUPPORTED_MEDIA_TYPE':
      return copy.error.form;
    case 'INTERNAL':
      return copy.state.error.body;
  }
}

/** True when a failure means "log in again" rather than "show an error". */
export function isUnauthenticated(status: number, code?: ErrorCode): boolean {
  return status === 401 || code === 'UNAUTHENTICATED';
}

/** First field-level message for a form field, if the API reported one. */
export function fieldError(
  details: ValidationDetail[],
  field: string,
): string | undefined {
  return details.find((detail) => detail.field === field)?.message;
}
