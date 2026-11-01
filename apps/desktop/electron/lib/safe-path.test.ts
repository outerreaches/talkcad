import { describe, expect, it } from 'vitest';
import { assertUuid, normalizeRelativePath, resolveWithin, sanitizePathSegment } from './safe-path';

describe('safe-path', () => {
  it('rejects traversal in resolveWithin', () => {
    expect(() => resolveWithin('/tmp/base', '../etc/passwd')).toThrow('Invalid path');
    expect(() => resolveWithin('/tmp/base', 'a/../../b')).toThrow('Invalid path');
  });

  it('resolves a path inside the base', () => {
    expect(resolveWithin('/tmp/base', 'assets', 'image.png')).toBe('/tmp/base/assets/image.png');
  });

  it('normalises separators and strips leading slashes', () => {
    expect(normalizeRelativePath('\\a\\b/c')).toBe('a/b/c');
    expect(normalizeRelativePath('/absolute')).toBe('absolute');
    expect(() => normalizeRelativePath('a\0b')).toThrow('Invalid path');
  });

  it('validates UUIDs', () => {
    expect(assertUuid('123e4567-e89b-42d3-a456-426614174000')).toBe('123e4567-e89b-42d3-a456-426614174000');
    expect(() => assertUuid('../../etc')).toThrow('Invalid id');
  });

  it('sanitises path segments', () => {
    expect(sanitizePathSegment('My File!.png')).toBe('My-File-png');
    expect(sanitizePathSegment('..')).toBe('default');
    expect(sanitizePathSegment('a/b')).toBe('a');
  });
});
