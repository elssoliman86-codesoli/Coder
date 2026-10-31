import { useEffect, useState } from 'react';
import { useLoaded, useApp } from './storage/store';
import { useT } from './i18n';
import { Drawer, Icon, Toaster } from './components/ui';
import { Home } from './features/home/Home';
import { Workspace } from './features/workspace/Workspace';
import { Settings } from './features/settings/Settings';

export function App() {
  const t = useT();
  const loaded = useLoaded();
  const lang = useApp((s) => s.settings.language);
  const [route, setRoute] = useState<string | null>(null); // project id or null = home
  const [menu, setMenu] = useState(false);
  const [settings, setSettings] = useState(false);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  if (!loaded) return <div className="boot" role="status">…</div>;

  return (
    <div className="app">
      <header className="topbar">
        <button className="icon-btn" aria-label={t('menu')} onClick={() => setMenu(true)} data-testid="hamburger"><Icon name="menu" /></button>
        <button className="brand" onClick={() => setRoute(null)}>{t('appName')}</button>
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
