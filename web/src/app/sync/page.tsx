"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronLeft,
  RefreshCw,
} from "lucide-react";
import { getCourseConfig } from "@/lib/course-config";

type SyncStatus = "loading" | "success" | "error" | "empty";

interface SyncResult {
  courseId: string;
  courseName: string;
  challengeIds: string[];
  newlySynced: number;
  alreadySynced: number;
}

function parseHash(
  hash: string
): { courseId: string; challengeIds: string[] } | null {
  // Format: #course_id:challenge1,challenge2,...
  const cleanHash = hash.startsWith("#") ? hash.slice(1) : hash;

  if (!cleanHash) return null;

  const [courseId, challengesStr] = cleanHash.split(":");

  if (!courseId || !challengesStr) return null;

  const challengeIds = challengesStr
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  if (challengeIds.length === 0) return null;

  return { courseId, challengeIds };
}

function syncChallenges(courseId: string, challengeIds: string[]): SyncResult {
  const courseConfig = getCourseConfig(courseId);
  const courseName = courseConfig?.title || courseId;

  let newlySynced = 0;
  let alreadySynced = 0;

  for (const challengeId of challengeIds) {
    const key = `sol_${challengeId}_status`;
    const existingStatus = localStorage.getItem(key);

    if (existingStatus === "solved") {
      alreadySynced++;
    } else {
      localStorage.setItem(key, "solved");
      newlySynced++;
    }
  }

  return {
    courseId,
    courseName,
    challengeIds,
    newlySynced,
    alreadySynced,
  };
}

