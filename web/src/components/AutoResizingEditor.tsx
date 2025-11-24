import React, { useRef, useState } from "react";
import Editor, { OnMount } from "@monaco-editor/react";

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
  maxHeight = 400 
}: AutoResizingEditorProps) {
  const [height, setHeight] = useState(minHeight);
  const editorRef = useRef<any>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
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
    <div style={{ height: height, transition: "height 0.1s ease-out" }} className="w-full rounded-md overflow-hidden bg-slate-950">
      <Editor
        height={height}
        defaultLanguage={language}
        value={value}
        onChange={onChange}
        theme="vs-dark"
        onMount={handleEditorDidMount}
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
