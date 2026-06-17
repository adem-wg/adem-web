import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';
import { installBufferPolyfill } from './polyfills';

installBufferPolyfill();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
