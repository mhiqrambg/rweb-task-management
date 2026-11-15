import {
  copy,
  errorStatus,
  type ErrorCode,
  type ErrorEnvelope,
  type ValidationDetail,
} from '@taskapp/contracts';
import { ApiError } from './errors';
import { isUuidV4 } from './ids';

/** §1.8: JSON bodies are capped at 256 KiB. */
export const MAX_JSON_BYTES = 256 * 1024;

const JSON_MEDIA_TYPE = 'application/json';

export function requestIdFrom(request: Request): string {
  const inbound = request.headers.get('x-request-id')?.trim();
  return inbound && isUuidV4(inbound) ? inbound : crypto.randomUUID();
}

/** Cloudflare overwrites `CF-Connecting-IP`; it is the only trustworthy client address here. */
export function clientIp(request: Request): string {
  const connecting = request.headers.get('cf-connecting-ip')?.trim();
  if (connecting) return connecting;
  const [firstForwarded] = (request.headers.get('x-forwarded-for') ?? '').split(',');
  const forwarded = firstForwarded?.trim();
  return forwarded ? forwarded : 'unknown';
}

/**
 * `errorResponse` returns a plain `Response` so any handler — or the global error handler — can
 * emit it without depending on a framework context object. `requestId` is passed in explicitly
 * rather than read from an ambient request context.
 */
export function errorResponse(
  requestId: string,
  code: ErrorCode,
  message: string,
  details: ValidationDetail[] = [],
  headers: Record<string, string> = {},
): Response {
  const body: ErrorEnvelope = {
    error: { code, message, requestId, details },
  };
  return new Response(JSON.stringify(body), {
    status: errorStatus[code],
    headers: { 'content-type': 'application/json', ...headers },
  });
}

/**
 * §1.1: JSON only, `application/json` with an optional charset; unknown fields are handled by
 * the strict schemas, not here.
 */
/**
 * Parse the request body Elysia already read (via the app's `onParse` hook) into a value, keeping
 * the wire contract: 415 for a non-JSON media type, 413 past 256 KiB, 422 for an empty or
 * malformed body. Elysia hands the handler the body as a string, so this never reads the request
 * stream a second time.
 */
export function parseJsonBody(
  text: string,
  contentType: string | null,
  contentLength: string | null,
): unknown {
  const [mediaType] = (contentType ?? '').split(';');
  if (mediaType?.trim().toLowerCase() !== JSON_MEDIA_TYPE) {
    throw new ApiError('UNSUPPORTED_MEDIA_TYPE', copy.error.form);
  }

  const declaredLength = Number(contentLength ?? Number.NaN);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) {
    throw new ApiError('PAYLOAD_TOO_LARGE', copy.upload.reject.sizeShort);
  }
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) {
    throw new ApiError('PAYLOAD_TOO_LARGE', copy.upload.reject.sizeShort);
  }
  if (text.trim() === '') {
    throw new ApiError('VALIDATION_FAILED', copy.error.form, {
      details: [{ field: 'body', code: 'required', message: copy.error.form }],
    });
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError('VALIDATION_FAILED', copy.error.form, {
      details: [{ field: 'body', code: 'invalid_json', message: copy.error.form }],
    });
  }
}

/** §6.5 of `.planning/07`: identical values for every API response. */
export function securityHeaders(isProduction: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Security-Policy':
      "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  };
  if (isProduction) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }
  return headers;
}
