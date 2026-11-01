import type { ProjectType, Role, Skill } from '../types';

export function scoreSkill(skill: Skill, text: string): number {
  const hay = text.toLowerCase();
  let score = 0;
  const nameParts = new Set(skill.name.toLowerCase().split(/[-_\s]+/).filter((x) => x.length >= 3));
  for (const t of skill.triggers) {
    const needle = t.toLowerCase().trim();
    // for auto-derived triggers a hit on the skill's own name is a strong signal; generic description words are weak
    if (needle && hay.includes(needle)) score += skill.autoTriggers && nameParts.has(needle) ? 2 : 1;
  }
  return score;
}

/** Picks the skills that apply to a project (type + description) and, optionally, to one agent role. */
export function selectSkills(all: Skill[], description: string, type: ProjectType | 'any', role?: Role): Skill[] {
  return all.filter((s) => {
    if (!s.enabled) return false;
    if (type !== 'any' && !s.appliesTo.includes(type) && !s.appliesTo.includes('*')) return false;
    if (role && s.agents && s.agents.length > 0 && !s.agents.includes(role)) return false;
    return s.always || scoreSkill(s, description) >= (s.autoTriggers ? 2 : 1);
  });
}

const STOP = new Set('this that with from your when using used use into over than then they them have will should would could about their there which what also only more most such each other any all and for the are was were been being has had not but you can may per via its our out off one two how why who whom'.split(' '));

/** Trigger words for skills that came without any (e.g. from a GitHub SKILL.md): the name parts + distinctive words of the description. */
export function deriveTriggers(name: string, description: string, max = 14): string[] {
  const out: string[] = [];
  const add = (w: string) => { const x = w.toLowerCase(); if (x.length >= 3 && !STOP.has(x) && !out.includes(x)) out.push(x); };
  name.split(/[-_\s]+/).forEach(add);
  for (const w of description.split(/[^\p{L}\p{N}+#.]+/u)) { if (w.length >= 4) add(w.replace(/^[.]+|[.]+$/g, '')); if (out.length >= max) break; }
  return out.slice(0, max);
}

const MAX_REF_FILE = 4000;
const MAX_REF_TOTAL = 12_000;

export function skillsPrompt(skills: Skill[]): string {
  if (skills.length === 0) return '';
  return (
    '# Skills you must follow\n' +
    skills.map((s) => {
      const extra = s.files?.length ? `\n### Files of this skill\n${s.files.map((f) => `- ${f.path}`).join('\n')}` : '';
      let budget = MAX_REF_TOTAL;
      const refs = (s.files ?? []).filter((f) => /\.(md|txt)$/i.test(f.path)).map((f) => {
        const c = f.content.slice(0, Math.min(MAX_REF_FILE, budget));
        budget -= c.length;
        return c ? `\n#### ${f.path}\n${c}` : '';
      }).join('');
      return `## ${s.name}\n${s.description}\n${s.body}${extra}${refs}`;
    }).join('\n\n')
  );
}

/** skills.md format: front-matter block followed by the instructions, repeated for each skill. */
export function serializeSkills(skills: Skill[]): string {
  return skills
    .map(
      (s) =>
        `---\nname: ${s.name}\ndescription: ${s.description}\napplies_to: [${s.appliesTo.join(', ')}]\ntriggers: [${s.triggers.join(', ')}]\nalways: ${s.always}\n---\n${s.body}\n`,
    )
    .join('\n');
}

const list = (v: string): string[] =>
  v
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

export function parseSkillsMd(text: string): Skill[] {
  const out: Skill[] = [];
  const re = /(?:^|\n)---\r?\n([\s\S]*?)\r?\n---\r?\n/g;
  const matches = [...text.matchAll(re)];
  matches.forEach((m, i) => {
    const meta: Record<string, string> = {};
    for (const line of m[1].split(/\r?\n/)) {
      const k = line.match(/^([a-z_]+):\s*(.*)$/i);
      if (k) meta[k[1].toLowerCase()] = k[2].trim();
    }
    if (!meta.name) return;
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index ?? text.length : text.length;
    out.push({
      name: meta.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
      description: meta.description ?? '',
      appliesTo: meta.applies_to ? list(meta.applies_to) : ['*'],
      triggers: meta.triggers ? list(meta.triggers) : [],
      always: meta.always === 'true',
      enabled: true,
      builtin: false,
      body: text.slice(start, end).trim(),
    });
  });
  return out;
}
