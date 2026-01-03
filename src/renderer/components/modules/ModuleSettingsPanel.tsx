import React from 'react'
import { useModuleStore } from '../../store/useModuleStore'
import { useJobStore } from '../../store/useJobStore'
import { useAppStore } from '../../store/useAppStore'
import type { ModuleType } from '../../../shared/types'
import {
  Moon,
  Eraser,
  Sofa,
  PaintBucket,
  ChevronLeft,
  Sparkles,
  Loader2,
  Info
} from 'lucide-react'

// Import module-specific panels (we'll refactor these to be settings-only)
import { TwilightSettings } from './settings/TwilightSettings'
import { CleanSlateSettings } from './settings/CleanSlateSettings'
import { StagingSettings } from './settings/StagingSettings'
import { RenovateSettings } from './settings/RenovateSettings'

interface ModuleSettingsPanelProps {
  activeModule: ModuleType
  selectedCount: number
  onClose: () => void
  onApply: () => void
}

const MODULE_CONFIG: Record<ModuleType, { 
  label: string
  icon: React.ReactNode
  color: string
  bgColor: string
  description: string
}> = {
  twilight: {
    label: 'Twilight',
    icon: <Moon className="w-5 h-5" />,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-600',
    description: 'Transform daytime photos into stunning twilight scenes with warm interior lighting.'
  },
  clean: {
    label: 'Clean Slate',
    icon: <Eraser className="w-5 h-5" />,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-600',
    description: 'Remove furniture and clutter while preserving architectural details.'
  },
  stage: {
    label: 'Staging',
    icon: <Sofa className="w-5 h-5" />,
    color: 'text-amber-400',
    bgColor: 'bg-amber-600',
    description: 'Virtually furnish empty rooms with realistic furniture.'
  },
  renovate: {
    label: 'Renovate',
    icon: <PaintBucket className="w-5 h-5" />,
    color: 'text-purple-400',
    bgColor: 'bg-purple-600',
    description: 'Change specific surfaces like floors, walls, and curtains.'
  }
}

export function ModuleSettingsPanel({ 
  activeModule, 
  selectedCount, 
  onClose, 
  onApply 
}: ModuleSettingsPanelProps) {
  const { isGenerating } = useModuleStore()
  const config = MODULE_CONFIG[activeModule]

  return (
    <div className="w-72 flex flex-col bg-slate-800/50 border-r border-slate-700">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-slate-700">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-3"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${config.bgColor}`}>
            {config.icon}
          </div>
          <h2 className="text-lg font-semibold text-white">{config.label}</h2>
        </div>
      </div>

      {/* Description */}
      <div className="flex-shrink-0 p-4 border-b border-slate-700">
        <div className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg">
          <Info className={`w-4 h-4 ${config.color} flex-shrink-0 mt-0.5`} />
          <p className="text-sm text-slate-400">{config.description}</p>
        </div>
      </div>

      {/* Module-specific settings */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {activeModule === 'twilight' && <TwilightSettings />}
        {activeModule === 'clean' && <CleanSlateSettings />}
        {activeModule === 'stage' && <StagingSettings />}
        {activeModule === 'renovate' && <RenovateSettings />}
      </div>

      {/* Apply Button */}
      <div className="flex-shrink-0 p-4 border-t border-slate-700 bg-slate-800/80">
        <button
          onClick={onApply}
          disabled={isGenerating || selectedCount === 0}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 ${config.bgColor} hover:opacity-90 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded-lg transition-all`}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Apply to Selected ({selectedCount})
            </>
          )}
        </button>
        {selectedCount === 0 && (
          <p className="text-xs text-slate-500 text-center mt-2">
            Select images in the grid to apply
          </p>
        )}
      </div>
    </div>
  )
}
