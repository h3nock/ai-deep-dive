import Link from "next/link";
import { getAllPosts } from "@/lib/posts";
import { Navbar } from "@/components/Navbar";
import { ArrowRight, ArrowLeft, Clock, BookOpen } from "lucide-react";
import { ProgressBar } from "@/components/ProgressBar";
import { ChapterCheckbox } from "@/components/ChapterCheckbox";
import { ContinueButton } from "@/components/ContinueButton";
import { getCourseConfig } from "@/lib/course-config";

export default async function RoadmapPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
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
  const totalSteps = visiblePosts.length;

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

  // Check if step falls within a phase range (handles decimal steps like 9.1, 9.2)
  const getPhaseForStep = (step: number) => {
    for (let i = 0; i < metadata.phases.length; i++) {
      const [min, max] = metadata.phases[i].stepRange;
      if (step >= min && step < max + 1) {
        return i;
      }
    }
    return -1;
  };

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
          <p className="text-base text-muted max-w-2xl leading-relaxed tracking-wide">
            {metadata.description}
          </p>

          {/* Stats */}
          <div className="mt-6 flex items-center gap-6 text-sm text-muted">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              <span>{mainChapterSteps.length} chapters</span>
            </div>
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
            <h3 className="font-semibold text-primary mb-3 text-lg">
              Prerequisites
            </h3>
            <ul className="space-y-2.5">
              {metadata.prerequisites.map((prereq, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-base text-muted leading-relaxed tracking-wide"
                >
                  <span className="text-zinc-600 shrink-0 mt-[7px] text-[5px]">
                    ●
                  </span>
                  <span>{prereq}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* What You'll Build */}
          <div className="md:pl-8">
            <h3 className="font-semibold text-primary mb-3 text-lg">
              What You'll Build
            </h3>
            {Array.isArray(metadata.outcome) ? (
              <ul className="space-y-2.5">
                {metadata.outcome.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-base text-muted leading-relaxed tracking-wide"
                  >
                    <span className="text-zinc-600 shrink-0 mt-[7px] text-[5px]">
                      ●
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-base text-secondary leading-relaxed">
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
                    <p className="text-sm text-muted leading-relaxed tracking-wide">{phase.description}</p>
                  </div>
                </div>

                {/* Chapter Timeline */}
                <div className="relative ml-4 pl-4 border-l border-zinc-800">
                  {phaseChapters.map((post) => (
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
                      <div className="relative my-1 py-2 px-4 rounded-lg transition-all duration-200 hover:bg-zinc-900/50 group-hover:translate-x-0.5">
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
                          <div className="shrink-0 text-zinc-700 group-hover:text-primary group-hover:translate-x-1 transition-all duration-200 ml-auto">
                            <ArrowRight className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
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
