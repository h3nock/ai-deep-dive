import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { CourseCard } from "@/components/CourseCard";
import { courseList } from "@/lib/course-config";
import { getAllPosts } from "@/lib/posts";

export default async function Home() {
  const courses = await Promise.all(
    courseList.map(async (course) => {
      const isAvailable = course.status === "available";
      const visiblePosts = isAvailable
        ? getAllPosts(course.id).filter((post) => !post.hidden)
        : [];

      // Only count main chapters (whole numbers) for progress tracking
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
        {/* Hero Section */}
        <section className="relative pt-20 pb-24 overflow-hidden">
          <div className="absolute inset-0 bg-grid-pattern" />
          <div className="absolute inset-0 hero-gradient-mask" />
          <div className="relative container mx-auto px-4 text-center max-w-3xl">
            <h1 className="animate-fade-in-up text-3xl md:text-5xl font-bold tracking-tight mb-6 text-primary">
              Learn AI by Building It
            </h1>

            <p className="animate-fade-in-up animate-delay-1 text-base md:text-lg text-secondary max-w-xl mx-auto leading-relaxed mb-10">
              The only way to truly understand AI is to build it.
            </p>

            <div className="animate-fade-in-up animate-delay-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="#courses"
                className="px-6 py-3 rounded-lg bg-primary hover:bg-primary-hover text-background font-medium transition-all hover:shadow-lg hover:shadow-muted/10"
              >
                Explore Courses
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
          </div>
        </section>

        {/* Course Catalog */}
        <section
          id="courses"
          className="py-20 bg-surface border-y border-border"
        >
          <div className="container mx-auto px-4 max-w-4xl">
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

        {/* Approach - Simplified */}
        <section className="py-20">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="mb-10">
              <h2 className="text-2xl font-bold text-primary mb-2">
                How It Works
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              {/* Connector line between circles (desktop) */}
              <div className="hidden md:block absolute top-5 left-[calc(16.67%+20px)] right-[calc(16.67%+20px)] h-px bg-border" />

              <div className="flex flex-col items-center text-center space-y-4">
                <div className="relative z-10 flex items-center justify-center w-10 h-10 rounded-full border border-border bg-background text-sm font-semibold text-muted">
                  01
                </div>
                <h3 className="font-semibold text-primary">Theory First</h3>
                <p className="text-sm text-secondary leading-relaxed">
                  Understand the why before the how.
                </p>
              </div>

              <div className="flex flex-col items-center text-center space-y-4">
                <div className="relative z-10 flex items-center justify-center w-10 h-10 rounded-full border border-border bg-background text-sm font-semibold text-muted">
                  02
                </div>
                <h3 className="font-semibold text-primary">
                  Build It Yourself
                </h3>
                <p className="text-sm text-secondary leading-relaxed">
                  Write real PyTorch. No magic imports.
                </p>
              </div>

              <div className="flex flex-col items-center text-center space-y-4">
                <div className="relative z-10 flex items-center justify-center w-10 h-10 rounded-full border border-border bg-background text-sm font-semibold text-muted">
                  03
                </div>
                <h3 className="font-semibold text-primary">Make It Work</h3>
                <p className="text-sm text-secondary leading-relaxed">
                  Train on real data. End with something you can use.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
