"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
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
  Terminal,
} from "lucide-react";
import Editor, { useMonaco } from "@monaco-editor/react";
import { AutoResizingEditor } from "./AutoResizingEditor";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  loadPyodide,
  isPyodideLoaded,
  runTestsWithPyodide,
  canRunInBrowser,
  type TestConfig,
} from "@/lib/pyodide";
import { bundleToTestConfig, fetchPublicBundle } from "@/lib/judge-public-tests";
import { submitToJudge, waitForJudgeResult } from "@/lib/judge-client";
import type { JudgeJobResult } from "@/lib/judge-client";
import type { Challenge } from "@/lib/challenge-types";
import { ConfirmModal } from "./ConfirmModal";
import {
  getChallengeCode,
  isChallengeSolved,
  markChallengeSolved,
  removeChallengeCode,
  setChallengeCode,
} from "@/lib/challenge-storage";

// Custom Monaco Theme - Eye-Safe Zinc Dark
const ZINC_DARK_THEME = {
  base: "vs-dark" as const,
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#09090B",
    "editor.foreground": "#D4D4D8",
    "editor.lineHighlightBackground": "#18181B",
    "editor.selectionBackground": "#27272A",
    "editorGutter.background": "#09090B",
    "editorCursor.foreground": "#D4D4D8",
    "minimap.background": "#09090B",
    "scrollbarSlider.background": "#27272A80",
    "scrollbarSlider.hoverBackground": "#3f3f4680",
  },
};

interface TestCase {
  id: string;
  inputs: Record<string, string>;
  expected: string;
  hidden?: boolean;
  explanation?: string;
}

interface TestResult {
  id: string;
  status:
    | "Accepted"
    | "Wrong Answer"
    | "Runtime Error"
    | "Time Limit Exceeded"
    | "Memory Limit Exceeded";
  input?: string;
  stdout?: string;
  output?: string;
  expected?: string;
  stderr?: string;
  hidden?: boolean;
}

export interface ChallengeEditorProps {
  courseId: string;
  challenges: Challenge[];
  activeChallengeIndex: number;
  setActiveChallengeIndex: (index: number | null) => void;
}

