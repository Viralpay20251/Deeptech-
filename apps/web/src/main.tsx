import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

// Bootstrap operator token for API requests
const originalFetch = window.fetch;
window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();
  if (url.includes('/api/v1') && !url.includes('/api/v1/auth/')) {
    const token = localStorage.getItem('growth_os_token');
    if (token) {
      const headers = new Headers(init.headers || (input instanceof Request ? input.headers : {}));
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      init = { ...init, headers };
    }
  }
  return originalFetch(input, init);
};

// Auto-bootstrap operator session on startup
fetch('/api/v1/auth/session')
  .then((res) => (res.ok ? res.json() : null))
  .then((json) => {
    if (json?.data?.token) {
      localStorage.setItem('growth_os_token', json.data.token);
      if (json.data.user) {
        localStorage.setItem('growth_os_user', JSON.stringify(json.data.user));
      }
    }
  })
  .catch(() => {});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary fallbackTitle="Autonomous Growth OS Application Error">
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
