import { argon2idAsync } from '@noble/hashes/argon2.js';
import { randomBytes } from '../../lib/ids';

/**
 * Password hashing — two formats coexist during the Argon2id → PBKDF2 migration:
 *
 * - **Legacy** `$argon2id$…` rows: still verifiable, never produced for new passwords.
 * - **Current** `$pbkdf2$…` rows: native `crypto.subtle` PBKDF2-SHA256, cheap enough for the
 *   Workers free-tier CPU budget (10 ms/request).
 *
 * Why the change: Argon2id (m=19456 KiB, t=2, pure-TS `@noble/hashes`) measured ~140 ms CPU per
 * hash. On Workers Free the limit is 10 ms/request, so register/login intermittently failed with
 * Cloudflare Error 1102 ("Worker exceeded resources") — measured on the deployed Worker. PBKDF2
 * runs on the platform's native `crypto.subtle`, which the Web Crypto docs call out as
 * "significantly faster than performing them purely in JavaScript".
 *
 * Measured cost on the deployed production Worker (one hash per request, `wrangler tail` cpuTime):
 * 20k iters = 4 ms, 30k = 6 ms, 40k = 12 ms, 100k = 15 ms. `crypto.subtle` also hard-caps
 * PBKDF2 at 100 000 iterations ("iteration counts above 100000 are not supported").
 *
 * **PBKDF2_ITERATIONS = 30 000** keeps the hash at ~6 ms, leaving headroom for the D1 session
 * read + response serialisation in the same request. This is below the OWASP PBKDF2-SHA256
 * recommendation (600 000) — a deliberate, documented trade-off to stay on the free tier. It is
 * offset by the 12-character minimum password policy (A-11) and a unique 16-byte salt per user.
 * Recorded in the ADR referenced from NFR-SEC-001.
 */
const PBKDF2_ITERATIONS = 30_000;
const PBKDF2_ALGORITHM = 'PBKDF2';
const PBKDF2_HASH = 'SHA-256';
const PBKDF2_DIGEST_BYTES = 32;
const PBKDF2_SALT_BYTES = 16;
const PBKDF2_PREFIX = '$pbkdf2$';

const PHC_VERSION = 'v=19';

/**
 * A real PBKDF2 hash of a value nobody knows, for the unknown-email timing path (T-02).
 * Same format and iteration count as a live row, so the burn costs the same ~6 ms and never
 * exceeds the free-tier CPU budget.
 */
const DUMMY_HASH =
  '$pbkdf2$SHA-256$30000$CxclKTVDR1NhZXF/g4uVnQ$zdbweozwjwvICs4ZQGBbuj2yvWvwvvjtNVqSu+XmRt8';

interface Argon2Parameters {
  t: number;
  m: number;
  p: number;
  dkLen: number;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=+$/u, '');
}

function decodeBase64(value: string): Uint8Array {
  const padded = value + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function decodeArgon2id(
  encoded: string,
): { params: Argon2Parameters; salt: Uint8Array; digest: Uint8Array } | null {
  const parts = encoded.split('$');
  if (parts.length !== 6) return null;
  const [, algorithm, version, options, salt, digest] = parts;
  if (algorithm !== 'argon2id' || version !== PHC_VERSION || !options || !salt || !digest) {
    return null;
  }

  const params: Argon2Parameters = { t: 0, m: 0, p: 0, dkLen: 0 };
  for (const pair of options.split(',')) {
    const [key, raw] = pair.split('=');
    const value = Number(raw);
    if (!key || !Number.isInteger(value) || value <= 0) return null;
    if (key === 't') params.t = value;
    else if (key === 'm') params.m = value;
    else if (key === 'p') params.p = value;
    else return null;
  }
  if (params.t === 0 || params.m === 0 || params.p === 0) return null;

  const digestBytes = decodeBase64(digest);
  params.dkLen = digestBytes.length;
  return { params, salt: decodeBase64(salt), digest: digestBytes };
}

function matchesConstantTime(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

async function derivePbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    PBKDF2_ALGORITHM,
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: PBKDF2_ALGORITHM, hash: PBKDF2_HASH, salt, iterations },
    key,
    PBKDF2_DIGEST_BYTES * 8,
  );
  return new Uint8Array(bits);
}

/** `$pbkdf2$SHA-256$<iterations>$<salt-b64url>$<digest-b64url>` */
function encodePbkdf2(salt: Uint8Array, digest: Uint8Array, iterations: number): string {
  return `${PBKDF2_PREFIX}${PBKDF2_HASH}$${iterations}$${encodeBase64(salt)}$${encodeBase64(digest)}`;
}

function decodePbkdf2(
  encoded: string,
): { salt: Uint8Array; digest: Uint8Array; iterations: number } | null {
  const parts = encoded.split('$');
  // ['', 'pbkdf2', hash, iterations, salt, digest]
  if (parts.length !== 6) return null;
  const [, algorithm, hash, rawIterations, salt, digest] = parts;
  if (algorithm !== 'pbkdf2' || hash !== PBKDF2_HASH || !salt || !digest) return null;

  const iterations = Number(rawIterations);
  if (!Number.isInteger(iterations) || iterations < 1) return null;

  const saltBytes = decodeBase64(salt);
  const digestBytes = decodeBase64(digest);
  if (saltBytes.length === 0 || digestBytes.length !== PBKDF2_DIGEST_BYTES) return null;

  return { salt: saltBytes, digest: digestBytes, iterations };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(PBKDF2_SALT_BYTES);
  const digest = await derivePbkdf2(password, salt, PBKDF2_ITERATIONS);
  return encodePbkdf2(salt, digest, PBKDF2_ITERATIONS);
}

/**
 * Verifies a password against either stored format. Returns the matched format so the login flow
 * can upgrade a legacy Argon2id row to the current one (rehash-on-login).
 */
export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<{ ok: boolean; format: 'pbkdf2' | 'argon2id' | 'unknown' }> {
  if (encoded.startsWith(PBKDF2_PREFIX)) {
    const parsed = decodePbkdf2(encoded);
    if (!parsed) return { ok: false, format: 'unknown' };
    const digest = await derivePbkdf2(password, parsed.salt, parsed.iterations);
    return { ok: matchesConstantTime(digest, parsed.digest), format: 'pbkdf2' };
  }

  const parsed = decodeArgon2id(encoded);
  if (!parsed) return { ok: false, format: 'unknown' };
  const digest = await argon2idAsync(
    new TextEncoder().encode(password),
    parsed.salt,
    parsed.params,
  );
  return { ok: matchesConstantTime(digest, parsed.digest), format: 'argon2id' };
}

/** True when a stored hash is not the current format and should be re-derived on a successful login. */
export function needsRehash(encoded: string): boolean {
  return !encoded.startsWith(PBKDF2_PREFIX);
}

export async function burnPasswordCheck(password: string): Promise<void> {
  try {
    await verifyPassword(password, DUMMY_HASH);
  } catch {
    // A malformed constant is a deploy-time defect, not a login failure path.
  }
}
