import React, { useEffect, useRef } from 'react';
import Editor, { loader, type OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/editor/editor.worker?worker';
import tsWorker from 'monaco-editor/language/typescript/ts.worker?worker';

// Monaco is bundled (no CDN) and lazy-loaded with the coding pages only.
self.MonacoEnvironment = {
  getWorker: (_id: string, label: string) =>
    label === 'typescript' || label === 'javascript' ? new tsWorker() : new editorWorker()
};
loader.config({ monaco });

// JavaScript keeps syntax errors and completions, without type noise from untyped params
monaco.typescript.javascriptDefaults.setDiagnosticsOptions({
  noSemanticValidation: true,
  noSyntaxValidation: false
});

// light theme in the app's palette; GitHub-light style token colours
monaco.editor.defineTheme('knowhere', {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '8b949e', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'cf222e' },
    { token: 'keyword.flow', foreground: 'cf222e' },
    { token: 'string', foreground: '0a3069' },
    { token: 'string.escape', foreground: '0550ae' },
    { token: 'number', foreground: '0550ae' },
    { token: 'regexp', foreground: '116329' },
    { token: 'type', foreground: '8250df' },
    { token: 'type.identifier', foreground: '8250df' },
    { token: 'annotation', foreground: '953800' },
    { token: 'predefined', foreground: '8250df' },
    { token: 'constant', foreground: '0550ae' },
    { token: 'delimiter', foreground: '57606a' },
    { token: 'operator', foreground: 'cf222e' },
    { token: 'identifier', foreground: '1f2328' }
  ],
  colors: {
    'editor.background': '#ffffff',
    'editor.foreground': '#1f2328',
    'editorLineNumber.foreground': '#b4b4bb',
    'editorLineNumber.activeForeground': '#18181b',
    'editor.lineHighlightBackground': '#f6f6f7',
    'editor.lineHighlightBorder': '#00000000',
    'editorCursor.foreground': '#18181b',
    'editor.selectionBackground': '#d7e5ff',
    'editor.inactiveSelectionBackground': '#e8eefb',
    'editorIndentGuide.background1': '#eeeeef',
    'editorIndentGuide.activeBackground1': '#d4d4d8',
    'editorBracketMatch.background': '#e7f0ff',
    'editorBracketMatch.border': '#9ec1ff',
    'editorWhitespace.foreground': '#e4e4e7',
    'editorGutter.background': '#ffffff',
    'scrollbarSlider.background': '#18181b14',
    'scrollbarSlider.hoverBackground': '#18181b2e',
    'scrollbarSlider.activeBackground': '#18181b52',
    'editorWidget.background': '#ffffff',
    'editorWidget.border': '#e4e4e7',
    'editorSuggestWidget.selectedBackground': '#f4f4f5'
  }
});

const MONACO_LANGUAGE: Record<string, string> = {
  javascript: 'javascript',
  python: 'python',
  cpp: 'cpp',
  java: 'java'
};

const FILE_NAME: Record<string, string> = {
  javascript: 'solution.js',
  python: 'solution.py',
  cpp: 'solution.cpp',
  java: 'Solution.java'
};

export interface MonacoEditorProps {
  value: string;
  onChange: (v: string) => void;
  language: string;
  // Ctrl/Cmd + ' runs, Ctrl/Cmd + Enter submits (LeetCode shortcuts)
  onRun?: () => void;
  onSubmit?: () => void;
  onPaste?: (chars: number) => void;
  ariaLabel?: string;
  height?: string | number;
}

const MonacoEditor: React.FC<MonacoEditorProps> = ({
  value,
  onChange,
  language,
  onRun,
  onSubmit,
  onPaste,
  ariaLabel = 'Code editor',
  height = '100%'
}) => {
  // keep the latest handlers without re-registering commands
  const handlers = useRef({ onRun, onSubmit, onPaste });
  useEffect(() => {
    handlers.current = { onRun, onSubmit, onPaste };
  }, [onRun, onSubmit, onPaste]);

  const mount: OnMount = (editor, m) => {
    editor.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.Quote, () => handlers.current.onRun?.());
    editor.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.Enter, () => handlers.current.onSubmit?.());
    editor.onDidPaste((e) => {
      const chars = editor.getModel()?.getValueInRange(e.range).length || 0;
      if (chars) handlers.current.onPaste?.(chars);
    });
  };

  return (
    <Editor
      height={height}
      theme="knowhere"
      language={MONACO_LANGUAGE[language] || 'plaintext'}
      // one model per language, so JavaScript diagnostics never linger on C++ / Java / Python
      path={FILE_NAME[language] || 'solution.txt'}
      value={value}
      onChange={(v) => onChange(v ?? '')}
      onMount={mount}
      loading={<div className="h-full w-full animate-pulse bg-zinc-50" />}
      options={{
        ariaLabel,
        fontSize: 14,
        lineHeight: 22,
        fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace",
        fontLigatures: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        tabSize: 4,
        insertSpaces: true,
        automaticLayout: true,
        padding: { top: 12, bottom: 12 },
        renderLineHighlight: 'all',
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: 'on',
        bracketPairColorization: { enabled: true },
        guides: { bracketPairs: 'active', indentation: true },
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        stickyScroll: { enabled: false },
        fixedOverflowWidgets: true
      }}
    />
  );
};

export default MonacoEditor;
