import { getPostBySlug, getAllPosts } from "@/lib/posts";
import { notFound } from "next/navigation";
import { StepContainer } from "@/components/StepContainer";
import { MDXRemote } from "next-mdx-remote/rsc";
import { SplitLayout } from "@/components/mdx/SplitLayout";
import { Step } from "@/components/mdx/Step";
import { Description } from "@/components/mdx/Description";
import { Action } from "@/components/mdx/Action";
import { Command } from "@/components/mdx/Command";
import { ProjectRoadmap } from "@/components/mdx/ProjectRoadmap";
import { ThinkingProcess } from "@/components/mdx/ThinkingProcess";
import remarkMath from "remark-math";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from "@/components/mdx/Table";
import { Callout } from "@/components/mdx/Callout";
import { ByteStream } from "@/components/mdx/ByteStream";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import rehypePrettyCode from "rehype-pretty-code";

const components = {
  SplitLayout,
  Step,
  Description,
  Action,
  Command,
  ProjectRoadmap,
  ThinkingProcess,
  Callout,
  ByteStream,
  table: Table,
  thead: TableHead,
  tbody: TableBody,
  tr: TableRow,
  th: TableHeader,
  td: TableCell,
};

export async function generateStaticParams() {
  // TODO: Dynamically list collections or hardcode known ones
  const collections = ["nanochat", "transformers", "build-chatgpt"];

  let params: { courseId: string; slug: string }[] = [];

  for (const courseId of collections) {
    const posts = getAllPosts(courseId);
    params = params.concat(
      posts.map((post) => ({
        courseId,
        slug: post.slug,
      }))
    );
  }

  return params;
}

export default async function StepPage({
  params,
}: {
  params: Promise<{ courseId: string; slug: string }>;
}) {
  const { courseId, slug } = await params;
  const post = await getPostBySlug(courseId, slug);
  const allPosts = getAllPosts(courseId);

  if (!post) {
    notFound();
  }

  const currentIndex = allPosts.findIndex((p) => p.slug === post.slug);
  const prevPost = currentIndex > 0 ? allPosts[currentIndex - 1] : null;
  const nextPost =
    currentIndex < allPosts.length - 1 ? allPosts[currentIndex + 1] : null;

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
            remarkPlugins: [remarkGfm, remarkMath],
            rehypePlugins: [
              rehypeKatex,
              [
                rehypePrettyCode,
                {
                  theme: "github-dark",
                  keepBackground: true,
                },
              ],
            ],
          },
        }}
      />
    </StepContainer>
  );
}
