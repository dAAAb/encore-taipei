import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import './submit.css'
import { initAnalytics } from '@/lib/analytics'
import { SubmitApp } from './SubmitApp'

initAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SubmitApp />
  </StrictMode>,
)
