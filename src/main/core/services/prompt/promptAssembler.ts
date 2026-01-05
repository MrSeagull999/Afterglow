import crypto from 'crypto'

export interface PromptSection {
  name: string
  content: string
  priority: number
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

export class PromptAssembler {
  static assemble(params: PromptAssemblerParams): AssembledPrompt {
    const sections: PromptSection[] = []

    sections.push({
      name: 'Base Prompt',
      content: params.basePrompt,
      priority: 1
    })

    if (params.injectorPrompts && params.injectorPrompts.length > 0) {
      sections.push({
        name: 'Options & Modifiers',
        content: params.injectorPrompts.join(' '),
        priority: 2
      })
    }

    if (params.customInstructions && params.customInstructions.trim()) {
      sections.push({
        name: 'Custom Instructions',
        content: params.customInstructions.trim(),
        priority: 3
      })
    }

    if (params.guardrailPrompts && params.guardrailPrompts.length > 0) {
      sections.push({
        name: 'Guardrails',
        content: params.guardrailPrompts.join(' '),
        priority: 4
      })
    }

    const sortedSections = sections.sort((a, b) => a.priority - b.priority)
    const finalPrompt = sortedSections.map(s => s.content).filter(Boolean).join('\n\n')
    const hash = this.generateHash(finalPrompt)

    return {
      finalPrompt,
      sections: sortedSections,
      hash,
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

  static generateHash(prompt: string): string {
    return crypto.createHash('sha256').update(prompt).digest('hex').slice(0, 8)
  }

  static formatForDisplay(assembled: AssembledPrompt): string {
    return assembled.sections
      .map(section => `[${section.name}]\n${section.content}`)
      .join('\n\n---\n\n')
  }
}
