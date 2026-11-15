import type { ErrorCode, ErrorEnvelope, PageMeta, ValidationDetail } from '@taskapp/contracts';

/** One normalised response, whether it came from the API or the contract-first mock. */
export interface ApiOk {
  status: number;
  data: unknown;
  page: PageMeta | null;
  setCookie: string | null;
  error: null;
}

export interface ApiErr {
  status: number;
  data: null;
  page: null;
  setCookie: string | null;
  error: ErrorEnvelope['error'];
}

export type ApiRaw = ApiOk | ApiErr;

export interface Failure {
  ok: false;
  status: number;
  code: ErrorCode;
  message: string;
  details: ValidationDetail[];
}

export type Success<T> = { ok: true; value: T };
export type Result<T> = Success<T> | Failure;

export interface ApiRequestInput {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** Path inside /api/v1, already encoded, query included. */
  path: string;
  cookie: string | null;
  body?: unknown;
  form?: FormData;
}
