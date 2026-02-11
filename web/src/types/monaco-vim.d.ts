declare module "monaco-vim" {
  export function initVimMode(
    editor: unknown,
    statusNode?: HTMLElement | null
  ): { dispose: () => void };
}
