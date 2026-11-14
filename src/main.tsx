import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LightboxProvider } from './ui/Lightbox'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LightboxProvider>
      <App />
    </LightboxProvider>
  </StrictMode>,
)
