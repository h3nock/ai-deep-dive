import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { serialize } from "next-mdx-remote/serialize";

const contentDirectory = path.join(process.cwd(), "content");

export interface PostData {
  slug: string;
  title: string;
  step: number;
  description: string;
  content: any; // Serialized MDX
  challenge?: string;
}

export function getAllPosts(): Omit<PostData, "content">[] {
  // Ensure directory exists
  if (!fs.existsSync(contentDirectory)) {
    return [];
  }

  const fileNames = fs.readdirSync(contentDirectory);
  // Whitelist of the new Speedrun steps
  const validSlugs = new Set([
    "01-environment",
    "02-data-prep",
    "03-tokenizer",
    "04-architecture",
    "05-pretraining",
    "06-midtraining",
    "07-sft",
    "08-rl"
  ]);

  const allPostsData = fileNames
    .filter((fileName) => {
      const slug = fileName.replace(/\.mdx?$/, ""); // Support .md and .mdx
      return (fileName.endsWith(".md") || fileName.endsWith(".mdx")) && validSlugs.has(slug);
    })
    .map((fileName) => {
      const slug = fileName.replace(/\.mdx?$/, "");
      const fullPath = path.join(contentDirectory, fileName);
      const fileContents = fs.readFileSync(fullPath, "utf8");
      const { data } = matter(fileContents);

      return {
        slug,
        title: data.title,
        step: data.step,
        description: data.description,
        challenge: data.challenge,
      };
    });

  // Deduplicate posts by slug, preferring MDX
  const uniquePosts = new Map<string, PostData>();
  
  allPostsData.forEach(post => {
    // If strictly preferring MDX, we might need to check the source file extension.
    // But since we just have the data here, we can rely on the fact that we want *one* entry per slug.
    // If we process them in order, we can just overwrite.
    // However, the previous map didn't preserve file extension info.
    // Let's just use the slug as key.
    if (!uniquePosts.has(post.slug)) {
      uniquePosts.set(post.slug, post as PostData);
    }
  });

  // Sort posts by step
  return Array.from(uniquePosts.values()).sort((a, b) => (a.step > b.step ? 1 : -1));
}

export async function getPostBySlug(slug: string): Promise<PostData | null> {
  try {
    // Check for .mdx first, then .md
    let fullPath = path.join(contentDirectory, `${slug}.mdx`);
    if (!fs.existsSync(fullPath)) {
      fullPath = path.join(contentDirectory, `${slug}.md`);
    }
    
    const fileContents = fs.readFileSync(fullPath, "utf8");
    const { data, content } = matter(fileContents);
    
    // Return raw content for RSC rendering
    return {
      slug,
      title: data.title,
      step: data.step,
      description: data.description,
      content: content, // Raw string
      challenge: data.challenge,
    };
  } catch (e) {
    console.error(e);
    return null;
  }
}
