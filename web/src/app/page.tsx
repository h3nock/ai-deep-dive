import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { CourseCard } from "@/components/CourseCard";
import { Terminal, Network, Image as ImageIcon, Code2, Cpu, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans selection:bg-blue-500/20">
      <Navbar />
      
      <main>
        {/* Hero Section */}
        <section className="relative pt-24 pb-32 overflow-hidden">
          <div className="absolute inset-0 bg-grid-pattern [mask-image:linear-gradient(to_bottom,white,transparent)] pointer-events-none -z-10"></div>
          
          <div className="container mx-auto px-4 text-center max-w-4xl relative z-10">
            
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-8 text-slate-900 dark:text-white">
              Master AI by <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
                Building It.
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed mb-12">
              No black boxes. No hand-waving. <br />
              We build state-of-the-art AI systems from the ground up.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                href="#courses" 
                className="px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5"
              >
                Explore Courses
              </Link>
              <a 
                href="https://github.com/h3nock/ai-deep-dive" 
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-bold text-lg transition-all"
              >
                View Source
              </a>
            </div>
          </div>
        </section>

        {/* Course Catalog */}
        <section id="courses" className="py-24 bg-slate-50/50 dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-800">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
                Deep Dive Curriculum
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400">
                Choose your track. Every course is a complete build-from-scratch experience.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              <CourseCard 
                title="Transformer Internals"
                description="The foundation of modern AI. A rigorous deep dive into the mathematical and architectural building blocks of the Transformer."
                icon={<Network className="w-6 h-6" />}
                href="/transformers"
                tags={["Architecture", "Transformers"]}
                status="available"
                color="purple"
              />

              <CourseCard 
                title="NanoChat: Build a GPT"
                description="Build a production-grade GPT from scratch. We implement the tokenizer, training loop, and inference engine to create a working chatbot."
                icon={<Terminal className="w-6 h-6" />}
                href="/nanochat"
                tags={["Python", "PyTorch", "GPT"]}
                status="available"
                color="blue"
              />
              
              <CourseCard 
                title="Diffusion from Scratch"
                description="Understand how modern image generators work by building a stable diffusion model from pure noise."
                icon={<ImageIcon className="w-6 h-6" />}
                tags={["Generative", "Vision", "U-Net"]}
                status="planned"
                color="emerald"
              />
            </div>
          </div>
        </section>

        {/* Philosophy Section */}
        <section className="py-24">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-900 dark:text-white mb-4">
                  <Code2 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">First Principles</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  We strip away the magic. No <code className="text-sm font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">import openai</code>. No <code className="text-sm font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">HuggingFace.load()</code>. You write the raw PyTorch to understand exactly what happens inside the matrix multiplication.
                </p>
              </div>

              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-900 dark:text-white mb-4">
                  <Cpu className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">End-to-End Engineering</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Real AI engineering goes beyond the notebook. We build the full lifecycle: from raw data ingestion and custom tokenizers to efficient training loops and real-time inference APIs.
                </p>
              </div>

              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-900 dark:text-white mb-4">
                  <Zap className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Interactive Learning</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Passive learning doesn't stick. Our platform forces you to engage: interactive visualizations for theory, and a browser-based IDE where you must write the code to proceed.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
