import type { ProjectFile } from '../types';

/** Extracts the first balanced JSON object from model output (handles ``` fences and chatter). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = fenced ? [fenced[1], text] : [text];
  for (const c of candidates) {
    const start = c.indexOf('{');
    if (start < 0) continue;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < c.length; i++) {
      const ch = c[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(c.slice(start, i + 1));
          } catch {
            break;
          }
        }
      }
    }
  }
  throw new Error('الرد لا يحتوي على JSON صالح');
}

export function stripCodeFence(text: string): string {
  const t = text.replace(/^\s*\n/, '');
  const m = t.match(/^```[\w+-]*\n([\s\S]*?)\n?```\s*$/);
  return m ? m[1] : text;
}

export const FILE_START = /^=====FILE:\s*(.+?)\s*=====\s*$/;
export const FILE_END = /^=====END FILE=====\s*$/;

export function fileBlock(path: string, content: string): string {
  return `=====FILE: ${path}=====\n${content}\n=====END FILE=====`;
}

export function safeRelPath(p: string): string | null {
  const s = p.trim().replace(/\\/g, '/').replace(/^\.\//, '');
  if (!s || s.startsWith('/') || /^[a-zA-Z]:/.test(s) || s.split('/').includes('..') || s.includes('\0')) return null;
  return s;
}

export interface StreamHandlers {
  onStart?: (path: string) => void;
  onChunk?: (path: string, text: string) => void;
  onEnd?: (path: string) => void;
}

/**
 * Incremental parser for multi-file output:
 *   =====FILE: path=====
 *   ...content...
 *   =====END FILE=====
 * Content is emitted as soon as it cannot be part of a marker, so the editor can show it live.
 */
export class FileStreamParser {
  private buf = '';
  private current: string | null = null;
  private lineStart = true;
  private firstLine = true;
  readonly files = new Map<string, string>();
  constructor(private h: StreamHandlers = {}) {}

  private emit(text: string) {
    if (this.current === null || !text) return;
    this.files.set(this.current, (this.files.get(this.current) ?? '') + text);
    this.h.onChunk?.(this.current, text);
  }

  private handleLine(line: string, hasNewline: boolean) {
    const start = line.match(FILE_START);
    if (start && this.current === null) {
      const p = safeRelPath(start[1]);
      if (p) {
        this.current = p;
        this.files.set(p, '');
        this.firstLine = true;
        this.h.onStart?.(p);
      }
      return;
    }
    if (this.current !== null && FILE_END.test(line)) {
      // Trailing newline before the end marker belongs to the marker, not to the file.
      const content = this.files.get(this.current) ?? '';
      if (content.endsWith('\n')) this.files.set(this.current, content.slice(0, -1));
      const done = this.current;
      this.current = null;
      this.h.onEnd?.(done);
      return;
    }
    if (this.current !== null) {
      this.emit((this.firstLine ? '' : '') + line + (hasNewline ? '\n' : ''));
      this.firstLine = false;
    }
  }

  feed(chunk: string) {
    this.buf += chunk;
    for (;;) {
      const nl = this.buf.indexOf('\n');
      if (nl < 0) break;
      const line = this.buf.slice(0, nl).replace(/\r$/, '');
      this.buf = this.buf.slice(nl + 1);
      if (this.lineStart) this.handleLine(line, true);
      else this.emit(line + '\n');
      this.lineStart = true;
    }
    // Partial line: show it live if it cannot be a marker.
    if (this.buf && this.current !== null && !this.buf.startsWith('=') && this.lineStart) {
      this.emit(this.buf);
      this.buf = '';
      this.lineStart = false;
    } else if (this.buf && !this.lineStart) {
      this.emit(this.buf);
      this.buf = '';
    }
  }

  end() {
    if (this.buf) {
      const line = this.buf.replace(/\r$/, '');
      this.buf = '';
      if (this.lineStart) this.handleLine(line, false);
      else this.emit(line);
    }
    if (this.current !== null) {
      const done = this.current;
      this.current = null;
      this.h.onEnd?.(done);
    }
  }
}

export function parseFileBlocks(text: string): ProjectFile[] {
  const p = new FileStreamParser();
  p.feed(text);
  p.end();
  return [...p.files.entries()].map(([path, content]) => ({ path, content }));
}
