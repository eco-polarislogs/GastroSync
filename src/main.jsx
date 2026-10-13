import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { THEME } from './theme/tokens'
import './styles/index.css'

// Katmanlı Mimari: THEME token'larını doğrudan CSS Root değişkenlerine enjekte et
if (typeof document !== 'undefined') {
  const root = document.documentElement;
  root.style.setProperty('--color-primary', THEME.colors.primary);
  root.style.setProperty('--color-primary-dark', THEME.colors.primaryHover);
  root.style.setProperty('--color-accent', THEME.colors.accent);
  root.style.setProperty('--color-danger', THEME.colors.danger);
  root.style.setProperty('--color-bg', THEME.colors.background);
  root.style.setProperty('--color-surface', THEME.colors.surface);
  root.style.setProperty('--color-border', THEME.colors.border);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster 
        position="top-right" 
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#f8fafc',
            border: '1px solid #334155',
            borderRadius: '10px',
            fontSize: '14px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)'
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#f8fafc'
            }
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#f8fafc'
            }
          }
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
)

