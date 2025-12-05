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
          <p className="text-base text-muted max-w-2xl leading-relaxed">
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

        {/* What You'll Build & Prerequisites */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          <div className="bg-surface rounded-xl border border-border p-5">
            <h3 className="font-semibold text-primary mb-3 text-sm">
              What You'll Build
            </h3>
            {Array.isArray(metadata.outcome) ? (
              <ul className="space-y-2">
                {metadata.outcome.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-baseline gap-2 text-sm text-muted"
                  >
                    <span className="text-zinc-600">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted leading-relaxed">
                {metadata.outcome}
              </p>
            )}
          </div>
          <div className="bg-surface rounded-xl border border-border p-5">
            <h3 className="font-semibold text-primary mb-3 text-sm">
              Prerequisites
            </h3>
            <ul className="space-y-2">
              {metadata.prerequisites.map((prereq, i) => (
                <li
                  key={i}
                  className="flex items-baseline gap-2 text-sm text-muted"
                >
                  <span className="text-zinc-600">•</span>
                  {prereq}
                </li>
              ))}
            </ul>
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
                    <p className="text-sm text-muted">{phase.description}</p>
                  </div>
                </div>

                {/* Chapter Cards */}
                <div className="space-y-2 ml-4 pl-7 border-l-2 border-border">
                  {phaseChapters.map((post) => (
                    <Link
                      key={post.slug}
                      href={`/${courseId}/${post.slug}`}
                      className="group block"
                    >
                      <div className="relative bg-surface rounded-lg border border-border p-4 hover:border-zinc-600 hover:bg-zinc-800/50 transition-all duration-200">
                        <div className="flex items-center gap-4">
                          {/* Completion Checkbox */}
                          <ChapterCheckbox
                            courseId={courseId}
                            step={post.step}
                            size="sm"
                          />

                          {/* Step Number */}
                          <div className="shrink-0 w-8 h-8 rounded-md bg-background flex items-center justify-center text-muted font-medium text-sm group-hover:bg-zinc-800 transition-colors">
                            {post.step}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm md:text-base font-medium text-primary group-hover:text-secondary transition-colors">
                              {post.title}
                            </h3>
                            <p className="text-muted text-xs md:text-sm line-clamp-1 mt-0.5">
                              {post.description}
                            </p>
                          </div>

                          {/* Arrow */}
                          <div className="shrink-0 text-muted group-hover:text-secondary group-hover:translate-x-0.5 transition-all duration-200">
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
