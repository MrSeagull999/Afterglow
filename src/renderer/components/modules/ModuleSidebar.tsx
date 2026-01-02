import React from 'react'
import { useModuleStore } from '../../store/useModuleStore'
import { useJobStore } from '../../store/useJobStore'
import type { ModuleType } from '../../../shared/types'
import { CleanSlatePanel } from './CleanSlatePanel'
import { StagingPanel } from './StagingPanel'
import { RenovatePanel } from './RenovatePanel'
import { TwilightPanel } from './TwilightPanel'
import {
  Sparkles,
  Eraser,
  Sofa,
  PaintBucket,
  Moon,
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
  const { activeModule, setActiveModule, loadInjectorsForModule, loadGuardrailsForModule } =
    useModuleStore()
  const { currentAsset } = useJobStore()

  const handleSelectModule = async (moduleId: ModuleType) => {
    if (activeModule === moduleId) {
      setActiveModule(null)
    } else {
      setActiveModule(moduleId)
      await Promise.all([loadInjectorsForModule(moduleId), loadGuardrailsForModule(moduleId)])
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Module List */}
      {!activeModule ? (
        <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
          {MODULES.map((module) => (
            <button
              key={module.id}
              onClick={() => handleSelectModule(module.id)}
              disabled={!currentAsset}
              className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                currentAsset
                  ? 'hover:bg-slate-700/50 cursor-pointer'
                  : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="p-2 bg-slate-700 rounded-lg text-slate-300">{module.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-white">{module.label}</div>
                <div className="text-xs text-slate-400">{module.description}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>
          ))}

          {!currentAsset && (
            <div className="p-4 text-center text-slate-500 text-sm">
              Select an asset to use modules
            </div>
          )}
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

          {/* Module Panel */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {activeModule === 'clean' && <CleanSlatePanel />}
            {activeModule === 'stage' && <StagingPanel />}
            {activeModule === 'renovate' && <RenovatePanel />}
            {activeModule === 'twilight' && <TwilightPanel />}
          </div>
        </div>
      )}
    </div>
  )
}
