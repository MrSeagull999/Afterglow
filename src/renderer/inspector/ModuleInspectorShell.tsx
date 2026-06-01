import React, { useEffect, useMemo, useState } from 'react'
import type { InspectorSelection } from './selectionAdapter'
import type { ModuleType } from '../../shared/types'
import { useModuleStore } from '../store/useModuleStore'
import { useAppStore } from '../store/useAppStore'
import { assemblePrompt } from '../../shared/services/prompt/promptAssembler'
import { buildCleanSlateBasePrompt, buildRenovateBasePrompt, buildStagingBasePrompt } from '../../shared/services/prompt/prompts'
import { getResolvedProviderConfig } from '../../shared/services/provider/resolvedProviderConfig'

export interface ModuleInspectorShellProps {
  selection: InspectorSelection
  moduleType: ModuleType
}

export function ModuleInspectorShell({ selection, moduleType }: ModuleInspectorShellProps) {
  const {
    injectors,
    guardrails,
    selectedInjectorIds,
    selectedGuardrailIds,
    cleanSlateSettings,
    setCleanSlateCustomInstructions,
    stagingSettings,
    setStagingCustomInstructions,
    renovateSettings,
    setRenovateCustomInstructions,
    twilightSettings,
    setTwilightCustomInstructions
  } = useModuleStore()

  const { settings } = useAppStore()

  const [extraInstructions, setExtraInstructions] = useState('')
  const [assembled, setAssembled] = useState<{ fullPrompt: string; promptHash: string } | null>(null)
  const [twilightPresetTemplate, setTwilightPresetTemplate] = useState<string>('')
  const intendedModel = (settings.previewImageModel || settings.previewModel) as string
  const [resolvedProvider, setResolvedProvider] = useState(() => {
    return getResolvedProviderConfig({
      uiProvider: settings.imageProvider || 'google',
      intendedModel,
      env: (typeof process !== 'undefined' ? (process.env as any) : undefined)
    })
  })

  const headerSubtext = useMemo(() => {
    const count = selection.selectedAssetIds.length
    if (count <= 1) {
      return `${count} item selected`
    }
    return `Batch mode: ${count} selected`
  }, [selection.selectedAssetIds.length])

  const applyLabel = useMemo(() => {
    const count = selection.selectedAssetIds.length
    return `Apply to Selected (${count})`
  }, [selection.selectedAssetIds.length])

  const providerDisplay = resolvedProvider.provider === 'openrouter' ? 'OpenRouter' : 'Gemini'

  useEffect(() => {
    let cancelled = false
    window.api
      .invoke('provider:getResolvedProviderConfig', {
        uiProvider: settings.imageProvider || 'google',
        intendedModel
      })
      .then((result) => {
        if (!cancelled && result) setResolvedProvider(result)
      })
      .catch(() => {
        // ignore; initial sync resolution is still displayed
      })
    return () => {
      cancelled = true
    }
  }, [settings.imageProvider, intendedModel])

  useEffect(() => {
    const current = (() => {
      switch (moduleType) {
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
    })()
    setExtraInstructions(current)
  }, [moduleType])

  useEffect(() => {
    if (moduleType !== 'twilight') return
    let cancelled = false
    window.electronAPI.getPresets().then((presets) => {
      if (cancelled) return
      const preset = presets.find((p: any) => p.id === twilightSettings.presetId)
      setTwilightPresetTemplate(preset?.promptTemplate || '')
    }).catch(() => {
      if (!cancelled) setTwilightPresetTemplate('')
    })
    return () => { cancelled = true }
  }, [moduleType, twilightSettings.presetId])

  useEffect(() => {
    const run = async () => {
      const injectorPrompts = injectors
        .filter((i) => selectedInjectorIds.has(i.id))
        .map((i) => i.promptFragment)

      const guardrailPrompts = guardrails
        .filter((g: any) => selectedGuardrailIds.has(g.id))
        .map((g: any) => g.promptFragment)

      let basePrompt = ''
      if (moduleType === 'clean') basePrompt = buildCleanSlateBasePrompt()
      if (moduleType === 'stage') basePrompt = buildStagingBasePrompt({ 
        roomType: stagingSettings.roomType, 
        style: stagingSettings.style,
        roomDimensions: stagingSettings.roomDimensions
      })
      if (moduleType === 'renovate') basePrompt = buildRenovateBasePrompt(renovateSettings.changes as any)
      if (moduleType === 'twilight') basePrompt = twilightPresetTemplate

      const result = await assemblePrompt({
        moduleType,
        basePrompt,
        options: injectorPrompts,
        guardrails: guardrailPrompts,
        extraInstructions
      })

      setAssembled({ fullPrompt: result.fullPrompt, promptHash: result.promptHash })
    }
    run().catch(() => setAssembled(null))
  }, [
    moduleType,
    selection.selectedAssetIds.length,
    injectors,
    guardrails,
    selectedInjectorIds,
    selectedGuardrailIds,
    stagingSettings.roomType,
    stagingSettings.style,
    renovateSettings.changes,
    twilightPresetTemplate,
    extraInstructions
  ])

  const handleExtraInstructionsChange = (value: string) => {
    setExtraInstructions(value)
    switch (moduleType) {
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
    <aside className="h-full flex flex-col border-l border-slate-700 bg-slate-800/30">
      <div className="p-4 border-b border-slate-700">
        <div className="text-lg font-semibold text-white">Inspector</div>
        <div className="text-xs font-bold text-amber-300 mt-1">INSPECTOR — ALL CONTROLS LIVE HERE</div>
        <div className="text-xs text-slate-400 mt-1">{headerSubtext}</div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-6">
        <div className="p-3 bg-amber-600 text-black font-bold rounded-lg text-center">
          PHASE 2 — PROMPT TRUTH SURFACE ACTIVE
        </div>

        <div className="p-3 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 space-y-1">
          <div><span className="text-slate-500">Module:</span> <span className="text-white font-medium">{moduleType}</span></div>
          <div><span className="text-slate-500">Selection:</span> <span className="text-white font-medium">{selection.selectedAssetIds.length}</span></div>
          <div><span className="text-slate-500">Effective Provider:</span> <span className="text-white font-medium">{providerDisplay}</span></div>
          <div><span className="text-slate-500">Model:</span> <span className="text-white font-mono">{resolvedProvider.model}</span></div>
          <div><span className="text-slate-500">Endpoint:</span> <span className="text-white font-mono">{resolvedProvider.endpointBaseUrl}</span></div>
          {resolvedProvider.resolvedBy === 'env_override' && resolvedProvider.envOverride && (
            <div className="text-amber-300">
              Overridden by env: {resolvedProvider.envOverride.key}={resolvedProvider.envOverride.value}
            </div>
          )}
          <div><span className="text-slate-500">promptHash:</span> <span className="text-white font-mono">{assembled?.promptHash || '...'}</span></div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">
            Extra Instructions (Phase 1 placeholder)
          </label>
          <textarea
            value={extraInstructions}
            onChange={(e) => handleExtraInstructionsChange(e.target.value)}
            placeholder="This will become the custom prompt field"
            className="w-full h-28 px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 resize-none focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">
            Final Prompt (Live) — Phase 1 placeholder
          </label>
          <textarea
            value={assembled?.fullPrompt || ''}
            readOnly
            className="w-full h-56 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg font-mono text-xs text-slate-300 resize-none focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={() => undefined}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          {applyLabel}
        </button>
      </div>
    </aside>
  )
}
