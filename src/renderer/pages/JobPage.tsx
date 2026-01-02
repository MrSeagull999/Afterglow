import React, { useEffect, useState } from 'react'
import { useJobStore } from '../store/useJobStore'
import { useLibraryStore } from '../store/useLibraryStore'
import { useModuleStore } from '../store/useModuleStore'
import { useAppStore } from '../store/useAppStore'
import { ScenePanel } from '../components/job/ScenePanel'
import { AssetWorkspace } from '../components/job/AssetWorkspace'
import { ModuleSidebar } from '../components/modules/ModuleSidebar'
import { LibraryBrowser } from '../components/library/LibraryBrowser'
import {
  ArrowLeft,
  FolderOpen,
  Layers,
  Grid3X3,
  Sparkles,
  ChevronRight,
  Plus,
  Settings
} from 'lucide-react'

type SidebarTab = 'scenes' | 'library' | 'modules'

export function JobPage() {
  const { currentJob, scenes, loadScenesForJob, currentScene, resetJobContext } = useJobStore()
  const { loadJobStats, jobStats } = useLibraryStore()
  const { setView, addToast } = useAppStore()
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('scenes')

  useEffect(() => {
    if (currentJob) {
      loadScenesForJob(currentJob.id)
      loadJobStats(currentJob.id)
    }
  }, [currentJob?.id])

  const handleBack = () => {
    resetJobContext()
    setView('home')
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

        <button className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
          <Settings className="w-5 h-5 text-slate-400" />
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Tabs */}
        <aside className="w-80 border-r border-slate-700 flex flex-col bg-slate-800/30">
          {/* Tab Buttons */}
          <div className="flex border-b border-slate-700">
            <TabButton
              active={sidebarTab === 'scenes'}
              onClick={() => setSidebarTab('scenes')}
              icon={<Layers className="w-4 h-4" />}
              label="Scenes"
            />
            <TabButton
              active={sidebarTab === 'library'}
              onClick={() => setSidebarTab('library')}
              icon={<Grid3X3 className="w-4 h-4" />}
              label="Library"
            />
            <TabButton
              active={sidebarTab === 'modules'}
              onClick={() => setSidebarTab('modules')}
              icon={<Sparkles className="w-4 h-4" />}
              label="Modules"
            />
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {sidebarTab === 'scenes' && <ScenePanel />}
            {sidebarTab === 'library' && <LibraryBrowser />}
            {sidebarTab === 'modules' && <ModuleSidebar />}
          </div>
        </aside>

        {/* Main Workspace */}
        <main className="flex-1 overflow-hidden">
          <AssetWorkspace />
        </main>
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium transition-colors ${
        active
          ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-800/50'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}
