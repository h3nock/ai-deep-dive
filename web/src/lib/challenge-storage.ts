export const CHALLENGE_PROGRESS_EVENT = "challenge-progress-changed";

export type ChallengeProgressEventDetail = {
  courseId?: string;
  challengeId?: string;
  challengeIds?: string[];
};

const statusValueCache = new Map<string, string | null>();
const codeValueCache = new Map<string, string | null>();

function statusKey(courseId: string, challengeId: string) {
  return `challenge:${courseId}:${challengeId}:status`;
}

function codeKey(courseId: string, challengeId: string) {
  return `challenge:${courseId}:${challengeId}:code`;
}

function legacyStatusKey(challengeId: string) {
  return `sol_${challengeId}_status`;
}

function legacyCodeKey(challengeId: string) {
  return `sol_${challengeId}_code`;
}

export function clearChallengeStorageCache(): void {
  statusValueCache.clear();
  codeValueCache.clear();
}

function safeGetItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.error("Failed to write localStorage:", error);
  }
}

function safeRemoveItem(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function migrateLegacyKeys(courseId: string, challengeId: string): void {
  const newStatusKey = statusKey(courseId, challengeId);
  const newCodeKey = codeKey(courseId, challengeId);
  const oldStatusKey = legacyStatusKey(challengeId);
  const oldCodeKey = legacyCodeKey(challengeId);

  const hasNewStatus = safeGetItem(newStatusKey) !== null;
  const hasNewCode = safeGetItem(newCodeKey) !== null;

  if (!hasNewStatus) {
    const legacyStatus = safeGetItem(oldStatusKey);
    if (legacyStatus !== null) {
      safeSetItem(newStatusKey, legacyStatus);
      statusValueCache.set(newStatusKey, legacyStatus);
      safeRemoveItem(oldStatusKey);
    }
  }

  if (!hasNewCode) {
    const legacyCode = safeGetItem(oldCodeKey);
    if (legacyCode !== null) {
      safeSetItem(newCodeKey, legacyCode);
      codeValueCache.set(newCodeKey, legacyCode);
      safeRemoveItem(oldCodeKey);
    }
  }
}

export function emitChallengeProgressChanged(
  detail: ChallengeProgressEventDetail
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CHALLENGE_PROGRESS_EVENT, { detail })
  );
}

export function getChallengeStatusValue(
  courseId: string,
  challengeId: string
): string | null {
  const key = statusKey(courseId, challengeId);
  if (statusValueCache.has(key)) {
    return statusValueCache.get(key) ?? null;
  }

  migrateLegacyKeys(courseId, challengeId);
  const value = safeGetItem(key);
  statusValueCache.set(key, value);
  return value;
}

export function isChallengeSolved(courseId: string, challengeId: string): boolean {
  return getChallengeStatusValue(courseId, challengeId) === "solved";
}

export function getChallengeCode(
  courseId: string,
  challengeId: string
): string | null {
  const key = codeKey(courseId, challengeId);
  if (codeValueCache.has(key)) {
    return codeValueCache.get(key) ?? null;
  }

  migrateLegacyKeys(courseId, challengeId);
  const value = safeGetItem(key);
  codeValueCache.set(key, value);
  return value;
}

export function setChallengeCode(
  courseId: string,
  challengeId: string,
  code: string
): void {
  const key = codeKey(courseId, challengeId);
  safeSetItem(key, code);
  codeValueCache.set(key, code);
  safeRemoveItem(legacyCodeKey(challengeId));
}

export function removeChallengeCode(courseId: string, challengeId: string): void {
  const key = codeKey(courseId, challengeId);
  safeRemoveItem(key);
  codeValueCache.delete(key);
}

export function markChallengeSolved(courseId: string, challengeId: string): void {
  const key = statusKey(courseId, challengeId);
  safeSetItem(key, "solved");
  statusValueCache.set(key, "solved");
  safeRemoveItem(legacyStatusKey(challengeId));
  emitChallengeProgressChanged({ courseId, challengeId });
}

export function markChallengesSolved(
  courseId: string,
  challengeIds: string[]
): void {
  if (challengeIds.length === 0) return;

  const uniqueIds = Array.from(new Set(challengeIds));
  for (const challengeId of uniqueIds) {
    const key = statusKey(courseId, challengeId);
    safeSetItem(key, "solved");
    statusValueCache.set(key, "solved");
    safeRemoveItem(legacyStatusKey(challengeId));
  }
  emitChallengeProgressChanged({ courseId, challengeIds: uniqueIds });
}
