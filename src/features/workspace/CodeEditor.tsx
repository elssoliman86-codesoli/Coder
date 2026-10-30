import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { indentOnInput, bracketMatching, foldGutter } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { sql } from '@codemirror/lang-sql';

interface CodeEditorProps {
  value: string;
  language: string;
  onChange: (value: string) => void;
}

function languageExtension(language: string) {
  switch (language.toLowerCase()) {
    case 'typescript':
    case 'javascript':
    case 'jsx':
    case 'tsx':
      return javascript({ typescript: language.toLowerCase() === 'typescript' || language.toLowerCase() === 'tsx', jsx: true });
    case 'json': return json();
    case 'markdown': return markdown();
    case 'css': return css();
    case 'html': return html();
    case 'python': return python();
    case 'rust': return rust();
    case 'sql': return sql();
    default: return [];
  }
}

export function CodeEditor({ value, language, onChange }: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        foldGutter(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        drawSelection(),
        history(),
        indentOnInput(),
        bracketMatching(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        languageExtension(language),
        EditorView.lineWrapping,
        EditorView.updateListener.of(update => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString());
        }),
        EditorView.theme({
          '&': { height: '100%', fontSize: '13px', backgroundColor: '#0b1120', color: '#e2e8f0' },
          '.cm-scroller': { overflow: 'auto', fontFamily: "'JetBrains Mono', monospace", lineHeight: '1.7' },
          '.cm-content': { padding: '16px 0', caretColor: '#38bdf8' },
          '.cm-gutters': { backgroundColor: '#0b1120', color: '#64748b', border: 'none' },
          '.cm-activeLine': { backgroundColor: '#172033' },
          '.cm-activeLineGutter': { backgroundColor: '#172033' },
          '&.cm-focused': { outline: 'none' },
          '.cm-selectionBackground': { backgroundColor: '#1e3a5f !important' }
        })
      ]
    });
    const view = new EditorView({ state, parent: host });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [language]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  return <div ref={hostRef} dir="ltr" className="h-full min-h-[55vh] overflow-hidden text-left" aria-label="محرر الأكواد" />;
}
