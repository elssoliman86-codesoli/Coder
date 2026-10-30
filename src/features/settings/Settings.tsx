import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@app/store/settingsStore';
import { SettingsSection } from '@components/settings/SettingsSection';
import { SettingItem } from '@components/settings/SettingItem';
import { SettingsTabs } from '@components/settings/SettingsTabs';

const SETTINGS_TABS = [
  { id: 'general', label: 'settings.tabs.general', icon: 'settings' },
  { id: 'editor', label: 'settings.tabs.editor', icon: 'edit' },
  { id: 'ai', label: 'settings.tabs.ai', icon: 'cpu' },
  { id: 'appearance', label: 'settings.tabs.appearance', icon: 'palette' },
  { id: 'advanced', label: 'settings.tabs.advanced', icon: 'cog' },
] as const;

type SettingsTabId = typeof SETTINGS_TABS[number]['id'];

export const Settings = () => {
  const { t } = useTranslation('settings');
  const {
    settings,
    updateSetting,
    resetSection,
    saveSection,
    hasUnsavedChanges,
    isSaving,
    lastSaved,
  } = useSettingsStore();

  const [activeTab, setActiveTab] = useState<SettingsTabId>('general');
  const [localSettings, setLocalSettings] = useState(settings);

  const handleSettingChange = (key: string, value: unknown) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    await saveSection(activeTab, localSettings);
  };

  const handleReset = () => {
    resetSection(activeTab);
    setLocalSettings(settings);
  };

  const renderGeneralTab = () => (
    <>
      <SettingItem
        key="language"
        type="select"
        label={t('general.language')}
        description={t('general.languageDesc')}
        value={localSettings.general?.language || 'en'}
        onChange={v => handleSettingChange('general.language', v)}
        options={[
          { value: 'en', label: 'English' },
          { value: 'ar', label: 'العربية' },
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
        rows={4}
      />
      <SettingItem
        key="aiEnableTools"
        type="switch"
        label={t('ai.enableTools')}
        description={t('ai.enableToolsDesc')}
        checked={localSettings.ai?.enableTools ?? true}
        onChange={v => handleSettingChange('ai.enableTools', v)}
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
      <SettingItem
        key="fontFamily"
        type="select"
        label={t('appearance.fontFamily')}
        description={t('appearance.fontFamilyDesc')}
        value={localSettings.appearance?.fontFamily || 'system'}
        onChange={v => handleSettingChange('appearance.fontFamily', v)}
        options={[
          { value: 'system', label: t('appearance.systemFont') },
          { value: 'monospace', label: 'Monospace' },
          { value: 'inter', label: 'Inter' },
          { value: 'jetbrains', label: 'JetBrains Mono' },
          { value: 'fira', label: 'Fira Code' },
        ]}
      />
    </>
  );

  const renderAdvancedTab = () => (
    <>
      <SettingItem
        key="experimentalFeatures"
        type="switch"
        label={t('advanced.experimentalFeatures')}
        description={t('advanced.experimentalFeaturesDesc')}
        checked={localSettings.advanced?.experimentalFeatures ?? false}
        onChange={v => handleSettingChange('advanced.experimentalFeatures', v)}
      />
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
        key="cacheSize"
        type="number"
        label={t('advanced.cacheSize')}
        description={t('advanced.cacheSizeDesc')}
        value={localSettings.advanced?.cacheSize || 500}
        onChange={v => handleSettingChange('advanced.cacheSize', Number(v))}
        min={50}
        max={5000}
      />
      <div className="pt-4 border-t border-border">
        <button
          type="button"
          className="text-sm text-destructive hover:underline"
          onClick={() => {
            if (confirm(t('advanced.clearCacheConfirm'))) {
              // Clear cache action
            }
          }}
        >
          {t('advanced.clearCache')}
        </button>
      </div>
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
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <div className="flex items-center gap-3">
          {hasUnsavedChanges && (
            <span className="text-sm text-yellow-500 flex items-center gap-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
              </span>
              {t('unsavedChanges')}
            </span>
          )}
          {lastSaved && (
            <span className="text-xs text-muted-foreground">
              {t('lastSaved', { time: new Date(lastSaved).toLocaleTimeString() })}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <SettingsTabs
          tabs={SETTINGS_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <div className="mt-6 max-w-3xl">
          <SettingsSection
            title={t(`tabs.${activeTab}`)}
            description={t(`tabs.${activeTab}Desc`)}
            isSaving={isSaving}
            hasChanges={hasUnsavedChanges}
            onSave={handleSave}
            onReset={handleReset}
          >
            {renderTabContent()}
          </SettingsSection>
        </div>
      </div>
    </div>
  );
};