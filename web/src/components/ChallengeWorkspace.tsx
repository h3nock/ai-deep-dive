"use client";

import React, { useState, useRef, useEffect } from "react";
import { Play, CheckCircle2, AlertCircle, ChevronLeft, Code2, Settings, List, Wifi, WifiOff, Download, X, Plus, Trash2, Copy } from "lucide-react";
import Editor, { useMonaco } from "@monaco-editor/react";
import { AutoResizingEditor } from "./AutoResizingEditor";
import ReactMarkdown from "react-markdown";
import { useDebounce } from "use-debounce";
import { PYTHON_HARNESS } from "@/lib/python-harness";
// We need to dynamically import monaco-vim to avoid SSR issues, but for now we'll try standard import
// If that fails, we might need a different approach. 
// Since this is a client component, we can try to require it inside a useEffect.

export interface Challenge {
  id: string;
  title: string;
  description: string; // Markdown string
  initialCode: string;
  hint?: string;
  difficulty?: "Easy" | "Medium" | "Hard";
  arguments?: { name: string; type: string }[];
  defaultTestCases?: { id: string; inputs: Record<string, string>; expected: string }[];
  executionSnippet?: string; // Code to run the function, e.g. "print(solution(numRows))"
}

interface TestCase {
  id: string;
  inputs: Record<string, string>;
  expected: string;
}

interface TestResult {
  id: string;
  status: "Accepted" | "Wrong Answer" | "Runtime Error";
  input: string;
  stdout: string;
  output: string;
  expected: string;
  stderr?: string;
}

interface ChallengeWorkspaceProps {
  challenges: Challenge[];
  activeChallengeIndex?: number | null;
  setActiveChallengeIndex?: (index: number | null) => void;
}

