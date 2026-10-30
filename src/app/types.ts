/** Core type definitions for 2OneByte-Coder */

export interface Project {
  id: string;
  name: string;
  description: string;
  type: 'website' | 'apk' | 'cli' | 'exe' | 'library';
  primaryLanguage: string;
  languages: string[];
  framework?: string;
  database?: string;
  files: ProjectFile[];
  plan?: ProjectPlan;
  generationStatus?: 'idle' | 'running' | 'complete' | 'error';
  generationError?: string;
  createdAt: number;
  updatedAt: number;
  importedFrom?: string;
  gitRepo?: string;
}

export interface ProjectFile {
  path: string;
  content: string;
  language: string;
  size: number;
  modified: boolean;
  lastModified: number;
}

export interface ProjectPlan {
  summary: string;
  targetUsers: string;
  type: Project['type'];
  runtimeTarget: string;
  stack: StackChoice[];
  fileTree: FileTreeNode[];
  functions: FunctionInventory[];
  dataModel?: DataModel;
  apiContracts?: ApiContract[];
  screens: ScreenMap[];
  design: DesignSummary;
  testPlan: TestPlan;
  risks: Risk[];
  assumptions: string[];
  version: number;
}
export interface StackChoice { category: 'language' | 'framework' | 'database' | 'tooling' | 'testing' | 'deployment'; choice: string; version: string; reason: string; verified: boolean; source: string; }
export interface FileTreeNode { name: string; type: 'file' | 'directory'; path: string; children?: FileTreeNode[]; purpose: string; language?: string; }
export interface FunctionInventory { file: string; functions: FunctionSignature[]; classes: ClassSignature[]; }
export interface FunctionSignature { name: string; signature: string; params: Param[]; returns: string; throws: string[]; calls: string[]; async: boolean; description: string; }
export interface ClassSignature { name: string; extends?: string; implements?: string[]; methods: FunctionSignature[]; properties: PropertySignature[]; }
export interface PropertySignature { name: string; type: string; visibility: 'public' | 'private' | 'protected'; readonly: boolean; description: string; }
export interface Param { name: string; type: string; optional: boolean; default?: string; description: string; }
export interface DataModel { entities: Entity[]; relationships: Relationship[]; }
export interface Entity { name: string; fields: Field[]; indexes: Index[]; }
export interface Field { name: string; type: string; nullable: boolean; unique: boolean; default?: string; description: string; }
export interface Index { fields: string[]; unique: boolean; }
export interface Relationship { from: string; to: string; type: 'one-to-one' | 'one-to-many' | 'many-to-many'; fromField: string; toField: string; }
export interface ApiContract { path: string; method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; request?: RequestSchema; response: ResponseSchema; auth: boolean; description: string; }
export interface RequestSchema { body?: Field[]; query?: Field[]; params?: Field[]; }
export interface ResponseSchema { status: number; body: Field[]; }
export interface ScreenMap { id: string; name: string; route: string; components: UIComponent[]; layout: string; navigation: NavigationElement[]; }
export interface UIComponent { name: string; type: string; props: Record<string, any>; children?: UIComponent[]; file: string; }
export interface NavigationElement { type: 'tab' | 'drawer' | 'stack' | 'modal' | 'sheet'; target: string; label: string; icon?: string; }
export interface DesignSummary { style: string; palette: ColorPalette; typography: TypographyScale; spacing: SpacingScale; motion: MotionRules; rtl: boolean; }
export interface ColorPalette { primary: string; secondary: string; accent: string; background: string; surface: string; text: string; textMuted: string; border: string; success: string; warning: string; error: string; }
export interface TypographyScale { fontSans: string; fontMono: string; fontArabic: string; sizes: Record<string, string>; weights: Record<string, number>; lineHeights: Record<string, number>; }
export interface SpacingScale { base: number; scale: number[]; }
export interface MotionRules { easing: string; durations: Record<string, number>; reducedMotion: boolean; }
export interface TestPlan { unit: TestCase[]; integration: TestCase[]; e2e: TestCase[]; visual: VisualTestCase[]; accessibility: A11yTestCase[]; }
export interface TestCase { name: string; description: string; file: string; function: string; }
export interface VisualTestCase { screen: string; states: string[]; viewport: string[]; }
export interface A11yTestCase { screen: string; criteria: string[]; }
export interface Risk { area: string; description: string; severity: 'low' | 'medium' | 'high' | 'critical'; mitigation: string; }

