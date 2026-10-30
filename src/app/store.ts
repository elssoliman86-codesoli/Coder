import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Project, Provider, Model, Skill, GitHubToken, UserSettings } from '@app/types';

interface AppState {
  // Projects
  projects: Record<string, Project>;
  currentProjectId: string | null;
  setProjects: (projects: Record<string, Project>) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  setCurrentProject: (id: string | null) => void;

  // Providers & Models
  providers: Provider[];
  addProvider: (provider: Provider) => void;
  updateProvider: (id: string, updates: Partial<Provider>) => void;
  deleteProvider: (id: string) => void;
  setModels: (providerId: string, models: Model[]) => void;
  updateModelStatus: (providerId: string, modelId: string, status: Model['status']) => void;

  // GitHub
  githubToken: GitHubToken | null;
  setGitHubToken: (token: GitHubToken | null) => void;
  githubRepos: string[];
  setGitHubRepos: (repos: string[]) => void;

  // Skills
  skills: Skill[];
  setSkills: (skills: Skill[]) => void;
  addSkill: (skill: Skill) => void;
  updateSkill: (name: string, updates: Partial<Skill>) => void;
  deleteSkill: (name: string) => void;

  // Settings
  settings: UserSettings;
  updateSettings: (updates: Partial<UserSettings>) => void;

  // UI State
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // Edit Queue
  editQueue: EditQueueItem[];
  addToQueue: (item: EditQueueItem) => void;
  removeFromQueue: (id: string) => void;
  updateQueueItem: (id: string, updates: Partial<EditQueueItem>) => void;
  reorderQueue: (items: EditQueueItem[]) => void;
  clearQueue: () => void;

  // Initialization
  initialized: boolean;
  initialize: () => Promise<void>;
}

interface EditQueueItem {
  id: string;
  projectId: string;
  prompt: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'cancelled';
  filesTouched: string[];
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

const defaultSettings: UserSettings = {
  theme: 'dark',
  language: 'ar',
  fontSize: 14,
  editorTabSize: 2,
  wordWrap: true,
  minimap: false,
  autoSave: true,
  previewAutoRefresh: true,
  maxQueueConcurrency: 1,
  telemetry: false
};

export const useStore = create<AppState>()(
  persist(
    immer((set, get) => ({
      // Projects
      projects: {},
      currentProjectId: null,
      setProjects: (projects) => set({ projects }),
      addProject: (project) => set((state) => { state.projects[project.id] = project; }),
      updateProject: (id, updates) => set((state) => {
        if (state.projects[id]) {
          Object.assign(state.projects[id], updates);
        }
      }),
      deleteProject: (id) => set((state) => {
        delete state.projects[id];
        if (state.currentProjectId === id) {
          state.currentProjectId = null;
        }
      }),
      setCurrentProject: (id) => set({ currentProjectId: id }),

      // Providers
      providers: [],
      addProvider: (provider) => set((state) => {
        state.providers.push(provider);
      }),
      updateProvider: (id, updates) => set((state) => {
        const idx = state.providers.findIndex(p => p.id === id);
        if (idx !== -1) {
          Object.assign(state.providers[idx], updates);
        }
      }),
      deleteProvider: (id) => set((state) => {
        state.providers = state.providers.filter(p => p.id !== id);
      }),
      setModels: (providerId, models) => set((state) => {
        const idx = state.providers.findIndex(p => p.id === providerId);
        if (idx !== -1) {
          state.providers[idx].models = models;
        }
      }),
      updateModelStatus: (providerId, modelId, status) => set((state) => {
        const pIdx = state.providers.findIndex(p => p.id === providerId);
        if (pIdx !== -1) {
          const mIdx = state.providers[pIdx].models.findIndex(m => m.id === modelId);
          if (mIdx !== -1) {
            state.providers[pIdx].models[mIdx].status = status;
          }
        }
      }),

      // GitHub
      githubToken: null,
      setGitHubToken: (token) => set({ githubToken: token }),
      githubRepos: [],
      setGitHubRepos: (repos) => set({ githubRepos: repos }),

      // Skills
      skills: [],
      setSkills: (skills) => set({ skills }),
      addSkill: (skill) => set((state) => { state.skills.push(skill); }),
      updateSkill: (name, updates) => set((state) => {
        const idx = state.skills.findIndex(s => s.name === name);
        if (idx !== -1) {
          Object.assign(state.skills[idx], updates);
        }
      }),
      deleteSkill: (name) => set((state) => {
        state.skills = state.skills.filter(s => s.name !== name);
      }),

      // Settings
      settings: defaultSettings,
      updateSettings: (updates) => set((state) => {
        Object.assign(state.settings, updates);
      }),

      // UI
      sidebarOpen: false,
      toggleSidebar: () => set((state) => { state.sidebarOpen = !state.sidebarOpen; }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      // Edit Queue
      editQueue: [],
      addToQueue: (item) => set((state) => { state.editQueue.push(item); }),
      removeFromQueue: (id) => set((state) => {
        state.editQueue = state.editQueue.filter(item => item.id !== id);
      }),
      updateQueueItem: (id, updates) => set((state) => {
        const idx = state.editQueue.findIndex(item => item.id === id);
        if (idx !== -1) {
          Object.assign(state.editQueue[idx], updates);
        }
      }),
      reorderQueue: (items) => set({ editQueue: items }),
      clearQueue: () => set({ editQueue: [] }),

      // Initialization
      initialized: false,
      initialize: async () => {
        if (get().initialized) return;

        // Load built-in skills
        const { loadBuiltinSkills } = await import('@skills/builtin');
        set({ skills: loadBuiltinSkills() });

        // Apply theme
        const { settings } = get();
        document.documentElement.classList.toggle('light', settings.theme === 'light');
        document.documentElement.setAttribute('dir', settings.language === 'ar' ? 'rtl' : 'ltr');
        document.documentElement.setAttribute('lang', settings.language);

        set({ initialized: true });
      }
    })),
    {
      name: '2onebyte-coder-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        projects: state.projects,
        currentProjectId: state.currentProjectId,
        providers: state.providers.map(({ apiKey, ...provider }) => ({ ...provider, apiKey: '' })),
        skills: state.skills,
        settings: state.settings,
        editQueue: state.editQueue
      }),
      version: 1,
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          // Migration from v0 to v1
          return {
            ...persistedState,
            settings: { ...defaultSettings, ...persistedState.settings }
          };
        }
        return persistedState as AppState;
      }
    }
  )
);

// Selectors
export const useCurrentProject = () => useStore(state => state.currentProjectId ? state.projects[state.currentProjectId] : null);
export const useProviders = () => useStore(state => state.providers);
export const useSkills = () => useStore(state => state.skills);
export const useSettings = () => useStore(state => state.settings);
export const useEditQueue = () => useStore(state => state.editQueue);