export function ChallengeWorkspace({ challenges, activeChallengeIndex: externalActiveIndex, setActiveChallengeIndex: externalSetActiveIndex }: ChallengeWorkspaceProps) {
  const [internalActiveIndex, setInternalActiveIndex] = useState<number | null>(null);
  const [code, setCode] = useState("");
  
  // Test Case State
  const [testCases, setTestCases] = useState<TestCase[]>([
    { id: "1", inputs: { numRows: "5" }, expected: "[[1],[1,1],[1,2,1],[1,3,3,1],[1,4,6,4,1]]" },
    { id: "2", inputs: { numRows: "1" }, expected: "[[1]]" }
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
  const [activeTab, setActiveTab] = useState<"console" | "testcases" | "result">("console");
  
  // Bridge State
  const [isConnected, setIsConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [showInstallInput, setShowInstallInput] = useState(false);
  const [installPackageName, setInstallPackageName] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const [debouncedCode] = useDebounce(code, 1000);
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
  const activeChallengeIndex = externalActiveIndex !== undefined ? externalActiveIndex : internalActiveIndex;
  const setActiveChallengeIndex = externalSetActiveIndex || setInternalActiveIndex;

  const activeChallenge = activeChallengeIndex !== null ? challenges[activeChallengeIndex] : null;

  // Initialize code and test cases when challenge changes
  useEffect(() => {
    if (activeChallenge) {
      setCode(activeChallenge.initialCode); // Always set code when challenge changes
      if (activeChallenge.defaultTestCases && activeChallenge.defaultTestCases.length > 0) {
        setTestCases(activeChallenge.defaultTestCases);
        setActiveTestCaseId(activeChallenge.defaultTestCases[0].id);
      } else {
        // Default empty case if none provided or defaultTestCases is empty
        const initialInputs: Record<string, string> = {};
        if (activeChallenge.arguments) {
          activeChallenge.arguments.forEach(arg => {
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
                const fullOutput = (prev || "");
                const lines = fullOutput.trim().split('\n');
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
    if (isConnected && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        command: "sync",
        filename: "main.py",
        content: debouncedCode
      }));
    }
  }, [debouncedCode, isConnected]);

  // Remove old sync test cases effect
  
  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  const handleRun = () => {
    if (!isConnected) {
      setOutput("Error: Local Bridge not connected.\nPlease run 'python bridge.py' in your terminal.");
      return;
    }

    setIsRunning(true);
    setOutput(""); // Clear previous output
    setTestResults(null);
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // 1. Sync User Code
      wsRef.current.send(JSON.stringify({
        command: "sync",
        filename: "main.py",
        content: code
      }));
      
      // 2. Sync Harness
      wsRef.current.send(JSON.stringify({
        command: "sync",
        filename: "harness.py",
        content: PYTHON_HARNESS
      }));

      // 3. Sync Test Config
      // Convert structured inputs to python assignment code for the harness
      const formattedCases = testCases.map(tc => {
        let inputCode = "";
        Object.entries(tc.inputs).forEach(([key, value]) => {
          inputCode += `${key} = ${value}\n`;
        });
        return {
          id: tc.id,
          input: inputCode, // Harness expects 'input' as code to execute
          expected: tc.expected
        };
      });

      const config = {
        cases: formattedCases,
        runner: activeChallenge?.executionSnippet || "print('No execution snippet defined')"
      };
      
      wsRef.current.send(JSON.stringify({
        command: "sync",
        filename: "test_config.json",
        content: JSON.stringify(config)
      }));

      // 4. Run Harness
      wsRef.current.send(JSON.stringify({
        command: "run",
        filename: "harness.py"
      }));
    }
  };

  const handleInstall = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !installPackageName.trim()) return;

    setOutput((prev) => (prev || "") + `\n> Requesting install: ${installPackageName}...\n`);
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        command: "install",
        package: installPackageName.trim()
      }));
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
        const newHeight = ((containerHeight - e.clientY) / containerHeight) * 100;
        
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

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 overflow-hidden select-none">
      
      {/* Left Panel */}
      <div 
        className="flex flex-col bg-white dark:bg-slate-900 overflow-hidden"
        style={{ width: `${leftPanelWidth}%` }}
      >
        {activeChallenge ? (
          // Detail View
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-slate-200 dark:border-slate-800">
              <button 
                onClick={() => setActiveChallengeIndex(null)}
                className="flex items-center gap-1 px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-500 text-sm font-medium transition-colors"
                title="Back to Challenges"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex-1 flex justify-between items-center">
                <h2 className="font-bold text-slate-900 dark:text-white truncate">
                  {activeChallenge.title}
                </h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  activeChallenge.difficulty === 'Easy' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  activeChallenge.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {activeChallenge.difficulty || 'Medium'}
                </span>
              </div>
            </div>

            {/* Description */}
            <div className="flex-1 overflow-y-auto p-6 prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  strong: ({node, ...props}) => {
                    const text = String(props.children);
                    if (text.startsWith("Input:") || text.startsWith("Output:") || text.startsWith("Task:") || text.startsWith("Hint:")) {
                      return <div className="font-bold mt-4 mb-2 text-slate-900 dark:text-white">{props.children}</div>;
                    }
                    return <strong {...props} />;
                  }
                }}
              >
                {activeChallenge.description}
              </ReactMarkdown>
              
              {activeChallenge.hint && (
                <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-lg not-prose">
                  <h4 className="text-amber-800 dark:text-amber-400 font-bold text-xs uppercase mb-1 flex items-center gap-2">
                    <AlertCircle className="w-3 h-3" /> Hint
                  </h4>
                  <p className="text-amber-900 dark:text-amber-300 text-sm">
                    {activeChallenge.hint}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          // List View
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <List className="w-5 h-5" /> Problem List
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {challenges.map((c, idx) => (
                <button
                  key={c.id}
                  onClick={() => setActiveChallengeIndex(idx)}
                  className="w-full text-left p-4 mb-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all group"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {idx + 1}. {c.title}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      c.difficulty === 'Easy' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      c.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {c.difficulty || 'Medium'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Resizer Handle (Left) */}
      <div
        className="w-1 bg-slate-200 dark:bg-slate-800 hover:bg-blue-500 cursor-col-resize transition-colors z-10 flex items-center justify-center"
        onMouseDown={startResizingLeft}
      >
        <div className="w-0.5 h-8 bg-slate-400 rounded-full" />
      </div>

      {/* Right Panel: Editor */}
      <div className="flex-1 flex flex-col bg-slate-900 min-w-[300px]">
        {/* Toolbar */}
        <div className="h-12 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-4 text-slate-400 text-sm">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4" />
              <span>Python 3</span>
            </div>
            <button 
              onClick={() => setIsVimMode(!isVimMode)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-800 transition-colors ${isVimMode ? 'text-green-400' : ''}`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Vim Mode {isVimMode ? 'ON' : 'OFF'}</span>
            </button>
            
            {/* Install Package Button */}
            <div className="relative">
              <button 
                onClick={() => setShowInstallInput(!showInstallInput)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-800 transition-colors ${showInstallInput ? 'text-blue-400 bg-slate-800' : ''}`}
                title="Install Python Package"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Install</span>
              </button>
              
              {showInstallInput && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-3 z-50">
                  <form onSubmit={handleInstall} className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-slate-400">Install Package (pip)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={installPackageName}
                        onChange={(e) => setInstallPackageName(e.target.value)}
                        placeholder="e.g. numpy"
                        className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                        autoFocus
                      />
                      <button 
                        type="submit"
                        disabled={!isConnected || !installPackageName.trim()}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-2 py-1 rounded text-xs font-medium"
                      >
                        Go
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            <div className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
              {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span className="text-xs font-medium">{isConnected ? 'Bridge Connected' : 'Bridge Disconnected'}</span>
            </div>
          </div>
            <button
              onClick={handleRun}
              className="flex items-center gap-2 px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-md transition-colors"
            >
              <Play className="w-3 h-3" />
              Run Code
            </button>
        </div>

        {/* Editor Area */}
        <div className="flex-1 relative min-h-0">
          <Editor
            height="100%"
            defaultLanguage="python"
            value={code}
            onChange={(value) => setCode(value || "")}
            theme="vs-dark"
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
              className="absolute bottom-0 left-0 right-0 px-4 py-1 bg-blue-900/80 text-white text-xs font-mono z-10"
            />
          )}
        </div>

        {/* Resizer Handle (Bottom) */}
        <div
          className="h-1 bg-slate-950 hover:bg-blue-500 cursor-row-resize transition-colors z-10 flex items-center justify-center border-t border-slate-800"
          onMouseDown={startResizingBottom}
        >
           <div className="h-0.5 w-8 bg-slate-600 rounded-full" />
        </div>

        {/* Bottom Panel (Console / Test Cases) */}
        <div 
            className="bg-slate-950 flex flex-col relative"
            style={{ height: `${bottomPanelHeight}%` }}
        >
            {/* Tabs */}
            <div className="flex items-center border-b border-slate-800 bg-slate-900/50">
            <button
              onClick={() => setActiveTab("console")}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-r border-slate-800 transition-colors ${
                activeTab === "console" ? "text-white bg-slate-800" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Console
            </button>
            <button
              onClick={() => setActiveTab("testcases")}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-r border-slate-800 transition-colors ${
                activeTab === "testcases" ? "text-white bg-slate-800" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Test Cases
            </button>
            <button
              onClick={() => setActiveTab("result")}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-r border-slate-800 transition-colors ${
                activeTab === "result" ? "text-white bg-slate-800" : "text-slate-500 hover:text-slate-300"
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
                className="h-full p-4 font-mono text-sm text-slate-300 overflow-y-auto whitespace-pre-wrap"
              >
                {output || <span className="text-slate-600 italic">Run code to see output...</span>}
              </div>
            )}
            {activeTab === "testcases" && (
              <div className="flex flex-col h-full">
                {/* Case Tabs */}
                <div className="flex items-center gap-2 p-2 border-b border-slate-800">
                    {testCases.map((tc, idx) => (
                        <button
                            key={tc.id}
                            onClick={() => setActiveTestCaseId(tc.id)}
                            className={`px-3 py-1 text-xs rounded-md transition-colors flex items-center gap-2 ${
                                activeTestCaseId === tc.id 
                                ? "bg-slate-800 text-white" 
                                : "text-slate-500 hover:bg-slate-900"
                            }`}
                        >
                            Case {idx + 1}
                            {testCases.length > 1 && (
                                <X 
                                    className="w-3 h-3 hover:text-red-400" 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setTestCases(prev => prev.filter(c => c.id !== tc.id));
                                        if (activeTestCaseId === tc.id) {
                                            setActiveTestCaseId(testCases[0].id);
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
                                activeChallenge.arguments.forEach(arg => {
                                    initialInputs[arg.name] = "";
                                });
                            }
                            setTestCases([...testCases, { id: newId, inputs: initialInputs, expected: "" }]);
                            setActiveTestCaseId(newId);
                        }}
                        className="p-1 text-slate-500 hover:text-white"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>

                {/* Case Editors */}
                <div className="flex-1 flex flex-col gap-6 p-4 overflow-y-auto">
                    {testCases.map(tc => {
                        if (tc.id !== activeTestCaseId) return null;
                        return (
                            <div key={tc.id} className="flex flex-col gap-6">
                                {activeChallenge?.arguments?.map(arg => (
                                    <div key={arg.name} className="flex flex-col gap-2">
                                        <label className="text-xs font-medium text-slate-500">
                                            {arg.name} <span className="text-slate-600">({arg.type})</span>
                                        </label>
                                        <AutoResizingEditor
                                            value={tc.inputs[arg.name] || ""}
                                            onChange={(val) => {
                                                setTestCases(prev => prev.map(c => 
                                                    c.id === tc.id 
                                                    ? { ...c, inputs: { ...c.inputs, [arg.name]: val || "" } } 
                                                    : c
                                                ));
                                            }}
                                        />
                                    </div>
                                ))}
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-medium text-slate-500">Expected Output</label>
                                    <AutoResizingEditor
                                        value={tc.expected}
                                        onChange={(val) => {
                                            setTestCases(prev => prev.map(c => c.id === tc.id ? { ...c, expected: val || "" } : c));
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
                    <div className="flex-1 flex items-center justify-center text-slate-500 text-sm italic">
                        Run code to see results...
                    </div>
                ) : (
                    <>
                        {/* Overall Status */}
                        <div className="p-4 pb-2">
                            {testResults.every(r => r.status === "Accepted") ? (
                                <h3 className="text-green-500 font-bold text-lg flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5" /> Accepted
                                </h3>
                            ) : (
                                <h3 className="text-red-500 font-bold text-lg flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5" /> Wrong Answer
                                </h3>
                            )}
                        </div>

                        {/* Result Tabs */}
                        <div className="flex items-center gap-2 px-4 border-b border-slate-800">
                            {testResults.map((r, idx) => (
                                <button
                                    key={r.id}
                                    onClick={() => setActiveTestCaseId(r.id)}
                                    className={`px-3 py-1 text-xs rounded-md transition-colors flex items-center gap-2 mb-2 ${
                                        activeTestCaseId === r.id 
                                        ? "bg-slate-800 text-white" 
                                        : "text-slate-500 hover:bg-slate-900"
                                    }`}
                                >
                                    <span className={`w-2 h-2 rounded-full ${r.status === "Accepted" ? "bg-green-500" : "bg-red-500"}`} />
                                    Case {idx + 1}
                                </button>
                            ))}
                        </div>

                        {/* Result Details */}
                        <div className="flex-1 p-4 overflow-y-auto">
                            {testResults.map(r => {
                                if (r.id !== activeTestCaseId) return null;
                                return (
                                    <div key={r.id} className="flex flex-col gap-4">
                                        {r.status === "Runtime Error" && (
                                            <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-md text-red-400 text-xs font-mono whitespace-pre-wrap">
                                                {r.stderr}
                                            </div>
                                        )}
                                        
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-slate-500">Input</label>
                                            <div className="p-4 bg-slate-900 rounded-md text-slate-300 text-sm font-mono whitespace-pre-wrap">
                                                {r.input}
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-slate-500">Stdout</label>
                                            <div className="p-4 bg-slate-900 rounded-md text-slate-300 text-sm font-mono whitespace-pre-wrap">
                                                {r.stdout || <span className="text-slate-600 italic">No output</span>}
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-slate-500">Output</label>
                                            <div className="p-4 bg-slate-900 rounded-md text-slate-300 text-sm font-mono whitespace-pre-wrap">
                                                {r.output}
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-slate-500">Expected</label>
                                            <div className="p-4 bg-slate-900 rounded-md text-slate-300 text-sm font-mono whitespace-pre-wrap">
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
    </div>
  );
}
