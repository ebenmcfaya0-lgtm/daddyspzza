import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error handler to prevent blank screens
window.onerror = (message, source, lineno, colno, error) => {
  console.error('Global error caught:', { message, source, lineno, colno, error });
  const root = document.getElementById('root');
  if (root && root.innerHTML === '') {
    root.innerHTML = `
      <div style="padding: 20px; font-family: sans-serif; text-align: center; background: #fff1f2; color: #991b1b; min-h-screen flex items-center justify-center">
        <div style="max-width: 400px; margin: 100px auto; background: white; padding: 32px; border-radius: 24px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1)">
          <h1 style="margin-top: 0; font-size: 24px;">Application Error</h1>
          <p style="font-size: 14px; color: #666;">The application failed to start. This is usually caused by a configuration error or a missing environment variable.</p>
          <pre style="text-align: left; background: #f8fafc; padding: 12px; border-radius: 8px; font-size: 10px; overflow: auto; max-height: 150px;">${message}</pre>
          <button onclick="window.location.reload()" style="background: #000; color: #fff; border: none; padding: 12px 24px; border-radius: 12px; font-weight: bold; cursor: pointer; margin-top: 16px;">Reload App</button>
        </div>
      </div>
    `;
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
