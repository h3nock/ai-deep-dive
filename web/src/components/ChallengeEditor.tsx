"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Group, Panel, Separator, usePanelRef } from "react-resizable-panels";
import { useTheme } from "next-themes";
import {
  Play,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  Code2,
  Settings,
  X,
  Plus,
  Loader2,
  RotateCcw,
  Send,
  ChevronUp,
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import Editor, { useMonaco } from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  loadPyodide,
  isPyodideLoaded,
  runTestsWithPyodide,
  type TestConfig,
} from "@/lib/pyodide";
import type { RunResult, TestStatus, TestSummary } from "@/lib/test-results";
import { runOnJudge, submitToJudge, waitForJudgeResult } from "@/lib/judge-client";
import type { JudgeJobResult } from "@/lib/judge-client";
import type { Challenge, TestCase } from "@/lib/challenge-types";
import { createMonacoTheme, getMonacoThemeName } from "@/lib/monaco-theme";
import type {
  MonacoEditorInstance,
  MonacoInstance,
  MonacoVimSession,
  MonacoVimModule,
} from "@/types/challenge-editor";
import { ConfirmModal } from "./ConfirmModal";
import {
  getChallengeCode,
  isChallengeSolved,
  markChallengeSolved,
  removeChallengeCode,
  setChallengeCode,
} from "@/lib/challenge-storage";

let monacoVimModulePromise: Promise<MonacoVimModule> | null = null;

function loadMonacoVim(): Promise<MonacoVimModule> {
  if (!monacoVimModulePromise) {
    monacoVimModulePromise = import("monaco-vim").then((module) => ({
      initVimMode: module.initVimMode as MonacoVimModule["initVimMode"],
    }));
  }

  return monacoVimModulePromise;
}

function withJitter(baseMs: number, ratio = 0.1): number {
  const delta = Math.max(1, Math.floor(baseMs * ratio));
  const offset = Math.floor(Math.random() * (2 * delta + 1)) - delta;
  return Math.max(100, baseMs + offset);
}

function compileInputCode(
  inputs: Record<string, string>,
  argOrder: Challenge["arguments"]
): string {
  return argOrder.map((arg) => `${arg.name} = ${inputs[arg.name]}`).join("\n") + "\n";
}

function requiresServer(challenge: Challenge): boolean {
  return challenge.executionProfile === "torch";
}

export interface ChallengeEditorProps {
  courseId: string;
  challenges: Challenge[];
  activeChallengeIndex: number;
  setActiveChallengeIndex: (index: number | null) => void;
}

function cleanDisplayValue(value: string): string {
  return value.replace(/, dtype=torch\.float32/g, "");
}

