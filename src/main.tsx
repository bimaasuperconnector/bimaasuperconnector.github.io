import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import './styles/index.css';
import { initPwaInstallCapture } from './lib/pwa';

// Must run before anything else: the browser's install prompt fires once, early.
initPwaInstallCapture();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Precaches only the built static app shell (see vite.config.ts) — never
// intercepts Firestore/Auth network calls, so no private data is cached.
registerSW({ immediate: true });
