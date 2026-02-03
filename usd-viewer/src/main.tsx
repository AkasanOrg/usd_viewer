import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WorkspaceProvider } from './stores/workspaceStore'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WorkspaceProvider>
      <App />
    </WorkspaceProvider>
  </StrictMode>,
)
