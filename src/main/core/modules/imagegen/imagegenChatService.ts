import { randomBytes } from 'crypto'

/**
 * Chat service for the Image Gen module.
 * Unlike the Freeform chat service, this has NO source asset —
 * the user attaches reference images (people, objects, bags, etc.)
 * and describes how to combine them into a new generated image.
 *
 * Reference images are kept in-memory (base64) so they can be passed
 * directly to the generation API at the moment of generation.
 */

export interface ImageGenChatAttachment {
  base64: string
  mimeType: string
  name?: string
}

export interface ImageGenChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  images?: ImageGenChatAttachment[]
}

export interface ImageGenChatSession {
  id: string
  messages: ImageGenChatMessage[]
  suggestedPrompt: string | null
  /** All reference images attached across the session — used at generation time */
  referenceImages: ImageGenChatAttachment[]
}

export interface ImageGenChatResponse {
  success: boolean
  message?: string
  suggestedPrompt?: string | null
  error?: string
}

// In-memory session store
const sessions = new Map<string, ImageGenChatSession>()

const SYSTEM_PROMPT = `You are an AI assistant helping a user craft a prompt for generating a brand new image from scratch.

The user will attach reference photos — for example a photo of a person, a product, a bag, a room, an animal, etc.
Your job is to:
1. Study each reference image the user sends carefully
2. Discuss what the user wants to create or combine
3. Ask clarifying questions if needed (style, background, lighting, mood, composition)
4. When you have enough detail, craft a specific, detailed generation prompt

When you produce the final prompt, wrap it exactly like this:
[PROMPT_START]
...prompt text...
[PROMPT_END]

Important rules for the prompt:
- Be specific about which elements come from which reference image ("the person from Image 1", "the bag from Image 2")
- Describe pose, lighting, background, and composition clearly
- Keep it photorealistic unless the user asks for a different style
- If the user wants to composite elements (person + product), describe how they interact naturally

Example — user sends a person photo and a handbag photo and says "put the bag on the person":
[PROMPT_START]
Photorealistic composite image. The person from Image 1 is shown holding the handbag from Image 2 naturally over their shoulder. Preserve the person's exact face, clothing, hair and pose from Image 1. The bag from Image 2 should look naturally lit to match the lighting in Image 1. Keep the original background from Image 1. Professional fashion photography quality.
[PROMPT_END]

Be friendly and conversational. Guide the user toward a great result.`

/**
 * Resolve chat API provider from env vars
 */
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

async function callGemini(apiKey: string, messages: ImageGenChatMessage[]): Promise<string | null> {
  const model = 'gemini-3-flash-preview'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const contents: any[] = [
    { role: 'user', parts: [{ text: SYSTEM_PROMPT }] }
  ]

  for (const msg of messages) {
    const parts: any[] = [{ text: msg.content }]

    if (msg.images && msg.images.length > 0) {
      msg.images.forEach((img, i) => {
        parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } })
      })
    }

    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts
    })
  }

  const body = {
    contents,
    generationConfig: {
      responseModalities: ['TEXT'],
      temperature: 0.7,
      maxOutputTokens: 2048
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45000)

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
      console.error(`[ImageGenChat] Gemini error ${res.status}: ${err.slice(0, 200)}`)
      return null
    }

    const data = await res.json()
    const parts = data.candidates?.[0]?.content?.parts as Array<Record<string, any>> | undefined
    return parts?.find(p => 'text' in p)?.text || null
  } catch (err: any) {
    clearTimeout(timeout)
    console.error('[ImageGenChat] Gemini call failed:', err.message)
    return null
  }
}

async function callOpenRouter(apiKey: string, baseUrl: string, messages: ImageGenChatMessage[]): Promise<string | null> {
  const url = `${baseUrl}/chat/completions`

  const apiMessages: any[] = [{ role: 'system', content: SYSTEM_PROMPT }]

  for (const msg of messages) {
    const hasImages = msg.images && msg.images.length > 0

    if (hasImages) {
      const parts: any[] = [{ type: 'text', text: msg.content }]
      for (const img of msg.images!) {
        parts.push({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.base64}` } })
      }
      apiMessages.push({ role: msg.role, content: parts })
    } else {
      apiMessages.push({ role: msg.role, content: msg.content })
    }
  }

  const body = {
    model: 'google/gemini-3-flash-preview',
    messages: apiMessages,
    temperature: 0.7,
    max_tokens: 2048
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45000)

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
      console.error(`[ImageGenChat] OpenRouter error ${res.status}: ${err.slice(0, 200)}`)
      return null
    }

    const data = await res.json()
    return (data.choices?.[0]?.message?.content as string) || null
  } catch (err: any) {
    clearTimeout(timeout)
    console.error('[ImageGenChat] OpenRouter call failed:', err.message)
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

export function createImageGenChatSession(): ImageGenChatSession {
  const id = `imagegen-${randomBytes(8).toString('hex')}`
  const session: ImageGenChatSession = {
    id,
    messages: [],
    suggestedPrompt: null,
    referenceImages: []
  }
  sessions.set(id, session)
  console.log(`[ImageGenChat] Created session ${id}`)
  return session
}

export async function sendImageGenChatMessage(
  sessionId: string,
  userMessage: string,
  attachedImages?: ImageGenChatAttachment[]
): Promise<ImageGenChatResponse> {
  const session = sessions.get(sessionId)
  if (!session) return { success: false, error: 'Session not found' }

  const provider = resolveProvider()
  if (!provider) return { success: false, error: 'No API key configured (need GEMINI_API_KEY or OPENROUTER_API_KEY)' }

  // Accumulate reference images for use at generation time
  if (attachedImages && attachedImages.length > 0) {
    session.referenceImages.push(...attachedImages)
    console.log(`[ImageGenChat] Session ${sessionId} now has ${session.referenceImages.length} reference image(s)`)
  }

  // Add to message history
  session.messages.push({
    role: 'user',
    content: userMessage,
    timestamp: new Date().toISOString(),
    ...(attachedImages && attachedImages.length > 0 ? { images: attachedImages } : {})
  })

  console.log(`[ImageGenChat] Sending to ${provider.type} — session ${sessionId}`)

  let responseText: string | null = null
  try {
    if (provider.type === 'gemini') {
      responseText = await callGemini(provider.apiKey, session.messages)
    } else {
      responseText = await callOpenRouter(provider.apiKey, provider.baseUrl!, session.messages)
    }
  } catch (err: any) {
    return { success: false, error: 'API call failed' }
  }

  if (!responseText) return { success: false, error: 'No response from API' }

  session.messages.push({
    role: 'assistant',
    content: responseText,
    timestamp: new Date().toISOString()
  })

  const suggestedPrompt = extractPrompt(responseText)
  session.suggestedPrompt = suggestedPrompt

  return { success: true, message: responseText, suggestedPrompt }
}

export function getImageGenChatSession(sessionId: string): ImageGenChatSession | null {
  return sessions.get(sessionId) || null
}

export function getImageGenChatReferenceImages(sessionId: string): ImageGenChatAttachment[] {
  return sessions.get(sessionId)?.referenceImages || []
}

export function clearImageGenChatSession(sessionId: string): void {
  sessions.delete(sessionId)
  console.log(`[ImageGenChat] Cleared session ${sessionId}`)
}
