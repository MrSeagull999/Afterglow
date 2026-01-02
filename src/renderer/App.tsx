import React, { useEffect } from 'react'
import { useAppStore } from './store/useAppStore'
import { TopBar } from './components/TopBar'
import { Home } from './pages/Home'
import { RunDetail } from './pages/RunDetail'
import { FlipCompareModal } from './components/FlipCompareModal'
import { SettingsModal } from './components/SettingsModal'
import { Toasts } from './components/Toasts'

export default function App() {
  const { view, setPresets, setSettings, setRuns, addToast } = useAppStore()

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
      } catch (error) {
        console.error('Failed to initialize:', error)
        addToast('Failed to initialize application', 'error')
      }
    }
    init()
  }, [setPresets, setSettings, setRuns, addToast])

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-slate-100">
      <TopBar />
      <main className="flex-1 overflow-hidden">
        {view === 'home' && <Home />}
        {view === 'run' && <RunDetail />}
      </main>
      <FlipCompareModal />
      <SettingsModal />
      <Toasts />
    </div>
  )
}
