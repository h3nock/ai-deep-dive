const SAFE_SEGMENT_REGEX = /^[a-zA-Z0-9._-]+$/;

export function isSafePathSegment(segment: string): boolean {
  if (!segment) return false;
  if (segment.includes("..")) return false;
  if (segment.includes("/") || segment.includes("\\")) return false;
  return SAFE_SEGMENT_REGEX.test(segment);
}

export function sanitizePathSegment(segment: string): string | null {
  return isSafePathSegment(segment) ? segment : null;
}
