import fs from "fs";
import path from "path";
import matter from "gray-matter";

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

export interface Challenge {
  id: string;
  title: string;
  description: string;
  initialCode: string;
  hint?: string;
  difficulty?: "Easy" | "Medium" | "Hard";
  arguments?: { name: string; type: string }[];
  defaultTestCases?: {
    id: string;
    inputs: Record<string, string>;
    expected: string;
    hidden?: boolean;
  }[];
  executionSnippet?: string;
  dependencies?: string[];
  visibleTestCases?: number;
  chapterNumber?: string; // e.g., "02" from "02-tokenization"
  problemNumber?: string; // e.g., "01" from "01-pair-counter"
}

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

function getCourseManifest(collection: string): CourseManifest | null {
  const manifestPath = path.join(contentDirectory, collection, "meta.json");
  if (!fs.existsSync(manifestPath)) return null;

  try {
    const raw = fs.readFileSync(manifestPath, "utf8");
    return JSON.parse(raw) as CourseManifest;
  } catch (e) {
    console.error(`Failed to read manifest for ${collection}:`, e);
    return null;
  }
}

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
  const dirPath = path.join(collectionPath, slug);
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
    path.join(collectionPath, `${slug}.mdx`),
    path.join(collectionPath, `${slug}.md`),
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

export function getAllPosts(collection: string): Omit<PostData, "content">[] {
  const collectionPath = path.join(contentDirectory, collection);
  const manifest = getCourseManifest(collection);

  // Ensure directory exists
  if (!fs.existsSync(collectionPath)) {
    console.warn(`Collection directory not found: ${collectionPath}`);
    return [];
  }

  const entries = fs.readdirSync(collectionPath, { withFileTypes: true });
  const manifestLookup = new Map(
    (manifest?.steps ?? []).map((step) => [step.slug, step])
  );
  const uniquePosts = new Map<string, Omit<PostData, "content">>();

  // Prefer directory-based content with index.mdx/index.md
  entries
    .filter((entry) => entry.isDirectory())
    .forEach((entry) => {
      const slug = entry.name;
      const postPath = findPostFile(collectionPath, slug);
      if (!postPath) return;

      const manifestStep = manifestLookup.get(slug);
      const post = loadPostFrontmatter(
        postPath,
        slug,
        collection,
        manifestStep
      );
      uniquePosts.set(slug, post);
    });

  // Backward compatibility: loose files in the course root
  entries
    .filter(
      (entry) =>
        entry.isFile() &&
        (entry.name.endsWith(".md") || entry.name.endsWith(".mdx"))
    )
    .forEach((entry) => {
      const slug = entry.name.replace(/\.mdx?$/, "");
      if (uniquePosts.has(slug)) return;

      const manifestStep = manifestLookup.get(slug);
      const postPath = path.join(collectionPath, entry.name);
      const post = loadPostFrontmatter(
        postPath,
        slug,
        collection,
        manifestStep
      );
      uniquePosts.set(slug, post);
    });

  return sortPosts(Array.from(uniquePosts.values()), manifest);
}

export async function getPostBySlug(
  collection: string,
  slug: string
): Promise<PostData | null> {
  try {
    const collectionPath = path.join(contentDirectory, collection);

    const manifest = getCourseManifest(collection);
    const manifestStep = manifest?.steps?.find((step) => step.slug === slug);
    const postPath = findPostFile(collectionPath, slug);

    if (!postPath) {
      return null;
    }

    const fileContents = fs.readFileSync(postPath, "utf8");
    const { data, content } = matter(fileContents);

    const postMeta = loadPostFrontmatter(
      postPath,
      slug,
      collection,
      manifestStep,
      data
    );

    // Load challenges from co-located folder, else fallback to legacy path
    const coLocatedChallenges = path.join(path.dirname(postPath), "challenges");
    const legacyChallenges = path.join(
      contentDirectory,
      "challenges",
      collection,
      slug
    );
    const challengesDir = fs.existsSync(coLocatedChallenges)
      ? coLocatedChallenges
      : legacyChallenges;

    if (fs.existsSync(challengesDir)) {
      // Extract chapter number from slug (e.g., "02-tokenization" -> "02")
      const chapterMatch = slug.match(/^(\d+)/);
      const chapterNumber = chapterMatch ? chapterMatch[1] : undefined;

      const challengeBundles = fs
        .readdirSync(challengesDir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name)
        .sort(); // Sort by folder name (e.g., 01-encoder, 02-byte-inspector)

      data.challenges = challengeBundles
        .map((bundleName) => {
          const bundlePath = path.join(challengesDir, bundleName);

          // Extract problem number from bundle name (e.g., "01-pair-counter" -> "01")
          const problemMatch = bundleName.match(/^(\d+)/);
          const problemNumber = problemMatch ? problemMatch[1] : undefined;

          // Load description.md
          const descriptionPath = path.join(bundlePath, "description.md");
          if (!fs.existsSync(descriptionPath)) {
            console.warn(`Missing description.md in bundle: ${bundleName}`);
            return null;
          }
          const descriptionContent = fs.readFileSync(descriptionPath, "utf8");
          const { data: challengeData, content: challengeBody } =
            matter(descriptionContent);

          // Load tests.json
          let defaultTestCases = [];
          const testsPath = path.join(bundlePath, "tests.json");
          if (fs.existsSync(testsPath)) {
            try {
              defaultTestCases = JSON.parse(fs.readFileSync(testsPath, "utf8"));
            } catch (e) {
              console.error(
                `Failed to load tests for bundle ${bundleName}:`,
                e
              );
            }
          }

          return {
            ...challengeData,
            description: challengeBody,
            defaultTestCases,
            chapterNumber,
            problemNumber,
          } as Challenge;
        })
        .filter(Boolean) as Challenge[]; // Filter out nulls
    }

    // Return raw content for RSC rendering
    return {
      ...postMeta,
      content: content, // Raw string
      challenges: data.challenges,
    };
  } catch (e) {
    console.error(e);
    return null;
  }
}
