import { imageSize } from 'image-size';
import type { Mime } from '@taskapp/contracts';

/**
 * Upload gate 1 (sniff) and gate 2 (decode) of `.planning/06` §8.3, with the one substitution the
 * runtime forces — see `docs/` and deviation D-15.
 *
 * The blueprint names `@jsquash` (Wasm) for the decode. This Workers runtime refuses to compile any
 * Wasm module at all:
 *
 *     CompileError: WebAssembly.Module(): Wasm code generation disallowed by embedder
 *
 * verified against an 8-byte empty module, so it is a property of the embedder and not of the
 * codec. Without Wasm there is no decode-and-re-encode path, so the checks that a decode provided
 * are carried by the strongest available pure-JS equivalent:
 *
 * - gate 1 (content, not filename): magic-byte signatures, in this module, never `file.type`.
 * - gate 2 (integrity): `image-size` walks the real frame headers, so a truncated or forged file
 *   whose declared dimensions cannot be parsed is rejected. A polyglot that parses as a valid image
 *   and as something else is refused by the MIME allowlist and by `nosniff` on the response.
 * - pixel-bomb defence (A-26): declared dimensions are read before anything is stored, and a file
 *   declaring more than MAX_PIXELS or an edge over MAX_EDGE is refused.
 *
 * The consequence for thumbnails is recorded as D-15: no re-encoding is possible here, so both
 * variants serve the stored original bytes. The `variant` parameter still selects the cache key and
 * the `Content-Type`, so the contract's addressing and headers hold.
 */

/** `.planning/06` §8.2: 5 MiB per file, 10 per target. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_TARGET = 10;

/** 07 §5.3 gate 2 pre-check (A-26): refuse a declared pixel bomb before storing anything. */
export const MAX_PIXELS = 40_000_000;
export const MAX_EDGE = 12_000;

const EXTENSION: Record<Mime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** File extension for a stored key. The MIME comes from the sniff, never from the client. */
export function extensionFor(mime: Mime): string {
  return EXTENSION[mime];
}

export type SniffResult =
  | { ok: true; mime: Mime; width: number; height: number }
  | { ok: false; reason: 'empty' | 'unsupported' | 'undecodable' | 'too_large' };

/**
 * Signature check. Deliberately not `file.type`: a client-declared type is advisory, and the whole
 * point of gate 1 is that a renamed `.txt` or an `.svg` is judged on its bytes.
 *
 * JPEG: `FF D8 FF`, then a frame header for dimensions.
 * PNG:  `89 50 4E 47 0D 0A 1A 0A`.
 * WebP: `RIFF` + size + `WEBP`.
 */
function sniffMime(bytes: Uint8Array): Mime | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

/**
 * Validates one uploaded file end to end. Returns the sniffed MIME plus the declared dimensions, or
 * the reason the file must be reported as rejected — the caller turns that into a `details[]` entry
 * naming the file (06 §8.4).
 */
export function inspectImage(bytes: Uint8Array): SniffResult {
  if (bytes.length === 0) return { ok: false, reason: 'empty' };
  if (bytes.length > MAX_FILE_BYTES) return { ok: false, reason: 'too_large' };

  const mime = sniffMime(bytes);
  if (!mime) return { ok: false, reason: 'unsupported' };

  let dimensions: { width?: number; height?: number };
  try {
    dimensions = imageSize(bytes);
  } catch {
    // The bytes claim an image but no frame header parses: truncated, forged, or not really an image.
    return { ok: false, reason: 'undecodable' };
  }

  const { width, height } = dimensions;
  if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) {
    return { ok: false, reason: 'undecodable' };
  }
  if (width > MAX_EDGE || height > MAX_EDGE || width * height > MAX_PIXELS) {
    return { ok: false, reason: 'undecodable' };
  }

  return { ok: true, mime, width, height };
}

/**
 * `details[].file` (D-9): a basename only. Path separators, control characters and length are all
 * bounded here, so a client filename can never reach a header, a path or a log line as-is.
 */
export function safeBasename(name: string, maxLength = 100): string {
  const withoutPath = name.split(/[\\/]/u).pop() ?? '';
  const cleaned = withoutPath.replace(/[\u0000-\u001f\u007f]/gu, '').trim();
  const clipped = cleaned.slice(0, maxLength);
  return clipped.length > 0 ? clipped : 'file';
}