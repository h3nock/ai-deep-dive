"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  Code2,
  Settings,
  Wifi,
  WifiOff,
  X,
  Plus,
  Globe,
  Loader2,
} from "lucide-react";
import Editor, { useMonaco } from "@monaco-editor/react";
import { AutoResizingEditor } from "./AutoResizingEditor";
import ReactMarkdown from "react-markdown";
import { useDebounce } from "use-debounce";
import { PYTHON_HARNESS } from "@/lib/python-harness";
import {
  loadPyodide,
  isPyodideLoaded,
  runTestsWithPyodide,
  canRunInBrowser,
  type TestConfig,
} from "@/lib/pyodide";

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

export interface Challenge {
  id: string;
  title: string;
  description: string; // Markdown string
  initialCode: string;
  hint?: string;
  difficulty?: "Easy" | "Medium" | "Hard";
  arguments?: { name: string; type: string }[];
  defaultTestCases?: {
    id: string;
    inputs: Record<string, string>;
    expected: string;
    hidden?: boolean;
  }[];
  executionSnippet?: string; // Code to run the function, e.g. "print(solution(numRows))"
  dependencies?: string[]; // Required packages (determines browser vs CLI execution)
  visibleTestCases?: number;
  browserOnly?: boolean; // Force browser execution even if bridge connected
}

interface TestCase {
  id: string;
  inputs: Record<string, string>;
  expected: string;
  hidden?: boolean;
}

interface TestResult {
  id: string;
  status: "Accepted" | "Wrong Answer" | "Runtime Error";
  input: string;
  stdout: string;
  output: string;
  expected: string;
  stderr?: string;
  hidden?: boolean;
}

interface ChallengeWorkspaceProps {
  challenges: Challenge[];
  activeChallengeIndex?: number | null;
  setActiveChallengeIndex?: (index: number | null) => void;
}

