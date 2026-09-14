import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/theme.css';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
