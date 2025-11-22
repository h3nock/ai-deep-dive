import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { ArrowRight, Terminal, Cpu, MessageSquare, Zap, BarChart3, Layers, ChevronRight, Database, Code2 } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans selection:bg-blue-500/20">
      <Navbar />
      
      <main>
        {/* Hero Section */}
        <section className="relative pt-20 pb-32 md:pt-32 md:pb-48 overflow-hidden">
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-4xl mx-auto text-center">
              
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 dark:text-white mb-8 leading-tight animate-fade-in-up delay-100">
                Build NanoChat <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 animate-gradient-shift">
                  From Scratch
                </span>
              </h1>
              
              <p className="text-xl text-slate-600 dark:text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed animate-fade-in-up delay-200">
                A hands-on, interactive course where you code every component yourself. Master the internals of LLMs, from the tokenizer to reinforcement learning.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up delay-300">
                <Link href="/roadmap" className="w-full sm:w-auto px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20">
                  Start Coding <ArrowRight className="w-4 h-4" />
                </Link>
                <a href="https://github.com/karpathy/nanochat" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-full font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2">
                  View Source
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* The Pipeline Section */}
        <section className="py-24 bg-white dark:bg-slate-950 relative border-t border-slate-100 dark:border-slate-900">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4 tracking-tight">The Implementation Pipeline</h2>
              <p className="text-slate-600 dark:text-slate-400 text-lg">
                You will write the code for each of these stages, building your understanding layer by layer.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
              <PipelineStep 
                number="01"
                title="Environment"
                slug="01-environment"
                icon={<Terminal className="w-5 h-5" />}
                description="Initialize your workspace. Set up uv, PyTorch, and the project structure from an empty directory."
              />
              <PipelineStep 
                number="02"
                title="Data Prep"
                slug="02-data-prep"
                icon={<Database className="w-5 h-5" />}
                description="Write efficient data loaders. Download, shard, and process the FineWeb-EDU dataset yourself."
              />
              <PipelineStep 
                number="03"
                title="Tokenizer"
                slug="03-tokenizer"
                icon={<Code2 className="w-5 h-5" />}
                description="Implement a BPE tokenizer in Rust. Compile it and bind it to Python for maximum performance."
              />
              <PipelineStep 
                number="04"
                title="Architecture"
                slug="04-architecture"
                icon={<Cpu className="w-5 h-5" />}
                description="Code the GPT model: Causal Self-Attention, MLP, RMSNorm, and RoPE embeddings."
              />
              <PipelineStep 
                number="05"
                title="Pretraining"
                slug="05-pretraining"
                icon={<Zap className="w-5 h-5" />}
                description="Write the training loop. Implement the Muon optimizer and train your model on 10B tokens."
              />
              <PipelineStep 
                number="06"
                title="Midtraining"
                slug="06-midtraining"
                icon={<Layers className="w-5 h-5" />}
                description="Implement conversation handling. Adapt your model for chat and tool use (MMLU, GSM8K)."
              />
              <PipelineStep 
                number="07"
                title="SFT"
                slug="07-sft"
                icon={<MessageSquare className="w-5 h-5" />}
                description="Fine-tune for instruction following. Implement the SFT data pipeline and training logic."
              />
              <PipelineStep 
                number="08"
                title="RL"
                slug="08-rl"
                icon={<BarChart3 className="w-5 h-5" />}
                description="Implement GRPO. Write the reinforcement learning loop to improve reasoning capabilities."
              />
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}

function PipelineStep({ number, title, slug, icon, description }: { number: string, title: string, slug: string, icon: React.ReactNode, description: string }) {
  return (
    <Link href={`/step/${slug}`} className="group block">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs font-mono text-slate-400 dark:text-slate-500">{number}</span>
        <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors"></div>
      </div>
      <div className="flex items-center gap-3 mb-3 text-slate-900 dark:text-white">
        <div className="p-2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {icon}
        </div>
        <h3 className="text-lg font-semibold group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{title}</h3>
      </div>
      <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
        {description}
      </p>
    </Link>
  );
}


