import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '@app/store';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { cn } from '@lib/utils';
import { ChevronDown, ChevronUp, Save, RotateCcw, Loader2, Check } from 'lucide-react';

const SETTINGS_TABS = [
  { id: 'general', label: 'settings.tabs.general', icon: 'settings' },
  { id: 'editor', label: 'settings.tabs.editor', icon: 'edit' },
  { id: 'ai', label: 'settings.tabs.ai', icon: 'cpu' },
  { id: 'appearance', label: 'settings.tabs.appearance', icon: 'palette' },
  { id: 'advanced', label: 'settings.tabs.advanced', icon: 'cog' },
] as const;

type SettingsTabId = typeof SETTINGS_TABS[number]['id'];

interface SettingItemProps {
  key: string;
  type: 'text' | 'password' | 'number' | 'select' | 'switch' | 'slider' | 'textarea' | 'color';
  label: string;
  description?: string;
  value: unknown;
  onChange: (value: unknown) => void;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

const SettingItem = ({ key, type, label, description, value, onChange, options, min, max, step, placeholder }: SettingItemProps) => {
  const id = `setting-${key}`;
  
  const renderInput = () => {
    switch (type) {
      case 'text':
      case 'password':
        return (
          <input
            id={id}
            type={type}
            value={value as string}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
        );
      case 'number':
        return (
          <input
            id={id}
            type="number"
            value={value as number}
            onChange={e => onChange(Number(e.target.value))}
            min={min}
            max={max}
            step={step}
            className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
        );
      case 'select':
        return (
          <select
            id={id}
            value={value as string}
            onChange={e => onChange(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          >
            {options?.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        );
      case 'switch':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              id={id}
              type="checkbox"
              checked={value as boolean}
              onChange={e => onChange(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm font-medium">{value ? 'مفعل' : 'معطل'}</span>
          </label>
        );
      case 'slider':
        return (
          <div className="flex items-center gap-3">
            <input
              id={id}
              type="range"
              value={value as number}
              onChange={e => onChange(Number(e.target.value))}
              min={min}
              max={max}
              step={step}
              className="flex-1 h-2 bg-muted rounded-lg appearance-none accent-primary"
            />
            <span className="text-sm font-mono text-muted-foreground min-w-[40px] text-center">
              {value}
            </span>
          </div>
        );
      case 'textarea':
        return (
          <textarea
            id={id}
            value={value as string}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            rows={4}
            className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-y"
          />
        );
      case 'color':
        return (
          <input
            id={id}
            type="color"
            value={value as string}
            onChange={e => onChange(e.target.value)}
            className="w-10 h-10 rounded border border-border cursor-pointer"
          />
        );
      default:
        return null;
    }
  };

  return (
    <div key={key} className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      {renderInput()}
    </div>
  );
};

const SettingsSection = ({ 
  title, 
  description, 
  children, 
  isSaving, 
  hasChanges,
  onSave,
  onReset 
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  isSaving: boolean;
  hasChanges: boolean;
  onSave: () => void;
  onReset: () => void;
}) => {
  return (
    <div className="space-y-4 p-4 bg-card border border-border rounded-lg">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasChanges && (
            <Badge variant="warning" className="text-xs">
              تغييرات غير محفوظة
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            disabled={isSaving}
            className="gap-1"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            إعادة تعيين
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            disabled={isSaving || !hasChanges}
            className="gap-1"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                جاري الحفظ...
              </>
            ) : hasChanges ? (
              <>
                <Save className="h-3.5 w-3.5" />
                حفظ
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                محفوظ
              </>
            )}
          </Button>
        </div>
      </div>
      <div className="space-y-4 pt-2 border-t border-border">
        {children}
      </div>
    </div>
  );
};

const SettingsTabs = ({ activeTab, onChange }: { activeTab: SettingsTabId; onChange: (tab: SettingsTabId) => void }) => {
  return (
    <div className="flex gap-1 p-1 bg-muted rounded-lg border border-border" role="tablist" aria-label="أقسام الإعدادات">
      {SETTINGS_TABS.map(tab => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`panel-${tab.id}`}
          id={`tab-${tab.id}`}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
            activeTab === tab.id
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
          )}
        >
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
};

export const Settings = () => {
  const { t } = useTranslation('settings');
  const {
    settings,
    updateSettings,
    hasUnsavedChanges,
    isSaving,
    lastSaved,
  } = useStore();

  const [activeTab, setActiveTab] = useState<SettingsTabId>('general');
  const [localSettings, setLocalSettings] = useState(settings);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const handleSettingChange = (key: string, value: unknown) => {
    setLocalSettings(prev => {
      const keys = key.split('.');
      const newSettings = { ...prev };
      let current: Record<string, unknown> = newSettings;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...(current[keys[i]] as Record<string, unknown> || {}) };
        current = current[keys[i]] as Record<string, unknown>;
      }
      current[keys[keys.length - 1]] = value;
      return newSettings;
    });
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    await updateSettings(localSettings);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleReset = () => {
    setLocalSettings(settings);
  };

  const hasTabChanges = useMemo(() => {
    return JSON.stringify(localSettings) !== JSON.stringify(settings);
  }, [localSettings, settings]);

  const renderGeneralTab = () => (
    <>
      <SettingItem
        key="language"
        type="select"
        label={t('general.language')}
        description={t('general.languageDesc')}
        value={localSettings.general?.language || 'ar'}
        onChange={v => handleSettingChange('general.language', v)}
        options={[
          { value: 'ar', label: 'العربية' },
          { value: 'en', label: 'English' },
        ]}
      />
      <SettingItem
        key="autoSave"
        type="switch"
        label={t('general.autoSave')}
        description={t('general.autoSaveDesc')}
        checked={localSettings.general?.autoSave ?? true}
        onChange={v => handleSettingChange('general.autoSave', v)}
      />
      <SettingItem
        key="confirmDelete"
        type="switch"
        label={t('general.confirmDelete')}
        description={t('general.confirmDeleteDesc')}
        checked={localSettings.general?.confirmDelete ?? true}
        onChange={v => handleSettingChange('general.confirmDelete', v)}
      />
      <SettingItem
        key="telemetry"
        type="switch"
        label={t('general.telemetry')}
        description={t('general.telemetryDesc')}
        checked={localSettings.general?.telemetry ?? false}
        onChange={v => handleSettingChange('general.telemetry', v)}
      />
    </>
  );

  const renderEditorTab = () => (
    <>
      <SettingItem
        key="fontSize"
        type="number"
        label={t('editor.fontSize')}
        description={t('editor.fontSizeDesc')}
        value={localSettings.editor?.fontSize || 14}
        onChange={v => handleSettingChange('editor.fontSize', Number(v))}
        min={10}
        max={24}
      />
      <SettingItem
        key="tabSize"
        type="number"
        label={t('editor.tabSize')}
        description={t('editor.tabSizeDesc')}
        value={localSettings.editor?.tabSize || 2}
        onChange={v => handleSettingChange('editor.tabSize', Number(v))}
        min={2}
        max={8}
      />
      <SettingItem
        key="wordWrap"
        type="select"
        label={t('editor.wordWrap')}
        description={t('editor.wordWrapDesc')}
        value={localSettings.editor?.wordWrap || 'on'}
        onChange={v => handleSettingChange('editor.wordWrap', v)}
        options={[
          { value: 'off', label: t('editor.wordWrapOff') },
          { value: 'on', label: t('editor.wordWrapOn') },
          { value: 'wordWrapColumn', label: t('editor.wordWrapColumn') },
          { value: 'bounded', label: t('editor.wordWrapBounded') },
        ]}
      />
      <SettingItem
        key="minimap"
        type="switch"
        label={t('editor.minimap')}
        description={t('editor.minimapDesc')}
        checked={localSettings.editor?.minimap ?? true}
        onChange={v => handleSettingChange('editor.minimap', v)}
      />
      <SettingItem
        key="lineNumbers"
        type="select"
        label={t('editor.lineNumbers')}
        description={t('editor.lineNumbersDesc')}
        value={localSettings.editor?.lineNumbers || 'on'}
        onChange={v => handleSettingChange('editor.lineNumbers', v)}
        options={[
          { value: 'on', label: t('editor.lineNumbersOn') },
          { value: 'off', label: t('editor.lineNumbersOff') },
          { value: 'relative', label: t('editor.lineNumbersRelative') },
        ]}
      />
      <SettingItem
        key="formatOnSave"
        type="switch"
        label={t('editor.formatOnSave')}
        description={t('editor.formatOnSaveDesc')}
        checked={localSettings.editor?.formatOnSave ?? false}
        onChange={v => handleSettingChange('editor.formatOnSave', v)}
      />
      <SettingItem
        key="bracketPairColorization"
        type="switch"
        label={t('editor.bracketPairColorization')}
        description={t('editor.bracketPairColorizationDesc')}
        checked={localSettings.editor?.bracketPairColorization ?? true}
        onChange={v => handleSettingChange('editor.bracketPairColorization', v)}
      />
    </>
  );

  const renderAITab = () => (
    <>
      <SettingItem
        key="aiProvider"
        type="select"
        label={t('ai.provider')}
        description={t('ai.providerDesc')}
        value={localSettings.ai?.provider || 'openai'}
        onChange={v => handleSettingChange('ai.provider', v)}
        options={[
          { value: 'openai', label: 'OpenAI' },
          { value: 'anthropic', label: 'Anthropic' },
          { value: 'local', label: t('ai.local') },
        ]}
      />
      <SettingItem
        key="aiModel"
        type="text"
        label={t('ai.model')}
        description={t('ai.modelDesc')}
        value={localSettings.ai?.model || 'gpt-4'}
        onChange={v => handleSettingChange('ai.model', v)}
        placeholder="gpt-4"
      />
      <SettingItem
        key="aiApiKey"
        type="password"
        label={t('ai.apiKey')}
        description={t('ai.apiKeyDesc')}
        value={localSettings.ai?.apiKey || ''}
        onChange={v => handleSettingChange('ai.apiKey', v)}
        placeholder={t('ai.apiKeyPlaceholder')}
      />
      <SettingItem
        key="aiTemperature"
        type="slider"
        label={t('ai.temperature')}
        description={t('ai.temperatureDesc')}
        value={localSettings.ai?.temperature ?? 0.7}
        onChange={v => handleSettingChange('ai.temperature', Number(v))}
        min={0}
        max={2}
        step={0.1}
      />
      <SettingItem
        key="aiMaxTokens"
        type="number"
        label={t('ai.maxTokens')}
        description={t('ai.maxTokensDesc')}
        value={localSettings.ai?.maxTokens || 4096}
        onChange={v => handleSettingChange('ai.maxTokens', Number(v))}
        min={100}
        max={128000}
      />
      <SettingItem
        key="aiSystemPrompt"
        type="textarea"
        label={t('ai.systemPrompt')}
        description={t('ai.systemPromptDesc')}
        value={localSettings.ai?.systemPrompt || ''}
        onChange={v => handleSettingChange('ai.systemPrompt', v)}
        placeholder={t('ai.systemPromptPlaceholder')}
      />
    </>
  );

  const renderAppearanceTab = () => (
    <>
      <SettingItem
        key="theme"
        type="select"
        label={t('appearance.theme')}
        description={t('appearance.themeDesc')}
        value={localSettings.appearance?.theme || 'system'}
        onChange={v => handleSettingChange('appearance.theme', v)}
        options={[
          { value: 'light', label: t('appearance.light') },
          { value: 'dark', label: t('appearance.dark') },
          { value: 'system', label: t('appearance.system') },
        ]}
      />
      <SettingItem
        key="accentColor"
        type="color"
        label={t('appearance.accentColor')}
        description={t('appearance.accentColorDesc')}
        value={localSettings.appearance?.accentColor || '#3b82f6'}
        onChange={v => handleSettingChange('appearance.accentColor', v)}
      />
      <SettingItem
        key="density"
        type="select"
        label={t('appearance.density')}
        description={t('appearance.densityDesc')}
        value={localSettings.appearance?.density || 'comfortable'}
        onChange={v => handleSettingChange('appearance.density', v)}
        options={[
          { value: 'compact', label: t('appearance.compact') },
          { value: 'comfortable', label: t('appearance.comfortable') },
          { value: 'spacious', label: t('appearance.spacious') },
        ]}
      />
      <SettingItem
        key="animations"
        type="switch"
        label={t('appearance.animations')}
        description={t('appearance.animationsDesc')}
        checked={localSettings.appearance?.animations ?? true}
        onChange={v => handleSettingChange('appearance.animations', v)}
      />
    </>
  );

  const renderAdvancedTab = () => (
    <>
      <SettingItem
        key="debugMode"
        type="switch"
        label={t('advanced.debugMode')}
        description={t('advanced.debugModeDesc')}
        checked={localSettings.advanced?.debugMode ?? false}
        onChange={v => handleSettingChange('advanced.debugMode', v)}
      />
      <SettingItem
        key="logLevel"
        type="select"
        label={t('advanced.logLevel')}
        description={t('advanced.logLevelDesc')}
        value={localSettings.advanced?.logLevel || 'info'}
        onChange={v => handleSettingChange('advanced.logLevel', v)}
        options={[
          { value: 'debug', label: 'Debug' },
          { value: 'info', label: 'Info' },
          { value: 'warn', label: 'Warn' },
          { value: 'error', label: 'Error' },
        ]}
      />
      <SettingItem
        key="maxLogFiles"
        type="number"
        label={t('advanced.maxLogFiles')}
        description={t('advanced.maxLogFilesDesc')}
        value={localSettings.advanced?.maxLogFiles || 10}
        onChange={v => handleSettingChange('advanced.maxLogFiles', Number(v))}
        min={1}
        max={100}
      />
    </>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return renderGeneralTab();
      case 'editor':
        return renderEditorTab();
      case 'ai':
        return renderAITab();
      case 'appearance':
        return renderAppearanceTab();
      case 'advanced':
        return renderAdvancedTab();
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('settings.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('settings.description')}</p>
        </div>
        <div className="flex items-center gap-2">
          {lastSaved && (
            <span className="text-xs text-muted-foreground">
              آخر حفظ: {new Date(lastSaved).toLocaleTimeString('ar-SA')}
            </span>
          )}
        </div>
      </div>

      <SettingsTabs activeTab={activeTab} onChange={setActiveTab} />

      <div 
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        className="space-y-4"
      >
        {activeTab === 'general' && (
          <SettingsSection
            title={t('settings.tabs.general')}
            description={t('general.description')}
            isSaving={isSaving || saveStatus === 'saving'}
            hasChanges={hasTabChanges}
            onSave={handleSave}
            onReset={handleReset}
          >
            {renderGeneralTab()}
          </SettingsSection>
        )}
        {activeTab === 'editor' && (
          <SettingsSection
            title={t('settings.tabs.editor')}
            description={t('editor.description')}
            isSaving={isSaving || saveStatus === 'saving'}
            hasChanges={hasTabChanges}
            onSave={handleSave}
            onReset={handleReset}
          >
            {renderEditorTab()}
          </SettingsSection>
        )}
        {activeTab === 'ai' && (
          <SettingsSection
            title={t('settings.tabs.ai')}
            description={t('ai.description')}
            isSaving={isSaving || saveStatus === 'saving'}
            hasChanges={hasTabChanges}
            onSave={handleSave}
            onReset={handleReset}
          >
            {renderAITab()}
          </SettingsSection>
        )}
        {activeTab === 'appearance' && (
          <SettingsSection
            title={t('settings.tabs.appearance')}
            description={t('appearance.description')}
            isSaving={isSaving || saveStatus === 'saving'}
            hasChanges={hasTabChanges}
            onSave={handleSave}
            onReset={handleReset}
          >
            {renderAppearanceTab()}
          </SettingsSection>
        )}
        {activeTab === 'advanced' && (
          <SettingsSection
            title={t('settings.tabs.advanced')}
            description={t('advanced.description')}
            isSaving={isSaving || saveStatus === 'saving'}
            hasChanges={hasTabChanges}
            onSave={handleSave}
            onReset={handleReset}
          >
            {renderAdvancedTab()}
          </SettingsSection>
        )}
      </div>
    </div>
  );
};