import React, { useEffect, useState } from 'react'
import { useJobStore } from '../store/useJobStore'
import { useLibraryStore } from '../store/useLibraryStore'
import { useModuleStore } from '../store/useModuleStore'
import { useAppStore } from '../store/useAppStore'
import { ModuleRail } from '../components/modules/ModuleRail'
import { ModuleSettingsPanel } from '../components/modules/ModuleSettingsPanel'
import { ModuleGrid } from '../components/modules/ModuleGrid'
import { LibraryBrowser } from '../components/library/LibraryBrowser'
import type { ModuleType } from '../../shared/types'
import {
  ArrowLeft,
  FolderOpen,
  Settings,
  X
} from 'lucide-react'

export function JobPage() {
  const { currentJob, selectedAssetIds, resetJobContext, loadAssetsForJob } = useJobStore()
  const { loadJobStats, jobStats } = useLibraryStore()
  const { 
    activeModule, 
    setActiveModule, 
    loadInjectorsForModule, 
    loadGuardrailsForModule,
    setIsGenerating
  } = useModuleStore()
  const { setView, addToast, openSettingsModal } = useAppStore()
  
  const [showLibrary, setShowLibrary] = useState(false)

  useEffect(() => {
    if (currentJob) {
      loadJobStats(currentJob.id)
      loadAssetsForJob(currentJob.id)
    }
  }, [currentJob?.id])

  // Load injectors/guardrails when module changes
  useEffect(() => {
    if (activeModule) {
      Promise.all([
        loadInjectorsForModule(activeModule),
        loadGuardrailsForModule(activeModule)
      ])
    }
  }, [activeModule])

  const handleBack = () => {
    resetJobContext()
    setView('home')
  }

  const handleSelectModule = (module: ModuleType | null) => {
    setActiveModule(module)
    if (module) {
      setShowLibrary(false)
    }
  }

  const handleOpenLibrary = () => {
    setShowLibrary(true)
    setActiveModule(null)
  }

  const handleApplyToSelected = async () => {
    if (!currentJob || !activeModule || selectedAssetIds.size === 0) {
      addToast('Select images first', 'error')
      return
    }

    setIsGenerating(true)
    try {
      // Batch execute for all selected assets
      const assetIds = Array.from(selectedAssetIds)
      
      await window.api.invoke(`module:${activeModule}:batchGenerate`, {
        jobId: currentJob.id,
        assetIds,
        // Module-specific settings are read from the store by the backend
      })

      addToast(`Started ${activeModule} generation for ${assetIds.length} images`, 'success')
    } catch (error) {
      console.error('Batch generation failed:', error)
      addToast('Failed to start generation', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  if (!currentJob) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-slate-400">
          <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No job selected</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Job Header */}
      <header className="flex-shrink-0 h-14 border-b border-slate-700 flex items-center px-4 gap-4 bg-slate-800/50">
        <button
          onClick={handleBack}
          className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
        
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-white truncate">{currentJob.name}</h1>
          {currentJob.metadata.address && (
            <p className="text-xs text-slate-400 truncate">{currentJob.metadata.address}</p>
          )}
        </div>

        {jobStats && (
          <div className="flex items-center gap-4 text-sm">
            <div className="text-slate-400">
              <span className="text-white font-medium">{jobStats.totalAssets}</span> assets
            </div>
            <div className="text-slate-400">
              <span className="text-emerald-400 font-medium">{jobStats.approvedCount}</span> approved
            </div>
            <div className="text-slate-400">
              <span className="text-amber-400 font-medium">{jobStats.finalCount}</span> finals
            </div>
          </div>
        )}

        <button 
          onClick={openSettingsModal}
          className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
        >
          <Settings className="w-5 h-5 text-slate-400" />
        </button>
      </header>

      {/* Main Content - Module Rail + Settings Panel + Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Module Rail (64px) */}
        <ModuleRail
          activeModule={activeModule}
          onSelectModule={handleSelectModule}
          onOpenLibrary={handleOpenLibrary}
          onOpenSettings={openSettingsModal}
        />

        {/* Module Settings Panel (280px, shown when module active) */}
        {activeModule && (
          <ModuleSettingsPanel
            activeModule={activeModule}
            selectedCount={selectedAssetIds.size}
            onClose={() => setActiveModule(null)}
            onApply={handleApplyToSelected}
          />
        )}

        {/* Library Panel (shown when Library is open) */}
        {showLibrary && !activeModule && (
          <aside className="w-80 border-r border-slate-700 flex flex-col bg-slate-800/30">
            <div className="flex items-center justify-between p-3 border-b border-slate-700">
              <h3 className="text-sm font-medium text-white">Library</h3>
              <button
                onClick={() => setShowLibrary(false)}
                className="p-1 hover:bg-slate-700 rounded transition-colors"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <LibraryBrowser />
            </div>
          </aside>
        )}

        {/* Main Grid Workspace */}
        <main className="flex-1 overflow-hidden">
          <ModuleGrid activeModule={activeModule} />
        </main>
      </div>
    </div>
  )
}
