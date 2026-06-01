import { assemblePrompt } from '../../../../shared/services/prompt/promptAssembler'

export async function buildPromptPayload(params: {
  moduleType: 'twilight' | 'clean' | 'stage' | 'renovate'
  basePrompt: string
  options?: string[]
  guardrails?: string[]
  extraInstructions?: string
}): Promise<{ fullPrompt: string; promptHash: string }> {
  const assembled = await assemblePrompt({
    moduleType: params.moduleType,
    basePrompt: params.basePrompt,
    options: params.options,
    guardrails: params.guardrails,
    extraInstructions: params.extraInstructions
  })

  return {
    fullPrompt: assembled.fullPrompt,
    promptHash: assembled.promptHash
  }
}
