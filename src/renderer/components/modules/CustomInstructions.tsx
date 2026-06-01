import React from 'react'
import { FileText } from 'lucide-react'
import { useModuleStore } from '../../store/useModuleStore'
import type { ModuleType } from '../../../shared/types'

interface CustomInstructionsProps {
  module: ModuleType
}

export function CustomInstructions({ module }: CustomInstructionsProps) {
  const {
    cleanSlateSettings,
    setCleanSlateCustomInstructions,
    stagingSettings,
    setStagingCustomInstructions,
    renovateSettings,
    setRenovateCustomInstructions,
    twilightSettings,
    setTwilightCustomInstructions
  } = useModuleStore()

  // Get the correct value and setter based on module
  const getValue = (): string => {
    switch (module) {
      case 'clean':
        return cleanSlateSettings.customInstructions
      case 'stage':
        return stagingSettings.customInstructions
      case 'renovate':
        return renovateSettings.customInstructions
      case 'twilight':
        return twilightSettings.customInstructions
      default:
        return ''
    }
  }

  const setValue = (value: string) => {
    switch (module) {
      case 'clean':
        setCleanSlateCustomInstructions(value)
        break
      case 'stage':
        setStagingCustomInstructions(value)
        break
      case 'renovate':
        setRenovateCustomInstructions(value)
        break
      case 'twilight':
        setTwilightCustomInstructions(value)
        break
    }
  }

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
        <FileText className="w-4 h-4" />
        Extra Instructions
      </label>
      <textarea
        value={getValue()}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add anything you want the model to do or avoid..."
        className="w-full h-24 px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 resize-none focus:outline-none focus:border-blue-500"
      />
      <p className="text-xs text-slate-500">
        Custom instructions are added to the end of the prompt with highest priority.
      </p>
    </div>
  )
}
