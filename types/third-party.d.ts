declare module '@codemirror/state' {
  export interface EditorState {
    [key: string]: any;
  }
  export const EditorState: {
    create(config: any): EditorState;
    [key: string]: any;
  };
  export type Extension = any;
}

declare module '@codemirror/view' {
  export interface EditorView {
    [key: string]: any;
  }
  export const EditorView: {
    new (...args: any[]): EditorView;
    theme(...args: any[]): any;
    updateListener: any;
    [key: string]: any;
  };
  export const keymap: any;
  export const drawSelection: any;
  export const highlightActiveLine: any;
  export const highlightSpecialChars: any;
  export const lineNumbers: any;
}

declare module '@codemirror/commands' {
  export const history: any;
  export const defaultKeymap: any;
  export const historyKeymap: any;
  export const indentWithTab: any;
}

declare module '@codemirror/language' {
  export const indentOnInput: any;
  export const syntaxHighlighting: any;
  export const HighlightStyle: any;
  export const bracketMatching: any;
  export const indentUnit: any;
}

declare module '@codemirror/lang-cpp' {
  export const cpp: any;
}

declare module '@codemirror/autocomplete' {
  export const autocompletion: any;
  export const closeBrackets: any;
  export const closeBracketsKeymap: any;
}

declare module '@lezer/highlight' {
  export const tags: any;
}

declare module '@google/genai' {
  export type GenerateContentResponse = any;
  export type FunctionCall = any;
  export type Chat = any;
  export const Chat: any;
  export type GoogleGenAI = any;
  export const GoogleGenAI: any;
}

declare module '@google/generative-ai' {
  export type GoogleGenerativeAI = any;
  export const GoogleGenerativeAI: any;
}

declare module 'marked' {
  export const marked: any;
  export function parse(...args: any[]): any;
}

declare module 'jszip' {
  const JSZip: any;
  export default JSZip;
}

declare module 'mermaid' {
  export interface Mermaid {
    [key: string]: any;
  }
  const mermaid: Mermaid;
  export default mermaid;
}

declare module 'vite' {
  export function defineConfig(config: any): any;
}
