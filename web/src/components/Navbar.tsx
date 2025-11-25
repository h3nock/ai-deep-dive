import Link from "next/link";

export function Navbar() {
  return (
    <nav className="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 bg-slate-900 dark:bg-white rounded-md flex items-center justify-center text-white dark:text-slate-900 text-xs font-bold">
            AI
          </div>
          <span className="font-semibold text-slate-900 dark:text-white">
            Deep Dive
          </span>
        </Link>
        
        <div className="flex items-center gap-6 text-sm text-slate-600 dark:text-slate-400">
          <a href="https://github.com/h3nock/ai-deep-dive" target="_blank" rel="noopener noreferrer" className="hover:text-slate-900 dark:hover:text-white transition-colors">
            GitHub
          </a>
        </div>
      </div>
    </nav>
  );
}
