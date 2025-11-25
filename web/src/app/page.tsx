import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { CourseCard } from "@/components/CourseCard";
import { Terminal, Image as ImageIcon, Code2, Cpu, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans">
      <Navbar />
      
      <main>
        {/* Hero Section */}
        <section className="relative pt-20 pb-24">
          <div className="container mx-auto px-4 text-center max-w-3xl">
            
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-6 text-slate-900 dark:text-white">
              Master AI by Building It.
            </h1>
            
            <p className="text-base md:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10">
              No black boxes. No hand-waving. We build state-of-the-art AI systems from the ground up.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link 
                href="#courses" 
                className="px-6 py-3 rounded-lg bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-medium transition-colors"
              >
                Explore Courses
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
        <section id="courses" className="py-20 bg-slate-50 dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-800">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="mb-10">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Courses
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                Every course is a complete build-from-scratch experience.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CourseCard 
                title="Build ChatGPT from Scratch"
                description="The ultimate deep dive. Build a production-grade GPT from an empty file to chatting with your creation."
                icon={<Terminal className="w-5 h-5" />}
                href="/build-chatgpt"
                tags={["Transformers", "PyTorch", "GPT"]}
                status="available"
              />
              
              <CourseCard 
                title="Diffusion from Scratch"
                description="Understand how modern image generators work by building a stable diffusion model from pure noise."
                icon={<ImageIcon className="w-5 h-5" />}
                tags={["Generative", "Vision", "U-Net"]}
                status="planned"
              />
            </div>
          </div>
        </section>

        {/* Philosophy Section */}
        <section className="py-20">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="mb-10">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Our Approach
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                How we teach AI engineering differently.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
                  <Code2 className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">First Principles</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  No <code className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">import openai</code>. You write the raw PyTorch to understand exactly what happens inside.
                </p>
              </div>

              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
                  <Cpu className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">End-to-End</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  From raw data and custom tokenizers to efficient training loops and real-time inference APIs.
                </p>
              </div>

              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Interactive</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Interactive visualizations for theory, and a browser-based IDE where you must write the code to proceed.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
