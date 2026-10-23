import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import '../tv/tv.css'
import './tower.css'
import { TowerApp } from './TowerApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TowerApp />
  </StrictMode>,
)
