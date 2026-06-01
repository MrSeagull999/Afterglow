import { useEffect, useState } from 'react'
import type { ModuleType } from '../../shared/types'
import { assemblePrompt } from '../../shared/services/prompt/promptAssembler'
import { getResolvedProviderConfig } from '../../shared/services/provider/resolvedProviderConfig'
import {
  buildCleanSlateBasePrompt,
  buildRenovateBasePrompt,
  buildStagingBasePrompt,
  buildStagingBasePromptSimplified,
  buildTwilightPreviewBasePrompt
} from '../../shared/services/prompt/prompts'
import { useModuleStore } from '../store/useModuleStore'
import { useAppStore } from '../store/useAppStore'

export function useInspectorTruth(params: {
  enabled: boolean
  moduleType: ModuleType
  selectionCount: number
}): {
  providerDisplay: string
  resolvedProvider: {
    provider: 'openrouter' | 'gemini'
    model: string
    endpointBaseUrl: string
    resolvedBy: 'ui' | 'env_override'
    envOverride?: { key: string; value: string }
  }
  promptHash: string
  fullPrompt: string
  extraInstructions: string
  setExtraInstructions: (value: string) => void
} {
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
    setTwilightCustomInstructions,
    freeformSettings,
    setFreeformCustomInstructions
  } = useModuleStore()

  const { settings } = useAppStore()

  const intendedModel = (settings.previewImageModel || settings.previewModel) as string

  const [twilightPresetTemplate, setTwilightPresetTemplate] = useState<string>('')
  const [extraInstructions, setExtraInstructionsLocal] = useState('')
  const [assembled, setAssembled] = useState<{ fullPrompt: string; promptHash: string } | null>(null)

  const [resolvedProvider, setResolvedProvider] = useState(() => {
    return getResolvedProviderConfig({
      uiProvider: settings.imageProvider || 'google',
      intendedModel,
      env: (typeof process !== 'undefined' ? (process.env as any) : undefined)
    })
  })

  const providerDisplay = resolvedProvider.provider === 'openrouter' ? 'OpenRouter' : 'Gemini'

  useEffect(() => {
    if (!params.enabled) return
    let cancelled = false
    ;(globalThis as any)?.window?.api
      ?.invoke('provider:getResolvedProviderConfig', {
        uiProvider: settings.imageProvider || 'google',
        intendedModel
      })
      .then((result: any) => {
        if (!cancelled && result) setResolvedProvider(result)
      })
      .catch(() => {
        // ignore
      })

    return () => {
      cancelled = true
    }
  }, [settings.imageProvider, intendedModel])

  useEffect(() => {
    if (!params.enabled) return
    const current = (() => {
      switch (params.moduleType) {
        case 'clean':
          return cleanSlateSettings.customInstructions
        case 'stage':
          return stagingSettings.customInstructions
        case 'renovate':
          return renovateSettings.customInstructions
        case 'twilight':
          return twilightSettings.customInstructions
        case 'freeform':
          return freeformSettings.customInstructions
        default:
          return ''
      }
    })()
    setExtraInstructionsLocal(current)
  }, [params.moduleType])

  useEffect(() => {
    if (!params.enabled) return
    if (params.moduleType !== 'twilight') return
    let cancelled = false
    ;(globalThis as any)?.window?.electronAPI
      ?.getPresets()
      .then((presets: any[]) => {
        if (cancelled) return
        const preset = presets.find((p: any) => p.id === twilightSettings.presetId)
        setTwilightPresetTemplate(preset?.promptTemplate || '')
      })
      .catch(() => {
        if (!cancelled) setTwilightPresetTemplate('')
      })

    return () => {
      cancelled = true
    }
  }, [params.moduleType, twilightSettings.presetId])

  useEffect(() => {
    if (!params.enabled) return
    const run = async () => {
      const injectorPrompts = injectors
        .filter((i) => selectedInjectorIds.has(i.id))
        .map((i) => i.promptFragment)

      // In simplified mode for staging, guardrails are baked into the base prompt
      const skipGuardrails = params.moduleType === 'stage' && settings.promptStyle === 'simplified'
      const guardrailPrompts = skipGuardrails ? [] : guardrails
        .filter((g: any) => selectedGuardrailIds.has(g.id))
        .map((g: any) => g.promptFragment)

      let basePrompt = ''
      if (params.moduleType === 'clean') basePrompt = buildCleanSlateBasePrompt()
      if (params.moduleType === 'stage') {
        const promptParams = {
          roomType: stagingSettings.roomType,
          style: stagingSettings.style,
          roomDimensions: stagingSettings.roomDimensions
        }
        basePrompt = settings.promptStyle === 'simplified'
          ? buildStagingBasePromptSimplified(promptParams)
          : buildStagingBasePrompt(promptParams)
      }
      if (params.moduleType === 'renovate') basePrompt = buildRenovateBasePrompt(renovateSettings.changes as any)
      if (params.moduleType === 'twilight') {
        basePrompt = twilightPresetTemplate
          ? buildTwilightPreviewBasePrompt(twilightPresetTemplate, twilightSettings.lightingCondition)
          : ''
      }
      if (params.moduleType === 'freeform') {
        basePrompt = freeformSettings.craftedPrompt || ''
      }

      const result = await assemblePrompt({
        moduleType: params.moduleType,
        basePrompt,
        options: injectorPrompts,
        guardrails: guardrailPrompts,
        extraInstructions
      })

      setAssembled({ fullPrompt: result.fullPrompt, promptHash: result.promptHash })
    }

    run().catch(() => setAssembled(null))
  }, [
    params.moduleType,
    params.selectionCount,
    injectors,
    guardrails,
    selectedInjectorIds,
    selectedGuardrailIds,
    stagingSettings.roomType,
    stagingSettings.style,
    settings.promptStyle,
    renovateSettings.changes,
    twilightPresetTemplate,
    freeformSettings.craftedPrompt,
    extraInstructions
  ])

  const setExtraInstructions = (value: string) => {
    if (!params.enabled) return
    setExtraInstructionsLocal(value)
    switch (params.moduleType) {
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
      case 'freeform':
        setFreeformCustomInstructions(value)
        break
    }
  }

  return {
    providerDisplay,
    resolvedProvider,
    promptHash: assembled?.promptHash || '...',
    fullPrompt: assembled?.fullPrompt || '',
    extraInstructions,
    setExtraInstructions
  }
}
