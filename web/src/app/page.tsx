import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { CourseCard } from "@/components/CourseCard";
import { Terminal, Image as ImageIcon } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans">
      <Navbar />

      <main>
        {/* Hero Section */}
        <section className="relative pt-20 pb-16">
          <div className="container mx-auto px-4 text-center max-w-3xl">
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-6 text-slate-900 dark:text-white">
              Learn AI by Building It
            </h1>

            <p className="text-base md:text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto leading-relaxed mb-10">
              Go beyond API calls. Build real AI systems from scratch and
              understand how they actually work.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="#courses"
                className="px-6 py-3 rounded-lg bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-medium transition-colors"
              >
                Browse Courses
              </Link>
              <a
                href="https://github.com/h3nock/ai-deep-dive"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 font-medium transition-colors"
              >
                View Source
              </a>
            </div>
          </div>
        </section>

        {/* Course Catalog */}
        <section
          id="courses"
          className="py-20 bg-slate-50 dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-800"
        >
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="mb-10">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Courses
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                Each course takes you from zero to a working system.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CourseCard
                title="Build ChatGPT from Scratch"
                description="Build a GPT from an empty file. Tokenization, transformers, training, and a working chatbot at the end."
                icon={<Terminal className="w-5 h-5" />}
                href="/build-chatgpt"
                tags={["Transformers", "PyTorch", "GPT"]}
                status="available"
              />

              <CourseCard
                title="Diffusion from Scratch"
                description="Build an image generator from pure noise. Understand how Stable Diffusion actually works."
                icon={<ImageIcon className="w-5 h-5" />}
                tags={["Generative", "Vision", "U-Net"]}
                status="planned"
              />
            </div>
          </div>
        </section>

        {/* Approach - Simplified */}
        <section className="py-20">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="mb-10">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                How It Works
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-2">
                <div className="text-2xl font-bold text-slate-300 dark:text-slate-700">
                  01
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  Theory First
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Understand the why before the how.
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-2xl font-bold text-slate-300 dark:text-slate-700">
                  02
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  Build It Yourself
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Write real PyTorch. No magic imports.
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-2xl font-bold text-slate-300 dark:text-slate-700">
                  03
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  Make It Work
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
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
