import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadState, startPersisting } from './storage/store';
import './styles.css';


void loadState().then(startPersisting);
createRoot(document.getElementById('root')!).render(<App />);

if ('serviceWorker' in navigator && location.protocol.startsWith('http') && location.hostname !== 'localhost') {
  navigator.serviceWorker.register('./sw.js').catch(() => undefined);
}
