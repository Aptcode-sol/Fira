import './sentry.js'; // ponytail: must be first import for early error capture
import '@fontsource-variable/inter'; // ponytail: self-hosted Inter via Vite build (replaces Google Fonts CDN)
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
