import { getPostBySlug, getAllPosts } from "@/lib/posts";
import { notFound } from "next/navigation";
import { StepContainer } from "@/components/StepContainer";
import { MDXRemote } from "next-mdx-remote/rsc";
import { SplitLayout } from "@/components/mdx/SplitLayout";
import { Step } from "@/components/mdx/Step";
import { Description } from "@/components/mdx/Description";
import { Action } from "@/components/mdx/Action";
import { Command } from "@/components/mdx/Command";

const components = {
  SplitLayout,
  Step,
  Description,
  Action,
  Command,
};

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export default async function StepPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  const allPosts = getAllPosts();

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
    >
      <MDXRemote source={post.content} components={components} />
    </StepContainer>
  );
}
