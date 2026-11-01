import { useEffect, useState } from 'react';
import { useLoaded, useApp, setState } from './storage/store';
import { useT } from './i18n';
import { applyTheme, Drawer, Icon, Toaster } from './components/ui';
import { Home } from './features/home/Home';
import { Workspace } from './features/workspace/Workspace';
import { Settings } from './features/settings/Settings';

export function App() {
  const t = useT();
  const loaded = useLoaded();
  const lang = useApp((s) => s.settings.language);
  const theme = useApp((s) => s.settings.theme);
  const [route, setRoute] = useState<string | null>(null); // project id or null = home
  const [menu, setMenu] = useState(false);
  const [settings, setSettings] = useState(false);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const h = () => applyTheme('system');
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [theme]);

  const isDark = theme === 'dark' || (theme === 'system' && !window.matchMedia?.('(prefers-color-scheme: light)').matches);
  const toggleTheme = () => setState((s) => { s.settings = { ...s.settings, theme: isDark ? 'light' : 'dark' }; });

  if (!loaded) return <div className="boot" role="status">…</div>;

  return (
    <div className="app">
      <header className="topbar">
        <button className="icon-btn" aria-label={t('menu')} onClick={() => setMenu(true)} data-testid="hamburger"><Icon name="menu" /></button>
        <button className="brand" onClick={() => setRoute(null)}>{t('appName')}</button>
        <span className="spacer" />
        <button className="icon-btn" aria-label={isDark ? 'الوضع الفاتح' : 'الوضع الداكن'} title={isDark ? 'الوضع الفاتح' : 'الوضع الداكن'} onClick={toggleTheme} data-testid="theme-toggle"><Icon name={isDark ? 'sun' : 'moon'} /></button>
      </header>
      <div className="content">
        {route ? <Workspace id={route} onBack={() => setRoute(null)} onOpenSettings={() => setSettings(true)} /> : <div className="container"><Home onOpen={setRoute} /></div>}
      </div>
      {menu && (
        <Drawer side="right" label={t('menu')} onClose={() => setMenu(false)}>
          <div className="drawer-head"><strong>{t('appName')}</strong><button className="icon-btn" aria-label={t('close')} onClick={() => setMenu(false)}><Icon name="close" /></button></div>
          <button className="drawer-item" onClick={() => { setMenu(false); setRoute(null); }}><Icon name="folder" /> {t('projects')}</button>
          <button className="drawer-item" onClick={() => { setMenu(false); setSettings(true); }} data-testid="open-settings"><Icon name="settings" /> {t('settings')}</button>
        </Drawer>
      )}
      {settings && <Settings onClose={() => setSettings(false)} />}
      <Toaster />
    </div>
  );
}