export default function SyncPage() {
  const [status, setStatus] = useState<SyncStatus>("loading");
  const [result, setResult] = useState<SyncResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const performSync = useCallback(() => {
    // Small delay for UX - shows loading state
    const timer = setTimeout(() => {
      try {
        const hash = window.location.hash;
        const parsed = parseHash(hash);

        if (!parsed) {
          setStatus("empty");
          setErrorMessage(
            "No sync data found in URL. Please run 'ai-deep-dive sync' from your terminal."
          );
          return;
        }

        const { courseId, challengeIds } = parsed;

        // Validate course exists
        const courseConfig = getCourseConfig(courseId);
        if (!courseConfig) {
          setStatus("error");
          setErrorMessage(
            `Unknown course: "${courseId}". Make sure you're using the correct sync link.`
          );
          return;
        }

        // Perform the sync
        const syncResult = syncChallenges(courseId, challengeIds);
        setResult(syncResult);
        setStatus("success");
      } catch (error) {
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "An unexpected error occurred"
        );
      }
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    performSync();
  }, [performSync]);

  return (
    <div className="min-h-screen bg-background text-secondary font-sans">
      <main className="w-full py-12">
        <div className="mx-auto max-w-[85ch] px-6 lg:px-8">
          {/* Header */}
          <header className="mb-12 border-b border-border pb-8">
            <div className="flex items-center gap-3 mb-6 text-sm text-muted">
              <Link
                href="/"
                className="hover:text-primary transition-colors flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Home
              </Link>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold text-primary mb-4 tracking-tight">
              Sync Progress
            </h1>
            <p className="text-lg text-muted leading-relaxed">
              Import your locally completed challenges to this browser.
            </p>
          </header>

          {/* Status Content */}
          <div
            className="flex flex-col items-center justify-center py-16"
            style={{ minHeight: "40vh" }}
          >
            {status === "loading" && <LoadingState />}
            {status === "success" && result && <SuccessState result={result} />}
            {status === "error" && <ErrorState message={errorMessage} />}
            {status === "empty" && <EmptyState message={errorMessage} />}
          </div>
        </div>
      </main>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="w-16 h-16 rounded-full bg-surface border border-border flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-muted animate-spin" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-primary mb-2">Syncing...</h2>
        <p className="text-muted">Importing your progress from the CLI</p>
      </div>
    </div>
  );
}

function SuccessState({ result }: { result: SyncResult }) {
  const totalChallenges = result.challengeIds.length;
  const hasNew = result.newlySynced > 0;

  return (
    <div className="flex flex-col items-center gap-8 text-center max-w-md">
      {/* Success Icon */}
      <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-400" />
      </div>

      {/* Message */}
      <div>
        <h2 className="text-2xl font-bold text-primary mb-3">
          {hasNew ? "Sync Complete!" : "Already Synced"}
        </h2>
        <p className="text-secondary leading-relaxed">
          {hasNew ? (
            <>
              <span className="text-emerald-400 font-semibold">
                {result.newlySynced} challenge
                {result.newlySynced !== 1 ? "s" : ""}
              </span>{" "}
              imported from{" "}
              <span className="text-primary">{result.courseName}</span>
            </>
          ) : (
            <>
              All {totalChallenges} challenge{totalChallenges !== 1 ? "s" : ""}{" "}
              were already synced for{" "}
              <span className="text-primary">{result.courseName}</span>
            </>
          )}
        </p>
      </div>

      {/* Summary Box */}
      <div className="w-full p-4 bg-[#121212] rounded-lg border border-zinc-800">
        <div className="flex justify-between items-center">
          <span className="text-muted text-sm">Course</span>
          <span className="text-secondary font-medium">
            {result.courseName}
          </span>
        </div>
        <div className="border-t border-zinc-800 my-3" />
        <div className="flex justify-between items-center">
          <span className="text-muted text-sm">Newly synced</span>
          <span
            className={`font-mono ${
              result.newlySynced > 0 ? "text-emerald-400" : "text-muted"
            }`}
          >
            {result.newlySynced}
          </span>
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-muted text-sm">Already synced</span>
          <span className="font-mono text-muted">{result.alreadySynced}</span>
        </div>
        <div className="border-t border-zinc-800 my-3" />
        <div className="flex justify-between items-center">
          <span className="text-muted text-sm">Total</span>
          <span className="font-mono text-secondary">{totalChallenges}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 w-full">
        <Link
          href={`/${result.courseId}`}
          className="flex-1 px-6 py-3 bg-surface border border-border rounded-lg text-center text-primary font-medium hover:border-zinc-600 hover:bg-zinc-800 transition-colors"
        >
          Continue Course
        </Link>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center max-w-md">
      {/* Error Icon */}
      <div className="w-16 h-16 rounded-full bg-rose-500/20 border border-rose-400/50 flex items-center justify-center">
        <XCircle className="w-8 h-8 text-rose-400" />
      </div>

      {/* Message */}
      <div>
        <h2 className="text-xl font-semibold text-primary mb-2">Sync Failed</h2>
        <p className="text-muted leading-relaxed">{message}</p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 w-full">
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-surface border border-border rounded-lg text-secondary font-medium hover:border-zinc-600 hover:text-primary transition-colors flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
        <Link
          href="/setup"
          className="px-6 py-3 text-muted hover:text-primary transition-colors text-center"
        >
          View Setup Guide
        </Link>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center max-w-md">
      {/* Empty Icon */}
      <div className="w-16 h-16 rounded-full bg-surface border border-border flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-muted" />
      </div>

      {/* Message */}
      <div>
        <h2 className="text-xl font-semibold text-primary mb-2">
          No Sync Data
        </h2>
        <p className="text-muted leading-relaxed">{message}</p>
      </div>

      {/* How to sync */}
      <div className="w-full p-4 bg-[#121212] rounded-lg border border-zinc-800 text-left">
        <p className="text-xs font-medium text-muted uppercase tracking-wider mb-3">
          To sync your progress
        </p>
        <ol className="space-y-2 text-sm text-secondary">
          <li className="flex gap-2">
            <span className="text-muted font-mono">1.</span>
            <span>Open a terminal in your course folder</span>
          </li>
          <li className="flex gap-2">
            <span className="text-muted font-mono">2.</span>
            <span>
              Run{" "}
              <code className="px-1.5 py-0.5 bg-surface rounded text-sm text-secondary">
                ai-deep-dive sync
              </code>
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-muted font-mono">3.</span>
            <span>Your browser will open with the sync link</span>
          </li>
        </ol>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 w-full">
        <Link
          href="/setup"
          className="px-6 py-3 bg-surface border border-border rounded-lg text-center text-primary font-medium hover:border-zinc-600 hover:bg-zinc-800 transition-colors"
        >
          View Setup Guide
        </Link>
        <Link
          href="/"
          className="px-6 py-3 text-muted hover:text-primary transition-colors text-center"
        >
          Go to Home
        </Link>
      </div>
    </div>
  );
}