function ExampleCard({
  testCase,
  argOrder,
  index,
}: {
  testCase: TestCase;
  argOrder: Challenge["arguments"];
  index: number;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="rounded-md border border-border overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-surface/50 hover:bg-surface transition-colors text-left"
      >
        <span className="text-xs font-medium text-muted">
          Example {index + 1}
        </span>
        {isOpen ? (
          <ChevronUp className="w-3 h-3 text-muted" />
        ) : (
          <ChevronDown className="w-3 h-3 text-muted" />
        )}
      </button>

      {isOpen && (
        <div className="bg-terminal px-3 py-2">
          {/* Input */}
          <div className="mb-2">
            <label className="text-[11px] font-medium text-muted uppercase tracking-wide">
              Input
            </label>
            <div className="mt-1 font-mono text-[13px] text-secondary whitespace-pre-wrap break-all leading-relaxed">
              {argOrder
                .map((arg) => `${arg.name} = ${cleanDisplayValue(testCase.inputs[arg.name] ?? "")}`)
                .join("\n")}
            </div>
          </div>

          {/* Output */}
          <div>
            <label className="text-[11px] font-medium text-muted uppercase tracking-wide">
              Output
            </label>
            <div className="mt-1 font-mono text-[13px] text-secondary whitespace-pre-wrap break-all leading-relaxed">
              {testCase.expected_literal}
            </div>
          </div>

          {/* Explanation */}
          {testCase.explanation && (
            <div className="mt-2">
              <label className="text-[11px] font-medium text-muted uppercase tracking-wide">
                Explanation
              </label>
              <div className="mt-1 text-[13px] text-secondary/80 font-sans leading-relaxed">
                {testCase.explanation}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AutoResizeTextarea({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      rows={1}
      style={{ overflow: "hidden" }}
    />
  );
}

interface ChallengeEditorContentProps extends ChallengeEditorProps {
  activeChallenge: Challenge;
}

export function ChallengeEditor(props: ChallengeEditorProps) {
  const activeChallenge = props.challenges[props.activeChallengeIndex];
  if (!activeChallenge) {
    return null;
  }

  return <ChallengeEditorContent {...props} activeChallenge={activeChallenge} />;
}

function ChallengeEditorContent({
  courseId,
  challenges,
  activeChallengeIndex,
  setActiveChallengeIndex,
  activeChallenge,
}: ChallengeEditorContentProps) {
  const { resolvedTheme } = useTheme();
  const colorMode = resolvedTheme === "light" ? "light" as const : "dark" as const;
  const monacoInstanceRef = useRef<MonacoInstance | null>(null);

  const [code, setCode] = useState("");
  const [isSolved, setIsSolved] = useState(false);
  const [lastRunMode, setLastRunMode] = useState<"run" | "submit" | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Active Pane Tracking - for focus ring styling
  const [activePane, setActivePane] = useState<"prose" | "editor">("editor");

  // Test Case State — working copies of publicCases, mutable by user
  const [workingCases, setWorkingCases] = useState<TestCase[]>([]);
  const originalCasesRef = useRef<TestCase[]>([]);
  const [activeTestCaseId, setActiveTestCaseId] = useState<string>("");
  const [runResult, setRunResult] = useState<RunResult | null>(null);

  const [isVimMode, setIsVimMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("editor_vim_mode") === "true";
    }
    return false;
  });
  // Bottom Panel State
  const bottomPanelRef = usePanelRef();
  const [isBottomPanelCollapsed, setIsBottomPanelCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<"testcases" | "result">(
    "testcases"
  );

  // Execution State
  const [isRunning, setIsRunning] = useState(false);
  const [runMessage, setRunMessage] = useState("");

  // Pyodide State
  const [pyodideStatus, setPyodideStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [executionMode, setExecutionMode] = useState<"browser" | "server">(
    "browser"
  );
  const formatServerError = useCallback(() => {
    return "Something went wrong on our side. Please retry.";
  }, []);
  const toErrorStatus = useCallback((status?: string): TestStatus => {
    if (status === "Time Limit Exceeded") return "Time Limit Exceeded";
    if (status === "Memory Limit Exceeded") return "Memory Limit Exceeded";
    return "Runtime Error";
  }, []);
  const toErrorResult = useCallback(
    (status: TestStatus, message: string, summary?: TestSummary): RunResult => ({
      status,
      summary: summary ?? { total: 0, passed: 0, failed: 0 },
      tests: [
        {
          id: "error",
          status,
          input: "",
          stdout: "",
          output: "",
          expected: "",
          stderr: message,
        },
      ],
    }),
    []
  );
  const normalizeBrowserResults = useCallback(
    (result: RunResult | null): { result?: RunResult; systemError?: string } => {
      if (!result) {
        return { systemError: formatServerError() };
      }
      return { result };
    },
    [formatServerError]
  );
  const normalizeServerResult = useCallback(
    (result: JudgeJobResult): { result?: RunResult; systemError?: string } => {
      if (result.status === "error") {
        if (result.error_kind === "internal") {
          return { systemError: formatServerError() };
        }

        const errorStatus = toErrorStatus(result.result?.status);
        const errorMessage = (result.error || result.result?.error || errorStatus).trim();
        return {
          result: toErrorResult(errorStatus, errorMessage, result.result?.summary),
        };
      }

      const payload = result.result;
      if (!payload || !payload.summary) {
        return { systemError: formatServerError() };
      }

      return { result: payload };
    },
    [formatServerError, toErrorResult, toErrorStatus]
  );
  const isErrorStatus = useCallback(
    (status: TestStatus) =>
      status === "Runtime Error" ||
      status === "Time Limit Exceeded" ||
      status === "Memory Limit Exceeded",
    []
  );
  // We don't need to debounce test cases for sync anymore, we send them on run

  const monaco = useMonaco();
  const editorRef = useRef<MonacoEditorInstance | null>(null);
  const vimModeRef = useRef<MonacoVimSession | null>(null);
  const isVimModeInitializedRef = useRef(false); // Track if vim was loaded from localStorage
  const isRunningRef = useRef(false); // Guard against concurrent executions
  const currentChallengeIdRef = useRef<string | null>(null); // Track challenge for race condition
  const pyodideStatusRef = useRef(pyodideStatus);
  const pyodideLoadPromiseRef = useRef<Promise<void> | null>(null);
  const hasTriggeredPyodidePreloadRef = useRef(false);
  const monacoWarmupHandleRef = useRef<
    { kind: "idle"; id: number } | { kind: "timeout"; id: number } | null
  >(null);
  const judgePollAbortRef = useRef<AbortController | null>(null);

  const cancelScheduledMonacoWarmup = useCallback(() => {
    const handle = monacoWarmupHandleRef.current;
    if (!handle) return;

    monacoWarmupHandleRef.current = null;
    if (handle.kind === "idle") {
      window.cancelIdleCallback?.(handle.id);
      return;
    }

    window.clearTimeout(handle.id);
  }, []);

  const abortJudgePolling = useCallback(() => {
    if (!judgePollAbortRef.current) {
      return;
    }
    judgePollAbortRef.current.abort();
    judgePollAbortRef.current = null;
  }, []);

  const warmMonaco = useCallback(
    (mode: "idle" | "now") => {
      if (typeof window === "undefined") return;

      if (mode === "now") {
        cancelScheduledMonacoWarmup();
        void import("@/lib/monaco-preload").then(({ preloadMonaco }) =>
          preloadMonaco()
        );
        return;
      }

      if (monacoWarmupHandleRef.current) return;

      const run = () => {
        monacoWarmupHandleRef.current = null;
        void import("@/lib/monaco-preload").then(({ preloadMonaco }) =>
          preloadMonaco()
        );
      };

      const ric = window.requestIdleCallback;
      if (ric) {
        const id = ric(run, { timeout: 1500 });
        monacoWarmupHandleRef.current = { kind: "idle", id };
        return;
      }

      const id = window.setTimeout(run, 250);
      monacoWarmupHandleRef.current = { kind: "timeout", id };
    },
    [cancelScheduledMonacoWarmup]
  );

  useEffect(() => cancelScheduledMonacoWarmup, [cancelScheduledMonacoWarmup]);

  useEffect(() => abortJudgePolling, [abortJudgePolling]);

  useEffect(() => {
    abortJudgePolling();
  }, [abortJudgePolling, activeChallenge.id]);

  useEffect(() => {
    pyodideStatusRef.current = pyodideStatus;
    if (pyodideStatus === "ready") {
      hasTriggeredPyodidePreloadRef.current = true;
    }
  }, [pyodideStatus]);

  const setActiveChallengeIndexWithWarmup = useCallback(
    (index: number | null) => {
      if (index !== null) {
        warmMonaco("now");
      }
      setActiveChallengeIndex(index);
    },
    [setActiveChallengeIndex, warmMonaco]
  );

  // Do not auto-load Pyodide on mount. Only mark ready if another challenge already loaded it.
  useEffect(() => {
    if (isPyodideLoaded()) {
      setPyodideStatus("ready");
    }
  }, []);

  // Determine execution mode based on execution profile
  useEffect(() => {
    if (!activeChallenge) return;
    setExecutionMode(requiresServer(activeChallenge) ? "server" : "browser");
  }, [activeChallenge]);

  // React to theme changes
  useEffect(() => {
    if (monacoInstanceRef.current) {
      monacoInstanceRef.current.editor.setTheme(getMonacoThemeName(colorMode));
    }
  }, [colorMode]);

  // Load code from localStorage or use initial code when challenge changes
  useEffect(() => {
    if (!activeChallenge) return;

    currentChallengeIdRef.current = activeChallenge.id;

    const storedCode = getChallengeCode(courseId, activeChallenge.id);
    setCode(storedCode ?? activeChallenge.initialCode);
    setIsSolved(isChallengeSolved(courseId, activeChallenge.id));

    // Initialize working cases from publicCases (synchronous — no bundle fetch)
    const cases = activeChallenge.publicCases;
    const cloned = cases.map((c) => ({
      ...c,
      inputs: { ...c.inputs },
    }));
    originalCasesRef.current = cloned;
    setWorkingCases(
      cases.map((c) => ({ ...c, inputs: { ...c.inputs } }))
    );
    setActiveTestCaseId(cases[0]?.id ?? "");

    setRunResult(null);
    setLastRunMode(null);
  }, [activeChallenge, courseId]);

  // Save code to localStorage with debounce
  useEffect(() => {
    if (!activeChallenge) return;

    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save operation (1000ms)
    saveTimeoutRef.current = setTimeout(() => {
      setChallengeCode(courseId, activeChallenge.id, code);
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [activeChallenge, code, courseId]);

  // Vim Mode Effect
  useEffect(() => {
    if (!editorRef.current || !monaco) return;
    let cancelled = false;

    // Always dispose existing vim mode first
    if (vimModeRef.current) {
      vimModeRef.current.dispose();
      vimModeRef.current = null;
    }

    if (isVimMode) {
      const statusNode = document.getElementById("vim-status-bar");
      void loadMonacoVim()
        .then(({ initVimMode }) => {
          if (cancelled || !editorRef.current) {
            return;
          }
          vimModeRef.current = initVimMode(editorRef.current, statusNode);
        })
        .catch((error) => {
          console.error("Failed to enable Vim mode:", error);
        });
    }

    return () => {
      cancelled = true;
      if (vimModeRef.current) {
        vimModeRef.current.dispose();
        vimModeRef.current = null;
      }
    };
  }, [isVimMode, monaco, activeChallenge.id]);

  // Persist vim mode preference (skip on initial mount to avoid writing the same value back)
  useEffect(() => {
    if (isVimModeInitializedRef.current) {
      localStorage.setItem("editor_vim_mode", isVimMode ? "true" : "false");
    } else {
      isVimModeInitializedRef.current = true;
    }
  }, [isVimMode]);

  // Keep latest handleRun in ref for event listeners
  const handleRunRef = useRef<(mode?: "run" | "submit") => void>(() => {});
  useEffect(() => {
    handleRunRef.current = handleRun;
  });

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Enter = Submit
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleRunRef.current("submit");
      }
      // Cmd/Ctrl + , = Run
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        handleRunRef.current("run");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const ensurePyodideLoaded = useCallback(async () => {
    if (!activeChallenge) return;
    if (executionMode !== "browser") return;
    if (pyodideStatusRef.current === "ready") return;

    if (!pyodideLoadPromiseRef.current) {
      setPyodideStatus("loading");
      pyodideLoadPromiseRef.current = loadPyodide()
        .then(() => {
          setPyodideStatus("ready");
        })
        .catch((error) => {
          setPyodideStatus("error");
          pyodideLoadPromiseRef.current = null;
          throw error;
        });
    }

    return pyodideLoadPromiseRef.current;
  }, [activeChallenge, executionMode]);

  const preloadPyodideOnFirstKey = useCallback(() => {
    if (hasTriggeredPyodidePreloadRef.current) return;
    if (!activeChallenge) return;
    if (executionMode !== "browser") return;
    if (pyodideStatusRef.current === "ready") {
      hasTriggeredPyodidePreloadRef.current = true;
      return;
    }

    hasTriggeredPyodidePreloadRef.current = true;
    void ensurePyodideLoaded().catch(() => {});
  }, [activeChallenge, executionMode, ensurePyodideLoaded]);

  // Editor Command
  const handleEditorDidMount = (
    editor: MonacoEditorInstance,
    monacoInstance: MonacoInstance
  ) => {
    editorRef.current = editor;

    // Store monaco instance for theme switching
    monacoInstanceRef.current = monacoInstance;

    // Theme is already defined in beforeMount, just ensure it's applied
    monacoInstance.editor.setTheme(getMonacoThemeName(colorMode));

    // Add Cmd+Enter / Ctrl+Enter shortcut to editor for Submit
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter, () => {
      handleRunRef.current("submit");
    });

    // Add Cmd+, / Ctrl+, shortcut to editor for Run
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Comma, () => {
      handleRunRef.current("run");
    });

    const preloadDisposable = editor.onKeyDown(() => {
      preloadPyodideOnFirstKey();
      if (hasTriggeredPyodidePreloadRef.current) {
        preloadDisposable.dispose();
      }
    });

    // Initialize vim mode if already enabled from localStorage
    // This handles the case where useEffect runs before the editor mounts
    if (isVimMode && !vimModeRef.current) {
      const statusNode = document.getElementById("vim-status-bar");
      void loadMonacoVim()
        .then(({ initVimMode }) => {
          if (editorRef.current !== editor || vimModeRef.current) {
            return;
          }
          vimModeRef.current = initVimMode(editor, statusNode);
        })
        .catch((error) => {
          console.error("Failed to enable Vim mode:", error);
        });
    }
  };

  // Reset handler
  const handleReset = useCallback(() => {
    if (!activeChallenge) return;
    setShowResetModal(true);
  }, [activeChallenge]);

  const confirmReset = useCallback(() => {
    if (!activeChallenge) return;
    setCode(activeChallenge.initialCode);
    removeChallengeCode(courseId, activeChallenge.id);
  }, [activeChallenge, courseId]);

  const handleRun = useCallback(
    async (mode: "run" | "submit" = "run") => {
      // Guard against concurrent executions
      if (isRunningRef.current) {
        return;
      }

      const useBrowser = executionMode === "browser" && mode === "run";
      const useServer = executionMode === "server" || mode === "submit";

      const casesToRun = workingCases;

      // Validate inputs before run (submit uses canonical server-side cases)
      if (mode === "run") {
        const emptyArgs = casesToRun.flatMap((tc, caseIdx) =>
          activeChallenge.arguments
            .filter((arg) => !tc.inputs[arg.name]?.trim())
            .map((arg) => ({ caseIdx, argName: arg.name }))
        );
        if (emptyArgs.length > 0) {
          const first = emptyArgs[0];
          setActiveTab("testcases");
          setActiveTestCaseId(casesToRun[first.caseIdx]?.id ?? "");
          bottomPanelRef.current?.expand();
          return;
        }
      }

      // Track which challenge we're running for race condition detection
      const runChallengeId = activeChallenge.id;

      if (useBrowser) {
        // === BROWSER EXECUTION (Pyodide) ===
        isRunningRef.current = true;
        setIsRunning(true);
        setRunResult(null);
        setLastRunMode(mode);
        setRunMessage("Running...");
        setActiveTab("result");
        bottomPanelRef.current?.expand();

        try {
          if (pyodideStatusRef.current !== "ready") {
            setRunMessage("Preparing runtime...");
          }
          await ensurePyodideLoaded();

          const config: TestConfig = {
            runner: activeChallenge.runner,
            cases: casesToRun.map((tc) => ({
              id: tc.id,
              input: compileInputCode(tc.inputs, activeChallenge.arguments),
              expected: tc.expected_literal,
            })),
            comparison: activeChallenge.comparison,
          };

          const results = await runTestsWithPyodide(
            code,
            config,
            () => {},
            (text) => setRunMessage(text.trim())
          );

          if (currentChallengeIdRef.current !== runChallengeId) {
            return;
          }

          const normalized = normalizeBrowserResults(results);
          if (normalized.systemError) {
            setRunMessage(normalized.systemError);
            setActiveTab("result");
            bottomPanelRef.current?.expand();
            return;
          }

          const finalResult = normalized.result ?? null;
          if (!finalResult) {
            setRunMessage(formatServerError());
            return;
          }
          setRunResult(finalResult);
          setActiveTab("result");
          setRunMessage("");
          bottomPanelRef.current?.expand();

          const tests = finalResult.tests;
          if (tests.length > 0) {
            if (finalResult.summary.failed === 0) {
              setActiveTestCaseId(tests[0]?.id ?? "");
            } else {
              const firstFailed = tests.find((r) => r.status !== "Accepted") ?? tests[0];
              setActiveTestCaseId(firstFailed?.id ?? "");
            }
          } else {
            setActiveTestCaseId("");
          }

        } catch (err: unknown) {
          if (currentChallengeIdRef.current === runChallengeId) {
            const errorMessage =
              err instanceof Error ? err.message : String(err);
            setPyodideStatus("error");
            setRunMessage(`Error: ${errorMessage}`);
            setActiveTab("result");
            bottomPanelRef.current?.expand();
          }
        } finally {
          isRunningRef.current = false;
          setIsRunning(false);
        }
      } else if (useServer) {
        // === SERVER EXECUTION (Judge VM) ===
        isRunningRef.current = true;
        setIsRunning(true);
        setRunResult(null);
        setLastRunMode(mode);
        setRunMessage("Pending...");
        setActiveTab("result");
        bottomPanelRef.current?.expand();

        let pollAbortController: AbortController | null = null;
        try {
          abortJudgePolling();
          pollAbortController = new AbortController();
          judgePollAbortRef.current = pollAbortController;

          const submit =
            mode === "run"
              ? await runOnJudge({
                  problem_id: activeChallenge.problemId,
                  code,
                  cases: casesToRun.map((tc) => ({
                    id: tc.id,
                    inputs: tc.inputs,
                    expected_literal: tc.expected_literal,
                  })),
                })
              : await submitToJudge({
                  problem_id: activeChallenge.problemId,
                  code,
                });

          const result = await waitForJudgeResult(submit.job_id, {
            timeoutMs: 120000,
            intervalFn: (_attempt, elapsedMs) => {
              if (elapsedMs < 5000) return withJitter(200);
              if (elapsedMs < 20000) return withJitter(500);
              if (elapsedMs < 60000) return withJitter(1000);
              return withJitter(2000);
            },
            signal: pollAbortController.signal,
            onUpdate: (update) => {
              if (update.status === "queued") {
                setRunMessage("Pending...");
              } else if (update.status === "running") {
                setRunMessage("Running...");
              }
            },
          });

          const normalized = normalizeServerResult(result);
          if (normalized.systemError) {
            setRunMessage(normalized.systemError);
            setActiveTab("result");
            bottomPanelRef.current?.expand();
            return;
          }

          if (currentChallengeIdRef.current !== runChallengeId) {
            return;
          }

          const finalResult = normalized.result ?? null;
          if (!finalResult) {
            setRunMessage(formatServerError());
            return;
          }
          setRunResult(finalResult);
          setActiveTab("result");
          setRunMessage("");

          bottomPanelRef.current?.expand();

          const tests = finalResult.tests;
          if (tests.length > 0) {
            if (finalResult.summary.failed === 0) {
              setActiveTestCaseId(tests[0]?.id ?? "");
            } else {
              const firstFailed = tests.find((r) => r.status !== "Accepted") ?? tests[0];
              setActiveTestCaseId(firstFailed?.id ?? "");
            }
          } else {
            setActiveTestCaseId("");
          }

          if (mode === "submit" && finalResult.summary.failed === 0 && activeChallenge) {
            markChallengeSolved(courseId, activeChallenge.id);
            setIsSolved(true);
          }
        } catch (err: unknown) {
          if (err instanceof Error && err.name === "AbortError") {
            return;
          }

          if (currentChallengeIdRef.current === runChallengeId) {
            const errorMessage =
              err instanceof Error ? err.message : String(err ?? "");
            if (errorMessage.includes("Timed out waiting")) {
              setRunMessage("Request took too long. Please try again.");
            } else {
              setRunMessage(formatServerError());
            }
            setActiveTab("result");
            bottomPanelRef.current?.expand();
          }
        } finally {
          if (
            pollAbortController &&
            judgePollAbortRef.current === pollAbortController
          ) {
            judgePollAbortRef.current = null;
          }
          isRunningRef.current = false;
          setIsRunning(false);
        }
      }
    },
    [
      abortJudgePolling,
      code,
      courseId,
      workingCases,
      activeChallenge,
      executionMode,
      ensurePyodideLoaded,
      formatServerError,
      normalizeBrowserResults,
      normalizeServerResult,
    ]
  );

  const toggleBottomPanel = useCallback(() => {
    const panel = bottomPanelRef.current;
    if (!panel) return;
    if (isBottomPanelCollapsed) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, [isBottomPanelCollapsed]);

  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const runShortcut = isMac ? "Cmd + ," : "Ctrl + ,";
  const submitShortcut = isMac ? "Cmd + Enter" : "Ctrl + Enter";

  // Check if the active case is a modified default (has an original to reset to)
  const activeCaseIsModified = React.useMemo(() => {
    const active = workingCases.find((c) => c.id === activeTestCaseId);
    if (!active) return false;
    const original = originalCasesRef.current.find((c) => c.id === active.id);
    if (!original) return false; // cloned case — no original to reset
    return JSON.stringify(active.inputs) !== JSON.stringify(original.inputs);
  }, [workingCases, activeTestCaseId]);

  return (
    <Group orientation="horizontal" className="flex-1 min-h-0 min-w-0 bg-background">
      {/* Left Panel - Prose */}
      <Panel defaultSize="40%" minSize="20%" maxSize="80%">
      <div
        className={`flex flex-col h-full bg-background overflow-hidden transition-colors border-r ${
          activePane === "prose" ? "border-border-hover" : "border-border"
        }`}
        onClick={() => setActivePane("prose")}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="h-11 flex items-center gap-3 px-4 border-b border-border">
            <button
              onClick={() => setActiveChallengeIndexWithWarmup(null)}
              className="flex items-center gap-1 px-2 py-1 hover:bg-surface rounded-md text-muted text-sm font-medium transition-colors"
              title="Back to Challenges"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-primary truncate">
                  {activeChallenge.title}
                </h2>
                {isSolved && (
                  <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                )}
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  activeChallenge.difficulty === "Easy"
                    ? "bg-success/10 text-success"
                    : activeChallenge.difficulty === "Medium"
                      ? "bg-warning/10 text-warning"
                      : "bg-error/10 text-error"
                }`}
              >
                {activeChallenge.difficulty || "Medium"}
              </span>
            </div>
          </div>

          {/* Description - prose handles typography, custom overrides via Tailwind */}
          <div className="flex-1 overflow-y-auto thin-scrollbar p-6 prose prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex]}
            >
              {activeChallenge.description}
            </ReactMarkdown>

            {activeChallenge.hint && (
              <div className="mt-6 pl-4 border-l-2 border-border-hover not-prose">
                <p className="text-xs font-medium text-muted uppercase tracking-wider mb-1">
                  Hint
                </p>
                <p className="text-sm text-secondary">{activeChallenge.hint}</p>
              </div>
            )}

            {/* Example Test Cases */}
            {activeChallenge.publicCases.length > 0 && (
              <div className="mt-8 not-prose">
                <div className="text-xs font-medium text-muted uppercase tracking-wider mb-3">
                  Examples
                </div>
                <div className="flex flex-col gap-3">
                  {activeChallenge.publicCases.map((tc, idx) => (
                    <ExampleCard
                      key={tc.id}
                      testCase={tc}
                      argOrder={activeChallenge.arguments}
                      index={idx}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </Panel>

      {/* Resizer Handle + Editor Panel - Only show when a challenge is selected */}
      {activeChallenge && (
        <>
          <Separator className="w-1.5 flex items-center justify-center group hover:bg-border-hover active:bg-success/50 transition-colors duration-150">
            <div className="w-0.5 h-12 rounded-full bg-muted group-hover:bg-secondary group-hover:h-16 group-active:bg-success group-active:h-16 transition-all duration-150" />
          </Separator>

          {/* Right Panel: Editor */}
          <Panel minSize="20%">
          <div
            className={`flex flex-col h-full bg-background border-l transition-colors overflow-hidden ${
              activePane === "editor" ? "border-border-hover" : "border-border"
            }`}
            onClick={() => setActivePane("editor")}
          >
          <Group orientation="vertical">
            <Panel className="flex flex-col">
            {/* Toolbar */}
            <div className="h-11 flex-shrink-0 flex items-center justify-between px-3 border-b border-border bg-surface">
              <div className="flex items-center gap-1 text-muted text-sm">
                {/* Language Badge */}
                <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted">
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Python</span>
                </div>

                <div className="w-px h-4 bg-border mx-1" />

                {/* Vim Toggle - More subtle */}
                <button
                  onClick={() => setIsVimMode(!isVimMode)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
                    isVimMode
                      ? "text-secondary bg-surface"
                      : "text-muted hover:text-secondary hover:bg-surface"
                  }`}
                  title="Toggle Vim keybindings"
                  aria-label={isVimMode ? "Disable Vim mode" : "Enable Vim mode"}
                  aria-pressed={isVimMode}
                >
                  <Settings className="w-3 h-3" />
                  <span>Vim</span>
                </button>
              </div>
              <div className="flex items-center gap-2" role="toolbar" aria-label="Code actions">
                {/* Reset Button */}
                <button
                  onClick={handleReset}
                  disabled={isRunning}
                  title="Reset to initial code"
                  aria-label="Reset code to initial template"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-secondary hover:text-primary hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium rounded-lg transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  Reset
                </button>

                <div className="w-px h-4 bg-border" aria-hidden="true" />

                {/* Run Code Button (public tests only) */}
                <button
                  onClick={() => handleRun("run")}
                  disabled={isRunning}
                  title={`Run public tests (${runShortcut})`}
                  aria-label={`Run public tests, keyboard shortcut ${runShortcut}`}
                  className="flex items-center gap-2 px-4 py-1.5 hover:bg-surface disabled:text-muted disabled:cursor-not-allowed text-secondary hover:text-primary text-sm font-medium rounded-lg transition-colors"
                >
                  {isRunning && lastRunMode === "run" ? (
                    <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                  ) : (
                    <Play className="w-3 h-3" aria-hidden="true" />
                  )}
                  Run
                </button>

                <div className="w-px h-4 bg-border" aria-hidden="true" />

                {/* Submit Button (all tests on the server) */}
                <button
                  onClick={() => handleRun("submit")}
                  disabled={isRunning}
                  title={`Submit and run all tests (${submitShortcut})`}
                  aria-label={`Submit and run all tests, keyboard shortcut ${submitShortcut}`}
                  className="flex items-center gap-2 px-4 py-1.5 bg-success/10 hover:bg-success/15 disabled:bg-transparent disabled:text-muted disabled:cursor-not-allowed text-success text-sm font-medium rounded-lg transition-colors"
                >
                  {isRunning && lastRunMode === "submit" ? (
                    <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="w-3 h-3" aria-hidden="true" />
                  )}
                  Submit
                </button>
              </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 relative min-h-0 overflow-hidden bg-background">
              <Editor
                height="100%"
                defaultLanguage="python"
                value={code}
                onChange={(value) => setCode(value || "")}
                theme={getMonacoThemeName(colorMode)}
                onMount={handleEditorDidMount}
                beforeMount={(monaco) => {
                  // Define both themes before mount to prevent flash
                  monaco.editor.defineTheme(getMonacoThemeName("dark"), createMonacoTheme("dark"));
                  monaco.editor.defineTheme(getMonacoThemeName("light"), createMonacoTheme("light"));
                }}
                loading={
                  <div className="w-full h-full bg-background pt-2 pl-4 font-mono text-sm leading-5">
                    <div className="space-y-0 animate-pulse">
                      <div className="flex items-center h-5">
                        <span className="text-border-hover w-8 text-right select-none pr-4">1</span>
                        <div className="h-3.5 bg-surface/60 rounded w-56" />
                      </div>
                      <div className="flex items-center h-5">
                        <span className="text-border-hover w-8 text-right select-none pr-4">2</span>
                        <div className="ml-6 h-3.5 bg-surface/40 rounded w-72" />
                      </div>
                      <div className="flex items-center h-5">
                        <span className="text-border-hover w-8 text-right select-none pr-4">3</span>
                        <div className="ml-6 h-3.5 bg-surface/60 rounded w-48" />
                      </div>
                      <div className="flex items-center h-5">
                        <span className="text-border-hover w-8 text-right select-none pr-4">4</span>
                        <div className="ml-6 h-3.5 bg-surface/40 rounded w-80" />
                      </div>
                      <div className="flex items-center h-5">
                        <span className="text-border-hover w-8 text-right select-none pr-4">5</span>
                        <div className="ml-6 h-3.5 bg-surface/60 rounded w-64" />
                      </div>
                    </div>
                  </div>
                }
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  renderLineHighlight: "none",
                }}
              />
              {/* Vim Status Bar */}
              {isVimMode && (
                <div
                  id="vim-status-bar"
                  className="absolute bottom-0 left-0 right-0 px-4 py-1 bg-surface text-secondary text-xs font-mono z-10"
                />
              )}
            </div>

            </Panel>

            {/* Resizer Handle (Bottom) */}
            <Separator className="h-2 flex-shrink-0 flex items-center justify-center border-t group hover:bg-surface/50 hover:border-border-hover active:bg-success/20 active:border-success/50 bg-background border-border transition-colors duration-150">
              <div className="h-0.5 rounded-full w-8 bg-muted group-hover:w-12 group-hover:bg-secondary group-active:w-16 group-active:bg-success transition-all duration-150" />
            </Separator>

            {/* Bottom Panel (Console / Test Cases) */}
            <Panel
              panelRef={bottomPanelRef}
              defaultSize="45%"
              minSize="8%"
              collapsible
              collapsedSize="4%"
              className="flex flex-col"
              onResize={(size) => {
                setIsBottomPanelCollapsed(size.asPercentage <= 4);
              }}
            >
            <div className="bg-background flex flex-col h-full relative">
              {/* Tabs Header */}
              <div
                className={`flex items-center bg-surface ${
                  isBottomPanelCollapsed ? "border-t border-border" : ""
                }`}
                role="tablist"
                aria-label="Output panels"
              >
                <button
                  onClick={() => {
                    setActiveTab("testcases");
                    if (isBottomPanelCollapsed)
                      bottomPanelRef.current?.expand();
                    // Ensure a valid test case is selected
                    if (workingCases.length > 0 && !workingCases.some((tc) => tc.id === activeTestCaseId)) {
                      setActiveTestCaseId(workingCases[0].id);
                    }
                  }}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-r border-border transition-colors ${
                    activeTab === "testcases" && !isBottomPanelCollapsed
                      ? "text-primary bg-background"
                      : "text-muted hover:text-secondary"
                  }`}
                  role="tab"
                  aria-selected={activeTab === "testcases" && !isBottomPanelCollapsed}
                  aria-controls="testcases-panel"
                >
                  Test Cases
                </button>
                <button
                  onClick={() => {
                    setActiveTab("result");
                    if (isBottomPanelCollapsed)
                      bottomPanelRef.current?.expand();
                  }}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-r border-border transition-colors ${
                    activeTab === "result" && !isBottomPanelCollapsed
                      ? "text-primary bg-background"
                      : "text-muted hover:text-secondary"
                  }`}
                  role="tab"
                  aria-selected={activeTab === "result" && !isBottomPanelCollapsed}
                  aria-controls="result-panel"
                >
                  Result
                </button>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Collapse/Expand Toggle Button */}
                <button
                  onClick={toggleBottomPanel}
                  className="px-3 py-2 text-muted hover:text-secondary transition-colors flex items-center gap-1.5"
                  title={
                    isBottomPanelCollapsed ? "Expand panel" : "Collapse panel"
                  }
                  aria-label={isBottomPanelCollapsed ? "Expand output panel" : "Collapse output panel"}
                  aria-expanded={!isBottomPanelCollapsed}
                >
                  {isBottomPanelCollapsed ? (
                    <ChevronUp className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>

              {/* Content - only show when not collapsed */}
              {!isBottomPanelCollapsed && (
                <div className="flex-1 overflow-hidden relative">
                  {activeTab === "testcases" && (
                    <div id="testcases-panel" role="tabpanel" aria-label="Test cases editor" className="flex flex-col h-full">
                      {/* Case Tabs */}
                      <div className="flex items-center gap-0.5 px-3 pt-1 border-b border-border">
                        {workingCases.map((tc, idx) => (
                          <button
                            key={tc.id}
                            onClick={() => setActiveTestCaseId(tc.id)}
                            className={`group/tab px-3 py-1.5 text-xs transition-colors flex items-center gap-1.5 border-b-2 -mb-px ${
                              activeTestCaseId === tc.id
                                ? "border-primary text-primary"
                                : "border-transparent text-muted hover:text-secondary"
                            }`}
                          >
                            Case {idx + 1}
                            {workingCases.length > 1 && (
                              <X
                                className="w-3 h-3 opacity-0 group-hover/tab:opacity-100 hover:text-error transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setWorkingCases((prev) =>
                                    prev.filter((c) => c.id !== tc.id)
                                  );
                                  if (activeTestCaseId === tc.id) {
                                    const remaining = workingCases.filter(
                                      (c) => c.id !== tc.id
                                    );
                                    if (remaining.length > 0) {
                                      setActiveTestCaseId(remaining[0].id);
                                    }
                                  }
                                }}
                              />
                            )}
                          </button>
                        ))}
                        {workingCases.length < 10 && (
                          <button
                            onClick={() => {
                              const source = workingCases[workingCases.length - 1];
                              if (!source) return;
                              const newId = `clone-${Date.now()}`;
                              setWorkingCases((prev) => [
                                ...prev,
                                {
                                  id: newId,
                                  inputs: { ...source.inputs },
                                  expected_literal: source.expected_literal,
                                },
                              ]);
                              setActiveTestCaseId(newId);
                            }}
                            className="px-2 py-1.5 text-muted hover:text-secondary transition-colors -mb-px border-b-2 border-transparent"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Per-parameter input fields */}
                      <div className="flex-1 overflow-y-auto px-4 py-3">
                        {workingCases.map((tc) => {
                          if (tc.id !== activeTestCaseId) return null;
                          return (
                            <div key={tc.id} className="flex flex-col gap-3">
                              {activeChallenge.arguments.map((arg) => (
                                <div key={arg.name}>
                                  <label className="block text-[11px] text-muted mb-0.5 font-mono">
                                    {arg.name} =
                                  </label>
                                  <AutoResizeTextarea
                                    value={tc.inputs[arg.name] ?? ""}
                                    onChange={(val) => {
                                      setWorkingCases((prev) =>
                                        prev.map((c) =>
                                          c.id === tc.id
                                            ? {
                                                ...c,
                                                inputs: {
                                                  ...c.inputs,
                                                  [arg.name]: val,
                                                },
                                              }
                                            : c
                                        )
                                      );
                                    }}
                                    className="w-full bg-surface/60 px-3 py-2 font-mono text-[13px] text-secondary rounded border-none focus:bg-surface focus:outline-none resize-none leading-relaxed"
                                  />
                                </div>
                              ))}

                              {/* Per-case reset — only for modified default cases */}
                              {activeCaseIsModified && (
                                <button
                                  onClick={() => {
                                    const original = originalCasesRef.current.find(
                                      (c) => c.id === tc.id
                                    );
                                    if (!original) return;
                                    setWorkingCases((prev) =>
                                      prev.map((c) =>
                                        c.id === tc.id
                                          ? { ...c, inputs: { ...original.inputs } }
                                          : c
                                      )
                                    );
                                  }}
                                  className="self-start text-xs text-muted hover:text-secondary transition-colors"
                                >
                                  Reset to default
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {activeTab === "result" && (
                    <div id="result-panel" role="tabpanel" aria-label="Test results" className="flex flex-col h-full">
                      {!runResult ? (
                        <div className="flex-1 flex items-center justify-center text-muted/60 text-sm italic">
                          {runMessage || (isRunning ? "Running..." : "You must run your code first")}
                        </div>
                      ) : (
                        <>
                          {/* Overall Status */}
                          <div className="p-4 pb-2">
                            {(() => {
                              const summary = runResult.summary;
                              const allPassed = summary.failed === 0 && summary.total > 0;
                              const statusLabel = runResult.status;

                              if (allPassed) {
                                if (lastRunMode === "submit" && isSolved) {
                                  return (
                                    <div className="flex flex-col gap-3">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                                            <CheckCircle2 className="w-5 h-5 text-success" />
                                          </div>
                                          <div>
                                            <h3 className="text-primary font-semibold">
                                              Challenge Complete
                                            </h3>
                                            <p className="text-sm text-muted">
                                              {summary.passed} / {summary.total} tests passed
                                            </p>
                                          </div>
                                        </div>
                                        {activeChallengeIndex <
                                          challenges.length - 1 && (
                                          <button
                                            onClick={() =>
                                              setActiveChallengeIndexWithWarmup(
                                                activeChallengeIndex + 1
                                              )
                                            }
                                            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-surface hover:bg-border-hover text-secondary hover:text-primary rounded-md transition-colors group"
                                          >
                                            <span>Next Challenge</span>
                                            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                }

                                return (
                                  <div className="flex items-center justify-between">
                                    <h3 className="text-success font-medium flex items-center gap-2">
                                      <CheckCircle2 className="w-4 h-4" />
                                      {summary.passed} / {summary.total} tests passed
                                    </h3>
                                    {lastRunMode === "run" && !isSolved && (
                                      <span className="text-xs text-muted">
                                        Submit to run all tests
                                      </span>
                                    )}
                                  </div>
                                );
                              }

                              return (
                                <div className="flex flex-col gap-2">
                                  <h3 className="text-error font-medium flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    {statusLabel}
                                  </h3>
                                  <p className="text-sm text-muted">
                                    {summary.passed} / {summary.total} tests passed
                                  </p>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Result Tabs */}
                          {runResult.tests.length > 0 && (
                            <div className="flex items-center gap-2 px-4 border-b border-border overflow-x-auto">
                              {runResult.tests.map((r, idx) => (
                                <button
                                  key={r.id}
                                  onClick={() => setActiveTestCaseId(r.id)}
                                  className={`px-3 py-1 text-xs rounded-md transition-colors flex items-center gap-2 mb-2 whitespace-nowrap ${
                                    activeTestCaseId === r.id
                                      ? "bg-surface text-primary"
                                      : "text-muted hover:bg-surface"
                                  }`}
                                >
                                  <span
                                    className={`w-2 h-2 rounded-full ${
                                      r.status === "Accepted"
                                        ? "bg-success"
                                        : "bg-error"
                                    }`}
                                  />
                                  {`Case ${idx + 1}`}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Result Details */}
                          <div className="flex-1 p-4 overflow-y-auto">
                            {runResult.tests.map((r) => {
                              if (r.id !== activeTestCaseId) return null;
                              return (
                                <div key={r.id} className="flex flex-col gap-3">
                                  {/* Input */}
                                  {r.input && (
                                    <div className="space-y-1.5">
                                      <label className="text-[11px] font-medium text-muted uppercase tracking-wide">
                                        Input
                                      </label>
                                      <div className="p-3 bg-surface rounded-lg text-secondary text-[13px] font-mono whitespace-pre-wrap leading-relaxed">
                                        {r.input}
                                      </div>
                                    </div>
                                  )}

                                  {/* Stderr */}
                                  {r.stderr && (
                                    <div className="space-y-1.5">
                                      <label className="text-[11px] font-medium text-muted uppercase tracking-wide">
                                        {isErrorStatus(r.status) ? r.status : "Stderr"}
                                      </label>
                                      <div className="p-3 bg-error/5 border border-error/20 rounded-lg text-error text-[13px] font-mono whitespace-pre-wrap leading-relaxed">
                                        {r.stderr}
                                      </div>
                                    </div>
                                  )}

                                  {/* Stdout */}
                                  {r.stdout && (
                                    <div className="space-y-1.5">
                                      <label className="text-[11px] font-medium text-muted uppercase tracking-wide">
                                        Stdout
                                      </label>
                                      <div className="p-3 bg-surface rounded-lg text-secondary text-[13px] font-mono whitespace-pre-wrap leading-relaxed">
                                        {r.stdout}
                                      </div>
                                    </div>
                                  )}

                                  {/* Output + Expected */}
                                  {(r.output || r.expected) && (
                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="space-y-1.5">
                                        <label className="text-[11px] font-medium text-muted uppercase tracking-wide">
                                          Output
                                        </label>
                                        <div className={`p-3 rounded-lg text-[13px] font-mono whitespace-pre-wrap leading-relaxed ${
                                          r.status === "Accepted"
                                            ? "bg-surface text-secondary"
                                            : "bg-error/5 text-error border border-error/20"
                                        }`}>
                                          {r.output || <span className="text-muted/60 italic">None</span>}
                                        </div>
                                      </div>

                                      <div className="space-y-1.5">
                                        <label className="text-[11px] font-medium text-muted uppercase tracking-wide">
                                          Expected
                                        </label>
                                        <div className="p-3 bg-success/5 border border-success/20 rounded-lg text-success text-[13px] font-mono whitespace-pre-wrap leading-relaxed">
                                          {r.expected}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            </Panel>
          </Group>
          </div>
          </Panel>
        </>
      )}

      {/* Reset Confirmation Modal */}
      <ConfirmModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirm={confirmReset}
        title="Reset Code"
        message="This will replace your code with the initial template. Any changes you've made will be lost."
        confirmText="Reset Code"
        cancelText="Keep Editing"
        variant="danger"
      />
    </Group>
  );
}
