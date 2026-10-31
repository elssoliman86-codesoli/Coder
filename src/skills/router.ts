import type { ProjectType, Role, Skill } from '../types';

export function scoreSkill(skill: Skill, text: string): number {
  const hay = text.toLowerCase();
  let score = 0;
  for (const t of skill.triggers) {
    const needle = t.toLowerCase().trim();
    if (needle && hay.includes(needle)) score++;
  }
  return score;
}

/** Picks the skills that apply to a project (type + description) and, optionally, to one agent role. */
export function selectSkills(all: Skill[], description: string, type: ProjectType | 'any', role?: Role): Skill[] {
  return all.filter((s) => {
    if (!s.enabled) return false;
    if (type !== 'any' && !s.appliesTo.includes(type) && !s.appliesTo.includes('*')) return false;
    if (role && s.agents && s.agents.length > 0 && !s.agents.includes(role)) return false;
    return s.always || scoreSkill(s, description) > 0;
  });
}

export function skillsPrompt(skills: Skill[]): string {
  if (skills.length === 0) return '';
  return (
    '# Skills you must follow\n' +
    skills.map((s) => `## ${s.name}\n${s.description}\n${s.body}`).join('\n\n')
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
