import path from 'path';

// UUID (v1-v5) pattern; our sessions are v4 but accept any UUID-like.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertUuid(id: string, label = 'id'): string {
  const value = (id || '').trim();
  if (!UUID_RE.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

export function normalizeRelativePath(p: string): string {
  // Make user-supplied paths platform-agnostic and ensure they stay relative.
  // - Convert backslashes to forward slashes
  // - Strip leading slashes
  // - Disallow null bytes
  const raw = String(p || '');
  if (raw.includes('\0')) throw new Error('Invalid path');
  return raw.replace(/\\/g, '/').replace(/^\/+/, '');
}

/**
 * Resolve a path under a base directory, rejecting path traversal.
 *
 * Important: This uses path.resolve + path.relative (not string startsWith),
 * so inputs like "assets/../secrets" are rejected correctly.
 */
export function resolveWithin(baseDir: string, ...parts: string[]): string {
  const base = path.resolve(baseDir);
  const target = path.resolve(baseDir, ...parts.map(normalizeRelativePath));
  const rel = path.relative(base, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Invalid path');
  }
  return target;
}

export function sanitizePathSegment(seg: string, fallback = 'default'): string {
  const cleaned = String(seg || '')
    .trim()
    .replace(/\\/g, '/')
    .split('/')[0] // only one segment
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '');

  if (!cleaned || cleaned === '.' || cleaned === '..') return fallback;
  return cleaned;
}

