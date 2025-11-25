import fs from "fs";
import path from "path";
import matter from "gray-matter";

const contentDirectory = path.join(process.cwd(), "content");

export interface Challenge {
  id: string;
  title: string;
  description: string;
  initialCode: string;
  hint?: string;
  difficulty?: "Easy" | "Medium" | "Hard";
  arguments?: { name: string; type: string }[];
  defaultTestCases?: { id: string; inputs: Record<string, string>; expected: string; hidden?: boolean }[];
  executionSnippet?: string;
  dependencies?: string[];
  visibleTestCases?: number;
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

export function getAllPosts(collection: string): Omit<PostData, "content">[] {
  const collectionPath = path.join(contentDirectory, collection);

  // Ensure directory exists
  if (!fs.existsSync(collectionPath)) {
    console.warn(`Collection directory not found: ${collectionPath}`);
    return [];
  }

  const fileNames = fs.readdirSync(collectionPath);
  
  // Whitelist of valid slugs per collection could be defined here or passed in.
  // For now, we'll just read all valid .md/.mdx files in the folder.
  
  const allPostsData = fileNames
    .filter((fileName) => fileName.endsWith(".md") || fileName.endsWith(".mdx"))
    .map((fileName) => {
      const slug = fileName.replace(/\.mdx?$/, "");
      const fullPath = path.join(collectionPath, fileName);
      const fileContents = fs.readFileSync(fullPath, "utf8");
      const { data } = matter(fileContents);

      return {
        slug,
        title: data.title,
        step: data.step,
        description: data.description,
        challenge: data.challenge,
        challenges: data.challenges,
        collection,
        hidden: data.hidden,
      };
    });

  // Deduplicate posts by slug, preferring MDX
  const uniquePosts = new Map<string, Omit<PostData, "content">>();
  
  allPostsData.forEach(post => {
    if (!uniquePosts.has(post.slug)) {
      uniquePosts.set(post.slug, post);
    }
  });

  // Sort posts by step
  return Array.from(uniquePosts.values()).sort((a, b) => (a.step > b.step ? 1 : -1));
}

export async function getPostBySlug(collection: string, slug: string): Promise<PostData | null> {
  try {
    const collectionPath = path.join(contentDirectory, collection);
    
    // Check for .mdx first, then .md
    let fullPath = path.join(collectionPath, `${slug}.mdx`);
    if (!fs.existsSync(fullPath)) {
      fullPath = path.join(collectionPath, `${slug}.md`);
    }
    
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    
    const fileContents = fs.readFileSync(fullPath, "utf8");
    const { data, content } = matter(fileContents);
    
    // Load challenges from directory
    const challengesDir = path.join(contentDirectory, "challenges", collection, slug);
    if (fs.existsSync(challengesDir)) {
      const challengeBundles = fs.readdirSync(challengesDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .sort(); // Sort by folder name (e.g., 01-encoder, 02-byte-inspector)

      data.challenges = challengeBundles.map(bundleName => {
        const bundlePath = path.join(challengesDir, bundleName);
        
        // Load description.md
        const descriptionPath = path.join(bundlePath, "description.md");
        if (!fs.existsSync(descriptionPath)) {
            console.warn(`Missing description.md in bundle: ${bundleName}`);
            return null;
        }
        const descriptionContent = fs.readFileSync(descriptionPath, "utf8");
        const { data: challengeData, content: challengeBody } = matter(descriptionContent);

        // Load tests.json
        let defaultTestCases = [];
        const testsPath = path.join(bundlePath, "tests.json");
        if (fs.existsSync(testsPath)) {
          try {
            defaultTestCases = JSON.parse(fs.readFileSync(testsPath, "utf8"));
          } catch (e) {
            console.error(`Failed to load tests for bundle ${bundleName}:`, e);
          }
        }

        return {
          ...challengeData,
          description: challengeBody,
          defaultTestCases
        } as Challenge;
      }).filter(Boolean) as Challenge[]; // Filter out nulls
    } else if (data.challenges) {
      // Legacy fallback: Load external test cases for existing frontmatter challenges
      data.challenges = data.challenges.map((challenge: Challenge) => {
        const testFilePath = path.join(contentDirectory, "tests", `${challenge.id}.json`);
        if (fs.existsSync(testFilePath)) {
          try {
            const testContent = fs.readFileSync(testFilePath, "utf8");
            const testCases = JSON.parse(testContent);
            return { ...challenge, defaultTestCases: testCases };
          } catch (e) {
            console.error(`Failed to load tests for challenge ${challenge.id}:`, e);
          }
        }
        return challenge;
      });
    }

    // Return raw content for RSC rendering
    return {
      slug,
      title: data.title,
      step: data.step,
      description: data.description,
      content: content, // Raw string
      challenge: data.challenge,
      challenges: data.challenges,
      collection,
    };
  } catch (e) {
    console.error(e);
    return null;
  }
}
