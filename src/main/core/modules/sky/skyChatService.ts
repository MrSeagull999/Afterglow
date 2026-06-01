import { randomBytes } from 'crypto'

/**
 * Chat service for the Sky module.
 * The user describes the sky they want in natural language.
 * The AI helps refine the description and produces a detailed generation prompt.
 * No source asset is required — this is a standalone sky generator.
 */

export interface SkyChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface SkyChatSession {
  id: string
  messages: SkyChatMessage[]
  suggestedPrompt: string | null
}

export interface SkyChatResponse {
  success: boolean
  message?: string
  suggestedPrompt?: string | null
  error?: string
}

// In-memory session store
const sessions = new Map<string, SkyChatSession>()

const SYSTEM_PROMPT = `You are an AI assistant helping a real estate photographer craft the perfect sky for Photoshop compositing.

The user will describe the kind of sky they want — mood, time of day, cloud types, colours, feel, etc. Your job is to:
1. Understand what they're after — ask a short clarifying question if needed
2. When you have enough detail, produce a detailed sky generation prompt

When you're ready to generate, wrap the prompt exactly like this:
[PROMPT_START]
...prompt text...
[PROMPT_END]

The prompt you write will be prepended with this base instruction automatically:
"Photorealistic full-frame sky photograph. The entire image is sky — no ground, no horizon line with land or buildings, no structures, no terrain. Fill the complete frame edge-to-edge with sky. High resolution, sharp detail, suitable for professional Photoshop compositing."

So your prompt should only describe the sky itself — its colours, clouds, light, atmosphere, and mood. Do NOT repeat the base instruction.

Guidelines for a great sky prompt:
- Describe the time of day and lighting conditions specifically
- Mention cloud types (cumulus, cirrus, cumulonimbus, stratus, etc.) and their arrangement
- Include colour palette details (warm, cool, specific hues, gradients)
- Describe the atmospheric mood (dramatic, serene, romantic, powerful, clean, etc.)
- Mention any special lighting effects (rays, glows, halos, gradients)
- Keep it photorealistic — this is for real estate photography compositing

Be warm and conversational. One or two clarifying questions is fine, but don't over-complicate it.
If the user gives you enough detail in one message, go straight to producing the prompt.`

function resolveProvider(): { type: 'gemini' | 'openrouter'; apiKey: string; baseUrl?: string } | null {
  const geminiKey = process.env.GEMINI_API_KEY || ''
  if (geminiKey) return { type: 'gemini', apiKey: geminiKey }

  const orKey = process.env.OPENROUTER_API_KEY || ''
  if (orKey) {
    return {
      type: 'openrouter',
      apiKey: orKey,
      baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'
    }
  }

  return null
}

async function callGemini(apiKey: string, messages: SkyChatMessage[]): Promise<string | null> {
  const model = 'gemini-3-flash-preview'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const contents: any[] = [
    { role: 'user', parts: [{ text: SYSTEM_PROMPT }] }
  ]

  for (const msg of messages) {
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    })
  }

  const body = {
    contents,
    generationConfig: {
      responseModalities: ['TEXT'],
      temperature: 0.7,
      maxOutputTokens: 1024
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    })
    clearTimeout(timeout)

    if (!res.ok) {
      const err = await res.text()
      console.error(`[SkyChat] Gemini error ${res.status}: ${err.slice(0, 200)}`)
      return null
    }

    const data = await res.json()
    const parts = data.candidates?.[0]?.content?.parts as Array<Record<string, any>> | undefined
    return parts?.find(p => 'text' in p)?.text || null
  } catch (err: any) {
    clearTimeout(timeout)
    console.error('[SkyChat] Gemini call failed:', err.message)
    return null
  }
}

async function callOpenRouter(apiKey: string, baseUrl: string, messages: SkyChatMessage[]): Promise<string | null> {
  const url = `${baseUrl}/chat/completions`

  const apiMessages: any[] = [{ role: 'system', content: SYSTEM_PROMPT }]
  for (const msg of messages) {
    apiMessages.push({ role: msg.role, content: msg.content })
  }

  const body = {
    model: 'google/gemini-3-flash-preview',
    messages: apiMessages,
    temperature: 0.7,
    max_tokens: 1024
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://afterglow.studio',
        'X-Title': 'Afterglow Studio'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    })
    clearTimeout(timeout)

    if (!res.ok) {
      const err = await res.text()
      console.error(`[SkyChat] OpenRouter error ${res.status}: ${err.slice(0, 200)}`)
      return null
    }

    const data = await res.json()
    return (data.choices?.[0]?.message?.content as string) || null
  } catch (err: any) {
    clearTimeout(timeout)
    console.error('[SkyChat] OpenRouter call failed:', err.message)
    return null
  }
}

function extractPrompt(text: string): string | null {
  const start = text.indexOf('[PROMPT_START]')
  const end = text.indexOf('[PROMPT_END]')
  if (start !== -1 && end !== -1 && end > start) {
    return text.substring(start + '[PROMPT_START]'.length, end).trim()
  }
  return null
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function createSkyChatSession(): SkyChatSession {
  const id = `sky-${randomBytes(8).toString('hex')}`
  const session: SkyChatSession = { id, messages: [], suggestedPrompt: null }
  sessions.set(id, session)
  console.log(`[SkyChat] Created session ${id}`)
  return session
}

export async function sendSkyChatMessage(sessionId: string, userMessage: string): Promise<SkyChatResponse> {
  const session = sessions.get(sessionId)
  if (!session) return { success: false, error: 'Session not found' }

  const provider = resolveProvider()
  if (!provider) return { success: false, error: 'No API key configured (need GEMINI_API_KEY or OPENROUTER_API_KEY)' }

  session.messages.push({
    role: 'user',
    content: userMessage,
    timestamp: new Date().toISOString()
  })

  console.log(`[SkyChat] Sending to ${provider.type} — session ${sessionId}`)

  let responseText: string | null = null
  try {
    if (provider.type === 'gemini') {
      responseText = await callGemini(provider.apiKey, session.messages)
    } else {
      responseText = await callOpenRouter(provider.apiKey, provider.baseUrl!, session.messages)
    }
  } catch {
    return { success: false, error: 'API call failed' }
  }

  if (!responseText) return { success: false, error: 'No response from API' }

  session.messages.push({
    role: 'assistant',
    content: responseText,
    timestamp: new Date().toISOString()
  })

  const suggestedPrompt = extractPrompt(responseText)
  if (suggestedPrompt) session.suggestedPrompt = suggestedPrompt

  return { success: true, message: responseText, suggestedPrompt }
}

export function clearSkyChatSession(sessionId: string): void {
  sessions.delete(sessionId)
  console.log(`[SkyChat] Cleared session ${sessionId}`)
}
