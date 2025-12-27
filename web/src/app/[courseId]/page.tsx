import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPosts, listCollections } from "@/lib/posts";
import { ArrowRight, ArrowLeft, Clock, BookOpen, Code2 } from "lucide-react";
import { ProgressBar } from "@/components/ProgressBar";
import { ChallengeProgressBar } from "@/components/ChallengeProgressBar";
import { ChallengeProgressPill } from "@/components/ChallengeProgressPill";
import { ChapterCheckbox } from "@/components/ChapterCheckbox";
import { ContinueButton } from "@/components/ContinueButton";
import { getCourseConfig } from "@/lib/course-config";
import { isSafePathSegment } from "@/lib/path-safety";
import fs from "fs";
import path from "path";

export const revalidate = 300;

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
          <Link
            href="/"
            className="inline-flex items-center text-sm text-muted hover:text-primary mb-8 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Courses
          </Link>

          <h1 className="text-3xl md:text-4xl font-bold text-primary mb-3">
            {metadata.title}
          </h1>
          <p className="text-lg text-muted max-w-2xl leading-relaxed">
            {metadata.description}
          </p>

          {/* Stats */}
          <div className="mt-6 flex items-center gap-6 text-sm text-muted">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              <span>{mainChapterSteps.length} chapters</span>
            </div>
            {allChallengeIds.length > 0 && (
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4" />
                <span>{allChallengeIds.length} problems</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>~120 hours</span>
            </div>
          </div>

          {/* Progress Bar */}
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

        {/* Prerequisites & What You'll Build - Inverted T Layout */}
        <div className="relative grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 pb-6 mb-12">
          {/* Center vertical line (hidden on mobile) - connects to horizontal line */}
          <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-zinc-800" />

          {/* Horizontal bottom line (the T's crossbar) */}
          <div className="absolute left-0 right-0 bottom-0 h-px bg-zinc-800" />

          {/* Prerequisites */}
          <div className="md:pr-8">
            <h3 className="text-sm font-medium text-secondary uppercase tracking-wider mb-4">
              Prerequisites
            </h3>
            <ul className="space-y-2.5">
              {metadata.prerequisites.map((prereq, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-base text-muted leading-relaxed"
                >
                  <span className="text-zinc-500 shrink-0 mt-[6px] text-[6px]">
                    ●
                  </span>
                  <span>{prereq}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* What You'll Build */}
          <div className="md:pl-8">
            <h3 className="text-sm font-medium text-secondary uppercase tracking-wider mb-4">
              What You'll Build
            </h3>
            {Array.isArray(metadata.outcome) ? (
              <ul className="space-y-2.5">
                {metadata.outcome.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-base text-muted leading-relaxed"
                  >
                    <span className="text-zinc-500 shrink-0 mt-[6px] text-[6px]">
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

        {/* Course Content by Phase */}
        <div className="space-y-8">
          {metadata.phases.map((phase, phaseIndex) => {
            const [min, max] = phase.stepRange;
            const phaseChapters = visiblePosts.filter(
              (post) => post.step >= min && post.step <= max
            );
            if (phaseChapters.length === 0) return null;

            return (
              <div key={phaseIndex}>
                {/* Phase Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-muted">
                    {phase.icon}
                  </div>
                  <div>
                    <h2 className="font-semibold text-primary">
                      {phase.title}
                    </h2>
                    <p className="text-sm font-medium text-muted">{phase.description}</p>
                  </div>
                </div>

                {/* Chapter Timeline */}
                <div className="relative ml-4 pl-4 border-l border-zinc-800">
                  {phaseChapters.map((post) => {
                    const chapterChallengeIds = challengeIdsBySlug[post.slug] ?? [];
                    return (
                      <Link
                        key={post.slug}
                        href={`/${courseId}/${post.slug}`}
                        className="group block relative border-b border-border last:border-0"
                      >
                      {/* Timeline Node (Checkbox) */}
                      <div className="absolute -left-[24.5px] top-1/2 -translate-y-1/2 z-10 bg-background ring-4 ring-background">
                        <ChapterCheckbox
                          courseId={courseId}
                          step={post.step}
                          size="sm"
                        />
                      </div>

                      {/* Content Floating on Void - Inset from borders */}
                      <div className="relative my-1 py-2 px-4 rounded-lg transition-all duration-150 hover:bg-zinc-900/50 group-hover:translate-x-0.5">
                        <div className="flex items-center gap-4">
                          {/* Step Number - Subtle */}
                          <div className="shrink-0 w-8 h-8 flex items-center justify-center text-muted/50 font-mono text-sm group-hover:text-primary transition-colors">
                            {String(post.step).padStart(2, "0")}
                          </div>

                          {/* Text Content (Stacked) */}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm md:text-base font-medium text-primary group-hover:text-white transition-colors">
                              {post.title}
                            </h3>
                            <p className="text-muted text-xs md:text-sm line-clamp-1 mt-0.5 group-hover:text-zinc-400 transition-colors">
                              {post.description}
                            </p>
                          </div>

                          {/* Arrow - Always visible for balance */}
                          <div className="shrink-0 flex items-center gap-2 ml-auto">
                            {chapterChallengeIds.length > 0 && (
                              <ChallengeProgressPill
                                courseId={courseId}
                                challengeIds={chapterChallengeIds}
                              />
                            )}
                            <div className="text-zinc-700 group-hover:text-primary group-hover:translate-x-1 transition-all duration-150">
                              <ArrowRight className="w-4 h-4" />
                            </div>
                          </div>
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
