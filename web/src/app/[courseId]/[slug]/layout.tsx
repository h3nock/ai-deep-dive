import { LessonGuideContent } from "@/components/LessonGuideContent";
import { LessonRouteShell } from "@/components/LessonRouteShell";
import { getLessonPageData } from "@/lib/lesson-page-data";

export const dynamic = "force-static";
export const dynamicParams = false;
export const revalidate = false;

export default async function LessonLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ courseId: string; slug: string }>;
}) {
  const { courseId, slug } = await params;
  const { post, prevPost, nextPost, allPosts } = await getLessonPageData(courseId, slug);
  const { content, ...postMeta } = post;

  return (
    <>
      {children}
      <LessonRouteShell
        post={postMeta}
        prevPost={prevPost}
        nextPost={nextPost}
        allPosts={allPosts}
        collection={courseId}
        guideContent={<LessonGuideContent source={content} />}
      />
    </>
  );
}
