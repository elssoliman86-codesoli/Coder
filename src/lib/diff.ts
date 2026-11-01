export interface DiffLine { kind: 'same' | 'add' | 'del'; text: string; a?: number; b?: number }

/** Line diff (LCS) with unchanged runs collapsed to `context` lines around each change. */
export function diffLines(before: string, after: string, context = 3): DiffLine[] {
  const A = before === '' ? [] : before.split('\n');
  const B = after === '' ? [] : after.split('\n');
  // trim common prefix/suffix so the LCS table stays small
  let s = 0;
  while (s < A.length && s < B.length && A[s] === B[s]) s++;
  let e = 0;
  while (e < A.length - s && e < B.length - s && A[A.length - 1 - e] === B[B.length - 1 - e]) e++;
  const a = A.slice(s, A.length - e);
  const b = B.slice(s, B.length - e);
  const mid: DiffLine[] = [];
  if (a.length * b.length > 4_000_000) {
    a.forEach((t, i) => mid.push({ kind: 'del', text: t, a: s + i + 1 }));
    b.forEach((t, i) => mid.push({ kind: 'add', text: t, b: s + i + 1 }));
  } else {
    const n = a.length, m = b.length;
    const t: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
    let i = 0, j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && a[i] === b[j]) { mid.push({ kind: 'same', text: a[i], a: s + i + 1, b: s + j + 1 }); i++; j++; }
      else if (j < m && (i === n || t[i][j + 1] >= t[i + 1][j])) { mid.push({ kind: 'add', text: b[j], b: s + j + 1 }); j++; }
      else { mid.push({ kind: 'del', text: a[i], a: s + i + 1 }); i++; }
    }
  }
  const all: DiffLine[] = [
    ...A.slice(0, s).map((text, i) => ({ kind: 'same' as const, text, a: i + 1, b: i + 1 })),
    ...mid,
    ...A.slice(A.length - e).map((text, i) => ({ kind: 'same' as const, text, a: A.length - e + i + 1, b: B.length - e + i + 1 })),
  ];
  // collapse far-from-change context
  const keep = new Array(all.length).fill(false);
  all.forEach((l, i) => { if (l.kind !== 'same') for (let k = Math.max(0, i - context); k <= Math.min(all.length - 1, i + context); k++) keep[k] = true; });
  const out: DiffLine[] = [];
  let skipped = 0;
  all.forEach((l, i) => {
    if (keep[i]) { if (skipped) { out.push({ kind: 'same', text: `… ${skipped} سطر بدون تغيير …` }); skipped = 0; } out.push(l); }
    else skipped++;
  });
  if (skipped && out.length) out.push({ kind: 'same', text: `… ${skipped} سطر بدون تغيير …` });
  return out;
}

export function diffStats(before: string, after: string): { added: number; removed: number } {
  let added = 0, removed = 0;
  for (const l of diffLines(before, after, 0)) { if (l.kind === 'add') added++; else if (l.kind === 'del') removed++; }
  return { added, removed };
}
