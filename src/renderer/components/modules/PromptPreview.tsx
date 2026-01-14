import React, { useEffect, useState } from 'react'
import { Hash, Info, ArrowRight } from 'lucide-react'
import { useModuleStore } from '../../store/useModuleStore'
import { useAppStore } from '../../store/useAppStore'
import type { ModuleType } from '../../../shared/types'
import { assemblePrompt } from '../../../shared/services/prompt/promptAssembler'
import {
  buildCleanSlateBasePrompt,
  buildStagingBasePrompt,
  buildRenovateBasePrompt
} from '../../../shared/services/prompt/prompts'

interface PromptPreviewProps {
  module: ModuleType
}

export function PromptPreview({ module }: PromptPreviewProps) {
  const {
    cleanSlateSettings,
    stagingSettings,
    renovateSettings,
    twilightSettings,
    injectors,
    guardrails,
    selectedInjectorIds,
    selectedGuardrailIds
  } = useModuleStore()
  const { settings } = useAppStore()
  const [assembledPrompt, setAssembledPrompt] = useState<{
    finalPrompt: string
    hash: string
    metadata: any
  } | null>(null)

  useEffect(() => {
    const run = async () => {
      try {
        const injectorPrompts = injectors
          .filter((i) => selectedInjectorIds.has(i.id))
          .map((i) => i.promptFragment)

        const guardrailPrompts = guardrails
          .filter((g: any) => selectedGuardrailIds.has(g.id))
          .map((g: any) => g.promptFragment)

        let basePrompt = ''
        let extraInstructions = ''

        if (module === 'clean') {
          basePrompt = buildCleanSlateBasePrompt()
          extraInstructions = cleanSlateSettings.customInstructions
        }
        if (module === 'stage') {
          basePrompt = buildStagingBasePrompt({ roomType: stagingSettings.roomType, style: stagingSettings.style })
          extraInstructions = stagingSettings.customInstructions
        }
        if (module === 'renovate') {
          basePrompt = buildRenovateBasePrompt(renovateSettings.changes as any)
          extraInstructions = renovateSettings.customInstructions
        }
        if (module === 'twilight') {
          const presets = await window.electronAPI.getPresets()
          const preset = presets.find((p: any) => p.id === twilightSettings.presetId)
          basePrompt = preset?.promptTemplate || ''
          extraInstructions = twilightSettings.customInstructions
        }

        const assembled = await assemblePrompt({
          moduleType: module,
          basePrompt,
          options: injectorPrompts,
          guardrails: guardrailPrompts,
          extraInstructions
        })

        setAssembledPrompt({
          finalPrompt: assembled.fullPrompt,
          hash: assembled.promptHash,
          metadata: {}
        })
      } catch (error) {
        console.error('[PromptPreview] Failed to assemble prompt:', error)
        setAssembledPrompt(null)
      }
    }

    run()
  }, [
    module,
    cleanSlateSettings.customInstructions,
    stagingSettings.roomType,
    stagingSettings.style,
    stagingSettings.customInstructions,
    renovateSettings.changes,
    renovateSettings.customInstructions,
    twilightSettings.presetId,
    twilightSettings.lightingCondition,
    twilightSettings.customInstructions,
    injectors,
    guardrails,
    selectedInjectorIds,
    selectedGuardrailIds
  ])

  const isLoading = !assembledPrompt

  // Determine provider display
  const rawProvider = settings.imageProvider || 'google'
  const providerDisplay = rawProvider === 'openrouter' ? 'OpenRouter' : 'Gemini'
  const model = settings.advancedCustomModel || settings.previewImageModel || 'gemini-2.0-flash-preview-image-generation'

  // Get module-specific metadata display
  const getMetadataDisplay = () => {
    switch (module) {
      case 'stage':
        return (
          <>
            <div className="p-2 bg-slate-800/50 rounded border border-slate-700">
              <div className="text-slate-500 mb-1">Room Type</div>
              <div className="text-white font-medium">{stagingSettings.roomType || 'N/A'}</div>
            </div>
            <div className="p-2 bg-slate-800/50 rounded border border-slate-700">
              <div className="text-slate-500 mb-1">Style</div>
              <div className="text-white font-medium">{stagingSettings.style || 'N/A'}</div>
            </div>
          </>
        )
      case 'renovate':
        const activeChanges = []
        if (renovateSettings.changes.floor?.enabled) activeChanges.push('Floor')
        if (renovateSettings.changes.wallPaint?.enabled) activeChanges.push('Walls')
        if (renovateSettings.changes.curtains?.enabled) activeChanges.push('Curtains')
        return (
          <div className="col-span-2 p-2 bg-slate-800/50 rounded border border-slate-700">
            <div className="text-slate-500 mb-1">Active Changes</div>
            <div className="text-white font-medium">
              {activeChanges.length > 0 ? activeChanges.join(', ') : 'None selected'}
            </div>
          </div>
        )
      case 'twilight':
        return (
          <div className="col-span-2 p-2 bg-slate-800/50 rounded border border-slate-700">
            <div className="text-slate-500 mb-1">Lighting</div>
            <div className="text-white font-medium capitalize">{twilightSettings.lightingCondition}</div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-300">Final Prompt (Live)</label>
        {!isLoading && assembledPrompt && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Hash className="w-3 h-3" />
            <span className="font-mono">{assembledPrompt.hash.slice(0, 8)}</span>
          </div>
        )}
      </div>

      <div className="relative">
        {isLoading ? (
          <div className="w-full h-48 flex items-center justify-center bg-slate-900 border border-slate-600 rounded-lg">
            <span className="text-slate-500 text-sm">Loading prompt preview...</span>
          </div>
        ) : (
          <textarea
            value={assembledPrompt?.finalPrompt || ''}
            readOnly
            className="w-full h-48 px-3 py-2 text-xs font-mono bg-slate-900 border border-slate-600 rounded-lg text-slate-300 resize-none focus:outline-none focus:border-blue-500 scrollbar-thin scrollbar-thumb-slate-700"
            style={{ lineHeight: '1.5' }}
          />
        )}
      </div>

      {/* Provider/Model - ALWAYS VISIBLE */}
      <div className="p-3 bg-gradient-to-r from-slate-800/80 to-slate-800/50 rounded-lg border border-slate-700">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-400">Provider:</span>
          <span className="font-semibold text-white">{providerDisplay}</span>
          <ArrowRight className="w-4 h-4 text-slate-500" />
          <span className="font-mono text-xs text-blue-400 truncate" title={model}>
            {model}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {getMetadataDisplay()}
      </div>

      <div className="flex items-start gap-2 p-2 bg-blue-900/20 border border-blue-700/50 rounded text-xs text-blue-200">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          This is the <strong>exact prompt</strong> that will be sent to the AI provider. What you see here is what gets sent.
        </div>
      </div>
    </div>
  )
}
