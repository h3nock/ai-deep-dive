import type Editor from "@monaco-editor/react";

/** UI-level test case used in the challenge editor panels. */
export interface TestCase {
  id: string;
  inputs: Record<string, string>;
  expected: string;
  explanation?: string;
}

// Monaco editor instance types derived from the Editor component's onMount callback
export type EditorOnMount = NonNullable<
  React.ComponentProps<typeof Editor>["onMount"]
>;
export type MonacoEditorInstance = Parameters<EditorOnMount>[0];
export type MonacoInstance = Parameters<EditorOnMount>[1];

// Monaco vim integration types
export type MonacoVimSession = { dispose: () => void };
export type MonacoVimModule = {
  initVimMode: (
    editor: MonacoEditorInstance,
    statusNode?: HTMLElement | null
  ) => MonacoVimSession;
};