export interface Provider {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  /** Loaded into memory from the device-local secret vault; excluded from Zustand persistence. */
  apiKey: string;
  models: Model[];
  selectedModelId?: string;
  default: boolean;
  createdAt: number;
}
export interface Model {
  id: string;
  name: string;
  providerId: string;
  inputPrice?: number;
  outputPrice?: number;
  contextWindow?: number;
  maxOutputTokens?: number;
  status: 'untested' | 'testing' | 'ok' | 'error';
  statusCode?: number;
  statusError?: string;
  lastTested?: number;
  starred: boolean;
  assignedRoles: ModelRole[];
}
export type ModelRole = 'planner' | 'coder' | 'observer' | 'critic' | 'fixer' | 'expert' | 'release';
export interface GitHubToken { token: string; username: string; scopes: string[]; verified: boolean; verifiedAt?: number; expiresAt?: number; }
export interface Skill { name: string; description: string; appliesTo: string[]; triggers: string[]; always: boolean; instructions: string; enabled: boolean; frontmatter: SkillFrontmatter; content: string; }
export interface SkillFrontmatter { name: string; description: string; applies_to: string[]; triggers: string[]; always: boolean; }
export interface UserSettings { theme: 'light' | 'dark' | 'system'; language: 'ar' | 'en'; fontSize: number; editorTabSize: number; wordWrap: boolean; minimap: boolean; autoSave: boolean; previewAutoRefresh: boolean; maxQueueConcurrency: number; telemetry: boolean; }
export interface LLMMessage { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; toolCalls?: ToolCall[]; toolCallId?: string; name?: string; }
export interface ToolCall { id: string; type: 'function'; function: { name: string; arguments: string; }; }
export interface LLMResponse { id: string; choices: { index: number; message: LLMMessage; finishReason: string; }[]; usage?: { promptTokens: number; completionTokens: number; totalTokens: number; }; }
export interface LLMStreamChunk { id: string; choices: { index: number; delta: Partial<LLMMessage>; finishReason: string | null; }[]; }
export interface AgentContext { projectId: string; project: Project; plan: ProjectPlan; files: ProjectFile[]; skills: Skill[]; model: Model; provider: Provider; }
export interface AgentResult<T = any> { success: boolean; data?: T; error?: string; events: AgentEvent[]; }
export interface AgentEvent { type: 'log' | 'progress' | 'file' | 'error' | 'complete'; timestamp: number; message: string; data?: any; }
export interface VFSEntry { path: string; type: 'file' | 'directory'; content?: Uint8Array; size: number; modified: number; created: number; }
export interface ZipImportResult { files: ProjectFile[]; entryPoint?: string; dependencies: Record<string, string>; languages: string[]; packageManager?: string; }
export interface PublishResult { success: boolean; repoUrl?: string; releaseUrl?: string; pagesUrl?: string; artifactUrls?: string[]; evaluation?: EvaluationResult; error?: string; }
export interface EvaluationResult { score: number; criteria: EvaluationCriteria; passed: boolean; blockers: string[]; }
export interface EvaluationCriteria { correctness: number; security: number; architecture: number; tests: number; documentation: number; uiQuality: number; accessibility: number; performance: number; dependencies: number; releaseReadiness: number; }
export interface PreviewMetrics { domIssues: DOMIssue[]; consoleErrors: ConsoleError[]; networkErrors: NetworkError[]; performanceMetrics: PerformanceMetric[]; screenshots: Screenshot[]; }
export interface DOMIssue { type: 'overlap' | 'sticky' | 'clipped' | 'contrast' | 'focus' | 'spacing' | 'alignment' | 'rtl'; selector: string; message: string; severity: 'low' | 'medium' | 'high'; screenshot?: string; }
export interface ConsoleError { type: 'error' | 'warning' | 'info'; message: string; source: string; line?: number; column?: number; }
export interface NetworkError { url: string; method: string; status: number; error: string; }
export interface PerformanceMetric { name: string; value: number; unit: string; threshold?: number; }
export interface Screenshot { name: string; dataUrl: string; viewport: { width: number; height: number; }; timestamp: number; }
export interface VisualCritique { issues: VisualIssue[]; summary: string; severity: 'low' | 'medium' | 'high'; }
export interface VisualIssue { id: string; element: string; file: string; type: 'layout' | 'color' | 'typography' | 'spacing' | 'consistency' | 'accessibility' | 'rtl'; severity: 'low' | 'medium' | 'high' | 'critical'; description: string; suggestion: string; namethatuiTerm?: string; }
export interface FixResult { fixed: boolean; filesModified: string[]; issuesResolved: string[]; issuesRemaining: VisualIssue[]; lintErrors: LintError[]; typeErrors: TypeError[]; testFailures: TestFailure[]; }
export interface LintError { file: string; line: number; column: number; rule: string; message: string; severity: 'error' | 'warning'; }
export interface TypeError { file: string; line: number; column: number; message: string; }
export interface TestFailure { test: string; file: string; error: string; }
export type ProjectType = 'website' | 'apk' | 'cli' | 'exe' | 'library';
export type Language = 'typescript' | 'javascript' | 'python' | 'dart' | 'kotlin' | 'java' | 'csharp' | 'go' | 'rust' | 'cpp' | 'c' | 'php' | 'html' | 'css' | 'shell' | 'sql' | 'json' | 'yaml' | 'markdown';
export type Framework = 'react' | 'vue' | 'svelte' | 'solid' | 'nextjs' | 'remix' | 'astro' | 'flutter' | 'react-native' | 'capacitor' | 'tauri' | 'electron' | 'fastapi' | 'express' | 'nestjs' | 'django' | 'spring' | 'gin' | 'actix' | 'none';
export type Database = 'sqlite' | 'postgresql' | 'mysql' | 'mongodb' | 'redis' | 'firestore' | 'supabase' | 'pocketbase' | 'none';
