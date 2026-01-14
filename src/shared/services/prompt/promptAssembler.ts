export type PromptModuleType = 'twilight' | 'clean' | 'stage' | 'renovate'

export type PromptSectionId = 'base' | 'options' | 'guardrails' | 'extra_instructions'

export const PROMPT_SECTION_ORDER: PromptSectionId[] = [
  'base',
  'options',
  'guardrails',
  'extra_instructions'
]

export interface AssemblePromptInput {
  moduleType: PromptModuleType
  basePrompt: string
  options?: string[]
  guardrails?: string[]
  extraInstructions?: string
}

export interface AssembledPrompt {
  fullPrompt: string
  promptHash: string
  sections: Array<{ id: PromptSectionId; content: string }>
}

function normalizeLines(s: string): string {
  return s.replace(/\r\n/g, '\n').trim()
}

function joinSentences(parts: string[]): string {
  return parts.map((p) => normalizeLines(p)).filter((p) => p.length > 0).join(' ')
}

async function sha256Hex(input: string): Promise<string> {
  let cryptoObj = (globalThis as any).crypto as Crypto | undefined
  if (!cryptoObj?.subtle) {
    try {
      const nodeCrypto = await import('node:crypto')
      cryptoObj = (nodeCrypto as any).webcrypto as Crypto | undefined
    } catch {
      // ignore
    }
  }
  if (!cryptoObj?.subtle) {
    throw new Error('crypto.subtle is not available for SHA-256 hashing (required)')
  }

  const bytes = new TextEncoder().encode(input)
  const digest = await cryptoObj.subtle.digest('SHA-256', bytes)
  const hashArray = Array.from(new Uint8Array(digest))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function assemblePrompt(input: AssemblePromptInput): Promise<AssembledPrompt> {
  const base = normalizeLines(input.basePrompt)
  const options = joinSentences(input.options || [])
  const guardrails = joinSentences(input.guardrails || [])
  const extra = normalizeLines(input.extraInstructions || '')

  const sectionContent: Record<PromptSectionId, string> = {
    base,
    options,
    guardrails,
    extra_instructions: extra
  }

  const sections = PROMPT_SECTION_ORDER.map((id) => ({ id, content: sectionContent[id] })).filter((s) => s.content.length > 0)
  const fullPrompt = sections.map((s) => s.content).join('\n\n')
  const promptHash = await sha256Hex(fullPrompt)

  return {
    fullPrompt,
    promptHash,
    sections
  }
}
