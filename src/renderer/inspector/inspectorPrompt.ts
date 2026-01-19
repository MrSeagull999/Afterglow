import type { ModuleType, Injector } from '../../shared/types'
import { assemblePrompt } from '../../shared/services/prompt/promptAssembler'
import {
  buildCleanSlateBasePrompt,
  buildStagingBasePrompt,
  buildRenovateBasePrompt
} from '../../shared/services/prompt/prompts'

type GuardrailLike = { id: string; promptFragment: string }

export async function buildInspectorAssembledPrompt(params: {
  moduleType: ModuleType
  injectors: Injector[]
  guardrails: GuardrailLike[]
  selectedInjectorIds: Set<string>
  selectedGuardrailIds: Set<string>
  staging: { 
    roomType: string
    style: string
    roomDimensions?: { enabled: boolean; width: string; length: string; unit: 'feet' | 'meters' }
  }
  renovate: { changes: any }
  twilight: { presetTemplate: string }
  extraInstructions: string
}): Promise<{ fullPrompt: string; promptHash: string }> {
  const injectorPrompts = params.injectors
    .filter((i) => params.selectedInjectorIds.has(i.id))
    .map((i) => i.promptFragment)

  const guardrailPrompts = params.guardrails
    .filter((g) => params.selectedGuardrailIds.has(g.id))
    .map((g) => g.promptFragment)

  let basePrompt = ''
  if (params.moduleType === 'clean') basePrompt = buildCleanSlateBasePrompt()
  if (params.moduleType === 'stage') {
    basePrompt = buildStagingBasePrompt({
      roomType: params.staging.roomType || 'room',
      style: params.staging.style || 'modern contemporary',
      roomDimensions: params.staging.roomDimensions
    })
  }
  if (params.moduleType === 'renovate') basePrompt = buildRenovateBasePrompt(params.renovate.changes as any)
  if (params.moduleType === 'twilight') basePrompt = params.twilight.presetTemplate

  const assembled = await assemblePrompt({
    moduleType: params.moduleType,
    basePrompt,
    options: injectorPrompts,
    guardrails: guardrailPrompts,
    extraInstructions: params.extraInstructions
  })

  return {
    fullPrompt: assembled.fullPrompt,
    promptHash: assembled.promptHash
  }
}
