// Verifies that a skill really changes what the model does — not just that its text exists.
import type { Skill, SkillCheck } from '../types';
import type { ChatMessage } from '../llm/client';
import { extractJson } from '../agents/parse';
import { skillsPrompt } from './router';

type Chat = (messages: ChatMessage[]) => Promise<string>;

const DESIGN_SYSTEM = `You design a small, objective test for an instruction set ("skill") given to an AI assistant.
Return ONLY JSON: { "task": "...", "criteria": ["...", "..."] }
- "task": a realistic request a user would make where this skill's instructions clearly matter. It must be answerable in under 60 lines of text/code, standalone, no attachments.
- "criteria": 3 to 5 concrete, objectively checkable statements taken from the skill's instructions that a good answer must satisfy (e.g. "uses X", "does not do Y", "includes section Z"). Each must be verifiable by reading the answer.`;

const JUDGE_SYSTEM = `You are a strict judge. You get a task, an answer, and a list of criteria.
For EACH criterion decide if the answer clearly satisfies it. Quote a short piece of evidence from the answer (or say what is missing).
Return ONLY JSON: { "results": [ { "criterion": "...", "met": true, "evidence": "..." } ] }`;

async function judge(chat: Chat, task: string, answer: string, criteria: string[]) {
  const raw = await chat([
    { role: 'system', content: JUDGE_SYSTEM },
    { role: 'user', content: `Task:\n${task}\n\nCriteria:\n${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\nAnswer to judge:\n<<<\n${answer.slice(0, 12_000)}\n>>>` },
  ]);
  const j = extractJson(raw) as any;
  const arr: any[] = Array.isArray(j?.results) ? j.results : [];
  const results = criteria.map((c, i) => {
    const r = arr[i] ?? arr.find((x) => x?.criterion === c) ?? {};
    return { criterion: c, met: r.met === true, evidence: String(r.evidence ?? '').slice(0, 300) };
  });
  return { score: criteria.length ? results.filter((r) => r.met).length / criteria.length : 0, results };
}

export function verdictOf(withScore: number, withoutScore: number): SkillCheck['verdict'] {
  if (withScore < 0.6) return 'ineffective';
  if (withScore > withoutScore + 0.05) return 'effective';
  if (withScore >= 0.8) return 'neutral'; // the model already did this without the skill
  return 'weak';
}

/** Runs the same task with and without the skill, judges both against criteria derived from the skill, compares. */
export async function checkSkill(chat: Chat, skill: Skill, onStep?: (s: string) => void): Promise<SkillCheck> {
  onStep?.('بيصمّم اختبار من تعليمات المهارة…');
  const spec = extractJson(await chat([
    { role: 'system', content: DESIGN_SYSTEM },
    { role: 'user', content: `Skill name: ${skill.name}\nDescription: ${skill.description}\n\nInstructions:\n${skill.body.slice(0, 8000)}` },
  ])) as any;
  const task = String(spec?.task ?? '').trim();
  const criteria: string[] = (Array.isArray(spec?.criteria) ? spec.criteria : []).map((c: unknown) => String(c).trim()).filter(Boolean).slice(0, 5);
  if (!task || criteria.length < 2) throw new Error('الموديل ما قدرش يصمّم اختبار من المهارة دي (التعليمات مش محددة كفاية)');
  onStep?.('بينفّذ المهمة بالمهارة…');
  const a = await chat([{ role: 'system', content: skillsPrompt([{ ...skill, enabled: true }]) }, { role: 'user', content: task }]);
  onStep?.('بينفّذ نفس المهمة من غير المهارة…');
  const b = await chat([{ role: 'system', content: 'You are a helpful assistant.' }, { role: 'user', content: task }]);
  onStep?.('بيقيّم النتيجتين…');
  const withSkill = await judge(chat, task, a, criteria);
  const withoutSkill = await judge(chat, task, b, criteria);
  return { at: Date.now(), task, criteria, withSkill, withoutSkill, verdict: verdictOf(withSkill.score, withoutSkill.score) };
}
