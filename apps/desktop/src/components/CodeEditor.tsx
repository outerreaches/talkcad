import { useCallback, useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { useEditorStore, useFilesStore } from '../store';

// OpenSCAD language definition
const OPENSCAD_LANGUAGE = {
  keywords: [
    'module', 'function', 'if', 'else', 'for', 'let', 'each',
    'intersection_for', 'include', 'use', 'true', 'false', 'undef',
  ],
  builtins: [
    // 3D primitives
    'cube', 'sphere', 'cylinder', 'polyhedron',
    // 2D primitives
    'circle', 'square', 'polygon', 'text',
    // Transformations
    'translate', 'rotate', 'scale', 'mirror', 'multmatrix', 'color', 'offset', 'hull', 'minkowski',
    // Boolean operations
    'union', 'difference', 'intersection',
    // Extrusion
    'linear_extrude', 'rotate_extrude',
    // Other
    'projection', 'render', 'surface', 'import', 'resize', 'children', 'echo', 'assert',
  ],
  operators: [
    '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=',
    '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%',
  ],
  symbols: /[=><!~?:&|+\-*/^%]+/,
  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
};

export function CodeEditor() {
  const { code, setCode } = useEditorStore();
  const activeFile = useFilesStore((s) => s.activeFile);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Register OpenSCAD language
    monaco.languages.register({ id: 'openscad' });

    monaco.languages.setMonarchTokensProvider('openscad', {
      keywords: OPENSCAD_LANGUAGE.keywords,
      builtins: OPENSCAD_LANGUAGE.builtins,
      operators: OPENSCAD_LANGUAGE.operators,
      symbols: OPENSCAD_LANGUAGE.symbols,
      escapes: OPENSCAD_LANGUAGE.escapes,

      tokenizer: {
        root: [
          // Comments
          [/\/\/.*$/, 'comment'],
          [/\/\*/, 'comment', '@comment'],

          // Strings
          [/"([^"\\]|\\.)*$/, 'string.invalid'],
          [/"/, 'string', '@string'],

          // Numbers
          [/\d*\.\d+([eE][-+]?\d+)?/, 'number.float'],
          [/\d+/, 'number'],

          // Special variables
          [/\$[a-zA-Z_]\w*/, 'variable.special'],

          // Identifiers and keywords
          [
            /[a-zA-Z_]\w*/,
            {
              cases: {
                '@keywords': 'keyword',
                '@builtins': 'keyword.builtin',
                '@default': 'identifier',
              },
            },
          ],

          // Operators
          [/@symbols/, { cases: { '@operators': 'operator', '@default': '' } }],

          // Brackets
          [/[{}()[\]]/, '@brackets'],

          // Delimiters
          [/[;,.]/, 'delimiter'],
        ],

        comment: [
          [/[^/*]+/, 'comment'],
          [/\*\//, 'comment', '@pop'],
          [/[/*]/, 'comment'],
        ],

        string: [
          [/[^\\"]+/, 'string'],
          [/@escapes/, 'string.escape'],
          [/\\./, 'string.escape.invalid'],
          [/"/, 'string', '@pop'],
        ],
      },
    });

    // Set language configuration
    monaco.languages.setLanguageConfiguration('openscad', {
      comments: {
        lineComment: '//',
        blockComment: ['/*', '*/'],
      },
      brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')'],
      ],
      autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
      ],
      surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
      ],
    });

    // Define theme
    monaco.editor.defineTheme('talkcad-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: 'c586c0' },
        { token: 'keyword.builtin', foreground: '4fc1ff' },
        { token: 'variable.special', foreground: '9cdcfe' },
        { token: 'number', foreground: 'b5cea8' },
        { token: 'string', foreground: 'ce9178' },
        { token: 'comment', foreground: '6a9955' },
      ],
      colors: {
        'editor.background': '#18181b',
        'editor.lineHighlightBackground': '#27272a',
        'editorLineNumber.foreground': '#52525b',
        'editorLineNumber.activeForeground': '#a1a1aa',
      },
    });

    monaco.editor.setTheme('talkcad-dark');
  }, []);

    return (
    <div className="h-full relative">
      {!activeFile && (
        <div className="absolute top-2 right-3 z-10 text-[11px] text-zinc-400 bg-zinc-800/80 border border-zinc-700 rounded px-2 py-1">
          Unsaved buffer · Open a folder to load/save files
        </div>
      )}
    <Editor
      height="100%"
      language="openscad"
      value={code}
      onChange={(value) => setCode(value || '')}
      onMount={handleMount}
      options={{
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, monospace",
        minimap: { enabled: false },
        lineNumbers: 'on',
        renderLineHighlight: 'line',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        tabSize: 2,
        automaticLayout: true,
        padding: { top: 8, bottom: 8 },
      }}
    />
    </div>
  );
}
