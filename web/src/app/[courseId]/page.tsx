import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPosts, listCollections } from "@/lib/posts";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ProgressBar } from "@/components/ProgressBar";
import { ChallengeProgressBar } from "@/components/ChallengeProgressBar";
import { ChallengeProgressPill } from "@/components/ChallengeProgressPill";
import { ChapterCheckbox } from "@/components/ChapterCheckbox";
import { ContinueButton } from "@/components/ContinueButton";
import { getCourseConfig } from "@/lib/course-config";
import { isSafePathSegment } from "@/lib/path-safety";
import { ThemeToggle } from "@/components/ThemeToggle";
import fs from "fs";
import path from "path";

export const dynamic = "force-static";
export const dynamicParams = false;
export const revalidate = false;

export async function generateStaticParams() {
  return listCollections().map((courseId) => ({ courseId }));
}

export default async function RoadmapPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  if (!isSafePathSegment(courseId)) {
    notFound();
  }
  const posts = getAllPosts(courseId);

  const metadata = getCourseConfig(courseId) || {
    id: courseId,
    title: "The Journey",
    description: "Select a course to begin your deep dive.",
    outcome: "",
    prerequisites: [],
    phases: [],
    status: "available",
    tags: [],
    heroIcon: null,
  };

  const visiblePosts = posts.filter((post) => !post.hidden);

  const contentDir = path.join(process.cwd(), "content");
  const getChallengeIdsForSlug = (slug: string): string[] => {
    if (!isSafePathSegment(slug)) return [];

    const chapterMatch = slug.match(/^(\d+)/);
    const chapterNumber = chapterMatch ? chapterMatch[1] : undefined;

    const coLocatedChallenges = path.join(contentDir, courseId, slug, "challenges");
    const legacyChallenges = path.join(contentDir, "challenges", courseId, slug);
    const challengesDir = fs.existsSync(coLocatedChallenges)
      ? coLocatedChallenges
      : legacyChallenges;

    if (!fs.existsSync(challengesDir)) return [];

    const challengeBundles = fs
      .readdirSync(challengesDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory() && isSafePathSegment(dirent.name))
      .map((dirent) => dirent.name)
      .sort();

    return challengeBundles.map((bundleName) => {
      const problemMatch = bundleName.match(/^(\d+)/);
      const problemNumber = problemMatch ? problemMatch[1] : undefined;
      return chapterNumber && problemNumber ? `${chapterNumber}-${problemNumber}` : bundleName;
    });
  };

  // Only count main chapters (whole numbers) for progress tracking
  // Sub-steps like 9.1, 9.2 are part of projects and tracked separately
  const mainChapterSteps = visiblePosts
    .filter((p) => Number.isInteger(p.step))
    .map((p) => p.step);

  // Create step -> slug mapping for ContinueButton (main chapters only)
  const slugMap: Record<number, string> = {};
  visiblePosts
    .filter((p) => Number.isInteger(p.step))
    .forEach((p) => {
      slugMap[p.step] = p.slug;
    });

  const challengeIdsBySlug: Record<string, string[]> = {};
  const allChallengeIdSet = new Set<string>();
  for (const post of visiblePosts) {
    const ids = getChallengeIdsForSlug(post.slug);
    if (ids.length > 0) {
      challengeIdsBySlug[post.slug] = ids;
      ids.forEach((id) => allChallengeIdSet.add(id));
    }
  }
  const allChallengeIds = Array.from(allChallengeIdSet);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-8">
            <Link
              href="/"
              className="inline-flex items-center text-sm text-muted hover:text-primary transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
              Back to Courses
            </Link>
            <ThemeToggle />
          </div>

          <h1 className="animate-fade-in-up text-3xl md:text-4xl font-bold text-primary mb-3">
            {metadata.title}
          </h1>
          <p className="text-lg text-muted max-w-2xl leading-relaxed">
            {metadata.description}
          </p>

          {/* Stats — mini cards */}
          <div className="mt-6 flex gap-3 flex-wrap">
            <div className="bg-surface rounded-xl px-4 py-3">
              <span className="text-xl font-bold text-primary">{mainChapterSteps.length}</span>
              <span className="block text-xs text-muted mt-0.5">chapters</span>
            </div>
            {allChallengeIds.length > 0 && (
              <div className="bg-surface rounded-xl px-4 py-3">
                <span className="text-xl font-bold text-primary">{allChallengeIds.length}</span>
                <span className="block text-xs text-muted mt-0.5">problems</span>
              </div>
            )}
            <div className="bg-surface rounded-xl px-4 py-3">
              <span className="text-xl font-bold text-primary">~120</span>
              <span className="block text-xs text-muted mt-0.5">hours</span>
            </div>
          </div>

          {/* Progress Bars */}
          <div className="mt-6">
            <ProgressBar
              courseId={courseId}
              totalSteps={mainChapterSteps.length}
            />
            {allChallengeIds.length > 0 && (
              <div className="mt-3">
                <ChallengeProgressBar
                  courseId={courseId}
                  challengeIds={allChallengeIds}
                />
              </div>
            )}
          </div>
        </div>

        {/* Prerequisites & What You'll Build — card pair */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
          <div className="bg-surface rounded-xl p-5">
            <h3 className="text-sm font-medium text-secondary uppercase tracking-wider mb-4">
              Prerequisites
            </h3>
            <ul className="space-y-2.5">
              {metadata.prerequisites.map((prereq, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-base text-muted leading-relaxed"
                >
                  <span className="text-muted shrink-0 mt-[6px] text-[6px]">
                    ●
                  </span>
                  <span>{prereq}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-surface rounded-xl p-5">
            <h3 className="text-sm font-medium text-secondary uppercase tracking-wider mb-4">
              What You&apos;ll Build
            </h3>
            {Array.isArray(metadata.outcome) ? (
              <ul className="space-y-2.5">
                {metadata.outcome.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-base text-muted leading-relaxed"
                  >
                    <span className="text-muted shrink-0 mt-[6px] text-[6px]">
                      ●
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-base text-muted leading-relaxed">
                {metadata.outcome}
              </p>
            )}
          </div>
        </div>

        {/* Course Content by Phase — timeline */}
        <div>
          {metadata.phases.map((phase, phaseIndex) => {
            const [min, max] = phase.stepRange;
            const phaseChapters = visiblePosts.filter(
              (post) => post.step >= min && post.step <= max
            );
            if (phaseChapters.length === 0) return null;

            return (
              <div key={phaseIndex}>
                {/* Phase Header */}
                <div className="flex items-center gap-3 mt-10 mb-4">
                  <span className="text-xs font-mono text-muted uppercase tracking-wider">
                    Phase {phaseIndex + 1}
                  </span>
                  <span className="text-sm font-semibold text-primary">
                    {phase.title}
                  </span>
                  <div className="flex-1 border-t border-border" />
                </div>

                {/* Chapter Timeline */}
                <div className="relative ml-3 pl-6 border-l border-border">
                  {phaseChapters.map((post) => {
                    const chapterChallengeIds =
                      challengeIdsBySlug[post.slug] ?? [];
                    return (
                      <Link
                        key={post.slug}
                        href={`/${courseId}/${post.slug}`}
                        className="group relative block py-3 first:pt-1 last:pb-1"
                      >
                        {/* Timeline node */}
                        <div className="absolute -left-[31px] top-1/2 -translate-y-1/2 bg-background ring-4 ring-background">
                          <ChapterCheckbox
                            courseId={courseId}
                            step={post.step}
                            size="sm"
                          />
                        </div>

                        {/* Row content */}
                        <div className="flex items-center gap-4 rounded-lg px-4 py-2.5 transition-colors hover:bg-surface/50">
                          <span className="shrink-0 w-7 font-mono text-sm text-muted/50 group-hover:text-primary transition-colors">
                            {String(post.step).padStart(2, "0")}
                          </span>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm md:text-base font-medium text-primary group-hover:text-secondary transition-colors">
                              {post.title}
                            </h3>
                            <p className="text-xs md:text-sm text-muted line-clamp-1 mt-0.5">
                              {post.description}
                            </p>
                          </div>
                          <div className="shrink-0 flex items-center gap-3">
                            {chapterChallengeIds.length > 0 && (
                              <ChallengeProgressPill
                                courseId={courseId}
                                challengeIds={chapterChallengeIds}
                              />
                            )}
                            <ArrowRight className="w-4 h-4 text-border group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Start/Continue CTA */}
        <div className="mt-12 text-center">
          <ContinueButton
            courseId={courseId}
            allSteps={mainChapterSteps}
            slugMap={slugMap}
          />
        </div>
      </div>
    </div>
  );
}
