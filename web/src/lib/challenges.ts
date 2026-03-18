import "server-only";

import fs from "fs";
import path from "path";
import { isSafePathSegment } from "./path-safety";

const contentDir = path.join(process.cwd(), "content");

/**
 * Returns challenge IDs for a given course chapter slug by scanning
 * the filesystem for challenge bundles in co-located or legacy paths.
 *
 * Each ID follows the format `{chapterNumber}-{problemNumber}`.
 */
export function getChallengeIdsForSlug(
  courseId: string,
  slug: string
): string[] {
  if (!isSafePathSegment(slug) || !isSafePathSegment(courseId)) return [];

  const chapterMatch = slug.match(/^(\d+)/);
  const chapterNumber = chapterMatch ? chapterMatch[1] : undefined;

  const coLocatedChallenges = path.join(contentDir, courseId, slug, "challenges");
  const legacyChallenges = path.join(contentDir, "challenges", courseId, slug);
  const challengesDir = fs.existsSync(coLocatedChallenges)
    ? coLocatedChallenges
    : legacyChallenges;

  if (!fs.existsSync(challengesDir)) return [];

  const challengeBundles = fs
    .readdirSync(challengesDir, { withFileTypes: true })
    .filter(
      (dirent) => dirent.isDirectory() && isSafePathSegment(dirent.name)
    )
    .map((dirent) => dirent.name)
    .sort();

  return challengeBundles.map((bundleName) => {
    const problemMatch = bundleName.match(/^(\d+)/);
    const problemNumber = problemMatch ? problemMatch[1] : undefined;
    return chapterNumber && problemNumber
      ? `${chapterNumber}-${problemNumber}`
      : bundleName;
  });
}
