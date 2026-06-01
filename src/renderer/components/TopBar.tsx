import React from 'react'
import { useAppStore } from '../store/useAppStore'
import { useJobStore } from '../store/useJobStore'
import { Settings, Briefcase } from 'lucide-react'

export function TopBar() {
  const { 
    view, 
    currentRun, 
    setView, 
    openSettingsModal,
    isProcessing,
    processingStage
  } = useAppStore()
  const { currentJob } = useJobStore()

  return (
    <header className="h-12 bg-slate-800 border-b border-slate-700 flex items-center px-4 drag-region">
      <div className="flex items-center gap-3 no-drag">
        <h1 className="text-xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
          AfterGlow
        </h1>
        {currentRun && view === 'run' && (
          <>
            <span className="text-slate-500">/</span>
            <span className="text-slate-300 text-sm">{currentRun.listingName}</span>
          </>
        )}
        {currentJob && view === 'job' && (
          <>
            <span className="text-slate-500">/</span>
            <span className="text-slate-300 text-sm">{currentJob.name}</span>
          </>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 ml-8 no-drag">
        <button
          onClick={() => setView('jobs')}
          className={`px-3 py-1.5 text-sm rounded transition-colors ${
            view === 'jobs' || view === 'job'
              ? 'bg-slate-700 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
          }`}
        >
          <Briefcase className="w-4 h-4 inline mr-1.5" />
          Studio
        </button>
      </div>

      <div className="flex-1 flex justify-center no-drag">
        {isProcessing && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span>{processingStage}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 no-drag">
        {view === 'run' && (
          <button
            onClick={() => setView('home')}
            className="px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
          >
            ← Back
          </button>
        )}
        <button
          onClick={openSettingsModal}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}
