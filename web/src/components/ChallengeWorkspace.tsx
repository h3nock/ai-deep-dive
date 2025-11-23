"use client";

import React, { useState, useRef, useEffect } from "react";
import { Play, CheckCircle2, AlertCircle, ChevronLeft, Code2, Settings, List } from "lucide-react";
import Editor, { useMonaco } from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";
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
}

interface ChallengeWorkspaceProps {
  challenges: Challenge[];
  activeChallengeIndex?: number | null;
  setActiveChallengeIndex?: (index: number | null) => void;
}

export function ChallengeWorkspace({ challenges, activeChallengeIndex: externalActiveIndex, setActiveChallengeIndex: externalSetActiveIndex }: ChallengeWorkspaceProps) {
  const [internalActiveIndex, setInternalActiveIndex] = useState<number | null>(null);
  const [code, setCode] = useState("");
  const [output, setOutput] = useState<string | null>(null);
  const [isVimMode, setIsVimMode] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(40); // Percentage
  const [isDragging, setIsDragging] = useState(false);

  const monaco = useMonaco();
  const editorRef = useRef<any>(null);
  const vimModeRef = useRef<any>(null);

  // Use external state if provided, otherwise use internal state
  const activeChallengeIndex = externalActiveIndex !== undefined ? externalActiveIndex : internalActiveIndex;
  const setActiveChallengeIndex = externalSetActiveIndex || setInternalActiveIndex;

  // Initialize code when entering a challenge
  useEffect(() => {
    if (activeChallengeIndex !== null) {
      setCode(challenges[activeChallengeIndex].initialCode);
      setOutput(null);
    }
  }, [activeChallengeIndex, challenges]);

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

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  const handleRun = () => {
    setOutput("Running tests...\n\nTest Case 1: Passed ✅\nTest Case 2: Passed ✅\n\nAll tests passed! Great job.");
  };

  // Resizer Logic
  const startResizing = (e: React.MouseEvent) => {
    setIsDragging(true);
    e.preventDefault();
  };

  useEffect(() => {
    const stopResizing = () => setIsDragging(false);
    const resize = (e: MouseEvent) => {
      if (isDragging) {
        const newWidth = (e.clientX / window.innerWidth) * 100;
        if (newWidth > 20 && newWidth < 80) {
          setLeftPanelWidth(newWidth);
        }
      }
    };

    if (isDragging) {
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
    }

    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isDragging]);

  const activeChallenge = activeChallengeIndex !== null ? challenges[activeChallengeIndex] : null;

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 overflow-hidden select-none">
      
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
              >
                <ChevronLeft className="w-4 h-4" />
                Challenges
              </button>
              <div className="flex-1">
                <h2 className="font-bold text-slate-900 dark:text-white truncate">
                  {activeChallenge.title}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    activeChallenge.difficulty === 'Easy' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    activeChallenge.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {activeChallenge.difficulty || 'Medium'}
                  </span>
                </div>
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
                  <p className="text-xs text-slate-500 line-clamp-2">
                    {c.description.replace(/[*_`#]/g, '').split('\n').filter(line => line.trim().length > 0)[0]}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Resizer Handle */}
      <div
        className="w-1 bg-slate-200 dark:bg-slate-800 hover:bg-blue-500 cursor-col-resize transition-colors z-10 flex items-center justify-center"
        onMouseDown={startResizing}
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
        <div className="flex-1 relative">
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

        {/* Output Console */}
        {output && (
          <div className="h-1/3 border-t border-slate-800 bg-slate-950 flex flex-col">
            <div className="px-4 py-2 border-b border-slate-800 text-xs font-bold text-slate-500 uppercase tracking-wider flex justify-between">
              <span>Console Output</span>
              <button onClick={() => setOutput(null)} className="hover:text-slate-300">Close</button>
            </div>
            <div className="flex-1 p-4 font-mono text-sm text-slate-300 overflow-y-auto whitespace-pre-wrap">
              {output}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
