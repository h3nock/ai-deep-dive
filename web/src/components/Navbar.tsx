import Link from "next/link";

export function Navbar() {
  return (
    <nav className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="font-bold text-xl tracking-tight hover:opacity-80 transition-opacity">
          NanoChat <span className="text-slate-500 font-normal">Deep Dive</span>
        </Link>
        
        <div className="flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400">
          <Link href="/roadmap" className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
            Roadmap
          </Link>
          <a 
            href="https://github.com/karpathy/nanochat" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            GitHub
          </a>
        </div>
      </div>
    </nav>
  );
}
