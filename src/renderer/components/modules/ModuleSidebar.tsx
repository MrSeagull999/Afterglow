import React, { useEffect } from 'react'
import { useModuleStore } from '../../store/useModuleStore'
import { useJobStore } from '../../store/useJobStore'
import type { ModuleType } from '../../../shared/types'
import { CleanSlatePanel } from './CleanSlatePanel'
import { StagingPanel } from './StagingPanel'
import { RenovatePanel } from './RenovatePanel'
import { TwilightPanel } from './TwilightPanel'
import { RelightPanel } from './RelightPanel'
import { ModuleInputPicker } from './ModuleInputPicker'
import {
  Sparkles,
  Eraser,
  Sofa,
  PaintBucket,
  Moon,
  Lightbulb,
  ChevronRight
} from 'lucide-react'

const MODULES: { id: ModuleType; label: string; icon: React.ReactNode; description: string }[] = [
  {
    id: 'twilight',
    label: 'Twilight',
    icon: <Moon className="w-5 h-5" />,
    description: 'Day to twilight conversion'
  },
  {
    id: 'relight',
    label: 'ReLight',
    icon: <Lightbulb className="w-5 h-5" />,
    description: 'Enhance lighting conditions'
  },
  {
    id: 'clean',
    label: 'Clean Slate',
    icon: <Eraser className="w-5 h-5" />,
    description: 'Remove furniture & clutter'
  },
  {
    id: 'stage',
    label: 'Staging',
    icon: <Sofa className="w-5 h-5" />,
    description: 'Virtual furniture staging'
  },
  {
    id: 'renovate',
    label: 'Renovate',
    icon: <PaintBucket className="w-5 h-5" />,
    description: 'Change surfaces & finishes'
  }
]

export function ModuleSidebar() {
  const { activeModule, setActiveModule, loadInjectorsForModule, loadGuardrailsForModule, selectedInput, setSelectedInput } =
    useModuleStore()
  const { currentJob, currentAsset, setCurrentAsset, assets } = useJobStore()

  const handleSelectModule = async (moduleId: ModuleType) => {
    if (activeModule === moduleId) {
      setActiveModule(null)
    } else {
      setActiveModule(moduleId)
      await Promise.all([loadInjectorsForModule(moduleId), loadGuardrailsForModule(moduleId)])
    }
  }

  // Listen for selectModule events from Library "Run Module" action
  useEffect(() => {
    const handleEvent = (e: CustomEvent<{ module: string; assetId: string }>) => {
      handleSelectModule(e.detail.module as ModuleType)
      // Also set the input from the asset
      const asset = assets.find(a => a.id === e.detail.assetId)
      if (asset) {
        setSelectedInput({
          type: 'original',
          assetId: asset.id,
          assetName: asset.name
        })
      }
    }
    window.addEventListener('selectModule', handleEvent as EventListener)
    return () => window.removeEventListener('selectModule', handleEvent as EventListener)
  }, [assets])

  // Sync selectedInput with currentAsset for module generation
  useEffect(() => {
    if (selectedInput && currentJob) {
      const asset = assets.find(a => a.id === selectedInput.assetId)
      if (asset && currentAsset?.id !== asset.id) {
        setCurrentAsset(asset)
      }
    }
  }, [selectedInput, assets, currentJob])

  return (
    <div className="h-full flex flex-col">
      {/* Module List */}
      {!activeModule ? (
        <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
          {MODULES.map((module) => (
            <button
              key={module.id}
              onClick={() => handleSelectModule(module.id)}
              className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors hover:bg-slate-700/50 cursor-pointer"
            >
              <div className="p-2 bg-slate-700 rounded-lg text-slate-300">{module.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-white">{module.label}</div>
                <div className="text-xs text-slate-400">{module.description}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>
          ))}

          <div className="p-4 text-center text-slate-500 text-sm">
            Select a module, then choose input from Library
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Module Header */}
          <div className="flex-shrink-0 p-3 border-b border-slate-700">
            <button
              onClick={() => setActiveModule(null)}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
              Back to modules
            </button>
            <h3 className="text-lg font-medium text-white mt-2">
              {MODULES.find((m) => m.id === activeModule)?.label}
            </h3>
          </div>

          {/* Input Picker - at top of all module settings */}
          <div className="flex-shrink-0 p-3 border-b border-slate-700">
            <ModuleInputPicker
              selectedInput={selectedInput}
              onSelectInput={setSelectedInput}
            />
          </div>

          {/* Module Panel */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {activeModule === 'clean' && <CleanSlatePanel />}
            {activeModule === 'stage' && <StagingPanel />}
            {activeModule === 'renovate' && <RenovatePanel />}
            {activeModule === 'twilight' && <TwilightPanel />}
            {activeModule === 'relight' && <RelightPanel />}
          </div>
        </div>
      )}
    </div>
  )
}
