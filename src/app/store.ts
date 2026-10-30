import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { get, set, del } from 'idb-keyval';
import type { Project, Provider, Model, Skill, GitHubToken, UserSettings } from '@app/types';

interface EditQueueItem {
  id: string; projectId: string; prompt: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'cancelled';
  filesTouched: string[]; createdAt: number; startedAt?: number; completedAt?: number; error?: string;
}
interface AppState {
  projects: Record<string, Project>; currentProjectId: string | null;
  setProjects: (projects: Record<string, Project>) => void; addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void; deleteProject: (id: string) => void; setCurrentProject: (id: string | null) => void;
  providers: Provider[]; addProvider: (provider: Provider) => void; updateProvider: (id: string, updates: Partial<Provider>) => void;
  deleteProvider: (id: string) => void; setModels: (providerId: string, models: Model[]) => void;
  updateModelStatus: (providerId: string, modelId: string, status: Model['status']) => void;
  githubToken: GitHubToken | null; setGitHubToken: (token: GitHubToken | null) => void;
  githubRepos: string[]; setGitHubRepos: (repos: string[]) => void;
  skills: Skill[]; setSkills: (skills: Skill[]) => void; addSkill: (skill: Skill) => void;
  updateSkill: (name: string, updates: Partial<Skill>) => void; deleteSkill: (name: string) => void;
  settings: UserSettings; updateSettings: (updates: Partial<UserSettings>) => void;
  sidebarOpen: boolean; toggleSidebar: () => void; setSidebarOpen: (open: boolean) => void;
  editQueue: EditQueueItem[]; addToQueue: (item: EditQueueItem) => void; removeFromQueue: (id: string) => void;
  updateQueueItem: (id: string, updates: Partial<EditQueueItem>) => void; reorderQueue: (items: EditQueueItem[]) => void; clearQueue: () => void;
  initialized: boolean; initialize: () => Promise<void>;
}
const defaultSettings: UserSettings = { theme: 'dark', language: 'ar', fontSize: 14, editorTabSize: 2, wordWrap: true, minimap: false, autoSave: true, previewAutoRefresh: true, maxQueueConcurrency: 1, telemetry: false };

export const useStore = create<AppState>()(persist(immer((set, get) => ({
  projects: {}, currentProjectId: null,
  setProjects: projects => set({ projects }),
  addProject: project => set(state => { state.projects[project.id] = { ...project, files: project.files ?? [] }; }),
  updateProject: (id, updates) => set(state => { if (state.projects[id]) Object.assign(state.projects[id], updates); }),
  deleteProject: id => set(state => {
    delete state.projects[id];
    if (state.currentProjectId === id) state.currentProjectId = null;
    state.editQueue = state.editQueue.filter(item => item.projectId !== id);
  }),
  setCurrentProject: id => set({ currentProjectId: id }),
  providers: [],
  addProvider: provider => set(state => { state.providers.push(provider); }),
  updateProvider: (id, updates) => set(state => { const item = state.providers.find(provider => provider.id === id); if (item) Object.assign(item, updates); }),
  deleteProvider: id => set(state => { state.providers = state.providers.filter(provider => provider.id !== id); }),
  setModels: (providerId, models) => set(state => { const item = state.providers.find(provider => provider.id === providerId); if (item) item.models = models; }),
  updateModelStatus: (providerId, modelId, status) => set(state => { const model = state.providers.find(provider => provider.id === providerId)?.models.find(item => item.id === modelId); if (model) model.status = status; }),
  githubToken: null, setGitHubToken: token => set({ githubToken: token }),
  githubRepos: [], setGitHubRepos: repos => set({ githubRepos: repos }),
  skills: [], setSkills: skills => set({ skills }),
  addSkill: skill => set(state => { state.skills.push(skill); }),
  updateSkill: (name, updates) => set(state => { const skill = state.skills.find(item => item.name === name); if (skill) Object.assign(skill, updates); }),
  deleteSkill: name => set(state => { state.skills = state.skills.filter(item => item.name !== name); }),
  settings: defaultSettings, updateSettings: updates => set(state => { Object.assign(state.settings, updates); }),
  sidebarOpen: false, toggleSidebar: () => set(state => { state.sidebarOpen = !state.sidebarOpen; }), setSidebarOpen: open => set({ sidebarOpen: open }),
  editQueue: [], addToQueue: item => set(state => { state.editQueue.push(item); }),
  removeFromQueue: id => set(state => { state.editQueue = state.editQueue.filter(item => item.id !== id); }),
  updateQueueItem: (id, updates) => set(state => { const item = state.editQueue.find(entry => entry.id === id); if (item) Object.assign(item, updates); }),
  reorderQueue: items => set({ editQueue: items }), clearQueue: () => set({ editQueue: [] }),
  initialized: false,
  initialize: async () => {
    if (get().initialized) return;
    const { loadBuiltinSkills } = await import('@skills/builtin');
    const builtins = loadBuiltinSkills();
    const saved = get().skills;
    const merged = [...builtins];
    for (const skill of saved) if (!merged.some(item => item.name === skill.name)) merged.push(skill);
    set({ skills: merged });
    const { settings } = get();
    document.documentElement.classList.toggle('light', settings.theme === 'light');
    document.documentElement.setAttribute('dir', settings.language === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', settings.language);
    set({ initialized: true });
  }
})), {
  name: '2onebyte-coder-storage',
  storage: createJSONStorage(() => ({
    getItem: async (name: string) => (await get<string>(name)) ?? null,
    setItem: async (name: string, value: string) => { await set(name, value); },
    removeItem: async (name: string) => { await del(name); }
  })),
  partialize: state => ({
    projects: state.projects, currentProjectId: state.currentProjectId, githubRepos: state.githubRepos,
    providers: state.providers.map(({ apiKey, ...provider }) => ({ ...provider, apiKey: '' })),
    skills: state.skills, settings: state.settings, editQueue: state.editQueue
  }),
  version: 4,
  skipHydration: true,
  migrate: (persisted: any) => ({
    ...persisted,
    projects: Object.fromEntries(Object.entries(persisted?.projects ?? {}).map(([id, raw]: [string, any]) => [id, { ...raw, files: Array.isArray(raw?.files) ? raw.files : [] }])),
    providers: Array.isArray(persisted?.providers) ? persisted.providers.map((provider: Provider) => ({ ...provider, apiKey: '', models: Array.isArray(provider.models) ? provider.models : [] })) : [],
    settings: { ...defaultSettings, ...(persisted?.settings ?? {}) },
    skills: Array.isArray(persisted?.skills) ? persisted.skills : [],
    editQueue: Array.isArray(persisted?.editQueue) ? persisted.editQueue : []
  })
}));

export const useCurrentProject = () => useStore(state => state.currentProjectId ? state.projects[state.currentProjectId] : null);
export const useProviders = () => useStore(state => state.providers);
export const useSkills = () => useStore(state => state.skills);
export const useSettings = () => useStore(state => state.settings);
export const useEditQueue = () => useStore(state => state.editQueue);