export function ChallengeWorkspace({
  challenges,
  activeChallengeIndex: externalActiveIndex,
  setActiveChallengeIndex: externalSetActiveIndex,
}: ChallengeWorkspaceProps) {
  const [internalActiveIndex, setInternalActiveIndex] = useState<number | null>(
    null
  );
  const [code, setCode] = useState("");

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

  const [output, setOutput] = useState<string | null>(null); // Raw console output (fallback)
  const [isVimMode, setIsVimMode] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(40); // Percentage
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);

  // Bottom Panel State
  const [bottomPanelHeight, setBottomPanelHeight] = useState(45); // Percentage
  const [isDraggingBottom, setIsDraggingBottom] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "console" | "testcases" | "result"
  >("console");

  // Bridge State
  const [isConnected, setIsConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [showInstallInput, setShowInstallInput] = useState(false);
  const [installPackageName, setInstallPackageName] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const [debouncedCode] = useDebounce(code, 1000);

  // Pyodide State
  const [pyodideStatus, setPyodideStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [executionMode, setExecutionMode] = useState<"browser" | "bridge">(
    "browser"
  );
  // We don't need to debounce test cases for sync anymore, we send them on run

  const monaco = useMonaco();
  const editorRef = useRef<any>(null);
  const vimModeRef = useRef<any>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

  // Auto-scroll console
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [output, activeTab]);

  // Use external state if provided, otherwise use internal state
  const activeChallengeIndex =
    externalActiveIndex !== undefined
      ? externalActiveIndex
      : internalActiveIndex;
  const setActiveChallengeIndex =
    externalSetActiveIndex || setInternalActiveIndex;

  const activeChallenge =
    activeChallengeIndex !== null ? challenges[activeChallengeIndex] : null;

  // Preload Pyodide for browser-compatible challenges
  useEffect(() => {
    if (
      activeChallenge &&
      canRunInBrowser(activeChallenge.dependencies) &&
      pyodideStatus === "idle"
    ) {
      setPyodideStatus("loading");
      loadPyodide()
        .then(() => {
          setPyodideStatus("ready");
        })
        .catch((err) => {
          console.error("Failed to load Pyodide:", err);
          setPyodideStatus("error");
        });
    }
  }, [activeChallenge, pyodideStatus]);

  // Determine execution mode based on challenge and connection
  useEffect(() => {
    if (!activeChallenge) return;

    const browserSupported = canRunInBrowser(activeChallenge.dependencies);

    if (activeChallenge.browserOnly || !isConnected) {
      // Force browser mode or no bridge available
      setExecutionMode("browser");
    } else if (!browserSupported) {
      // Challenge requires packages not available in Pyodide
      setExecutionMode("bridge");
    } else {
      // Default to browser for simplicity
      setExecutionMode("browser");
    }
  }, [activeChallenge, isConnected]);

  // Initialize code and test cases when challenge changes
  useEffect(() => {
    if (activeChallenge) {
      setCode(activeChallenge.initialCode); // Always set code when challenge changes
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
    }
  }, [activeChallenge]);

  // Vim Mode Effect
  useEffect(() => {
    if (!editorRef.current || !monaco) return;

    if (isVimMode) {
      try {
        // @ts-ignore
        const { initVimMode } = require("monaco-vim");
        const statusNode = document.getElementById("vim-status-bar");
        vimModeRef.current = initVimMode(editorRef.current, statusNode);
      } catch (e) {
        console.error("Failed to enable Vim mode:", e);
      }
    } else {
      if (vimModeRef.current) {
        vimModeRef.current.dispose();
        vimModeRef.current = null;
      }
    }

    return () => {
      if (vimModeRef.current) {
        vimModeRef.current.dispose();
        vimModeRef.current = null;
      }
    };
  }, [isVimMode, monaco]);

  // WebSocket Bridge Connection
  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket("ws://localhost:8000");

      ws.onopen = () => {
        setIsConnected(true);
        ws.send(JSON.stringify({ command: "handshake" }));
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Try to reconnect after 3 seconds
        setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        ws.close();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "stdout") {
            // If we are running the harness, the output is the JSON result
            // But we might get partial lines. For now, let's just accumulate raw output
            // and try to parse it at the end if it looks like JSON?
            // Actually, the harness prints the JSON at the very end.
            setOutput((prev) => (prev || "") + data.data);
          } else if (data.type === "stderr") {
            setOutput((prev) => (prev || "") + data.data);
          } else if (data.type === "exit") {
            setIsRunning(false);
            // Try to parse the last line of output as JSON results
            // This is a bit hacky but works for the harness
            setOutput((prev) => {
              const fullOutput = prev || "";
              const lines = fullOutput.trim().split("\n");
              const lastLine = lines[lines.length - 1];
              try {
                const results = JSON.parse(lastLine);
                if (Array.isArray(results)) {
                  setTestResults(results);
                  setActiveTab("result");
                }
              } catch (e) {
                // Not JSON, just regular output
              }
              return fullOutput;
            });
          }
        } catch (e) {
          console.error("Failed to parse message:", event.data);
        }
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Sync Code to Local Bridge
  useEffect(() => {
    if (
      isConnected &&
      wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN
    ) {
      wsRef.current.send(
        JSON.stringify({
          command: "sync",
          filename: "main.py",
          content: debouncedCode,
        })
      );
    }
  }, [debouncedCode, isConnected]);

  // Remove old sync test cases effect

  // Keep latest handleRun in ref for event listeners
  const handleRunRef = useRef<() => void>(() => {});
  useEffect(() => {
    handleRunRef.current = handleRun;
  });

  // Global Keyboard Shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleRunRef.current();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Editor Command
  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;

    // Define and apply custom Zinc dark theme
    monaco.editor.defineTheme("zinc-dark", ZINC_DARK_THEME);
    monaco.editor.setTheme("zinc-dark");

    // Add Cmd+Enter / Ctrl+Enter shortcut to editor
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleRunRef.current();
    });
  };

  const handleRun = useCallback(async () => {
    const browserSupported = canRunInBrowser(activeChallenge?.dependencies);

    // Determine which execution path to use
    const useBrowser =
      executionMode === "browser" &&
      browserSupported &&
      (pyodideStatus === "ready" || pyodideStatus === "loading");

    if (useBrowser) {
      // === BROWSER EXECUTION (Pyodide) ===
      setIsRunning(true);
      setOutput("");
      setTestResults(null);

      try {
        // Wait for Pyodide if still loading
        if (pyodideStatus === "loading") {
          setOutput("Loading Python runtime...\n");
          await loadPyodide();
          setPyodideStatus("ready");
        }

        // Build test config
        const formattedCases = testCases.map((tc) => {
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
        // Strip print() wrapper if present
        if (
          runnerCode.trim().startsWith("print(") &&
          runnerCode.trim().endsWith(")")
        ) {
          runnerCode = runnerCode.trim().slice(6, -1);
        }

        const config: TestConfig = {
          cases: formattedCases,
          runner: runnerCode,
        };

        // Run tests with Pyodide
        const results = await runTestsWithPyodide(
          code,
          config,
          (text) => setOutput((prev) => (prev || "") + text),
          (text) => setOutput((prev) => (prev || "") + text)
        );

        setTestResults(results);
        setActiveTab("result");
      } catch (err: any) {
        setOutput((prev) => (prev || "") + `\nError: ${err.message}`);
      } finally {
        setIsRunning(false);
      }
    } else if (isConnected) {
      // === BRIDGE EXECUTION (Local Python) ===
      setIsRunning(true);
      setOutput("");
      setTestResults(null);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        // 1. Sync User Code
        wsRef.current.send(
          JSON.stringify({
            command: "sync",
            filename: "main.py",
            content: code,
          })
        );

        // 2. Sync Harness
        wsRef.current.send(
          JSON.stringify({
            command: "sync",
            filename: "harness.py",
            content: PYTHON_HARNESS,
          })
        );

        // 3. Sync Test Config
        const formattedCases = testCases.map((tc) => {
          let inputCode = "";
          Object.entries(tc.inputs).forEach(([key, value]) => {
            inputCode += `${key} = ${value}\n`;
          });
          return {
            id: tc.id,
            input: inputCode,
            expected: tc.expected,
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

        const config = {
          cases: formattedCases,
          runner: runnerCode,
        };

        wsRef.current.send(
          JSON.stringify({
            command: "sync",
            filename: "test_config.json",
            content: JSON.stringify(config),
          })
        );

        // 4. Run Harness
        wsRef.current.send(
          JSON.stringify({
            command: "run",
            filename: "harness.py",
          })
        );
      }
    } else {
      // No execution method available
      setOutput(
        "Unable to run code.\n\n" +
          (browserSupported
            ? "Loading Python runtime... Please wait."
            : "This challenge requires packages not available in the browser.\n" +
              "Please run 'python bridge.py' locally for CLI execution.")
      );
    }
  }, [
    code,
    testCases,
    activeChallenge,
    executionMode,
    pyodideStatus,
    isConnected,
  ]);

  const handleInstall = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !installPackageName.trim()) return;

    setOutput(
      (prev) =>
        (prev || "") + `\n> Requesting install: ${installPackageName}...\n`
    );

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          command: "install",
          package: installPackageName.trim(),
        })
      );
      setInstallPackageName("");
      setShowInstallInput(false);
    }
  };

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
      if (isDraggingBottom) {
        const containerHeight = window.innerHeight;
        // Calculate height from bottom: Total Height - Mouse Y Position
        const newHeight =
          ((containerHeight - e.clientY) / containerHeight) * 100;

        if (newHeight > 5 && newHeight < 95) {
          setBottomPanelHeight(newHeight);
        }
      }
    };

    if (isDraggingBottom) {
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
    }

    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isDraggingBottom]);

  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const shortcutLabel = isMac ? "Cmd + Enter" : "Ctrl + Enter";

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background border-t border-border overflow-hidden select-none">
      {/* Left Panel - Prose (full width when no challenge selected) */}
      <div
        className={`flex flex-col bg-background overflow-hidden transition-colors ${
          activeChallenge
            ? `border-r ${
                activePane === "prose" ? "border-zinc-600" : "border-border"
              }`
            : ""
        }`}
        style={{ width: activeChallenge ? `${leftPanelWidth}%` : "100%" }}
        onClick={() => setActivePane("prose")}
      >
        {activeChallenge ? (
          // Detail View
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-border">
              <button
                onClick={() => setActiveChallengeIndex(null)}
                className="flex items-center gap-1 px-2 py-1 hover:bg-surface rounded-md text-muted text-sm font-medium transition-colors"
                title="Back to Challenges"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex-1 flex justify-between items-center">
                <h2 className="font-bold text-primary truncate">
                  {activeChallenge.title}
                </h2>
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

            {/* Description */}
            <div className="flex-1 overflow-y-auto p-6 prose prose-lg prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  p: ({ node, ...props }) => (
                    <p className="mb-4 leading-relaxed" {...props} />
                  ),
                  li: ({ node, ...props }) => (
                    <li className="mb-2" {...props} />
                  ),
                  strong: ({ node, ...props }) => {
                    const text = String(props.children);
                    if (
                      text.startsWith("Input:") ||
                      text.startsWith("Output:") ||
                      text.startsWith("Task:") ||
                      text.startsWith("Hint:")
                    ) {
                      return (
                        <div className="font-bold mt-4 mb-2 text-primary">
                          {props.children}
                        </div>
                      );
                    }
                    return <strong {...props} />;
                  },
                }}
              >
                {activeChallenge.description}
              </ReactMarkdown>

              {activeChallenge.hint && (
                <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg not-prose">
                  <h4 className="text-amber-400 font-bold text-xs uppercase mb-1 flex items-center gap-2">
                    <AlertCircle className="w-3 h-3" /> Hint
                  </h4>
                  <p className="text-amber-300 text-sm">
                    {activeChallenge.hint}
                  </p>
                </div>
              )}

              {/* Automated Example Test Cases */}
              {activeChallenge.defaultTestCases &&
                activeChallenge.defaultTestCases.filter((tc) => !tc.hidden)
                  .length > 0 && (
                  <div className="mt-8 not-prose">
                    <h3 className="text-primary font-bold text-sm mb-4">
                      Examples
                    </h3>
                    <div className="flex flex-col gap-4">
                      {(() => {
                        const nonHidden =
                          activeChallenge.defaultTestCases.filter(
                            (tc) => !tc.hidden
                          );
                        const visibleCount =
                          activeChallenge.visibleTestCases !== undefined
                            ? activeChallenge.visibleTestCases
                            : nonHidden.length;
                        return nonHidden
                          .slice(0, visibleCount)
                          .map((tc, idx) => (
                            <div
                              key={tc.id}
                              className="bg-surface rounded-lg p-4 border border-border"
                            >
                              <div className="flex flex-col gap-2">
                                <div className="text-xs font-mono">
                                  <span className="font-bold text-muted uppercase mr-2">
                                    Input:
                                  </span>
                                  <span className="text-secondary">
                                    {Object.entries(tc.inputs)
                                      .map(([k, v]) => `${k} = ${v}`)
                                      .join(", ")}
                                  </span>
                                </div>
                                <div className="text-xs font-mono">
                                  <span className="font-bold text-muted uppercase mr-2">
                                    Output:
                                  </span>
                                  <span className="text-secondary">
                                    {tc.expected}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ));
                      })()}
                    </div>
                  </div>
                )}
            </div>
          </div>
        ) : (
          // List View - Clean, premium list with same gutter as guide
          <div className="flex flex-col h-full overflow-y-auto py-12">
            <div className="mx-auto w-full max-w-[85ch] px-6 lg:px-8">
              <header className="mb-10">
                <h2 className="font-bold text-2xl text-primary">Challenges</h2>
                <p className="text-muted mt-2">
                  {challenges.length} problems to solve
                </p>
              </header>

              {/* Negative margin so hover padding doesn't break text alignment */}
              <div className="-mx-4 divide-y divide-border">
                {challenges.map((c, idx) => (
                  <div key={c.id} className="py-1">
                    <button
                      onClick={() => setActiveChallengeIndex(idx)}
                      className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-surface transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-muted/60 text-sm font-mono w-6">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <span className="text-secondary group-hover:text-primary transition-colors">
                          {c.title}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-medium ${
                          c.difficulty === "Easy"
                            ? "text-emerald-400"
                            : c.difficulty === "Medium"
                            ? "text-amber-400"
                            : "text-rose-400"
                        }`}
                      >
                        {c.difficulty || "Medium"}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Resizer Handle + Editor Panel - Only show when a challenge is selected */}
      {activeChallenge && (
        <>
          {/* Resizer Handle (Left) */}
          <div
            className="w-1 bg-border hover:bg-zinc-600 cursor-col-resize transition-colors z-10 flex items-center justify-center"
            onMouseDown={startResizingLeft}
          >
            <div className="w-0.5 h-8 bg-muted rounded-full" />
          </div>

          {/* Right Panel: Editor */}
          <div
            className={`flex-1 flex flex-col bg-background min-w-[300px] border-l transition-colors ${
              activePane === "editor" ? "border-zinc-600" : "border-border"
            }`}
            onClick={() => setActivePane("editor")}
          >
            {/* Toolbar */}
            <div className="h-12 flex items-center justify-between px-4 border-b border-border bg-surface">
              <div className="flex items-center gap-4 text-muted text-sm">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4" />
                  <span>Python 3</span>
                </div>
                <button
                  onClick={() => setIsVimMode(!isVimMode)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded hover:bg-background transition-colors ${
                    isVimMode ? "text-emerald-400" : ""
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">
                    Vim Mode {isVimMode ? "ON" : "OFF"}
                  </span>
                </button>

                {/* Execution Mode Indicator */}
                {canRunInBrowser(activeChallenge?.dependencies) ? (
                  <div
                    className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${
                      pyodideStatus === "ready"
                        ? "text-emerald-400"
                        : pyodideStatus === "loading"
                        ? "text-amber-400"
                        : "text-muted"
                    }`}
                  >
                    {pyodideStatus === "loading" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Globe className="w-3.5 h-3.5" />
                    )}
                    <span className="text-xs font-medium">
                      {pyodideStatus === "loading"
                        ? "Loading Python..."
                        : pyodideStatus === "ready"
                        ? "Browser Mode"
                        : "Browser Ready"}
                    </span>
                  </div>
                ) : (
                  <div
                    className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${
                      isConnected ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {isConnected ? (
                      <Wifi className="w-3.5 h-3.5" />
                    ) : (
                      <WifiOff className="w-3.5 h-3.5" />
                    )}
                    <span className="text-xs font-medium">
                      {isConnected ? "Bridge Connected" : "Bridge Required"}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={handleRun}
                disabled={
                  isRunning ||
                  (executionMode === "browser" && pyodideStatus === "error") ||
                  (executionMode === "bridge" && !isConnected)
                }
                title={`Run Code (${shortcutLabel})`}
                className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-muted disabled:cursor-not-allowed text-zinc-950 text-sm font-semibold rounded-md transition-colors"
              >
                {isRunning ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Play className="w-3 h-3" />
                )}
                {isRunning ? "Running..." : "Run Code"}
              </button>
            </div>

            {/* Editor Area */}
            <div className="flex-1 relative min-h-0">
              <Editor
                height="100%"
                defaultLanguage="python"
                value={code}
                onChange={(value) => setCode(value || "")}
                theme="zinc-dark"
                onMount={handleEditorDidMount}
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

            {/* Resizer Handle (Bottom) */}
            <div
              className="h-1 bg-background hover:bg-zinc-600 cursor-row-resize transition-colors z-10 flex items-center justify-center border-t border-border"
              onMouseDown={startResizingBottom}
            >
              <div className="h-0.5 w-8 bg-muted rounded-full" />
            </div>

            {/* Bottom Panel (Console / Test Cases) */}
            <div
              className="bg-background flex flex-col relative"
              style={{ height: `${bottomPanelHeight}%` }}
            >
              {/* Tabs */}
              <div className="flex items-center border-b border-border bg-surface">
                <button
                  onClick={() => setActiveTab("console")}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-r border-border transition-colors ${
                    activeTab === "console"
                      ? "text-primary bg-background"
                      : "text-muted hover:text-secondary"
                  }`}
                >
                  Console
                </button>
                <button
                  onClick={() => setActiveTab("testcases")}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-r border-border transition-colors ${
                    activeTab === "testcases"
                      ? "text-primary bg-background"
                      : "text-muted hover:text-secondary"
                  }`}
                >
                  Test Cases
                </button>
                <button
                  onClick={() => setActiveTab("result")}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-r border-border transition-colors ${
                    activeTab === "result"
                      ? "text-primary bg-background"
                      : "text-muted hover:text-secondary"
                  }`}
                >
                  Result
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-hidden relative">
                {activeTab === "console" && (
                  <div
                    ref={consoleRef}
                    className="h-full p-4 font-mono text-sm text-secondary overflow-y-auto whitespace-pre-wrap"
                  >
                    {output || (
                      <span className="text-muted italic">
                        Run code to see output...
                      </span>
                    )}
                  </div>
                )}
                {activeTab === "testcases" && (
                  <div className="flex flex-col h-full">
                    {/* Case Tabs */}
                    <div className="flex items-center gap-2 p-2 border-b border-border">
                      {testCases
                        .filter((tc) => !tc.hidden)
                        .map((tc, idx) => (
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
                            {testCases.filter((t) => !t.hidden).length > 1 && (
                              <X
                                className="w-3 h-3 hover:text-rose-400"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTestCases((prev) =>
                                    prev.filter((c) => c.id !== tc.id)
                                  );
                                  if (activeTestCaseId === tc.id) {
                                    const remaining = testCases.filter(
                                      (c) => c.id !== tc.id && !c.hidden
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
                          const newId = Math.random().toString(36).substr(2, 9);
                          const initialInputs: Record<string, string> = {};
                          if (activeChallenge?.arguments) {
                            activeChallenge.arguments.forEach((arg) => {
                              initialInputs[arg.name] = "";
                            });
                          }
                          setTestCases([
                            ...testCases,
                            { id: newId, inputs: initialInputs, expected: "" },
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
                  <div className="flex flex-col h-full">
                    {!testResults ? (
                      <div className="flex-1 flex items-center justify-center text-muted text-sm italic">
                        Run code to see results...
                      </div>
                    ) : (
                      <>
                        {/* Overall Status */}
                        <div className="p-4 pb-2">
                          {testResults.every((r) => r.status === "Accepted") ? (
                            <h3 className="text-emerald-400 font-bold text-lg flex items-center gap-2">
                              <CheckCircle2 className="w-5 h-5" /> Accepted
                            </h3>
                          ) : (
                            <h3 className="text-rose-400 font-bold text-lg flex items-center gap-2">
                              <AlertCircle className="w-5 h-5" /> Wrong Answer
                            </h3>
                          )}

                          {/* Hidden Tests Summary */}
                          {(() => {
                            const hiddenResults = testResults.filter(
                              (r) => r.hidden
                            );
                            const hiddenPassed = hiddenResults.filter(
                              (r) => r.status === "Accepted"
                            ).length;
                            const hiddenTotal = hiddenResults.length;

                            if (hiddenTotal > 0) {
                              return (
                                <div className="mt-2 text-xs font-medium text-muted">
                                  {hiddenPassed}/{hiddenTotal} hidden tests
                                  passed
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>

                        {/* Result Tabs */}
                        <div className="flex items-center gap-2 px-4 border-b border-border overflow-x-auto">
                          {testResults.map((r, idx) => {
                            // Only show hidden tests if they failed or if they are the active one (unlikely but safe)
                            if (
                              r.hidden &&
                              r.status === "Accepted" &&
                              activeTestCaseId !== r.id
                            )
                              return null;

                            return (
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
                                      ? "bg-emerald-500"
                                      : "bg-rose-500"
                                  }`}
                                />
                                {r.hidden ? "Hidden Case" : `Case ${idx + 1}`}
                              </button>
                            );
                          })}
                        </div>

                        {/* Result Details */}
                        <div className="flex-1 p-4 overflow-y-auto">
                          {testResults.map((r) => {
                            if (r.id !== activeTestCaseId) return null;
                            return (
                              <div key={r.id} className="flex flex-col gap-4">
                                {r.status === "Runtime Error" && (
                                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-md text-rose-400 text-xs font-mono whitespace-pre-wrap">
                                    {r.stderr}
                                  </div>
                                )}

                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-muted">
                                    Input
                                  </label>
                                  <div className="p-4 bg-surface rounded-md text-secondary text-sm font-mono whitespace-pre-wrap">
                                    {r.input}
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-muted">
                                    Stdout
                                  </label>
                                  <div className="p-4 bg-surface rounded-md text-secondary text-sm font-mono whitespace-pre-wrap">
                                    {r.stdout || (
                                      <span className="text-muted italic">
                                        No output
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-muted">
                                    Output
                                  </label>
                                  <div className="p-4 bg-surface rounded-md text-secondary text-sm font-mono whitespace-pre-wrap">
                                    {r.output}
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-muted">
                                    Expected
                                  </label>
                                  <div className="p-4 bg-surface rounded-md text-secondary text-sm font-mono whitespace-pre-wrap">
                                    {r.expected}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
