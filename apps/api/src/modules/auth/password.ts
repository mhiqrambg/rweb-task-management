import { argon2idAsync } from '@noble/hashes/argon2.js';
import { randomBytes } from '../../lib/ids';

/**
 * NFR-SEC-001 parameters, unchanged: Argon2id, m=19456 KiB, t=2, p=1, 32-byte digest.
 *
 * The implementation is pure TypeScript (`@noble/hashes`) rather than a Wasm build because
 * Workers refuses runtime Wasm compilation ("Wasm code generation disallowed by embedder");
 * only statically imported modules may be instantiated. Same RFC 9106 output, ~140 ms CPU.
 */
export const ARGON2_PARAMS = {
  t: 2,
  m: 19456,
  p: 1,
  dkLen: 32,
} as const;

const PHC_VERSION = 'v=19';

/** A real Argon2id hash of a value nobody knows, for the unknown-email timing path (T-02). */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$AQIDBAUGBwgJCgsMDQ4PEA$JL4ClzSclDe7qcU25QC3ep6iQ0Uyk5/CterE5b3yOQQ';

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

export function encodeArgon2id(
  salt: Uint8Array,
  digest: Uint8Array,
  params: Argon2Parameters,
): string {
  return `$argon2id$${PHC_VERSION}$m=${params.m},t=${params.t},p=${params.p}$${encodeBase64(salt)}$${encodeBase64(digest)}`;
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

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const digest = await argon2idAsync(new TextEncoder().encode(password), salt, ARGON2_PARAMS);
  return encodeArgon2id(salt, digest, ARGON2_PARAMS);
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parsed = decodeArgon2id(encoded);
  if (!parsed) return false;
  const digest = await argon2idAsync(
    new TextEncoder().encode(password),
    parsed.salt,
    parsed.params,
  );
  return matchesConstantTime(digest, parsed.digest);
}

export async function burnPasswordCheck(password: string): Promise<void> {
  try {
    await verifyPassword(password, DUMMY_HASH);
  } catch {
    // A malformed constant is a deploy-time defect, not a login failure path.
  }
}
