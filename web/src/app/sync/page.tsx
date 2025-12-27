"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { getCourseConfig } from "@/lib/course-config";
import { isChallengeSolved, markChallengesSolved } from "@/lib/challenge-storage";

type Status = "loading" | "success" | "error";

export default function SyncPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [courseName, setCourseName] = useState("");
  const [courseId, setCourseId] = useState("");
  const [newlySynced, setNewlySynced] = useState(0);
  const [alreadySynced, setAlreadySynced] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const hash = window.location.hash.slice(1); // Remove #
    if (!hash) {
      setError("No sync data. Run 'ai-deep-dive sync' from your terminal.");
      setStatus("error");
      return;
    }

    const [cId, challengesStr] = hash.split(":");
    if (!cId || !challengesStr) {
      setError("Invalid sync URL format.");
      setStatus("error");
      return;
    }

    const config = getCourseConfig(cId);
    if (!config) {
      setError(`Unknown course: "${cId}"`);
      setStatus("error");
      return;
    }

    setCourseId(cId);
    setCourseName(config.title);

    // Sync challenges to localStorage
    const challenges = challengesStr.split(",").filter(Boolean);
    const newlySolved: string[] = [];
    let existingCount = 0;

    for (const id of challenges) {
      if (isChallengeSolved(cId, id)) {
        existingCount++;
      } else {
        newlySolved.push(id);
      }
    }

    markChallengesSolved(cId, newlySolved);

    setNewlySynced(newlySolved.length);
    setAlreadySynced(existingCount);
    setStatus("success");
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        {status === "loading" && (
          <>
            <Loader2 className="w-12 h-12 text-muted animate-spin mx-auto mb-4" />
            <p className="text-muted">Syncing...</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-16 h-16 rounded-full bg-rose-500/20 border border-rose-400/50 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-rose-400" />
            </div>
            <h1 className="text-xl font-semibold text-primary mb-2">
              Sync Failed
            </h1>
            <p className="text-muted mb-6">{error}</p>
            <Link
              href="/setup"
              className="text-secondary hover:text-primary underline"
            >
              View Setup Guide
            </Link>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h1 className="text-xl font-semibold text-primary mb-2">
              {newlySynced > 0 ? "Sync Complete!" : "Already Synced"}
            </h1>
            <p className="text-muted mb-6">{courseName}</p>

            <div className="p-4 bg-[#121212] rounded-lg border border-zinc-800 mb-6 text-left">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Newly synced</span>
                <span
                  className={
                    newlySynced > 0 ? "text-emerald-400" : "text-muted"
                  }
                >
                  {newlySynced}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-muted">Already synced</span>
                <span className="text-muted">{alreadySynced}</span>
              </div>
            </div>

            <Link
              href={`/${courseId}`}
              className="block w-full px-4 py-2 bg-surface border border-border rounded-lg text-primary hover:bg-zinc-800 transition-colors"
            >
              Continue Course
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
