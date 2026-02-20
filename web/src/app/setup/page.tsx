"use client";

import Link from "next/link";
import { CheckCircle2, Copy, ChevronLeft, ChevronDown } from "lucide-react";
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
      <pre className="p-4 bg-terminal rounded-lg border border-border font-mono text-sm text-secondary overflow-x-auto">
        {children}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 p-1.5 rounded bg-surface text-muted hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? (
          <CheckCircle2 className="w-4 h-4 text-success" />
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
      <main className="w-full py-12">
        <div className="mx-auto max-w-[85ch] px-6 lg:px-8">
          <header className="mb-12 border-b border-border pb-8">
            <div className="flex items-center gap-3 mb-6 text-sm text-muted">
              <Link
                href="/build-gpt"
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
              Chapter challenges are solved in the browser. The CLI is
              temporarily frozen while we redesign it for project-focused local
              workflows.
            </p>
          </header>

          <section style={{ marginBottom: "var(--space-section)" }}>
            <h2 className="text-xl font-semibold text-primary mb-1">
              1. Install the CLI package
            </h2>
            <CodeBlock>{`pip install ai-deep-dive`}</CodeBlock>
            <p className="text-lg text-secondary leading-relaxed">
              This installs the command globally. Requires Python 3.9 or later.
            </p>
          </section>

          <section style={{ marginBottom: "var(--space-section)" }}>
            <h2 className="text-xl font-semibold text-primary mb-1">
              2. Current CLI behavior
            </h2>
            <CodeBlock>{`ai-deep-dive
ai-deep-dive --version`}</CodeBlock>
            <p className="text-lg text-secondary leading-relaxed">
              Running the root command prints a temporary freeze message.
              Version output remains available.
            </p>
          </section>

          <section style={{ marginBottom: "var(--space-section)" }}>
            <h2 className="text-xl font-semibold text-primary mb-1">
              3. Build GPT chapter challenges today
            </h2>
            <p className="text-lg text-secondary leading-relaxed">
              Continue chapter challenge work directly in the browser course
              interface. Public tests run there without local CLI setup.
            </p>
            <p className="text-muted leading-relaxed mt-4">
              Open the course: {" "}
              <Link
                href="/build-gpt"
                className="underline underline-offset-2 hover:text-primary"
              >
                Build GPT
              </Link>
            </p>
          </section>

          <section style={{ marginBottom: "var(--space-section)" }}>
            <h2 className="text-xl font-semibold text-primary mb-1">
              4. Next CLI scope
            </h2>
            <p className="text-lg text-secondary leading-relaxed">
              The next CLI release is focused on local project workflows
              (starting with GPT project implementation support), not chapter
              challenge orchestration.
            </p>
          </section>

          <section style={{ marginBottom: "var(--space-section)" }}>
            <h2 className="text-xl font-semibold text-primary mb-4">
              Unavailable during freeze
            </h2>
            <div className="space-y-3 text-lg">
              <div className="flex gap-4">
                <code className="text-secondary font-mono shrink-0 w-40">
                  init
                </code>
                <span className="text-muted">Not exposed right now</span>
              </div>
              <div className="flex gap-4">
                <code className="text-secondary font-mono shrink-0 w-40">
                  test / submit
                </code>
                <span className="text-muted">Not exposed right now</span>
              </div>
              <div className="flex gap-4">
                <code className="text-secondary font-mono shrink-0 w-40">
                  status / list / sync
                </code>
                <span className="text-muted">Not exposed right now</span>
              </div>
              <div className="flex gap-4">
                <code className="text-secondary font-mono shrink-0 w-40">
                  config
                </code>
                <span className="text-muted">Not exposed right now</span>
              </div>
            </div>
          </section>

          <section className="pt-8 border-t border-border">
            <h2 className="text-xl font-semibold text-primary mb-2">
              FAQs
            </h2>
            <div>
              <FAQItem question="Do I need a GPU?">
                <p>
                  Not for chapter challenges in the browser. For larger local
                  project training runs, a GPU can help reduce runtime.
                </p>
              </FAQItem>

              <FAQItem question="Why are CLI challenge commands unavailable?">
                <p>
                  We intentionally froze the old challenge-oriented CLI surface
                  while we replace it with a project-focused workflow.
                </p>
              </FAQItem>

              <FAQItem question="Can I still complete Build GPT chapters now?">
                <p>
                  Yes. Chapter challenges continue to run in the browser
                  experience.
                </p>
              </FAQItem>
            </div>
          </section>

          <section className="pt-10">
            <Link
              href="/build-gpt"
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
