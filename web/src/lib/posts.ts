import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { cache } from "react";
import { isSafePathSegment, sanitizePathSegment } from "./path-safety";
import type { Challenge } from "./challenge-types";
export type { Challenge } from "./challenge-types";

const contentDirectory = path.join(process.cwd(), "content");

type StepMeta = {
  slug: string;
  step?: number;
  title?: string;
  description?: string;
  hidden?: boolean;
};

type CourseManifest = {
  steps?: StepMeta[];
};

export interface PostData {
  slug: string;
  title: string;
  step: number;
  description: string;
  content: any; // Serialized MDX or raw string
  challenge?: string; // Legacy
  challenges?: Challenge[]; // New list
  collection: string;
  hidden?: boolean;
}

function deriveStepFromSlug(slug: string): number | undefined {
  const match = slug.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : undefined;
}

export const listCollections = cache((): string[] => {
  if (!fs.existsSync(contentDirectory)) {
    return [];
  }

  return fs
    .readdirSync(contentDirectory, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name !== "challenges" &&
        !entry.name.startsWith(".") &&
        isSafePathSegment(entry.name)
    )
    .map((entry) => entry.name);
});

const getCourseManifest = cache((collection: string): CourseManifest | null => {
  const safeCollection = sanitizePathSegment(collection);
  if (!safeCollection) return null;

  const manifestPath = path.join(contentDirectory, safeCollection, "meta.json");
  if (!fs.existsSync(manifestPath)) return null;

  try {
    const raw = fs.readFileSync(manifestPath, "utf8");
    return JSON.parse(raw) as CourseManifest;
  } catch (e) {
    console.error(`Failed to read manifest for ${collection}:`, e);
    return null;
  }
});

function loadPostFrontmatter(
  filePath: string,
  slug: string,
  collection: string,
  manifestStep?: StepMeta,
  frontmatterData?: Record<string, any>
): Omit<PostData, "content"> {
  const data =
    frontmatterData ?? matter(fs.readFileSync(filePath, "utf8")).data;

  const stepCandidate =
    data.step ?? manifestStep?.step ?? deriveStepFromSlug(slug);
  const numericStep =
    typeof stepCandidate === "string"
      ? parseFloat(stepCandidate)
      : stepCandidate;
  const step = Number.isFinite(numericStep) ? numericStep : 0;

  return {
    slug,
    title: data.title ?? manifestStep?.title ?? slug,
    step,
    description: data.description ?? manifestStep?.description ?? "",
    challenge: data.challenge,
    challenges: data.challenges,
    collection,
    hidden: data.hidden ?? manifestStep?.hidden,
  };
}

