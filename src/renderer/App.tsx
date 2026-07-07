import React, { useEffect, useState } from 'react'
import { useAppStore } from './store/useAppStore'
import { useModuleStore } from './store/useModuleStore'
import { TopBar } from './components/TopBar'
import { Home } from './pages/Home'
import { RunDetail } from './pages/RunDetail'
import { JobsHome } from './pages/JobsHome'
import { JobPage } from './pages/JobPage'
import { FlipCompareModal } from './components/FlipCompareModal'
import { SettingsModal } from './components/SettingsModal'
import { ImportFilesModal } from './components/ImportFilesModal'
import { Toasts } from './components/Toasts'

export default function App() {
  const { view, setPresets, setSettings, setRuns, addToast } = useAppStore()
  const { loadConstants } = useModuleStore()
  const [incomingFiles, setIncomingFiles] = useState<string[]>([])

  // Files opened via Finder / Lightroom "Edit In" — drain main's pending
  // queue on mount, then again whenever main pings that more arrived.
  useEffect(() => {
    const pullPending = async () => {
      const files: string[] = await window.api.invoke('openFiles:getPending')
      if (files.length > 0) {
        setIncomingFiles((prev) => [...prev, ...files.filter((f) => !prev.includes(f))])
      }
    }
    pullPending()
    const off = window.api.on('openFiles:pending', pullPending)
    return off
  }, [])

  useEffect(() => {
    async function init() {
      try {
        const [presets, settings, runs] = await Promise.all([
          window.electronAPI.getPresets(),
          window.electronAPI.getSettings(),
          window.electronAPI.listRuns()
        ])
        setPresets(presets)
        setSettings(settings)
        setRuns(runs)
        
        // Load Phase 2 constants
        loadConstants()
      } catch (error) {
        console.error('Failed to initialize:', error)
        addToast('Failed to initialize application', 'error')
      }
    }
    init()
  }, [setPresets, setSettings, setRuns, addToast, loadConstants])

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-slate-100">
      <TopBar />
      <main className="flex-1 overflow-hidden">
        {view === 'home' && <Home />}
        {view === 'run' && <RunDetail />}
        {view === 'jobs' && <JobsHome />}
        {view === 'job' && <JobPage />}
      </main>
      <FlipCompareModal />
      <SettingsModal />
      {incomingFiles.length > 0 && (
        <ImportFilesModal filePaths={incomingFiles} onClose={() => setIncomingFiles([])} />
      )}
      <Toasts />
    </div>
  )
}
