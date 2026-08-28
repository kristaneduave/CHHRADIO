
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerRadcoreServiceWorker } from './services/pwaService';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    void registerRadcoreServiceWorker();
  }, { once: true });
}
