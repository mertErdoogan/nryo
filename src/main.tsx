import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/rubik/wght.css';
import './styles/tokens.css';
import './styles/base.css';
import { App } from './app/App';
import { registerServiceWorker } from './platform/pwa';

const container = document.getElementById('root');
if (!container) throw new Error('Root element missing');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

sessionStorage.removeItem('nryo:chunk-reload');
registerServiceWorker();
