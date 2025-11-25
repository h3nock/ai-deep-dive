import Link from "next/link";
import { getAllPosts } from "@/lib/posts";
import { Navbar } from "@/components/Navbar";
import { ArrowRight, ArrowLeft, Clock, BookOpen } from "lucide-react";

export default async function RoadmapPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const posts = getAllPosts(courseId);

  const courseMetadata: Record<string, { title: string; description: React.ReactNode }> = {
    "build-chatgpt": {
      title: "Build ChatGPT from Scratch",
      description: (
        <>
          The ultimate deep dive. <br className="hidden md:block" />
          We combine the theory of Transformers with the practice of building a production-grade GPT. From empty file to chatting with your creation.
        </>
      ),
    },
  };

  const metadata = courseMetadata[courseId] || {
    title: "The Journey",
    description: "Select a course to begin your deep dive.",
  };

  const visiblePosts = posts.filter(post => !post.hidden);
  const totalSteps = visiblePosts.length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <Link 
            href="/"
            className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white mb-8 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Courses
          </Link>
          
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-3">
            {metadata.title}
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
            {metadata.description}
          </p>
          
          {/* Progress Overview */}
          <div className="mt-6 flex items-center gap-6 text-sm text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              <span>{totalSteps} chapters</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>~20 hours</span>
            </div>
          </div>
        </div>

        {/* Step Cards */}
        <div className="space-y-3">
          {visiblePosts.map((post, index) => {
            const isFirst = index === 0;
            
            return (
              <Link 
                key={post.slug} 
                href={`/${courseId}/step/${post.slug}`}
                className="group block"
              >
                <div className="relative bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 md:p-5 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-200">
                  <div className="flex items-center gap-4">
                    {/* Step Number */}
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 font-semibold text-sm group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
                      {post.step}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base md:text-lg font-medium text-slate-900 dark:text-white group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">
                        {post.title}
                      </h3>
                      <p className="text-slate-500 dark:text-slate-500 text-sm line-clamp-1 mt-0.5">
                        {post.description}
                      </p>
                    </div>

                    {/* Arrow */}
                    <div className="shrink-0 text-slate-400 dark:text-slate-600 group-hover:text-slate-600 dark:group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all duration-200">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
