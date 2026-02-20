import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

export function Navbar() {
  return (
    <nav className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" prefetch={true} className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center text-background text-xs font-bold">
            AI
          </div>
          <span className="font-semibold text-primary">Deep Dive</span>
        </Link>

        <div className="flex items-center gap-4 text-sm text-muted">
          <a
            href="https://github.com/h3nock/ai-deep-dive"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
          >
            GitHub
          </a>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