function findPostFile(collectionPath: string, slug: string): string | null {
  const safeSlug = sanitizePathSegment(slug);
  if (!safeSlug) return null;

  const dirPath = path.join(collectionPath, safeSlug);
  const dirCandidates = [
    path.join(dirPath, "index.mdx"),
    path.join(dirPath, "index.md"),
  ];

  for (const candidate of dirCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const fileCandidates = [
    path.join(collectionPath, `${safeSlug}.mdx`),
    path.join(collectionPath, `${safeSlug}.md`),
  ];

  for (const candidate of fileCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function sortPosts(
  posts: Omit<PostData, "content">[],
  manifest: CourseManifest | null
) {
  if (manifest?.steps && manifest.steps.length > 0) {
    const manifestOrder = new Map(
      manifest.steps.map((step, index) => [step.slug, index])
    );

    return posts.slice().sort((a, b) => {
      const orderA = manifestOrder.get(a.slug);
      const orderB = manifestOrder.get(b.slug);

      if (orderA !== undefined && orderB !== undefined) {
        return orderA - orderB;
      }
      if (orderA !== undefined) return -1;
      if (orderB !== undefined) return 1;

      if (a.step === b.step) return a.slug.localeCompare(b.slug);
      return a.step > b.step ? 1 : -1;
    });
  }

  return posts.slice().sort((a, b) => {
    if (a.step === b.step) return a.slug.localeCompare(b.slug);
    return a.step > b.step ? 1 : -1;
  });
}

const getAllPostsUncached = (
  collection: string
): Omit<PostData, "content">[] => {
  const safeCollection = sanitizePathSegment(collection);
  if (!safeCollection) {
    console.warn(`Invalid collection name: ${collection}`);
    return [];
  }

  const collectionPath = path.join(contentDirectory, safeCollection);
  const manifest = getCourseManifest(safeCollection);

  if (!fs.existsSync(collectionPath)) {
    console.warn(`Collection directory not found: ${collectionPath}`);
    return [];
  }

  const entries = fs.readdirSync(collectionPath, { withFileTypes: true });
  const manifestLookup = new Map(
    (manifest?.steps ?? []).map((step) => [step.slug, step])
  );
  const uniquePosts = new Map<string, Omit<PostData, "content">>();

  entries
    .filter((entry) => entry.isDirectory() && isSafePathSegment(entry.name))
    .forEach((entry) => {
      const slug = entry.name;
      const postPath = findPostFile(collectionPath, slug);
      if (!postPath) return;

      const manifestStep = manifestLookup.get(slug);
      const post = loadPostFrontmatter(
        postPath,
        slug,
        safeCollection,
        manifestStep
      );
      uniquePosts.set(slug, post);
    });

  entries
    .filter(
      (entry) =>
        entry.isFile() &&
        (entry.name.endsWith(".md") || entry.name.endsWith(".mdx")) &&
        isSafePathSegment(entry.name.replace(/\.mdx?$/, ""))
    )
    .forEach((entry) => {
      const slug = entry.name.replace(/\.mdx?$/, "");
      if (uniquePosts.has(slug)) return;

      const manifestStep = manifestLookup.get(slug);
      const postPath = path.join(collectionPath, entry.name);
      const post = loadPostFrontmatter(
        postPath,
        slug,
        safeCollection,
        manifestStep
      );
      uniquePosts.set(slug, post);
    });

  return sortPosts(Array.from(uniquePosts.values()), manifest);
};

export const getAllPosts = cache(getAllPostsUncached);

export const getPostBySlug = cache(
  async (collection: string, slug: string): Promise<PostData | null> => {
    const safeCollection = sanitizePathSegment(collection);
    const safeSlug = sanitizePathSegment(slug);

    if (!safeCollection || !safeSlug) {
      console.warn(
        `Invalid collection/slug combination: ${collection}/${slug}`
      );
      return null;
    }

    try {
      const collectionPath = path.join(contentDirectory, safeCollection);

      const manifest = getCourseManifest(safeCollection);
      const manifestStep = manifest?.steps?.find(
        (step) => step.slug === safeSlug
      );
      const postPath = findPostFile(collectionPath, safeSlug);

      if (!postPath) {
        return null;
      }

      const fileContents = fs.readFileSync(postPath, "utf8");
      const { data, content } = matter(fileContents);

      const postMeta = loadPostFrontmatter(
        postPath,
        safeSlug,
        safeCollection,
        manifestStep,
        data
      );

      const coLocatedChallenges = path.join(
        path.dirname(postPath),
        "challenges"
      );
      const legacyChallenges = path.join(
        contentDirectory,
        "challenges",
        safeCollection,
        safeSlug
      );
      const challengesDir = fs.existsSync(coLocatedChallenges)
        ? coLocatedChallenges
        : legacyChallenges;

      if (fs.existsSync(challengesDir)) {
        const chapterMatch = safeSlug.match(/^(\d+)/);
        const chapterNumber = chapterMatch ? chapterMatch[1] : undefined;

        const challengeBundles = fs
          .readdirSync(challengesDir, { withFileTypes: true })
          .filter(
            (dirent) => dirent.isDirectory() && isSafePathSegment(dirent.name)
          )
          .map((dirent) => dirent.name)
          .sort();

        data.challenges = challengeBundles
          .map((bundleName) => {
            const bundlePath = path.join(challengesDir, bundleName);

            const problemMatch = bundleName.match(/^(\d+)/);
            const problemNumber = problemMatch ? problemMatch[1] : undefined;

            const autoId =
              chapterNumber && problemNumber
                ? `${chapterNumber}-${problemNumber}`
                : bundleName;

            const descriptionPath = path.join(bundlePath, "description.md");
            if (!fs.existsSync(descriptionPath)) {
              console.warn(`Missing description.md in bundle: ${bundleName}`);
              return null;
            }
            const descriptionContent = fs.readFileSync(descriptionPath, "utf8");
            const { data: challengeData, content: challengeBody } =
              matter(descriptionContent);

            if (!challengeData.problemId) {
              throw new Error(
                `Missing problemId in ${path.relative(contentDirectory, descriptionPath)}`
              );
            }

            return {
              ...challengeData,
              id: autoId,
              description: challengeBody,
              chapterNumber,
              problemNumber,
            } as Challenge;
          })
          .filter(Boolean) as Challenge[];
      }

      return {
        ...postMeta,
        content,
        challenges: data.challenges,
      };
    } catch (e) {
      console.error(e);
      return null;
    }
  }
);
