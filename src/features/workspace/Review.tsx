import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Project } from '../../types';
import { app } from '../../storage/store';
import { useT } from '../../i18n';
import { Icon } from '../../components/ui';
import { runFixCycle } from '../../agents/pipeline';
import { shouldStop, type CycleRecord } from '../../agents/observer';
import { cancel, log, runJob } from '../../runtime';
import type { AuditSnapshot, PreviewHandle } from './Preview';
import { PROMPT_INPUT_ID } from './PromptBar';

export type ReviewPhase = 'idle' | 'fixing' | 'observing' | 'asking';

/**
 * Drives the preview review loop:
 * reload → (critic → fixer → reload)* up to maxFixCycles or no progress → observe window → ask the user.
 */
export function useReview(projectId: string, preview: RefObject<PreviewHandle | null>) {
  const [phase, setPhase] = useState<ReviewPhase>('idle');
  const [note, setNote] = useState('');
  const running = useRef(false);
  const stopped = useRef(false);

  const fixLoop = useCallback(async (userCritique?: string) => {
    const handle = preview.current;
    if (!handle || running.current) return;
    running.current = true;
    stopped.current = false;
    try {
      setPhase('fixing');
      setNote('بيفحص المعاينة…');
      let snap: AuditSnapshot = await handle.reload();
      if (stopped.current) { setNote(''); setPhase('idle'); return; }
      const history: CycleRecord[] = [];
      let critique = userCritique;
      const max = app.get().settings.maxFixCycles;
      for (;;) {
        if (snap.issues.length === 0 && !critique) break;
        setNote(`دورة إصلاح ${history.length + 1} — ${snap.issues.length} ملاحظة`);
        const before = snap.issues.length;
        const result = await runJob(projectId, 'fix', (ctx) => runFixCycle(ctx, { observed: snap.issues, bodyText: snap.bodyText, userCritique: critique }));
        critique = undefined;
        if (stopped.current || !result || !result.fix) break; // cancelled, failed or nothing to fix
        snap = await handle.reload();
        if (stopped.current) break;
        history.push({ issuesBefore: before, issuesAfter: snap.issues.length });
        const stop = shouldStop(history, max);
        if (stop) { log(projectId, stop === 'max-cycles' ? 'وصلنا للحد الأقصى من دورات الإصلاح' : 'الإصلاحات مش بتقلل المشاكل — وقفت الحلقة وهعرض اللي فاضل', 'warn'); break; }
      }
      setNote('');
      if (stopped.current) { setPhase('idle'); return; }
      handle.observe(app.get().settings.observeSeconds);
      setPhase('observing');
    } finally {
      running.current = false;
    }
  }, [projectId, preview]);

  /** Stop button: abort the running job and end the whole fix loop (no observe window afterwards). */
  const stop = useCallback(() => { stopped.current = true; cancel(projectId); preview.current?.stopObserve?.(); setNote(''); setPhase('idle'); }, [projectId, preview]);
  /** True once after a stop (consumed), so a cancelled job doesn't immediately restart the review loop. */
  const wasStopped = useCallback(() => { const v = stopped.current; stopped.current = false; return v; }, []);
  const onWindowEnd = useCallback(() => setPhase('asking'), []);
  const keepWatching = useCallback(() => { preview.current?.observe(app.get().settings.observeSeconds); setPhase('observing'); }, [preview]);
  const anotherEdit = useCallback(() => { setPhase('idle'); document.getElementById(PROMPT_INPUT_ID)?.focus(); }, []);
  const done = useCallback(() => setPhase('idle'), []);
  return { phase, note, fixLoop, stop, wasStopped, onWindowEnd, keepWatching, anotherEdit, done };
}

export function ReviewPopover({ project, phase, issues, onContinue, onAnother, onDone, onCritique }: {
  project: Project; phase: ReviewPhase; issues: number;
  onContinue: () => void; onAnother: () => void; onDone: () => void; onCritique: (text: string) => void;
}) {
  const t = useT();
  const [text, setText] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (phase === 'asking') ref.current?.focus(); }, [phase]);
  if (phase !== 'asking') return null;
  return (
    <div className="popover" role="dialog" aria-label="review" tabIndex={-1} ref={ref} data-testid="review-popover">
      <p className="popover-title">{issues === 0 ? 'خلصت المراقبة ومفيش ملاحظات.' : `خلصت المراقبة — لسه ${issues} ملاحظة.`}</p>
      <textarea className="input" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="ملاحظتك على الشكل (اختياري) — هتتعامل معاها كشرط" data-testid="critique-input" />
      <div className="popover-actions">
        {text.trim() && <button className="btn primary" onClick={() => { onCritique(text.trim()); setText(''); }} data-testid="send-critique">أصلح الملاحظة</button>}
        <button className="btn" onClick={onContinue} data-testid="continue-watching"><Icon name="play" size={14} /> {t('continueWatching')}</button>
        <button className="btn" onClick={onAnother} data-testid="another-edit">{t('anotherEdit')}</button>
        {project.reviewCycles >= 1 && <button className="btn primary" onClick={onDone} data-testid="thats-it">{t('thatsIt')}</button>}
      </div>
    </div>
  );
}
