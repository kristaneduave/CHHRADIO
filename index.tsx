
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AppErrorBoundary from './components/AppErrorBoundary';
import { registerRadcoreServiceWorker } from './services/pwaService';
import { installSafeConsoleLogging } from './utils/safeLogger';

installSafeConsoleLogging();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);

if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    void registerRadcoreServiceWorker();
  }, { once: true });
}