// ExampleCard component for displaying test cases with optional explanations
function ExampleCard({ testCase }: { testCase: TestCase }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const inputLines = Object.entries(testCase.inputs)
    .map(([key, value]) => `${key} = ${value}`)
    .join("\n");

  return (
    <div className="p-3 bg-[#121212] rounded-md border border-zinc-800">
      <div className="flex flex-col gap-2 font-mono text-[13px]">
        <div>
          <span className="text-muted text-xs uppercase tracking-wide">
            Input
          </span>
          <div className="mt-0.5 text-secondary whitespace-pre-wrap break-words leading-snug">
            {inputLines}
          </div>
        </div>
        <div>
          <span className="text-muted text-xs uppercase tracking-wide">
            Output
          </span>
          <div className="mt-0.5 text-secondary whitespace-pre-wrap break-words leading-snug">
            {testCase.expected}
          </div>
        </div>
      </div>

      {/* Explanation toggle */}
      {testCase.explanation && (
        <div className="mt-3 pt-3 border-t border-zinc-800">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-secondary transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
            <span>{isExpanded ? "Hide explanation" : "Why?"}</span>
          </button>

          {isExpanded && (
            <div className="mt-3 text-sm text-secondary font-sans prose prose-invert prose-sm max-w-none [&>p]:my-2 [&>ul]:my-2 [&>ol]:my-2 [&_code]:text-xs [&_code]:bg-zinc-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded">
              <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
              >
                {testCase.explanation}
              </ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ChallengeEditor({
  courseId,
  challenges,
  activeChallengeIndex,
  setActiveChallengeIndex,
}: ChallengeEditorProps) {
  const [code, setCode] = useState("");
  const [isSolved, setIsSolved] = useState(false);
  const [lastRunMode, setLastRunMode] = useState<"run" | "submit" | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Active Pane Tracking - for focus ring styling
  const [activePane, setActivePane] = useState<"prose" | "editor">("editor");

  // Test Case State
  const [testCases, setTestCases] = useState<TestCase[]>([
    {
      id: "1",
      inputs: { numRows: "5" },
      expected: "[[1],[1,1],[1,2,1],[1,3,3,1],[1,4,6,4,1]]",
    },
    { id: "2", inputs: { numRows: "1" }, expected: "[[1]]" },
  ]);
  const [activeTestCaseId, setActiveTestCaseId] = useState<string>("1");
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);
  const [bundleExamples, setBundleExamples] = useState<TestCase[] | null>(null);

  const [output, setOutput] = useState<string | null>(null); // Raw console output (fallback)
  const [isVimMode, setIsVimMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("editor_vim_mode") === "true";
    }
    return false;
  });
  const [leftPanelWidth, setLeftPanelWidth] = useState(40); // Percentage
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);

  // Bottom Panel State
  const [bottomPanelHeight, setBottomPanelHeight] = useState(45); // Percentage
  const [isDraggingBottom, setIsDraggingBottom] = useState(false);
  const [isBottomPanelCollapsed, setIsBottomPanelCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "console" | "testcases" | "result"
  >("console");

  // Execution State
  const [isRunning, setIsRunning] = useState(false);
  const [runMessage, setRunMessage] = useState("");

  // Pyodide State
  const [pyodideStatus, setPyodideStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [executionMode, setExecutionMode] = useState<
    "browser" | "server" | "cli"
  >(
    "browser"
  );
  const formatServerError = useCallback((message?: string) => {
    const generic = "Something went wrong on our side. Please retry.";
    if (!message) return generic;
    const trimmed = message.trim();
    const allowlist = ["Time Limit Exceeded", "Memory Limit Exceeded"];
    if (allowlist.some((prefix) => trimmed.startsWith(prefix))) {
      return trimmed;
    }
    return generic;
  }, []);
  const normalizeLimitError = useCallback((message?: string) => {
    if (!message) return null;
    const trimmed = message.trim();
    if (trimmed.startsWith("Time Limit Exceeded")) {
      return { status: "Time Limit Exceeded" as const, message: trimmed };
    }
    if (trimmed.startsWith("Memory Limit Exceeded")) {
      return { status: "Memory Limit Exceeded" as const, message: trimmed };
    }
    return null;
  }, []);
  const toErrorResult = useCallback(
    (status: TestResult["status"], message: string): TestResult[] => [
      {
        id: "error",
        status,
        input: "",
        stdout: "",
        output: "",
        expected: "",
        stderr: message,
        hidden: false,
      },
    ],
    []
  );
  const normalizeBrowserResults = useCallback(
    (results: TestResult[] | null): { tests?: TestResult[]; systemError?: string } => {
      if (!results || results.length === 0) {
        return { systemError: formatServerError() };
      }

      if (results.length === 1 && results[0].status === "Runtime Error") {
        const stderr = results[0].stderr || "";
        if (stderr.includes("ExecutionLimitExceeded")) {
          return {
            tests: toErrorResult(
              "Time Limit Exceeded",
              "Time Limit Exceeded"
            ),
          };
        }
      }

      return { tests: results };
    },
    [formatServerError, toErrorResult]
  );
  const normalizeServerResult = useCallback(
    (result: JudgeJobResult): { tests?: TestResult[]; systemError?: string } => {
      const rawError = result.error || result.result?.error;
      if (result.status === "error" || rawError) {
        const limit = normalizeLimitError(rawError);
        if (limit) {
          return { tests: toErrorResult(limit.status, limit.message) };
        }
        return { systemError: formatServerError(rawError) };
      }

      const tests = result.result?.tests ?? [];
      if (!tests.length) {
        return { systemError: formatServerError() };
      }

      return { tests };
    },
    [formatServerError, normalizeLimitError, toErrorResult]
  );
  const isErrorStatus = useCallback(
    (status: TestResult["status"]) =>
      status === "Runtime Error" ||
      status === "Time Limit Exceeded" ||
      status === "Memory Limit Exceeded",
    []
  );
  const deriveVerdict = useCallback((results: TestResult[]) => {
    const priority: TestResult["status"][] = [
      "Time Limit Exceeded",
      "Memory Limit Exceeded",
      "Runtime Error",
    ];
    for (const status of priority) {
      if (results.some((r) => r.status === status)) {
        return { kind: "error" as const, label: status };
      }
    }
    if (results.every((r) => r.status === "Accepted")) {
      return { kind: "accepted" as const };
    }
    if (results.some((r) => r.status === "Wrong Answer")) {
      return { kind: "wrong" as const, label: "Wrong Answer" };
    }
    return { kind: "failed" as const };
  }, []);
  // We don't need to debounce test cases for sync anymore, we send them on run

  const monaco = useMonaco();
  const editorRef = useRef<any>(null);
  const vimModeRef = useRef<any>(null);
  const consoleRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);
  const isVimModeInitializedRef = useRef(false); // Track if vim was loaded from localStorage
  const isRunningRef = useRef(false); // Guard against concurrent executions
  const currentChallengeIdRef = useRef<string | null>(null); // Track challenge for race condition
  const pyodideStatusRef = useRef(pyodideStatus);
  const pyodideLoadPromiseRef = useRef<Promise<void> | null>(null);
  const hasTriggeredPyodidePreloadRef = useRef(false);
  const monacoWarmupHandleRef = useRef<
    { kind: "idle"; id: number } | { kind: "timeout"; id: number } | null
  >(null);

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

  useEffect(() => {
    pyodideStatusRef.current = pyodideStatus;
    if (pyodideStatus === "ready") {
      hasTriggeredPyodidePreloadRef.current = true;
    }
  }, [pyodideStatus]);

  // Auto-scroll console
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [output, activeTab]);

  const setActiveChallengeIndexWithWarmup = useCallback(
    (index: number | null) => {
      if (index !== null) {
        warmMonaco("now");
      }
      setActiveChallengeIndex(index);
    },
    [setActiveChallengeIndex, warmMonaco]
  );

  const activeChallenge = challenges[activeChallengeIndex];
  if (!activeChallenge) {
    return null;
  }

  // Do not auto-load Pyodide on mount. Only mark ready if another challenge already loaded it.
  useEffect(() => {
    if (isPyodideLoaded()) {
      setPyodideStatus("ready");
    }
  }, []);

  // Determine execution mode based on challenge dependencies
  useEffect(() => {
    if (!activeChallenge) return;

    const browserSupported = canRunInBrowser(activeChallenge.dependencies);

    if (browserSupported) {
      setExecutionMode("browser");
    } else {
      setExecutionMode("server");
    }
  }, [activeChallenge]);

  // Warm public test bundle for judge-backed challenges
  useEffect(() => {
    if (!activeChallenge?.problemId) return;
    fetchPublicBundle(activeChallenge.problemId).catch(() => {
      // Ignore preload failures; will retry on run
    });
  }, [activeChallenge?.problemId]);

  // Load code from localStorage or use initial code when challenge changes
  useEffect(() => {
    if (activeChallenge) {
      let cancelled = false;
      let hasAsync = false;

      // Update ref for race condition detection
      currentChallengeIdRef.current = activeChallenge.id;

      setBundleExamples(null);

      const storedCode = getChallengeCode(courseId, activeChallenge.id);
      if (storedCode !== null) {
        setCode(storedCode);
      } else {
        setCode(activeChallenge.initialCode);
      }

      // Load solved status
      setIsSolved(isChallengeSolved(courseId, activeChallenge.id));
      if (
        activeChallenge.defaultTestCases &&
        activeChallenge.defaultTestCases.length > 0
      ) {
        // Filter visible cases based on configuration
        // If visibleTestCases is set, take first N non-hidden cases.
        // Otherwise take all non-hidden cases.
        // Hidden cases are always excluded from the editor tabs initially.
        const nonHidden = activeChallenge.defaultTestCases.filter(
          (tc) => !tc.hidden
        );
        const visibleCount =
          activeChallenge.visibleTestCases !== undefined
            ? activeChallenge.visibleTestCases
            : nonHidden.length;
        const visibleCases = nonHidden.slice(0, visibleCount);

        // We also want to keep the hidden cases in the state so they run, but they are filtered out in the UI
        // Actually, if we want to "hide" the extra ones, we should mark them as hidden in the state?
        // But defaultTestCases already has hidden flags.
        // If visibleTestCases < nonHidden.length, we treat the excess as hidden.

        const processedCases = activeChallenge.defaultTestCases.map(
          (tc, index) => {
            // Check if this case is one of the "visible" ones
            const isVisible = visibleCases.some((vc) => vc.id === tc.id);
            if (isVisible) return tc;
            return { ...tc, hidden: true };
          }
        );

        setTestCases(processedCases);
        const firstVisible = processedCases.find((tc) => !tc.hidden);
        setActiveTestCaseId(
          firstVisible ? firstVisible.id : processedCases[0].id
        );
      } else if (activeChallenge.problemId) {
        hasAsync = true;
        (async () => {
          try {
            const bundle = await fetchPublicBundle(activeChallenge.problemId!);
            const cases = (Array.isArray(bundle.tests)
              ? bundle.tests
              : bundle.tests.cases || []
            ).map((tc) => {
              const expected =
                typeof tc.expected === "string"
                  ? tc.expected
                  : JSON.stringify(tc.expected);
              return {
                id: tc.id,
                inputs: tc.inputs || {},
                expected,
                hidden: tc.hidden,
              } as TestCase;
            });

            if (cancelled) return;
            setBundleExamples(cases);
            if (cases.length > 0) {
              setTestCases(cases);
              const firstVisible = cases.find((tc) => !tc.hidden) || cases[0];
              setActiveTestCaseId(firstVisible.id);
            }
          } catch (err) {
            console.warn("Failed to load public bundle", err);
          }
        })();
      } else {
        // Default empty case if none provided or defaultTestCases is empty
        const initialInputs: Record<string, string> = {};
        if (activeChallenge.arguments) {
          activeChallenge.arguments.forEach((arg) => {
            initialInputs[arg.name] = "";
          });
        }
        const newId = "case1";
        setTestCases([{ id: newId, inputs: initialInputs, expected: "" }]);
        setActiveTestCaseId(newId);
      }
      setTestResults(null);
      setOutput("");
      setLastRunMode(null);

      return () => {
        if (hasAsync) {
          cancelled = true;
        }
      };
    }
  }, [activeChallenge]);

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
  }, [code, activeChallenge]);

  // Vim Mode Effect
  useEffect(() => {
    if (!editorRef.current || !monaco) return;

    // Always dispose existing vim mode first
    if (vimModeRef.current) {
      vimModeRef.current.dispose();
      vimModeRef.current = null;
    }

    if (isVimMode) {
      try {
        // @ts-ignore
        const { initVimMode } = require("monaco-vim");
        const statusNode = document.getElementById("vim-status-bar");
        vimModeRef.current = initVimMode(editorRef.current, statusNode);
      } catch (e) {
        console.error("Failed to enable Vim mode:", e);
      }
    }

    return () => {
      if (vimModeRef.current) {
        vimModeRef.current.dispose();
        vimModeRef.current = null;
      }
    };
  }, [isVimMode, monaco, activeChallenge?.id]);

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
    if (!canRunInBrowser(activeChallenge.dependencies)) return;
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
    if (!canRunInBrowser(activeChallenge.dependencies)) return;
    if (pyodideStatusRef.current === "ready") {
      hasTriggeredPyodidePreloadRef.current = true;
      return;
    }

    hasTriggeredPyodidePreloadRef.current = true;
    void ensurePyodideLoaded().catch(() => {});
  }, [activeChallenge, executionMode, ensurePyodideLoaded]);

  // Editor Command
  const handleEditorDidMount = (editor: any, monacoInstance: any) => {
    editorRef.current = editor;

    // Theme is already defined in beforeMount, just ensure it's applied
    monacoInstance.editor.setTheme("zinc-dark");

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
      try {
        // @ts-ignore
        const { initVimMode } = require("monaco-vim");
        const statusNode = document.getElementById("vim-status-bar");
        if (statusNode) {
          vimModeRef.current = initVimMode(editor, statusNode);
        }
      } catch (e) {
        console.error("Failed to enable Vim mode:", e);
      }
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

      // Filter test cases based on mode
      const casesToRun =
        mode === "run" ? testCases.filter((tc) => !tc.hidden) : testCases; // Submit runs ALL test cases including hidden

      // Track which challenge we're running for race condition detection
      const runChallengeId = activeChallenge?.id;

      if (useBrowser) {
        // === BROWSER EXECUTION (Pyodide) ===
        isRunningRef.current = true;
        setIsRunning(true);
        setOutput("");
        setTestResults(null);
        setLastRunMode(mode);
        setRunMessage("Running...");
        setActiveTab("result");
        if (isBottomPanelCollapsed) {
          setBottomPanelHeight(45);
          setIsBottomPanelCollapsed(false);
        }

        try {
          // Show loading message if user runs tests before Pyodide is ready
          if (pyodideStatusRef.current !== "ready") {
            setOutput("Preparing runtime...\n");
            setRunMessage("Preparing runtime...");
          }
          await ensurePyodideLoaded();

          let config: TestConfig;

          const fallbackConfig = () => {
            const formattedCases = casesToRun.map((tc) => {
              let inputCode = "";
              Object.entries(tc.inputs).forEach(([key, value]) => {
                inputCode += `${key} = ${value}\n`;
              });
              return {
                id: tc.id,
                input: inputCode,
                expected: tc.expected,
                hidden: tc.hidden,
              };
            });

            let runnerCode =
              activeChallenge?.executionSnippet ||
              "print('No execution snippet defined')";
            if (
              runnerCode.trim().startsWith("print(") &&
              runnerCode.trim().endsWith(")")
            ) {
              runnerCode = runnerCode.trim().slice(6, -1);
            }

            return {
              cases: formattedCases,
              runner: runnerCode,
            };
          };

          if (activeChallenge?.problemId && mode === "run") {
            try {
              const bundle = await fetchPublicBundle(activeChallenge.problemId);
              config = bundleToTestConfig(bundle);
            } catch (err) {
              console.warn("Failed to load public bundle, falling back", err);
              config = fallbackConfig();
            }
          } else {
            config = fallbackConfig();
          }

          // Run tests with Pyodide
          const results = await runTestsWithPyodide(
            code,
            config,
            (text) => setOutput((prev) => (prev || "") + text),
            (text) => setOutput((prev) => (prev || "") + text)
          );

          // Discard results if challenge changed during execution
          if (currentChallengeIdRef.current !== runChallengeId) {
            return;
          }

          const normalized = normalizeBrowserResults(results);
          if (normalized.systemError) {
            setOutput((prev) => (prev || "") + normalized.systemError);
            setActiveTab("console");
            if (isBottomPanelCollapsed) {
              setBottomPanelHeight(45);
              setIsBottomPanelCollapsed(false);
            }
            setRunMessage("");
            return;
          }

          const finalResults = normalized.tests ?? [];
          setTestResults(finalResults);
          setActiveTab("result");
          setRunMessage("");
          // Reset to initial height when expanding
          if (isBottomPanelCollapsed) {
            setBottomPanelHeight(45);
          }
          setIsBottomPanelCollapsed(false);

          // Auto-select appropriate test case tab
          const allPassed = finalResults.every((r) => r.status === "Accepted");
          if (allPassed) {
            // Select first test case
            setActiveTestCaseId(finalResults[0]?.id || "1");
          } else {
            // Select first failed test case
            const firstFailed = finalResults.find((r) => r.status !== "Accepted");
            if (firstFailed) {
              setActiveTestCaseId(firstFailed.id);
            }
          }

        } catch (err: any) {
          // Only show error if still on the same challenge
          if (currentChallengeIdRef.current === runChallengeId) {
            setPyodideStatus("error");
            setOutput((prev) => (prev || "") + `\nError: ${err.message}`);
            setActiveTab("console");
            if (isBottomPanelCollapsed) {
              setBottomPanelHeight(45);
              setIsBottomPanelCollapsed(false);
            }
            setRunMessage("");
          }
        } finally {
          isRunningRef.current = false;
          setIsRunning(false);
        }
      } else if (useServer) {
        // === SERVER EXECUTION (Judge VM) ===
        isRunningRef.current = true;
        setIsRunning(true);
        setOutput("Pending...\n");
        setTestResults(null);
        setLastRunMode(mode);
        setRunMessage("Pending...");
        setActiveTab("result");
        if (isBottomPanelCollapsed) {
          setBottomPanelHeight(45);
          setIsBottomPanelCollapsed(false);
        }

        try {
          const submit = await submitToJudge({
            problemId: activeChallenge.problemId,
            code,
            kind: mode,
          });

          const result = await waitForJudgeResult(submit.job_id, {
            timeoutMs: 120000,
            intervalFn: (_attempt, elapsedMs) => {
              if (elapsedMs < 10000) return 400;
              if (elapsedMs < 30000) return 1000;
              if (elapsedMs < 120000) return 2000;
              return 5000;
            },
            onUpdate: (update) => {
              if (update.status === "queued") {
                setOutput("Pending...\n");
                setRunMessage("Pending...");
              } else if (update.status === "running") {
                setOutput("Running...\n");
                setRunMessage("Running...");
              }
            },
          });

          const normalized = normalizeServerResult(result);
          if (normalized.systemError) {
            setRunMessage(normalized.systemError);
            setActiveTab("result");
            if (isBottomPanelCollapsed) {
              setBottomPanelHeight(45);
              setIsBottomPanelCollapsed(false);
            }
            return;
          }

          if (currentChallengeIdRef.current !== runChallengeId) {
            return;
          }

          const tests = normalized.tests ?? [];
          setTestResults(tests);
          setActiveTab("result");
          setRunMessage("");

          if (isBottomPanelCollapsed) {
            setBottomPanelHeight(45);
          }
          setIsBottomPanelCollapsed(false);

          const allPassed =
            tests.length > 0 &&
            tests.every((r: TestResult) => r.status === "Accepted");
          if (allPassed) {
            setActiveTestCaseId(tests[0]?.id || "1");
          } else {
            const firstFailed = tests.find((r: TestResult) => r.status !== "Accepted");
            if (firstFailed) {
              setActiveTestCaseId(firstFailed.id);
            }
          }

          if (mode === "submit" && allPassed && activeChallenge) {
            markChallengeSolved(courseId, activeChallenge.id);
            setIsSolved(true);
          }
        } catch (err: any) {
          if (currentChallengeIdRef.current === runChallengeId) {
            if (String(err?.message || "").includes("Timed out waiting")) {
              setRunMessage("Request took too long. Please try again.");
            } else {
              setRunMessage(formatServerError(err?.message));
            }
            setActiveTab("result");
            if (isBottomPanelCollapsed) {
              setBottomPanelHeight(45);
              setIsBottomPanelCollapsed(false);
            }
          }
        } finally {
          isRunningRef.current = false;
          setIsRunning(false);
        }
      } else {
        // CLI-only challenge - show clear instructions
        const challengeId = activeChallenge?.id || "<id>";
        setOutput(
          `This challenge requires PyTorch and must be run locally.\n\n` +
            `Install CLI:\n` +
            `  $ pip install ai-deep-dive\n\n` +
            `Run tests:\n` +
            `  $ ai-deep-dive test ${challengeId}\n\n` +
            `Sync progress to web:\n` +
            `  $ ai-deep-dive sync\n\n` +
            `See /setup for the full setup guide.`
        );
        // Expand panel and show console
        setActiveTab("console");
        if (isBottomPanelCollapsed) {
          setBottomPanelHeight(45);
        }
        setIsBottomPanelCollapsed(false);
      }
    },
    [
      code,
      testCases,
      activeChallenge,
      executionMode,
      isBottomPanelCollapsed,
      ensurePyodideLoaded,
    ]
  );

  // Resizer Logic (Left Panel)
  const startResizingLeft = (e: React.MouseEvent) => {
    setIsDraggingLeft(true);
    e.preventDefault();
  };

  useEffect(() => {
    const stopResizing = () => setIsDraggingLeft(false);
    const resize = (e: MouseEvent) => {
      if (isDraggingLeft) {
        const newWidth = (e.clientX / window.innerWidth) * 100;
        if (newWidth > 20 && newWidth < 80) {
          setLeftPanelWidth(newWidth);
        }
      }
    };

    if (isDraggingLeft) {
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
    }

    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isDraggingLeft]);

  // Resizer Logic (Bottom Panel)
  const startResizingBottom = (e: React.MouseEvent) => {
    setIsDraggingBottom(true);
    e.preventDefault();
  };

  useEffect(() => {
    const stopResizing = () => setIsDraggingBottom(false);
    const resize = (e: MouseEvent) => {
      if (!isDraggingBottom || !rightPanelRef.current) return;

      // Get the actual bounds of the right panel
      const rect = rightPanelRef.current.getBoundingClientRect();
      const panelTop = rect.top;
      const panelHeight = rect.height;

      // Measure actual DOM element heights
      const toolbarHeight = toolbarRef.current?.getBoundingClientRect().height ?? 0;
      const resizerHeight = resizerRef.current?.getBoundingClientRect().height ?? 0;
      const minTopSpace = toolbarHeight + resizerHeight;

      // Calculate max allowed height percentage
      const maxHeightPercent = ((panelHeight - minTopSpace) / panelHeight) * 100;

      // Calculate height from bottom of panel
      const mouseYInPanel = e.clientY - panelTop;
      const heightFromBottom = panelHeight - mouseYInPanel;
      const newHeightPercent = (heightFromBottom / panelHeight) * 100;

      // If dragged below 8%, collapse the panel
      if (newHeightPercent < 8) {
        setIsBottomPanelCollapsed(true);
      } else {
        // Expand if collapsed and set new height
        if (isBottomPanelCollapsed) {
          setIsBottomPanelCollapsed(false);
        }
        // Cap at max to leave room for toolbar and resizer
        setBottomPanelHeight(Math.min(newHeightPercent, maxHeightPercent));
      }
    };

    if (isDraggingBottom) {
      // Use capture phase for immediate response
      document.addEventListener("mousemove", resize, { passive: true });
      document.addEventListener("mouseup", stopResizing);
    }

    return () => {
      document.removeEventListener("mousemove", resize);
      document.removeEventListener("mouseup", stopResizing);
    };
  }, [isDraggingBottom, isBottomPanelCollapsed]);

  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const runShortcut = isMac ? "Cmd + ," : "Ctrl + ,";
  const submitShortcut = isMac ? "Cmd + Enter" : "Ctrl + Enter";

  // Memoize visible test cases for performance
  const visibleTestCases = useMemo(
    () => testCases.filter((tc) => !tc.hidden),
    [testCases]
  );

  // Dragging state for premium feel
  const isDragging = isDraggingLeft || isDraggingBottom;

  return (
    <div
      className={`flex h-[calc(100vh-4rem)] bg-background border-t border-border overflow-hidden ${
        isDragging ? "cursor-grabbing" : ""
      }`}
      style={{
        // Prevent text selection and iframe capture during drag
        userSelect: isDragging ? "none" : undefined,
        WebkitUserSelect: isDragging ? "none" : undefined,
      }}
    >
      {/* Left Panel - Prose */}
      <div
        className={`flex flex-col bg-background overflow-hidden transition-colors border-r ${
          activePane === "prose" ? "border-zinc-600" : "border-border"
        }`}
        style={{ width: `${leftPanelWidth}%` }}
        onClick={() => setActivePane("prose")}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b border-border">
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
                  <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                )}
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  activeChallenge.difficulty === "Easy"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : activeChallenge.difficulty === "Medium"
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-rose-500/10 text-rose-400"
                }`}
              >
                {activeChallenge.difficulty || "Medium"}
              </span>
            </div>
          </div>

          {/* Description - prose handles typography, custom overrides via Tailwind */}
          <div className="flex-1 overflow-y-auto p-6 prose prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex]}
            >
              {activeChallenge.description}
            </ReactMarkdown>

            {activeChallenge.hint && (
              <div className="mt-6 pl-4 border-l-2 border-zinc-600 not-prose">
                <p className="text-xs font-medium text-muted uppercase tracking-wider mb-1">
                  Hint
                </p>
                <p className="text-sm text-secondary">{activeChallenge.hint}</p>
              </div>
            )}

            {/* Automated Example Test Cases */}
            {(() => {
              const exampleCases =
                activeChallenge.defaultTestCases &&
                activeChallenge.defaultTestCases.length > 0
                  ? activeChallenge.defaultTestCases
                  : bundleExamples || [];
              if (exampleCases.filter((tc) => !tc.hidden).length === 0) {
                return null;
              }
              return (
                <div className="mt-8 not-prose">
                  <div className="text-xs font-medium text-muted uppercase tracking-wider mb-3">
                    Examples
                  </div>
                  <div className="flex flex-col gap-3">
                    {(() => {
                      const nonHidden = exampleCases.filter((tc) => !tc.hidden);
                      const visibleCount =
                        activeChallenge.visibleTestCases !== undefined
                          ? activeChallenge.visibleTestCases
                          : nonHidden.length;
                      return nonHidden
                        .slice(0, visibleCount)
                        .map((tc) => <ExampleCard key={tc.id} testCase={tc} />);
                    })()}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Resizer Handle + Editor Panel - Only show when a challenge is selected */}
      {activeChallenge && (
        <>
          {/* Resizer Handle (Left) */}
          <div
            className={`w-1.5 cursor-col-resize z-10 flex items-center justify-center group transition-colors duration-150 ${
              isDraggingLeft
                ? "bg-emerald-500/50"
                : "bg-transparent hover:bg-zinc-700"
            }`}
            onMouseDown={startResizingLeft}
          >
            <div
              className={`w-0.5 h-12 rounded-full transition-all duration-150 ${
                isDraggingLeft
                  ? "bg-emerald-400 h-16"
                  : "bg-zinc-600 group-hover:bg-zinc-500 group-hover:h-16"
              }`}
            />
          </div>

          {/* Right Panel: Editor */}
          <div
            ref={rightPanelRef}
            className={`flex-1 flex flex-col bg-background min-w-[300px] border-l transition-colors overflow-hidden ${
              activePane === "editor" ? "border-zinc-600" : "border-border"
            }`}
            onClick={() => setActivePane("editor")}
          >
            {/* Toolbar */}
            <div ref={toolbarRef} className="h-11 flex-shrink-0 flex items-center justify-between px-3 border-b border-border bg-surface">
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
                      ? "text-secondary bg-zinc-800"
                      : "text-muted hover:text-secondary hover:bg-zinc-800"
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
                  className="flex items-center gap-1.5 px-3 py-1.5 text-secondary hover:text-primary hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium rounded-lg transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  Reset
                </button>

                <div className="w-px h-4 bg-border" aria-hidden="true" />

                {/* Run Code Button (visible tests only) */}
                <button
                  onClick={() => handleRun("run")}
                  disabled={isRunning}
                  title={`Run visible tests (${runShortcut})`}
                  aria-label={`Run visible tests, keyboard shortcut ${runShortcut}`}
                  className="flex items-center gap-2 px-4 py-1.5 hover:bg-zinc-800 disabled:text-muted disabled:cursor-not-allowed text-secondary hover:text-primary text-sm font-medium rounded-lg transition-colors"
                >
                  {isRunning && lastRunMode === "run" ? (
                    <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                  ) : (
                    <Play className="w-3 h-3" aria-hidden="true" />
                  )}
                  Run
                </button>

                <div className="w-px h-4 bg-border" aria-hidden="true" />

                {/* Submit Button (all tests including hidden) */}
                <button
                  onClick={() => handleRun("submit")}
                  disabled={isRunning}
                  title={`Submit and run all tests (${submitShortcut})`}
                  aria-label={`Submit and run all tests including hidden tests, keyboard shortcut ${submitShortcut}`}
                  className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/15 disabled:bg-transparent disabled:text-muted disabled:cursor-not-allowed text-emerald-400 text-sm font-medium rounded-lg transition-colors"
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
            <div className="flex-1 relative min-h-0 overflow-hidden bg-[#09090B]">
              <Editor
                height="100%"
                defaultLanguage="python"
                value={code}
                onChange={(value) => setCode(value || "")}
                theme="zinc-dark"
                onMount={handleEditorDidMount}
                beforeMount={(monaco) => {
                  // Define theme before mount to prevent flash
                  monaco.editor.defineTheme("zinc-dark", ZINC_DARK_THEME);
                }}
                loading={
                  <div className="w-full h-full bg-[#09090B] pt-2 pl-4 font-mono text-sm leading-5">
                    <div className="space-y-0 animate-pulse">
                      <div className="flex items-center h-5">
                        <span className="text-zinc-700 w-8 text-right select-none pr-4">1</span>
                        <div className="h-3.5 bg-zinc-800/60 rounded w-56" />
                      </div>
                      <div className="flex items-center h-5">
                        <span className="text-zinc-700 w-8 text-right select-none pr-4">2</span>
                        <div className="ml-6 h-3.5 bg-zinc-800/40 rounded w-72" />
                      </div>
                      <div className="flex items-center h-5">
                        <span className="text-zinc-700 w-8 text-right select-none pr-4">3</span>
                        <div className="ml-6 h-3.5 bg-zinc-800/60 rounded w-48" />
                      </div>
                      <div className="flex items-center h-5">
                        <span className="text-zinc-700 w-8 text-right select-none pr-4">4</span>
                        <div className="ml-6 h-3.5 bg-zinc-800/40 rounded w-80" />
                      </div>
                      <div className="flex items-center h-5">
                        <span className="text-zinc-700 w-8 text-right select-none pr-4">5</span>
                        <div className="ml-6 h-3.5 bg-zinc-800/60 rounded w-64" />
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

            {/* Resizer Handle (Bottom) - only visible when panel is expanded */}
            {!isBottomPanelCollapsed && (
              <div
                ref={resizerRef}
                className={`h-2 flex-shrink-0 cursor-row-resize z-10 flex items-center justify-center border-t transition-colors duration-150 group ${
                  isDraggingBottom
                    ? "bg-emerald-500/20 border-emerald-500/50"
                    : "bg-background border-border hover:bg-zinc-800/50 hover:border-zinc-600"
                }`}
                onMouseDown={startResizingBottom}
              >
                <div
                  className={`h-0.5 rounded-full transition-all duration-150 ${
                    isDraggingBottom
                      ? "w-16 bg-emerald-400"
                      : "w-8 bg-zinc-600 group-hover:w-12 group-hover:bg-zinc-500"
                  }`}
                />
              </div>
            )}

            {/* Bottom Panel (Console / Test Cases) */}
            <div
              className={`bg-background flex flex-col relative flex-shrink-0 ${
                isDraggingBottom ? "" : "transition-[height] duration-200"
              }`}
              style={{
                height: isBottomPanelCollapsed
                  ? "auto"
                  : `${bottomPanelHeight}%`,
                minHeight: isBottomPanelCollapsed ? undefined : "100px",
              }}
            >
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
                    setActiveTab("console");
                    if (isBottomPanelCollapsed)
                      setIsBottomPanelCollapsed(false);
                  }}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-r border-border transition-colors ${
                    activeTab === "console" && !isBottomPanelCollapsed
                      ? "text-primary bg-background"
                      : "text-muted hover:text-secondary"
                  }`}
                  role="tab"
                  aria-selected={activeTab === "console" && !isBottomPanelCollapsed}
                  aria-controls="console-panel"
                >
                  Console
                </button>
                <button
                  onClick={() => {
                    setActiveTab("testcases");
                    if (isBottomPanelCollapsed)
                      setIsBottomPanelCollapsed(false);
                    // Ensure a valid test case is selected
                    if (visibleTestCases.length > 0 && !visibleTestCases.some((tc) => tc.id === activeTestCaseId)) {
                      setActiveTestCaseId(visibleTestCases[0].id);
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
                      setIsBottomPanelCollapsed(false);
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
                  onClick={() => {
                    if (isBottomPanelCollapsed) {
                      // Reset to initial height when expanding via button
                      setBottomPanelHeight(45);
                    }
                    setIsBottomPanelCollapsed(!isBottomPanelCollapsed);
                  }}
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
                  {activeTab === "console" && (
                    <div
                      ref={consoleRef}
                      id="console-panel"
                      role="tabpanel"
                      aria-label="Console output"
                      className="h-full p-4 font-mono text-[13px] text-secondary overflow-y-auto whitespace-pre-wrap leading-relaxed"
                    >
                      {output || (
                        <span className="text-muted/60 italic font-sans text-sm">
                          Run code to see output...
                        </span>
                      )}
                    </div>
                  )}
                  {activeTab === "testcases" && (
                    <div id="testcases-panel" role="tabpanel" aria-label="Test cases editor" className="flex flex-col h-full">
                      {/* Case Tabs */}
                      <div className="flex items-center gap-2 p-2 border-b border-border">
                        {visibleTestCases.map((tc, idx) => (
                            <button
                              key={tc.id}
                              onClick={() => setActiveTestCaseId(tc.id)}
                              className={`px-3 py-1 text-xs rounded-md transition-colors flex items-center gap-2 ${
                                activeTestCaseId === tc.id
                                  ? "bg-surface text-primary"
                                  : "text-muted hover:bg-surface"
                              }`}
                            >
                              Case {idx + 1}
                              {visibleTestCases.length > 1 && (
                                <X
                                  className="w-3 h-3 hover:text-rose-400"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTestCases((prev) =>
                                      prev.filter((c) => c.id !== tc.id)
                                    );
                                    if (activeTestCaseId === tc.id) {
                                      const remaining = visibleTestCases.filter(
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
                        <button
                          onClick={() => {
                            const newId = Math.random()
                              .toString(36)
                              .substr(2, 9);
                            const initialInputs: Record<string, string> = {};
                            if (activeChallenge?.arguments) {
                              activeChallenge.arguments.forEach((arg) => {
                                initialInputs[arg.name] = "";
                              });
                            }
                            setTestCases([
                              ...testCases,
                              {
                                id: newId,
                                inputs: initialInputs,
                                expected: "",
                              },
                            ]);
                            setActiveTestCaseId(newId);
                          }}
                          className="p-1 text-muted hover:text-primary"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Case Editors */}
                      <div className="flex-1 flex flex-col gap-6 p-4 overflow-y-auto">
                        {testCases.map((tc) => {
                          if (tc.id !== activeTestCaseId || tc.hidden)
                            return null;
                          return (
                            <div key={tc.id} className="flex flex-col gap-6">
                              {activeChallenge?.arguments?.map((arg) => (
                                <div
                                  key={arg.name}
                                  className="flex flex-col gap-2"
                                >
                                  <label className="text-xs font-medium text-muted">
                                    {arg.name}{" "}
                                    <span className="text-muted/60">
                                      ({arg.type})
                                    </span>
                                  </label>
                                  <AutoResizingEditor
                                    value={tc.inputs[arg.name] || ""}
                                    onChange={(val) => {
                                      setTestCases((prev) =>
                                        prev.map((c) =>
                                          c.id === tc.id
                                            ? {
                                                ...c,
                                                inputs: {
                                                  ...c.inputs,
                                                  [arg.name]: val || "",
                                                },
                                              }
                                            : c
                                        )
                                      );
                                    }}
                                  />
                                </div>
                              ))}
                              <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-muted">
                                  Expected Output
                                </label>
                                <AutoResizingEditor
                                  value={tc.expected}
                                  onChange={(val) => {
                                    setTestCases((prev) =>
                                      prev.map((c) =>
                                        c.id === tc.id
                                          ? { ...c, expected: val || "" }
                                          : c
                                      )
                                    );
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {activeTab === "result" && (
                    <div id="result-panel" role="tabpanel" aria-label="Test results" className="flex flex-col h-full">
                      {!testResults ? (
                        <div className="flex-1 flex items-center justify-center text-muted/60 text-sm italic">
                          {runMessage || (isRunning ? "Running..." : "Run or submit to see results...")}
                        </div>
                      ) : (
                        <>
                          {/* Overall Status */}
                          <div className="p-4 pb-2">
                            {(() => {
                              const totalTests = testResults.length;
                              const passedTests = testResults.filter(
                                (r) => r.status === "Accepted"
                              ).length;
                              const verdict = deriveVerdict(testResults);
                              const allPassed = verdict.kind === "accepted";

                              if (allPassed) {
                                // All tests passed
                                if (lastRunMode === "submit" && isSolved) {
                                  // Submit mode success - Challenge Complete
                                  return (
                                    <div className="flex flex-col gap-3">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                          </div>
                                          <div>
                                            <h3 className="text-primary font-semibold">
                                              Challenge Complete
                                            </h3>
                                            <p className="text-sm text-muted">
                                              {passedTests} / {totalTests} tests
                                              passed
                                            </p>
                                          </div>
                                        </div>
                                        {/* Next Challenge Link */}
                                            {activeChallengeIndex <
                                              challenges.length - 1 && (
                                              <button
                                                onClick={() =>
                                                  setActiveChallengeIndexWithWarmup(
                                                    activeChallengeIndex + 1
                                                  )
                                                }
                                                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 text-secondary hover:text-primary rounded-md transition-colors group"
                                              >
                                              <span>Next Challenge</span>
                                              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                            </button>
                                          )}
                                      </div>
                                    </div>
                                  );
                                } else {
                                  // Run mode success - visible tests only
                                  return (
                                    <div className="flex items-center justify-between">
                                      <h3 className="text-emerald-400 font-medium flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4" />
                                        {passedTests} / {totalTests} tests passed
                                      </h3>
                                      {!isSolved && (
                                        <span className="text-xs text-muted">
                                          Submit to run all tests
                                        </span>
                                      )}
                                    </div>
                                  );
                                }
                              } else {
                                if (verdict.kind === "error" || verdict.kind === "wrong") {
                                  return (
                                    <div className="flex flex-col gap-2">
                                      <h3 className="text-rose-400 font-medium flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4" />
                                        {verdict.label}
                                      </h3>
                                      <p className="text-sm text-muted">
                                        {passedTests} / {totalTests} tests passed
                                      </p>
                                    </div>
                                  );
                                }

                                return (
                                  <h3 className="text-rose-400 font-medium flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    {passedTests} / {totalTests} tests passed
                                  </h3>
                                );
                              }
                            })()}
                          </div>

                          {/* Result Tabs */}
                          <div className="flex items-center gap-2 px-4 border-b border-border overflow-x-auto">
                            {(() => {
                              // Determine which test results to show as tabs
                              const visibleResults = testResults.filter(
                                (r) => !r.hidden
                              );
                              const hiddenResults = testResults.filter(
                                (r) => r.hidden
                              );
                              const allVisiblePassed = visibleResults.every(
                                (r) => r.status === "Accepted"
                              );
                              const firstFailedHidden = hiddenResults.find(
                                (r) => r.status !== "Accepted"
                              );

                              // Build the list of results to display
                              let resultsToShow: typeof testResults = [];

                              if (lastRunMode === "submit") {
                                // Submit mode: show visible tests + first failed hidden (if all visible passed)
                                resultsToShow = [...visibleResults];
                                if (allVisiblePassed && firstFailedHidden) {
                                  resultsToShow.push(firstFailedHidden);
                                }
                              } else {
                                // Run mode: only visible tests were run
                                resultsToShow = visibleResults;
                              }

                              return resultsToShow.map((r, idx) => (
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
                                        ? "bg-emerald-400"
                                        : "bg-rose-400"
                                    }`}
                                  />
                                  {r.hidden ? "Hidden Test" : `Case ${idx + 1}`}
                                </button>
                              ));
                            })()}
                          </div>

                          {/* Result Details */}
                          <div className="flex-1 p-4 overflow-y-auto">
                            {testResults.map((r) => {
                              if (r.id !== activeTestCaseId) return null;
                              return (
                                <div key={r.id} className="flex flex-col gap-3">
                                  {r.hidden ? (
                                    <div className="p-3 bg-surface rounded-lg text-secondary text-[13px] font-mono">
                                      Hidden test details are not available.
                                    </div>
                                  ) : (
                                    <>
                                  {isErrorStatus(r.status) && r.stderr && (
                                    <div className="p-3 bg-rose-500/5 border border-rose-500/20 rounded-lg text-rose-300 text-[13px] font-mono whitespace-pre-wrap leading-relaxed">
                                      {r.stderr}
                                    </div>
                                  )}

                                  {!isErrorStatus(r.status) && (
                                    <>
                                      <div className="space-y-1.5">
                                        <label className="text-[11px] font-medium text-muted uppercase tracking-wide">
                                          Input
                                        </label>
                                        <div className="p-3 bg-surface rounded-lg text-secondary text-[13px] font-mono whitespace-pre-wrap leading-relaxed">
                                          {r.input || <span className="text-muted/60 italic">None</span>}
                                        </div>
                                      </div>

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

                                      <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                          <label className="text-[11px] font-medium text-muted uppercase tracking-wide">
                                            Output
                                          </label>
                                          <div className={`p-3 rounded-lg text-[13px] font-mono whitespace-pre-wrap leading-relaxed ${
                                            r.status === "Accepted"
                                              ? "bg-surface text-secondary"
                                              : "bg-rose-500/5 text-rose-300 border border-rose-500/20"
                                          }`}>
                                            {r.output || <span className="text-muted/60 italic">None</span>}
                                          </div>
                                        </div>

                                        <div className="space-y-1.5">
                                          <label className="text-[11px] font-medium text-muted uppercase tracking-wide">
                                            Expected
                                          </label>
                                          <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg text-emerald-300 text-[13px] font-mono whitespace-pre-wrap leading-relaxed">
                                            {r.expected}
                                          </div>
                                        </div>
                                      </div>
                                    </>
                                  )}
                                    </>
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
          </div>
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
    </div>
  );
}
