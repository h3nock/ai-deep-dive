import { getPostBySlug, getAllPosts } from "@/lib/posts";
import { notFound } from "next/navigation";
import { StepContainer } from "@/components/StepContainer";
import { MDXRemote } from "next-mdx-remote/rsc";
import { SplitLayout } from "@/components/mdx/SplitLayout";
import { Step } from "@/components/mdx/Step";
import { Description } from "@/components/mdx/Description";
import { Action } from "@/components/mdx/Action";
import { Command } from "@/components/mdx/Command";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

const components = {
  SplitLayout,
  Step,
  Description,
  Action,
  Command,
};

export async function generateStaticParams() {
  // TODO: Dynamically list collections or hardcode known ones
  const collections = ["nanochat", "transformers"];
  
  let params: { courseId: string; slug: string }[] = [];
  
  for (const courseId of collections) {
    const posts = getAllPosts(courseId);
    params = params.concat(posts.map((post) => ({
      courseId,
      slug: post.slug,
    })));
  }
  
  return params;
}

export default async function StepPage({ params }: { params: Promise<{ courseId: string; slug: string }> }) {
  const { courseId, slug } = await params;
  const post = await getPostBySlug(courseId, slug);
  const allPosts = getAllPosts(courseId);

  if (!post) {
    notFound();
  }

  const currentIndex = allPosts.findIndex((p) => p.slug === post.slug);
  const prevPost = currentIndex > 0 ? allPosts[currentIndex - 1] : null;
  const nextPost = currentIndex < allPosts.length - 1 ? allPosts[currentIndex + 1] : null;

  return (
    <StepContainer 
      post={post} 
      prevPost={prevPost} 
      nextPost={nextPost}
      collection={courseId}
    >
      <MDXRemote 
        source={post.content} 
        components={components}
        options={{
          mdxOptions: {
            remarkPlugins: [remarkMath],
            rehypePlugins: [rehypeKatex],
          }
        }}
      />
    </StepContainer>
  );
}
