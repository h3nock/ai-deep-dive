import React, { useRef, useState, useEffect } from "react";
import Editor, { OnMount, BeforeMount } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import { createMonacoTheme, getMonacoThemeName } from "@/lib/monaco-theme";
import { useTheme } from "next-themes";

interface AutoResizingEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
  language?: string;
  minHeight?: number;
  maxHeight?: number;
}

export function AutoResizingEditor({
  value,
  onChange,
  language = "python",
  minHeight = 50,
  maxHeight = 400,
}: AutoResizingEditorProps) {
  const [height, setHeight] = useState(minHeight);
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
  const { resolvedTheme } = useTheme();
  const mode = resolvedTheme === "light" ? "light" : "dark";

  const handleBeforeMount: BeforeMount = (monaco) => {
    // Define both themes before mount to prevent flash
    monaco.editor.defineTheme(getMonacoThemeName("dark"), createMonacoTheme("dark"));
    monaco.editor.defineTheme(getMonacoThemeName("light"), createMonacoTheme("light"));
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Set theme to match current mode
    monaco.editor.setTheme(getMonacoThemeName(mode));

    // Initial resize
    updateHeight();

    // Listen for content changes
    editor.onDidContentSizeChange(() => {
      updateHeight();
    });
  };

  // React to theme changes
  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(getMonacoThemeName(mode));
    }
  }, [mode]);

  const updateHeight = () => {
    if (editorRef.current) {
      const contentHeight = editorRef.current.getContentHeight();
      const newHeight = Math.max(minHeight, Math.min(contentHeight, maxHeight));
      setHeight(newHeight);
      editorRef.current.layout();
    }
  };

  return (
    <div
      style={{ height: height, transition: "height 0.1s ease-out" }}
      className="w-full rounded-md overflow-hidden bg-background"
    >
      <Editor
        height={height}
        defaultLanguage={language}
        value={value}
        onChange={onChange}
        theme={getMonacoThemeName(mode)}
        beforeMount={handleBeforeMount}
        onMount={handleEditorDidMount}
        loading={<div className="w-full h-full bg-background" />}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: "off",
          folding: false,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          scrollbar: {
            vertical: "hidden",
            horizontal: "hidden",
            handleMouseWheel: false,
          },
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          overviewRulerBorder: false,
          padding: { top: 12, bottom: 12 },
          renderLineHighlight: "none",
        }}
      />
    </div>
  );
}
