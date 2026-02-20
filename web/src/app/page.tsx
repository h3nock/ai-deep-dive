import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { CourseCard } from "@/components/CourseCard";
import { courseList } from "@/lib/course-config";
import { getAllPosts } from "@/lib/posts";

const TOKENS = ["The", "cat", "sat", "on", "the", "mat"];

const ATTENTION_WEIGHTS = [
  0.9, 0.12, 0.0, 0.0, 0.08, 0.0,
  0.1, 0.8, 0.08, 0.0, 0.0, 0.0,
  0.0, 0.12, 0.7, 0.18, 0.0, 0.0,
  0.0, 0.0, 0.2, 0.55, 0.12, 0.1,
  0.1, 0.0, 0.0, 0.08, 0.8, 0.0,
  0.0, 0.0, 0.05, 0.1, 0.08, 0.8,
];

const PIPELINE_STAGES = ["text", "tokens", "vectors", "attention", "GPT"];

export default async function Home() {
  const courses = await Promise.all(
    courseList.map(async (course) => {
      const isAvailable = course.status === "available";
      const visiblePosts = isAvailable
        ? getAllPosts(course.id).filter((post) => !post.hidden)
        : [];

      const mainChapterSteps = visiblePosts
        .filter((post) => Number.isInteger(post.step))
        .map((post) => post.step);

      return {
        ...course,
        totalSteps: mainChapterSteps.length,
        href: isAvailable ? `/${course.id}` : undefined,
      };
    })
  );

  return (
    <div className="min-h-screen bg-background text-secondary font-sans">
      <Navbar />

      <main>
        {/* Hero — asymmetric split */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-pattern" />
          <div className="absolute inset-0 hero-gradient-mask" />

          <div className="relative max-w-6xl mx-auto px-6 pt-20 md:pt-32 pb-20 md:pb-28">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-12 lg:gap-16 items-start">
              {/* Left: copy */}
              <div>
                <p className="animate-fade-in-up font-mono text-xs text-muted tracking-widest uppercase mb-6">
                  Open-source course
                </p>
                <h1 className="animate-fade-in-up animate-delay-1 text-4xl sm:text-5xl md:text-6xl font-bold text-primary tracking-tight leading-[1.08] mb-6">
                  Learn AI by{" "}
                  <br className="hidden sm:block" />
                  Building It
                </h1>
                <p className="animate-fade-in-up animate-delay-2 text-lg text-secondary leading-relaxed mb-10 max-w-lg">
                  Understand transformers by implementing every layer
                  from scratch. No shortcuts, no magic imports.
                </p>
                <div className="animate-fade-in-up animate-delay-3 flex flex-wrap gap-3">
                  <Link
                    href="#courses"
                    className="group inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary hover:bg-primary-hover text-background font-medium transition-all hover:shadow-lg hover:shadow-muted/10"
                  >
                    Start Building
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                  <a
                    href="https://github.com/h3nock/ai-deep-dive"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3 rounded-lg border border-border hover:bg-surface text-secondary font-medium transition-colors"
                  >
                    View Source
                  </a>
                </div>

                {/* Mobile: compact pipeline flow */}
                <div className="flex items-center gap-2 flex-wrap lg:hidden mt-12">
                  {PIPELINE_STAGES.map((stage, i) => (
                    <div
                      key={stage}
                      className="pipeline-stage flex items-center gap-2"
                      style={{ animationDelay: `${0.6 + i * 0.15}s` }}
                    >
                      {i > 0 && <span className="text-border text-xs">&rarr;</span>}
                      <span
                        className={`px-2.5 py-1 rounded-md bg-surface border border-border text-xs font-mono ${
                          stage === "GPT"
                            ? "text-primary font-medium"
                            : "text-muted"
                        }`}
                      >
                        {stage}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: pipeline visualization (desktop) */}
              <div className="hidden lg:block">
                <div className="font-mono text-sm border border-border rounded-xl bg-terminal overflow-hidden">
                  {/* Terminal header */}
                  <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border">
                    <div className="w-2.5 h-2.5 rounded-full bg-border" />
                    <div className="w-2.5 h-2.5 rounded-full bg-border" />
                    <div className="w-2.5 h-2.5 rounded-full bg-border" />
                    <span className="ml-2 text-[10px] text-muted">transformer.py</span>
                  </div>

                  <div className="p-5 space-y-5">
                    {/* Input */}
                    <div className="pipeline-stage" style={{ animationDelay: "0.6s" }}>
                      <span className="text-[10px] text-muted uppercase tracking-widest">input</span>
                      <p className="text-secondary mt-1.5">
                        &quot;The cat sat on the mat&quot;
                        <span className="pipeline-cursor">|</span>
                      </p>
                    </div>

                    {/* Connector */}
                    <div
                      className="pipeline-stage flex items-center gap-2"
                      style={{ animationDelay: "0.9s" }}
                    >
                      <div className="flex-1 border-t border-border border-dashed" />
                      <span className="text-[10px] text-muted">&darr;</span>
                      <div className="flex-1 border-t border-border border-dashed" />
                    </div>

                    {/* Tokenize */}
                    <div className="pipeline-stage" style={{ animationDelay: "1.2s" }}>
                      <span className="text-[10px] text-muted uppercase tracking-widest">tokenize</span>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {TOKENS.map((token) => (
                          <span
                            key={token}
                            className="px-2 py-0.5 rounded bg-surface border border-border text-primary text-xs"
                          >
                            {token}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Embed */}
                    <div className="pipeline-stage" style={{ animationDelay: "1.8s" }}>
                      <span className="text-[10px] text-muted uppercase tracking-widest">embed</span>
                      <div className="mt-1.5 text-[11px] text-muted whitespace-pre leading-relaxed">
{`[ 0.82, -0.31,  0.67, ...]
[-0.45,  0.91,  0.23, ...]`}
                      </div>
                    </div>

                    {/* Self-Attention */}
                    <div className="pipeline-stage" style={{ animationDelay: "2.4s" }}>
                      <span className="text-[10px] text-muted uppercase tracking-widest">self-attention</span>
                      <div className="grid grid-cols-6 gap-[3px] mt-1.5 w-fit">
                        {ATTENTION_WEIGHTS.map((weight, i) => (
                          <div
                            key={i}
                            className="w-3.5 h-3.5 rounded-[2px] bg-primary"
                            style={{ opacity: Math.max(weight, 0.06) }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Generate */}
                    <div className="pipeline-stage" style={{ animationDelay: "3s" }}>
                      <span className="text-[10px] text-muted uppercase tracking-widest">generate</span>
                      <p className="text-primary mt-1.5">&quot;...and purred softly.&quot;</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Course Catalog */}
        <section id="courses" className="py-24 bg-surface/50">
          <div className="max-w-4xl mx-auto px-6">
            <div className="mb-10">
              <h2 className="text-2xl font-bold text-primary mb-2">Courses</h2>
              <p className="text-secondary">
                Guided paths from first principles to working code.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {courses.map((course) => (
                <CourseCard
                  key={course.id}
                  title={course.title}
                  description={course.description}
                  icon={course.heroIcon}
                  href={course.href}
                  tags={course.tags}
                  status={course.status}
                  courseId={
                    course.status === "available" ? course.id : undefined
                  }
                  totalSteps={course.totalSteps}
                />
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-12 text-center text-sm text-muted">
        <a
          href="https://github.com/h3nock/ai-deep-dive"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-primary transition-colors"
        >
          Open Source
        </a>
        <span className="mx-3 text-border">&middot;</span>
        <span>Built for learners</span>
      </footer>
    </div>
  );
}
