'use client';

import { useState, useEffect, useCallback } from 'react';

export interface Settings {
  // General
  language: string;
  autoSave: boolean;
  confirmDelete: boolean;
  startupBehavior: 'welcome' | 'lastProject' | 'newProject';

  // Editor
  theme: 'vs-dark' | 'vs-light' | 'hc-black' | 'github-dark' | 'github-light';
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  wordWrap: 'off' | 'on' | 'wordWrapColumn' | 'bounded';
  minimap: boolean;
  lineNumbers: 'on' | 'off' | 'relative' | 'interval';
  formatOnSave: boolean;
  formatOnPaste: boolean;
  autoClosingBrackets: 'always' | 'languageDefined' | 'beforeWhitespace' | 'never';
  autoClosingQuotes: 'always' | 'languageDefined' | 'beforeWhitespace' | 'never';
  bracketPairColorization: boolean;
  guides: { bracketPairs: boolean; indentation: boolean; highlightActiveIndentation: boolean };

  // AI
  aiProvider: 'openai' | 'anthropic' | 'local' | 'ollama';
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  enableInlineCompletion: boolean;
  enableChat: boolean;
  contextWindow: number;

  // Appearance
  uiTheme: 'system' | 'light' | 'dark';
  accentColor: string;
  density: 'comfortable' | 'compact' | 'spacious';
  animations: boolean;
  showLineNumbers: boolean;
  showWhitespace: boolean;

  // Advanced
  telemetry: boolean;
  crashReports: boolean;
  autoUpdate: boolean;
  previewPort: number;
  terminalShell: string;
  gitEnabled: boolean;
  experimentalFeatures: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

const DEFAULT_SETTINGS: Settings = {
  // General
  language: 'ar',
  autoSave: true,
  confirmDelete: true,
  startupBehavior: 'welcome',

  // Editor
  theme: 'vs-dark',
  fontSize: 14,
  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
  tabSize: 2,
  wordWrap: 'on',
  minimap: true,
  lineNumbers: 'on',
  formatOnSave: true,
  formatOnPaste: true,
  autoClosingBrackets: 'always',
  autoClosingQuotes: 'always',
  bracketPairColorization: true,
  guides: { bracketPairs: true, indentation: true, highlightActiveIndentation: true },

  // AI
  aiProvider: 'openai',
  apiKey: '',
  model: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 4096,
  systemPrompt: 'You are a helpful coding assistant.',
  enableInlineCompletion: true,
  enableChat: true,
  contextWindow: 8192,

  // Appearance
  uiTheme: 'system',
  accentColor: '#3b82f6',
  density: 'comfortable',
  animations: true,
  showLineNumbers: true,
  showWhitespace: false,

  // Advanced
  telemetry: false,
  crashReports: true,
  autoUpdate: true,
  previewPort: 3000,
  terminalShell: 'bash',
  gitEnabled: true,
  experimentalFeatures: false,
  logLevel: 'info',
};

const STORAGE_KEY = 'coder-settings';

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings(prev => ({ ...prev, ...parsed }));
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
      setError('فشل تحميل الإعدادات');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save settings to localStorage
  const saveSettings = useCallback(async (newSettings: Partial<Settings>): Promise<boolean> => {
    setError(null);
    try {
      const updated = { ...settings, ...newSettings };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setSettings(updated);
      setHasChanges(false);
      setLastSaved(new Date());
      return true;
    } catch (e) {
      setError('فشل حفظ الإعدادات');
      console.error('Failed to save settings:', e);
      return false;
    }
  }, [settings]);

  // Reset a section to defaults
  const resetSection = useCallback((section: keyof Settings) => {
    const defaultSection = DEFAULT_SETTINGS[section];
    if (defaultSection !== undefined) {
      saveSettings({ [section]: defaultSection } as Partial<Settings>);
    }
  }, [saveSettings]);

  // Reset all settings
  const resetAll = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSettings(DEFAULT_SETTINGS);
    setHasChanges(false);
    setLastSaved(new Date());
  }, []);

  // Update a single setting (for form inputs)
  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      setHasChanges(true);
      return next;
    });
  }, []);

  // Update nested setting (e.g., guides.bracketPairs)
  const updateNestedSetting = useCallback(<T extends object, K extends keyof T>(
    parent: T,
    key: K,
    value: T[K]
  ) => {
    setSettings(prev => {
      const next = { ...prev, [Object.keys(parent)[0]]: { ...parent, [key]: value } };
      setHasChanges(true);
      return next;
    });
  }, []);

  return {
    settings,
    isLoading,
    hasChanges,
    lastSaved,
    error,
    saveSettings,
    resetSection,
    resetAll,
    updateSetting,
    updateNestedSetting,
    DEFAULT_SETTINGS,
  };
}

export type { Settings as SettingsType };