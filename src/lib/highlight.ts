const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const KW = '\\b(?:function|const|let|var|return|if|else|elif|for|while|do|class|import|export|from|new|async|await|def|self|None|True|False|try|catch|except|finally|throw|raise|in|of|is|not|and|or|lambda|with|as|pass|yield|switch|case|break|continue|default|struct|fn|pub|impl|use|mod|package|func|go|defer|interface|type|enum|public|private|protected|static|void|int|float|double|string|bool|boolean|null|undefined|true|false|this|super|extends|implements|namespace|using|val|fun|override|abstract|final|readonly)\\b';

interface Rule { re: string; cls: string }

function rulesFor(lang: string): Rule[] {
  const str = { re: '"(?:\\\\.|[^"\\\\\\n])*"|\'(?:\\\\.|[^\'\\\\\\n])*\'|`(?:\\\\.|[^`\\\\])*`', cls: 'tk-s' };
  const num = { re: '\\b\\d+(?:\\.\\d+)?(?:px|em|rem|%|vh|vw|ms|s)?\\b', cls: 'tk-n' };
  switch (lang) {
    case 'html':
      return [{ re: '&lt;!--[\\s\\S]*?--&gt;', cls: 'tk-c' }, { re: '&lt;/?[a-zA-Z][\\w:-]*', cls: 'tk-k' }, { re: '\\s[a-zA-Z_:@-][\\w:.-]*(?==)', cls: 'tk-a' }, str, { re: '/?&gt;', cls: 'tk-k' }];
    case 'css':
      return [{ re: '/\\*[\\s\\S]*?\\*/', cls: 'tk-c' }, str, { re: '[a-z-]+(?=\\s*:)', cls: 'tk-a' }, { re: '#[0-9a-fA-F]{3,8}\\b', cls: 'tk-n' }, num, { re: '[.#][a-zA-Z_][\\w-]*', cls: 'tk-k' }];
    case 'python':
    case 'shell':
    case 'yaml':
      return [{ re: '#[^\\n]*', cls: 'tk-c' }, str, num, { re: KW, cls: 'tk-k' }];
    case 'json':
      return [{ re: '"(?:\\\\.|[^"\\\\])*"(?=\\s*:)', cls: 'tk-a' }, str, num, { re: '\\b(?:true|false|null)\\b', cls: 'tk-k' }];
    case 'markdown':
      return [{ re: '^#{1,6} .*$', cls: 'tk-k' }, { re: '`[^`\\n]+`', cls: 'tk-s' }];
    default:
      return [{ re: '//[^\\n]*|/\\*[\\s\\S]*?\\*/', cls: 'tk-c' }, str, num, { re: KW, cls: 'tk-k' }];
  }
}

/** Tiny syntax highlighter. Input is escaped first, so the returned HTML is safe to inject. */
export function highlight(code: string, lang: string): string {
  const text = esc(code);
  if (text.length > 120_000) return text; // keep big files responsive
  const rules = rulesFor(lang);
  const re = new RegExp(rules.map((r) => `(${r.re})`).join('|'), lang === 'markdown' ? 'gm' : 'g');
  return text.replace(re, (m, ...groups) => {
    const i = groups.findIndex((g, idx) => idx < rules.length && g !== undefined);
    return i >= 0 ? `<span class="${rules[i].cls}">${m}</span>` : m;
  });
}
