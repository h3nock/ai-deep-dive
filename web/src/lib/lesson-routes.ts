function encodeSegment(value: string): string {
  return encodeURIComponent(value);
}

export function lessonGuidePath(courseId: string, slug: string): string {
  return `/${encodeSegment(courseId)}/${encodeSegment(slug)}`;
}

export function lessonChallengesPath(courseId: string, slug: string): string {
  return `${lessonGuidePath(courseId, slug)}/challenges`;
}

export function lessonChallengePath(
  courseId: string,
  slug: string,
  challengeId: string
): string {
  return `${lessonChallengesPath(courseId, slug)}/${encodeSegment(challengeId)}`;
}
