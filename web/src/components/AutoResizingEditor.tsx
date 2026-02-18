import React, { useRef, useState } from "react";
import Editor, { OnMount, BeforeMount } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";

// Custom Monaco Theme - Eye-Safe Zinc Dark (matches ChallengeWorkspace)
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

  const handleBeforeMount: BeforeMount = (monaco) => {
    // Define theme before mount to prevent flash
    monaco.editor.defineTheme("zinc-dark", ZINC_DARK_THEME);
  };

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;

    // Initial resize
    updateHeight();

    // Listen for content changes
    editor.onDidContentSizeChange(() => {
      updateHeight();
    });
  };

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
      className="w-full rounded-md overflow-hidden bg-[#09090B]"
    >
      <Editor
        height={height}
        defaultLanguage={language}
        value={value}
        onChange={onChange}
        theme="zinc-dark"
        beforeMount={handleBeforeMount}
        onMount={handleEditorDidMount}
        loading={<div className="w-full h-full bg-[#09090B]" />}
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
