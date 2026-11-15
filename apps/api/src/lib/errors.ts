import { ERROR_STATUS, type ErrorCode, type ValidationDetail } from '@rweb/contracts';

/** The only error type handlers throw; `onError` turns it into the wire envelope. */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly details: ValidationDetail[];
  readonly headers: Record<string, string>;

  constructor(
    code: ErrorCode,
    message: string,
    options: { details?: ValidationDetail[]; headers?: Record<string, string> } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = options.details ?? [];
    this.headers = options.headers ?? {};
  }

  get status(): number {
    return ERROR_STATUS[this.code];
  }
}
