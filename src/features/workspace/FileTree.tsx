import { useMemo, useState } from 'react';
import { LangIcon } from '../../components/ui';
import { basename, languageOf } from '../../lib/lang';

interface Node {
  name: string;
  path: string;
  children?: Node[];
}

export function buildTree(paths: string[]): Node[] {
  const root: Node = { name: '', path: '', children: [] };
  for (const p of paths) {
    const parts = p.split('/');
    let cur = root;
    parts.forEach((name, i) => {
      const path = parts.slice(0, i + 1).join('/');
      if (i === parts.length - 1) { cur.children!.push({ name, path }); return; }
      let dir = cur.children!.find((c) => c.children && c.name === name);
      if (!dir) { dir = { name, path, children: [] }; cur.children!.push(dir); }
      cur = dir;
    });
  }
  const sort = (n: Node) => {
    n.children?.sort((a, b) => Number(!!b.children) - Number(!!a.children) || a.name.localeCompare(b.name));
    n.children?.forEach(sort);
  };
  sort(root);
  return root.children!;
}

function Row({ n, depth, active, live, planned, openAll, onSelect }: { n: Node; depth: number; active: string | null; live: Set<string>; planned: Set<string>; openAll: boolean; onSelect: (p: string) => void }) {
  const [open, setOpen] = useState(openAll || depth < 2 || (!!active && active.startsWith(n.path + '/')));
  const pad = { paddingInlineStart: 8 + depth * 14 };
  if (n.children) {
    return (
      <li role="treeitem" aria-expanded={open}>
        <button className="tree-row" style={pad} onClick={() => setOpen(!open)}>
          <span className={open ? 'tri open' : 'tri'} aria-hidden="true">▸</span>
          <span className="tree-name" dir="ltr">{n.name}</span>
        </button>
        {open && <ul role="group">{n.children.map((c) => <Row key={c.path} n={c} depth={depth + 1} active={active} live={live} planned={planned} openAll={openAll} onSelect={onSelect} />)}</ul>}
      </li>
    );
  }
  return (
    <li role="treeitem" aria-selected={active === n.path}>
      <button className={`tree-row${active === n.path ? ' on' : ''}`} style={pad} onClick={() => onSelect(n.path)} data-testid="tree-file" data-path={n.path}>
        <LangIcon lang={languageOf(n.path)} size={20} />
        <span className={`tree-name${planned.has(n.path) ? ' planned' : ''}`} dir="ltr">{basename(n.path)}</span>
        {live.has(n.path) && <span className="live-dot" title="بيتكتب الآن" />}
      </button>
    </li>
  );
}

export function FileTree({ paths, planned, active, live, onSelect }: { paths: string[]; planned: string[]; active: string | null; live: string[]; onSelect: (p: string) => void }) {
  const all = useMemo(() => [...new Set([...paths, ...planned])], [paths, planned]);
  const tree = useMemo(() => buildTree(all), [all]);
  const liveSet = useMemo(() => new Set(live), [live]);
  const pending = useMemo(() => new Set(planned.filter((p) => !paths.includes(p))), [paths, planned]);
  if (tree.length === 0) return <p className="muted small tree-empty">لسه مفيش ملفات</p>;
  return <ul role="tree" className="tree" aria-label="files">{tree.map((n) => <Row key={n.path} n={n} depth={0} active={active} live={liveSet} planned={pending} openAll={all.length <= 80} onSelect={onSelect} />)}</ul>;
}
