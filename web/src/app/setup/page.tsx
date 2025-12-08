"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Copy,
  ChevronLeft,
  Folder,
  FileCode,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="relative group"
      style={{
        marginTop: "var(--space-connected)",
        marginBottom: "var(--space-flow)",
      }}
    >
      <pre className="p-4 bg-[#121212] rounded-lg border border-zinc-800 font-mono text-sm text-secondary overflow-x-auto">
        {children}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 p-1.5 rounded bg-zinc-800 text-muted hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}

function FAQItem({
  question,
  children,
}: {
  question: string;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-4 flex items-center justify-between text-left group"
      >
        <span className="text-secondary group-hover:text-primary transition-colors">
          {question}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted shrink-0 ml-4 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {isOpen && (
        <div className="pb-4 text-muted leading-relaxed animate-in fade-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}

export default function SetupPage() {
  return (
    <div className="min-h-screen bg-background text-secondary font-sans">
      {/* Content */}
      <main className="w-full py-12">
        <div className="mx-auto max-w-[85ch] px-6 lg:px-8">
          {/* Header */}
          <header className="mb-12 border-b border-border pb-8">
            <div className="flex items-center gap-3 mb-6 text-sm text-muted">
              <Link
                href="/build-chatgpt"
                className="hover:text-primary transition-colors flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Course
              </Link>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold text-primary mb-4 tracking-tight">
              Local Development Setup
            </h1>
            <p className="text-lg text-muted leading-relaxed">
              Some challenges require dependencies that can&apos;t run in the
              browser. The CLI tool sets up a local workspace and runs the
              test suite for each challenge.
            </p>
          </header>

          {/* Step 1 */}
          <section style={{ marginBottom: "var(--space-section)" }}>
            <h2 className="text-xl font-semibold text-primary mb-1">
              1. Install the CLI
            </h2>
            <CodeBlock>{`pip install ai-deep-dive`}</CodeBlock>
            <p className="text-lg text-secondary leading-relaxed">
              This installs the{" "}
              <code className="px-1.5 py-0.5 bg-surface rounded text-sm text-secondary">
                ai-deep-dive
              </code>{" "}
              command globally. Requires Python 3.8 or later.
            </p>
          </section>

          {/* Step 2 */}
          <section style={{ marginBottom: "var(--space-section)" }}>
            <h2 className="text-xl font-semibold text-primary mb-1">
              2. Initialize the course
            </h2>
            <CodeBlock>{`ai-deep-dive init build-chatgpt`}</CodeBlock>
            <p className="text-lg text-secondary leading-relaxed">
              Creates a workspace folder with starter files for every challenge,
              organized by chapter.
            </p>

            {/* Folder structure */}
            <div className="mt-6 p-4 bg-[#121212] rounded-lg border border-zinc-800">
              <div className="flex items-center gap-2 text-secondary font-mono text-sm mb-3">
                <Folder className="w-4 h-4 text-amber-400" />
                <span>build-chatgpt/</span>
              </div>
              <div className="ml-6 space-y-2 font-mono text-sm">
                <div className="flex items-center gap-2 text-muted">
                  <Folder className="w-4 h-4 text-zinc-600" />
                  <span>01-from-text-to-bytes/</span>
                </div>
                <div className="ml-6 space-y-1">
                  <div className="flex items-center gap-2 text-muted">
                    <FileCode className="w-4 h-4 text-zinc-600" />
                    <span>01-01_utf8_encode.py</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted">
                    <FileCode className="w-4 h-4 text-zinc-600" />
                    <span>01-02_utf8_decode.py</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-muted">
                  <Folder className="w-4 h-4 text-zinc-600" />
                  <span>02-tokenization/</span>
                </div>
                <div className="ml-6">
                  <span className="text-zinc-600">...</span>
                </div>
              </div>
            </div>

            <p className="text-muted leading-relaxed mt-4">
              Use{" "}
              <code className="px-1.5 py-0.5 bg-surface rounded text-sm">
                --dir my-folder
              </code>{" "}
              if you want a different folder name.
            </p>
          </section>

          {/* Step 3 */}
          <section style={{ marginBottom: "var(--space-section)" }}>
            <h2 className="text-xl font-semibold text-primary mb-1">
              3. Work on a challenge
            </h2>
            <CodeBlock>{`cd build-chatgpt
nvim .  # or your preferred editor`}</CodeBlock>
            <p className="text-lg text-secondary leading-relaxed">
              Open the folder in your editor and find the challenge file. Each
              filename starts with the challenge ID, for example{" "}
              <code className="px-1.5 py-0.5 bg-surface rounded text-sm text-secondary">
                01-02
              </code>{" "}
              means Chapter 1, Challenge 2.
            </p>
          </section>

          {/* Step 4 */}
          <section style={{ marginBottom: "var(--space-section)" }}>
            <h2 className="text-xl font-semibold text-primary mb-1">
              4. Test your solution
            </h2>
            <CodeBlock>{`ai-deep-dive test 01-02`}</CodeBlock>
            <p className="text-lg text-secondary leading-relaxed">
              Runs the test suite for that challenge. The CLI expects the
              filename to follow the naming convention and searches the current
              directory recursively, so you can organize your folders however
              you prefer.
            </p>
          </section>

          {/* Step 5 */}
          <section style={{ marginBottom: "var(--space-section)" }}>
            <h2 className="text-xl font-semibold text-primary mb-1">
              5. Sync your progress
            </h2>
            <CodeBlock>{`ai-deep-dive sync`}</CodeBlock>
            <p className="text-lg text-secondary leading-relaxed">
              Automatically imports locally completed challenges to the website.
              Progress is stored in your browser on this machine.
            </p>
          </section>

          {/* Other commands */}
          <section style={{ marginBottom: "var(--space-section)" }}>
            <h2 className="text-xl font-semibold text-primary mb-4">
              Other commands
            </h2>
            <div className="space-y-3 text-lg">
              <div className="flex gap-4">
                <code className="text-secondary font-mono shrink-0 w-28">
                  status
                </code>
                <span className="text-muted">
                  Shows which challenges you&apos;ve completed locally
                </span>
              </div>
              <div className="flex gap-4">
                <code className="text-secondary font-mono shrink-0 w-28">
                  list
                </code>
                <span className="text-muted">Lists all available courses</span>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section className="pt-8 border-t border-border">
            <h2 className="text-xl font-semibold text-primary mb-2">
              FAQs
            </h2>
            <div>
              <FAQItem question="Do I need a GPU?">
                <p>
                  No. All challenges run on CPU. The final training projects
                  work best with a GPU, but you can reduce the model size and
                  train on CPU if needed.
                </p>
              </FAQItem>

              <FAQItem question="I'm getting import errors">
                <p className="mb-3">
                  Install the required packages. For example:
                </p>
                <code className="block px-3 py-2 bg-[#121212] border border-zinc-800 rounded text-sm font-mono">
                  pip install torch numpy
                </code>
              </FAQItem>

              <FAQItem question="Can I work offline?">
                <p>
                  Yes. After running{" "}
                  <code className="px-1.5 py-0.5 bg-surface rounded text-sm">
                    ai-deep-dive init
                  </code>
                  , all files and tests are stored locally. You only need
                  internet to sync progress to the website.
                </p>
              </FAQItem>
            </div>
          </section>

          {/* Back link */}
          <section className="pt-10">
            <Link
              href="/build-chatgpt"
              className="text-muted hover:text-primary transition-colors inline-flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Course
            </Link>
          </section>
        </div>
      </main>
    </div>
  );
}
