import Link from "next/link";
import { ChevronDown } from "lucide-react";
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
        {/* Hero Section — full viewport */}
        <section className="relative min-h-[calc(100vh-3.5rem)] flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-grid-pattern" />
          <div className="absolute inset-0 hero-gradient-mask" />
          <div className="relative text-center max-w-3xl px-4">
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

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-muted/30">
            <ChevronDown className="w-5 h-5" />
          </div>
        </section>

        {/* Course Catalog */}
        <section
          id="courses"
          className="py-24 bg-surface"
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
      </main>

      {/* Minimal footer */}
      <footer className="py-12 text-center text-sm text-muted">
        <a
          href="https://github.com/h3nock/ai-deep-dive"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-primary transition-colors"
        >
          Open Source
        </a>
        <span className="mx-3 text-border">·</span>
        <span>Built for learners</span>
      </footer>
    </div>
  );
}
