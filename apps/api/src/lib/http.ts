import {
  COPY,
  ERROR_STATUS,
  type ErrorCode,
  type ErrorEnvelope,
  type ValidationDetail,
} from '@rweb/contracts';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { AppEnv } from '../context';
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

export function errorResponse(
  c: Context<AppEnv>,
  code: ErrorCode,
  message: string,
  details: ValidationDetail[] = [],
  headers: Record<string, string> = {},
): Response {
  const body: ErrorEnvelope = {
    error: {
      code,
      message,
      requestId: c.get('requestId'),
      details,
    },
  };
  return c.json(body, ERROR_STATUS[code] as ContentfulStatusCode, headers);
}

/**
 * §1.1: JSON only, `application/json` with an optional charset; unknown fields are handled by
 * the strict schemas, not here.
 */
export async function readJson(request: Request): Promise<unknown> {
  const [mediaType] = (request.headers.get('content-type') ?? '').split(';');
  if (mediaType?.trim().toLowerCase() !== JSON_MEDIA_TYPE) {
    throw new ApiError('UNSUPPORTED_MEDIA_TYPE', COPY.apiOnly.unsupportedMediaType);
  }

  const declaredLength = Number(request.headers.get('content-length') ?? Number.NaN);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) {
    throw new ApiError('PAYLOAD_TOO_LARGE', COPY.apiOnly.payloadTooLarge);
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) {
    throw new ApiError('PAYLOAD_TOO_LARGE', COPY.apiOnly.payloadTooLarge);
  }
  if (text.trim() === '') {
    throw new ApiError('VALIDATION_FAILED', COPY.form.checkFields, {
      details: [{ field: 'body', code: 'required', message: COPY.apiOnly.invalidJson }],
    });
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError('VALIDATION_FAILED', COPY.apiOnly.invalidJson, {
      details: [{ field: 'body', code: 'invalid_json', message: COPY.apiOnly.invalidJson }],
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
