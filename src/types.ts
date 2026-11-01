/** website = static HTML; webapp = framework app (React/Next/Vue…); backend = API/server; apk = mobile app; exe = desktop program. */
export type ProjectType = 'website' | 'webapp' | 'backend' | 'apk' | 'cli' | 'exe' | 'library';
export type Role = 'planner' | 'coder' | 'critic' | 'fixer' | 'expert';
export const ROLES: Role[] = ['planner', 'coder', 'critic', 'fixer', 'expert'];

export interface ProjectFile {
  path: string;
  content: string;
}

export interface PlanFile {
  path: string;
  purpose: string;
}

export interface PlanFunction {
  file: string;
  name: string;
  signature: string;
  description: string;
}

export interface PlanStack {
  category: string;
  choice: string;
  version: string;
  reason: string;
  verified: boolean;
}

export interface Plan {
  summary: string;
  targetUsers: string;
  type: ProjectType;
  primaryLanguage: string;
  stack: PlanStack[];
  files: PlanFile[];
  functions: PlanFunction[];
  screens: { name: string; route: string; uiTerms: string[] }[];
  design: { style: string; palette: Record<string, string>; typography: string; spacing: string; motion: string };
  tests: string[];
  risks: string[];
  assumptions: string[];
  openQuestions: string[];
}

export type QueueStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export interface QueueItem {
  id: string;
  prompt: string;
  status: QueueStatus;
  createdAt: number;
  filesTouched: string[];
  error?: string;
  /** Snapshot of the files before the item ran, used for undo. */
  snapshot?: ProjectFile[];
  undone?: boolean;
  /** How the model understood the request. */
  understanding?: string;
  /** Reviewer verdict: true = fully done, false = unmet points remain, undefined = not reviewed. */
  satisfied?: boolean | null;
  missing?: string[];
}

export interface PublishInfo {
  repoUrl: string;
  repoFullName: string;
  pagesUrl?: string;
  artifactUrl?: string;
  version: string;
  score: number;
  report: string;
  publishedAt: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  type: ProjectType;
  primaryLanguage: string;
  files: ProjectFile[];
  plan?: Plan;
  planMd?: string;
  status: 'new' | 'planning' | 'coding' | 'ready' | 'error';
  style: string;
  queue: QueueItem[];
  publish?: PublishInfo;
  importedFrom?: string;
  createdAt: number;
  updatedAt: number;
  reviewCycles: number;
  /** Set when the project was imported from a GitHub repository. */
  github?: GithubLink;
  /** AI-written visual simulation, used to preview apps that cannot run in the browser (native Android, desktop, Flutter…). */
  mock?: { html: string; at: number };
  /**
   * Content of each file as it was before the AI's pending changes (null = file is new).
   * Drives the +/− counts and the diff view; an entry disappears when the file is saved or the project is published.
   */
  baseline?: Record<string, string | null>;
  /** Text that had already arrived from the model when a job was cut off (network drop, stop, crash) — path → partial content. */
  recovery?: Record<string, string>;
  /** The model's reasoning text from the last job (kept so a cut-off job doesn't lose it). */
  thinking?: string;
}

export interface GithubLink {
  fullName: string;
  htmlUrl: string;
  /** Branch the project was imported from. */
  baseBranch: string;
  /** Branch the next publish commits to. */
  branch: string;
  /** git blob sha of every imported text file, used to push only what changed (and never touch binaries). */
  shas: Record<string, string>;
}

export interface ModelInfo {
  id: string;
  inputPrice?: number; // USD per 1M tokens
  outputPrice?: number; // USD per 1M tokens
  context?: number;
  maxOutput?: number;
  status: 'untested' | 'testing' | 'ok' | 'error';
  code?: number;
  error?: string;
  starred?: boolean;
}

export interface Provider {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  apiKey: string;
  models: ModelInfo[];
  isDefault: boolean;
}

export interface ModelRef {
  providerId: string;
  modelId: string;
}

export interface Skill {
  name: string;
  description: string;
  appliesTo: string[];
  triggers: string[];
  always: boolean;
  enabled: boolean;
  builtin: boolean;
  body: string;
  /** Agents that receive this skill. Empty/undefined = every agent. */
  agents?: Role[];
  /** Triggers were derived automatically (not written by a person): require a stronger match before activating. */
  autoTriggers?: boolean;
  /** Group shown as a folder in the skills list (e.g. "owner/repo" for imported skills). */
  folder?: string;
  /** Other files that live next to SKILL.md (references, scripts, templates). */
  files?: { path: string; content: string }[];
  /** Where an imported skill came from. */
  source?: { repo: string; path: string; ref: string };
}

export interface SkillCheck {
  at: number;
  task: string;
  criteria: string[];
  withSkill: { score: number; results: { criterion: string; met: boolean; evidence: string }[] };
  withoutSkill: { score: number; results: { criterion: string; met: boolean; evidence: string }[] };
  verdict: 'effective' | 'neutral' | 'weak' | 'ineffective';
}

export interface GithubState {
  token: string;
  login?: string;
  scopes?: string[];
  verifiedAt?: number;
  plugins: {
    readRepo: boolean;
    writeFiles: boolean;
    createRepo: boolean;
    enablePages: boolean;
    runActions: boolean;
    createReleases: boolean;
  };
}

export interface Settings {
  language: 'ar' | 'en';
  observeSeconds: number;
  maxFixCycles: number;
  concurrency: number;
  /** Seconds of silence from the model before a request is given up (reasoning models can be slow). */
  requestTimeoutSec: number;
  /** Hard cap (minutes) on one model request, even while it keeps streaming. 0 = no cap. */
  maxRequestMinutes: number;
  /** 0 = let the provider decide. */
  maxOutputTokens: number;
  temperature: number;
  /** Piston-compatible endpoint used to run languages that cannot run in the browser (Go, Rust, Java, C++, …). */
  runnerUrl: string;
  /** Colour theme; 'system' follows the OS. */
  theme: 'dark' | 'light' | 'system';
}

export interface AppState {
  projects: Record<string, Project>;
  providers: Provider[];
  roles: Partial<Record<Role, ModelRef>>;
  github: GithubState;
  userSkills: Skill[];
  disabledSkills: string[];
  /** How many times each skill was actually injected into a model request. */
  skillStats: Record<string, { used: number; last: number }>;
  skillChecks: Record<string, SkillCheck>;
  settings: Settings;
}

export const DEFAULT_STATE: AppState = {
  projects: {},
  providers: [],
  roles: {},
  github: {
    token: '',
    plugins: { readRepo: true, writeFiles: true, createRepo: true, enablePages: true, runActions: true, createReleases: true },
  },
  userSkills: [],
  disabledSkills: [],
  skillStats: {},
  skillChecks: {},
  settings: { language: 'ar', observeSeconds: 120, maxFixCycles: 5, concurrency: 3, requestTimeoutSec: 180, maxRequestMinutes: 8, maxOutputTokens: 0, temperature: 0.2, runnerUrl: 'https://emkc.org/api/v2/piston', theme: 'dark' },
};
