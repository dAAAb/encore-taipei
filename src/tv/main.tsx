import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import './tv.css'
import { startTvAnalytics } from './analytics'
import { TvApp } from './TvApp'

startTvAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TvApp />
  </StrictMode>,
)
