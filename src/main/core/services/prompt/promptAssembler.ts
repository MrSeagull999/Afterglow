import { assemblePrompt } from '../../../../shared/services/prompt/promptAssembler'
import type { PromptModuleType } from '../../../../shared/services/prompt/promptAssembler'

export interface PromptSection {
  name: string
  content: string
}

export interface AssembledPrompt {
  finalPrompt: string
  sections: PromptSection[]
  hash: string
  metadata: {
    roomType?: string
    style?: string
    module: string
    injectorCount: number
    guardrailCount: number
    hasCustomInstructions: boolean
  }
}

export interface PromptAssemblerParams {
  module: string
  basePrompt: string
  injectorPrompts?: string[]
  guardrailPrompts?: string[]
  customInstructions?: string
  roomType?: string
  style?: string
}

/**
 * Phase 2: Single prompt truth surface.
 * This wrapper exists for backwards compatibility with older call sites.
 * Authoritative assembly + SHA-256 hashing is performed by the shared assembler.
 */
export class PromptAssembler {
  static async assemble(params: PromptAssemblerParams): Promise<AssembledPrompt> {
    const assembled = await assemblePrompt({
      moduleType: params.module as PromptModuleType,
      basePrompt: params.basePrompt,
      options: params.injectorPrompts,
      guardrails: params.guardrailPrompts,
      extraInstructions: params.customInstructions
    })

    return {
      finalPrompt: assembled.fullPrompt,
      sections: assembled.sections.map((s) => ({
        name: s.id,
        content: s.content
      })),
      hash: assembled.promptHash,
      metadata: {
        roomType: params.roomType,
        style: params.style,
        module: params.module,
        injectorCount: params.injectorPrompts?.length || 0,
        guardrailCount: params.guardrailPrompts?.length || 0,
        hasCustomInstructions: !!(params.customInstructions && params.customInstructions.trim())
      }
    }
  }

  static async generateHash(prompt: string): Promise<string> {
    const assembled = await assemblePrompt({
      moduleType: 'clean',
      basePrompt: prompt
    })
    return assembled.promptHash
  }

  static formatForDisplay(assembled: AssembledPrompt): string {
    return assembled.sections
      .map((section) => `[${section.name}]\n${section.content}`)
      .join('\n\n---\n\n')
  }
}
