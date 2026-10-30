import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useStore } from '@app/store';
import { Layout } from '@app/layout';
import { LoadingScreen } from '@components/ui/loading-screen';

// Lazy load heavy routes
const Home = lazy(() => import('@features/home/Home').then(m => ({ default: m.Home })));
const Workspace = lazy(() => import('@features/workspace/Workspace').then(m => ({ default: m.Workspace })));
const Settings = lazy(() => import('@features/settings/Settings').then(m => ({ default: m.Settings })));
const NewProject = lazy(() => import('@features/home/NewProjectDialog').then(m => ({ default: m.NewProjectDialog })));

function App() {
  const initialize = useStore(state => state.initialize);

  useEffect(() => {
    let active = true;
    void (async () => {
      // Hydrate the local IndexedDB before initializing skills or rendering persisted workspace state.
      await useStore.persist.rehydrate();
      if (active) await initialize();
    })();
    return () => { active = false; };
  }, [initialize]);

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