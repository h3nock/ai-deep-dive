import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { CourseCard } from "@/components/CourseCard";
import { courseList } from "@/lib/course-config";
import { getChallengeIdsForSlug } from "@/lib/challenges";
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

      const challengeIdSet = new Set<string>();
      for (const post of visiblePosts) {
        for (const id of getChallengeIdsForSlug(course.id, post.slug)) {
          challengeIdSet.add(id);
        }
      }

      return {
        ...course,
        totalSteps: mainChapterSteps.length,
        totalChallenges: challengeIdSet.size,
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

          <div className="relative max-w-4xl mx-auto px-6 pt-20 md:pt-32 pb-20 md:pb-28">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_20rem] gap-12 lg:gap-10 items-center">
              {/* Left: copy */}
              <div>
                <h1 className="animate-fade-in-up text-4xl sm:text-5xl md:text-6xl font-bold text-primary tracking-tight leading-[1.08] mb-6">
                  Learn AI by{" "}
                  <br className="hidden sm:block" />
                  Building It
                </h1>
                <p className="animate-fade-in-up animate-delay-1 text-lg text-secondary leading-relaxed mb-10 max-w-lg italic">
                  &ldquo;What I cannot create, I do not understand.&rdquo;
                  <span className="not-italic text-muted text-base ml-1">&mdash; Richard Feynman</span>
                </p>
                <div className="animate-fade-in-up animate-delay-2 flex flex-wrap gap-3">
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

        {/* Features — what's built into every chapter */}
        <section className="py-20 bg-surface/50">
          <div className="max-w-4xl mx-auto px-6">
            <div className="mb-10">
              <h2 className="text-2xl font-bold text-primary">Learn by Doing</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Feature: Coding Challenges */}
              <div className="flex flex-col">
                <h3 className="text-sm font-medium text-primary mb-3">Coding Challenges</h3>
                <div className="font-mono text-xs border border-border rounded-xl bg-terminal overflow-hidden flex-1">
                  <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border">
                    <div className="w-2 h-2 rounded-full bg-border" />
                    <div className="w-2 h-2 rounded-full bg-border" />
                    <div className="w-2 h-2 rounded-full bg-border" />
                    <span className="ml-auto text-[10px] text-primary/60 font-medium">Run</span>
                    <span className="text-[10px] text-primary font-medium">Submit</span>
                  </div>
                  <div className="p-3.5 space-y-0.5 text-[10px] leading-relaxed">
                    <p><span className="text-accent-2">def</span> <span className="text-primary">gelu</span>(x):</p>
                    <p className="text-secondary/60 pl-4">&quot;&quot;&quot;GELU activation.&quot;&quot;&quot;</p>
                    <p className="pl-4"><span className="text-accent-2">return</span> <span className="text-secondary">0.5 * x * (1 + tanh(</span></p>
                    <p className="pl-8 text-secondary">sqrt(2/pi) * (x + 0.044715</p>
                    <p className="pl-8 text-secondary">* x**3)))</p>
                  </div>
                  <div className="px-3 py-2 border-t border-border text-[10px] text-success">
                    ✓ All tests passed
                  </div>
                </div>
              </div>

              {/* Feature: Interactive Visuals */}
              <div className="flex flex-col">
                <h3 className="text-sm font-medium text-primary mb-3">Interactive Visuals</h3>
                <div className="font-mono text-xs border border-border rounded-xl bg-terminal overflow-hidden flex-1">
                  <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border">
                    <div className="w-2 h-2 rounded-full bg-border" />
                    <div className="w-2 h-2 rounded-full bg-border" />
                    <div className="w-2 h-2 rounded-full bg-border" />
                  </div>
                  <div className="p-3.5 space-y-2.5">
                    {/* Frequency waves — 4 sine waves at different frequencies */}
                    {(() => {
                      const dotX = 48;
                      const waves = [
                        { label: "d₀", freq: 1, color: "var(--color-accent-2)" },
                        { label: "d₂", freq: 0.5, color: "var(--color-accent-5)" },
                        { label: "d₄", freq: 0.25, color: "var(--color-accent-1)" },
                        { label: "d₆", freq: 0.125, color: "var(--color-accent-3)" },
                      ];
                      return waves.map((wave) => {
                        const dotY = 10 - 8 * Math.sin(dotX * wave.freq * 0.15);
                        return (
                          <div key={wave.label} className="flex items-center gap-2">
                            <span className="text-[9px] text-muted w-3">{wave.label}</span>
                            <svg viewBox="0 0 120 20" className="flex-1 h-4">
                              <path
                                d={`M0,10 ${Array.from({ length: 121 }, (_, x) => {
                                  const y = 10 - 8 * Math.sin(x * wave.freq * 0.15);
                                  return `L${x},${y.toFixed(1)}`;
                                }).join(" ")}`}
                                fill="none"
                                stroke={wave.color}
                                strokeWidth="1.5"
                                opacity="0.8"
                              />
                              <circle cx={dotX} cy={dotY.toFixed(1)} r="2.5" fill={wave.color} />
                            </svg>
                          </div>
                        );
                      });
                    })()}
                    <p className="text-[10px] text-muted leading-relaxed pt-1">
                      Each dimension oscillates at a different frequency.
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature: Progress Tracking */}
              <div className="flex flex-col">
                <h3 className="text-sm font-medium text-primary mb-3">Progress Tracking</h3>
                <div className="font-mono text-xs border border-border rounded-xl bg-terminal overflow-hidden flex-1">
                  <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border">
                    <div className="w-2 h-2 rounded-full bg-border" />
                    <div className="w-2 h-2 rounded-full bg-border" />
                    <div className="w-2 h-2 rounded-full bg-border" />
                  </div>
                  <div className="p-3.5 space-y-3">
                    {[
                      { ch: "04", name: "Positional Enc.", done: true, problems: "3/3" },
                      { ch: "05", name: "Attention", done: true, problems: "2/2" },
                      { ch: "06", name: "Multi-Head", done: true, problems: "1/1" },
                      { ch: "07", name: "Feed-Forward", done: false, problems: "1/2" },
                      { ch: "08", name: "Residuals", done: false, problems: "0/2" },
                    ].map((row) => (
                      <div key={row.ch} className="flex items-center gap-2.5">
                        <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[8px] ${
                          row.done
                            ? "bg-primary/20 border-primary/40 text-primary"
                            : "border-border text-border"
                        }`}>
                          {row.done ? "✓" : ""}
                        </span>
                        <span className="text-[11px] text-secondary flex-1">{row.ch} {row.name}</span>
                        <span className={`text-[10px] ${row.done ? "text-primary/60" : "text-muted"}`}>{row.problems}</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-border">
                      <div className="h-1 bg-surface rounded-full overflow-hidden">
                        <div className="h-full bg-primary/60 rounded-full" style={{ width: "60%" }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Course Catalog */}
        <section id="courses" className="py-24">
          <div className="max-w-4xl mx-auto px-6">
            <div className="mb-10">
              <h2 className="text-2xl font-bold text-primary mb-2">Courses</h2>
              <p className="text-secondary">
                Choose a path and start building.
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
        <span>&copy; {new Date().getFullYear()} AI Deep Dive</span>
        <span className="mx-3 text-border">&middot;</span>
        <span>MIT License</span>
        <span className="mx-3 text-border">&middot;</span>
        <a
          href="https://github.com/h3nock/ai-deep-dive"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-primary transition-colors"
        >
          Star on GitHub
          <Star className="inline w-3.5 h-3.5 ml-1 -mt-0.5" />
        </a>
      </footer>
    </div>
  );
}
