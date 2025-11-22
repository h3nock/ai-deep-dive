import Link from "next/link";
import { getAllPosts } from "@/lib/posts";
import { Navbar } from "@/components/Navbar";
import { ArrowRight, Terminal, Database, Code2, Cpu, Zap, Layers, MessageSquare, BarChart3, CheckCircle2 } from "lucide-react";

export default async function RoadmapPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const posts = getAllPosts(courseId);

  const courseMetadata: Record<string, { title: string; description: React.ReactNode }> = {
    nanochat: {
      title: "Build a GPT from Scratch",
      description: (
        <>
          Go beyond theory. Build a functional GPT from scratch. <br className="hidden md:block" />
          You will implement the tokenizer, training loop, and inference engine in pure PyTorch.
        </>
      ),
    },
    transformers: {
      title: "Deconstructing the Transformer",
      description: (
        <>
          Understand the architecture by deriving it. <br className="hidden md:block" />
          We implement every component of the Transformer—from self-attention to layer normalization—from first principles.
        </>
      ),
    },
  };

  const metadata = courseMetadata[courseId] || {
    title: "The Journey",
    description: "Select a course to begin your deep dive.",
  };

  // Map step numbers to icons
  const getIcon = (step: number) => {
    switch (step) {
      case 1: return <Terminal className="w-6 h-6" />;
      case 2: return <Database className="w-6 h-6" />;
      case 3: return <Code2 className="w-6 h-6" />;
      case 4: return <Cpu className="w-6 h-6" />;
      case 5: return <Zap className="w-6 h-6" />;
      case 6: return <Layers className="w-6 h-6" />;
      case 7: return <MessageSquare className="w-6 h-6" />;
      case 8: return <BarChart3 className="w-6 h-6" />;
      case 9: return <Layers className="w-6 h-6" />; // Reusing Layers for Block
      case 10: return <CheckCircle2 className="w-6 h-6" />; // Final Assembly
      default: return <CheckCircle2 className="w-6 h-6" />;
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans selection:bg-blue-500/20">
      <Navbar />
      
      <main className="relative pt-20 pb-24 container mx-auto px-4 max-w-5xl">
        {/* Grid Background */}
        <div className="absolute inset-0 bg-grid-pattern [mask-image:linear-gradient(to_bottom,white,transparent)] pointer-events-none -z-10"></div>

        <div className="mb-16 text-center">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-6 text-slate-900 dark:text-white">
            {metadata.title}
          </h1>
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
            {metadata.description}
          </p>
        </div>

        <div className="grid gap-8 relative">
          {/* Connecting Line (Desktop) */}
          <div className="hidden md:block absolute left-[2.25rem] top-8 bottom-8 w-px bg-slate-200 dark:bg-slate-800 -z-10"></div>

          {posts.map((post) => (
            <div key={post.slug} className="group relative flex gap-6 md:gap-8">
              
              {/* Icon Marker */}
              <div className="shrink-0 flex flex-col items-center">
                <div className="w-18 h-18 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-1.5 shadow-sm group-hover:border-blue-500/50 group-hover:shadow-blue-500/20 transition-all duration-300 z-10 relative">
                  <div className="w-16 h-16 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                    {getIcon(post.step)}
                  </div>
                </div>
              </div>

              {/* Content Card */}
              <Link href={`/${courseId}/step/${post.slug}`} className="flex-1 block group/card">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 hover:border-blue-500/30 dark:hover:border-blue-500/30 hover:shadow-xl hover:shadow-blue-500/5 dark:hover:shadow-none transition-all duration-300 relative overflow-hidden">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-bold font-mono text-slate-500 dark:text-slate-400 uppercase tracking-wider group-hover/card:bg-blue-50 dark:group-hover/card:bg-blue-900/20 group-hover/card:text-blue-600 dark:group-hover/card:text-blue-400 transition-colors">
                      Step {post.step.toString().padStart(2, '0')}
                    </span>
                  </div>
                  
                  <h3 className="text-2xl font-bold mb-3 text-slate-900 dark:text-white group-hover/card:text-blue-600 dark:group-hover/card:text-blue-400 transition-colors">
                    {post.title}
                  </h3>
                  
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-8 text-lg">
                    {post.description}
                  </p>

                  <div className="flex items-center text-sm font-bold text-slate-900 dark:text-white group-hover/card:translate-x-1 transition-transform">
                    Start Building <ArrowRight className="w-4 h-4 ml-2 text-blue-500" />
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
