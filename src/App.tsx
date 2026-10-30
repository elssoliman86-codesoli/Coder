import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from '@app/store';
import { get, set } from 'idb-keyval';
import { Layout } from '@app/layout';
import { LoadingScreen } from '@components/ui/loading-screen';
import { restoreProviderSecrets } from '@lib/ai/secrets';

const Home = lazy(() => import('@features/home/Home').then(module => ({ default: module.Home })));
const Workspace = lazy(() => import('@features/workspace/Workspace').then(module => ({ default: module.Workspace })));
const Settings = lazy(() => import('@features/settings/Settings').then(module => ({ default: module.Settings })));
const NewProject = lazy(() => import('@features/home/NewProjectDialog').then(module => ({ default: module.NewProjectDialog })));

let appPreparation: Promise<void> | null = null;

function prepareAppData(): Promise<void> {
  if (!appPreparation) {
    appPreparation = (async () => {
      const stored = await get<string>('2onebyte-coder-storage');
      if (!stored) {
        const legacy = localStorage.getItem('2onebyte-coder-storage');
        if (legacy) await set('2onebyte-coder-storage', legacy);
      }
      await useStore.persist.rehydrate();
      await restoreProviderSecrets();
    })().catch(error => {
      appPreparation = null;
      throw error;
    });
  }
  return appPreparation;
}

function App() {
  const initialize = useStore(state => state.initialize);
  const initialized = useStore(state => state.initialized);

  useEffect(() => {
    let active = true;
    void prepareAppData()
      .catch(error => {
        console.error('Application data preparation failed', error);
      })
      .finally(() => {
        if (active) void initialize();
      });
    return () => { active = false; };
  }, [initialize]);

  if (!initialized) return <LoadingScreen />;

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="workspace/:projectId" element={<Workspace />} />
          <Route path="settings" element={<Settings />} />
          <Route path="new-project" element={<NewProject />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
