"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { getCourseConfig } from "@/lib/course-config";
import { isChallengeSolved, markChallengesSolved } from "@/lib/challenge-storage";

type Status = "loading" | "success" | "error";
type SyncViewModel =
  | { status: "loading" }
  | { status: "error"; error: string }
  | {
      status: "success";
      courseId: string;
      courseName: string;
      newlySolvedIds: string[];
      newlySynced: number;
      alreadySynced: number;
    };

const NOOP_SUBSCRIBE = () => () => {};
const SERVER_HASH_SENTINEL = "__SERVER__";

export default function SyncPage() {
  const hash = useSyncExternalStore(
    NOOP_SUBSCRIBE,
    () => window.location.hash.slice(1),
    () => SERVER_HASH_SENTINEL
  );
  const hasAppliedSyncRef = useRef(false);

  const viewModel = useMemo<SyncViewModel>(() => {
    if (hash === SERVER_HASH_SENTINEL) {
      return { status: "loading" };
    }

    // Remove leading #
    if (!hash) {
      return {
        status: "error",
        error:
          "No sync data. CLI sync is temporarily unavailable. See /setup for the latest status.",
      };
    }

    const [cId, challengesStr] = hash.split(":");
    if (!cId || !challengesStr) {
      return { status: "error", error: "Invalid sync URL format." };
    }

    const config = getCourseConfig(cId);
    if (!config) {
      return { status: "error", error: `Unknown course: "${cId}"` };
    }

    const challenges = challengesStr.split(",").filter(Boolean);
    const newlySolvedIds: string[] = [];
    let alreadySynced = 0;

    for (const id of challenges) {
      if (isChallengeSolved(cId, id)) {
        alreadySynced++;
      } else {
        newlySolvedIds.push(id);
      }
    }

    return {
      status: "success",
      courseId: cId,
      courseName: config.title,
      newlySolvedIds,
      newlySynced: newlySolvedIds.length,
      alreadySynced,
    };
  }, [hash]);

  useEffect(() => {
    if (viewModel.status !== "success" || hasAppliedSyncRef.current) {
      return;
    }
    markChallengesSolved(viewModel.courseId, viewModel.newlySolvedIds);
    hasAppliedSyncRef.current = true;
  }, [viewModel]);

  const status: Status = viewModel.status;

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
            <p className="text-muted mb-6">
              {viewModel.status === "error" ? viewModel.error : ""}
            </p>
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
              {viewModel.status === "success" && viewModel.newlySynced > 0
                ? "Sync Complete!"
                : "Already Synced"}
            </h1>
            <p className="text-muted mb-6">
              {viewModel.status === "success" ? viewModel.courseName : ""}
            </p>

            <div className="p-4 bg-[#121212] rounded-lg border border-zinc-800 mb-6 text-left">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Newly synced</span>
                <span
                  className={
                    viewModel.status === "success" && viewModel.newlySynced > 0
                      ? "text-emerald-400"
                      : "text-muted"
                  }
                >
                  {viewModel.status === "success" ? viewModel.newlySynced : 0}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-muted">Already synced</span>
                <span className="text-muted">
                  {viewModel.status === "success" ? viewModel.alreadySynced : 0}
                </span>
              </div>
            </div>

            <Link
              href={
                viewModel.status === "success" ? `/${viewModel.courseId}` : "/"
              }
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
