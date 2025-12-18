import fs from "fs";
import path from "path";
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
import { ComingSoon } from "@/components/mdx/ComingSoon";
import { ProcessTimeline } from "@/components/mdx/ProcessTimeline";
import dynamic from "next/dynamic";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import rehypePrettyCode from "rehype-pretty-code";

// Lazy load heavy interactive components
const FrequencyWaves = dynamic(() =>
  import("@/components/mdx/FrequencyWaves").then((mod) => mod.FrequencyWaves)
);
const BinaryVsSmooth = dynamic(() =>
  import("@/components/mdx/BinaryVsSmooth").then((mod) => mod.BinaryVsSmooth)
);
const RotationVisualization = dynamic(() =>
  import("@/components/mdx/RotationVisualization").then(
    (mod) => mod.RotationVisualization
  )
);
const EmbeddingSpace = dynamic(() =>
  import("@/components/mdx/EmbeddingSpace").then((mod) => mod.EmbeddingSpace)
);
const LiveByteInspector = dynamic(() =>
  import("@/components/mdx/LiveByteInspector").then(
    (mod) => mod.LiveByteInspector
  )
);
const EncodingCompare = dynamic(() =>
  import("@/components/mdx/EncodingCompare").then((mod) => mod.EncodingCompare)
);
const NormalizedStepSize = dynamic(() =>
  import("@/components/mdx/NormalizedStepSize").then(
    (mod) => mod.NormalizedStepSize
  )
);

const components = {
  SplitLayout,
  Step,
  Description,
  Action,
  Command,
  ProjectRoadmap,
  ThinkingProcess,
  EmbeddingSpace,
  Callout,
  ByteStream,
  table: Table,
  thead: TableHead,
  tbody: TableBody,
  tr: TableRow,
  th: TableHeader,
  td: TableCell,
  ComingSoon,
  ProcessTimeline,
  LiveByteInspector,
  EncodingCompare,
  FrequencyWaves,
  NormalizedStepSize,
  BinaryVsSmooth,
  RotationVisualization,
};

function getCollections() {
  const contentDir = path.join(process.cwd(), "content");
  if (!fs.existsSync(contentDir)) {
    return [];
  }

  return fs
    .readdirSync(contentDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name !== "challenges" &&
        !entry.name.startsWith(".")
    )
    .map((entry) => entry.name);
}

export async function generateStaticParams() {
  const collections = getCollections();

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
  searchParams,
}: {
  params: Promise<{ courseId: string; slug: string }>;
  searchParams: Promise<{ view?: string; c?: string }>;
}) {
  const { courseId, slug } = await params;
  const { view, c } = await searchParams;
  const post = await getPostBySlug(courseId, slug);
  const allPosts = getAllPosts(courseId);

  if (!post) {
    notFound();
  }

  // Compute initial navigation state server-side to prevent hydration flash
  const hasChallenges = post.challenges && post.challenges.length > 0;
  const initialTab: "guide" | "challenges" =
    view === "challenges" && hasChallenges ? "challenges" : "guide";

  // Parse challenge index, validate it's within bounds
  let initialChallengeIndex: number | null = null;
  if (c !== undefined && hasChallenges) {
    const parsed = parseInt(c, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed < post.challenges!.length) {
      initialChallengeIndex = parsed;
    }
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
      initialTab={initialTab}
      initialChallengeIndex={initialChallengeIndex}
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
