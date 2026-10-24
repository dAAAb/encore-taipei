import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import './tv.css'
import { startTvAnalytics } from './analytics'
import { DUO_MODE } from './duo/mode'
import { TvApp } from './TvApp'

const DuoRemoteApp = lazy(() => import('./duo/DuoRemoteApp'))

startTvAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {DUO_MODE === 'remote' ? (
      <Suspense fallback={<div className="duo-pad h-full w-full" />}>
        <DuoRemoteApp />
      </Suspense>
    ) : (
      <TvApp />
    )}
  </StrictMode>,
)
