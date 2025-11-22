import fs from "fs";
import path from "path";
import matter from "gray-matter";

const contentDirectory = path.join(process.cwd(), "content");

export interface PostData {
  slug: string;
  title: string;
  step: number;
  description: string;
  content: any; // Serialized MDX or raw string
  challenge?: string;
  collection: string;
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
        collection,
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
    
    // Return raw content for RSC rendering
    return {
      slug,
      title: data.title,
      step: data.step,
      description: data.description,
      content: content, // Raw string
      challenge: data.challenge,
      collection,
    };
  } catch (e) {
    console.error(e);
    return null;
  }
}
