import { readFile, mkdir, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import sharp from 'sharp'
import { randomBytes } from 'crypto'
import { getAsset } from '../../store/assetStore'
import { getJobDirectory } from '../../store/jobStore'

/**
 * Chat service for freeform module.
 * Provides multi-turn text conversation with Gemini Flash to help craft prompts.
 */

export interface ChatImageAttachment {
  base64: string
  mimeType: string
  name?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  images?: ChatImageAttachment[]
}

export interface ChatSession {
  id: string
  jobId: string
  assetId: string
  messages: ChatMessage[]
  suggestedPrompt: string | null
  imageBase64?: string
  imageMimeType?: string
  /** Paths to reference images saved to disk during this session (for generation) */
  referenceImagePaths: string[]
}

export interface ChatResponse {
  success: boolean
  message?: string
  suggestedPrompt?: string | null
  error?: string
}

// In-memory session store (ephemeral, no persistence needed)
const chatSessions = new Map<string, ChatSession>()

const SYSTEM_PROMPT = `You are an AI assistant helping a user craft an image editing prompt for a real estate photograph.

Your task:
1. Analyse the provided subject image carefully
2. If the user attaches additional reference images (e.g. a reverse-angle photo, a furnished room for style matching), study them closely and use the details to inform your prompt
3. Discuss with the user what changes they want to make
4. Help craft a detailed, specific prompt for an AI image editing model
5. When you've crafted a prompt, format it between [PROMPT_START] and [PROMPT_END] markers

The image editing model works best with:
- Clear, specific descriptions of what to change
- Photorealistic, natural results
- Preservation of elements that should stay unchanged
- Detailed instructions about style, lighting, materials, and furniture placement
- When a reference image is provided for multi-angle consistency, describe the key furniture pieces, styles, and layout you observed so the model can replicate them in the target view

Be conversational and helpful. Ask clarifying questions if needed. When you suggest a prompt, make it detailed and actionable.

Example prompt format:
[PROMPT_START]
Stage this empty living room with the same furniture visible in the reference photo: a light grey three-seat sofa facing the TV wall, a round oak coffee table, two Eames-style armchairs, and a large area rug with a geometric pattern. Match the warm neutral colour palette and natural light feel of the reference. Keep all architectural details — windows, floors, and walls — exactly as shown.
[PROMPT_END]`

/**
 * Resolve which API to use for chat.
 * Prefers GEMINI_API_KEY (direct, cheapest), falls back to OPENROUTER_API_KEY.
 */
function resolveChatProvider(): { type: 'gemini' | 'openrouter'; apiKey: string; baseUrl?: string } | null {
  const geminiKey = process.env.GEMINI_API_KEY || ''
  if (geminiKey) {
    return { type: 'gemini', apiKey: geminiKey }
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY || ''
  if (openRouterKey) {
    return {
      type: 'openrouter',
      apiKey: openRouterKey,
      baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'
    }
  }

  return null
}

/**
 * Call Gemini API directly for chat.
 */
async function callGeminiChat(
  apiKey: string,
  messages: ChatMessage[],
  assetImageBase64?: string,
  assetImageMimeType?: string
): Promise<{ text: string } | { error: string }> {
  const model = 'gemini-3-flash-preview'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  // Build conversation contents (no system prompt in contents — use system_instruction instead)
  const contents: any[] = []

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const parts: any[] = [{ text: msg.content }]

    // Include asset image in first user message
    if (i === 0 && msg.role === 'user' && assetImageBase64 && assetImageMimeType) {
      parts.push({
        inlineData: {
          mimeType: assetImageMimeType,
          data: assetImageBase64
        }
      })
    }

    // Include any reference images attached to this message
    if (msg.images && msg.images.length > 0) {
      for (const img of msg.images) {
        parts.push({
          inlineData: {
            mimeType: img.mimeType,
            data: img.base64
          }
        })
      }
    }

    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts
    })
  }

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048
    }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 45000)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      const msg = `Gemini API error ${response.status}: ${errorText.slice(0, 300)}`
      console.error(`[ChatService] ${msg}`)
      return { error: msg }
    }

    const data = await response.json()
    const candidates = data.candidates as Array<Record<string, unknown>> | undefined
    const content = candidates?.[0]?.content as Record<string, unknown> | undefined
    const parts = content?.parts as Array<Record<string, unknown>> | undefined
    const textPart = parts?.find(p => 'text' in p) as Record<string, string> | undefined
    const text = textPart?.text
    if (!text) return { error: 'Empty response from Gemini API' }
    return { text }
  } catch (error: any) {
    clearTimeout(timeoutId)
    const msg = error.name === 'AbortError' ? 'Request timed out (45s)' : error.message
    console.error('[ChatService] Gemini API call failed:', msg)
    return { error: msg }
  }
}

/**
 * Call OpenRouter API for chat (OpenAI-compatible format).
 */
async function callOpenRouterChat(
  apiKey: string,
  baseUrl: string,
  messages: ChatMessage[],
  assetImageBase64?: string,
  assetImageMimeType?: string
): Promise<{ text: string } | { error: string }> {
  const model = 'google/gemini-3-flash-preview'
  const url = `${baseUrl}/chat/completions`

  // Build messages array
  const apiMessages: any[] = [
    {
      role: 'system',
      content: SYSTEM_PROMPT
    }
  ]

  // Add conversation history
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const hasAssetImage = i === 0 && msg.role === 'user' && assetImageBase64 && assetImageMimeType
    const hasRefImages = msg.images && msg.images.length > 0

    if (hasAssetImage || hasRefImages) {
      const contentParts: any[] = [{ type: 'text', text: msg.content }]

      if (hasAssetImage) {
        contentParts.push({
          type: 'image_url',
          image_url: { url: `data:${assetImageMimeType};base64,${assetImageBase64}` }
        })
      }

      if (hasRefImages) {
        for (const img of msg.images!) {
          contentParts.push({
            type: 'image_url',
            image_url: { url: `data:${img.mimeType};base64,${img.base64}` }
          })
        }
      }

      apiMessages.push({ role: 'user', content: contentParts })
    } else {
      apiMessages.push({
        role: msg.role,
        content: msg.content
      })
    }
  }

  const body = {
    model,
    messages: apiMessages,
    temperature: 0.7,
    max_tokens: 2048
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 45000)

  try {
    const response = await fetch(url, {
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
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      const msg = `OpenRouter API error ${response.status}: ${errorText.slice(0, 300)}`
      console.error(`[ChatService] ${msg}`)
      return { error: msg }
    }

    const data = await response.json()
    const choices = data.choices as Array<Record<string, any>> | undefined
    const message = choices?.[0]?.message as Record<string, any> | undefined
    const text = message?.content as string | undefined
    if (!text) return { error: 'Empty response from OpenRouter API' }
    return { text }
  } catch (error: any) {
    clearTimeout(timeoutId)
    const msg = error.name === 'AbortError' ? 'Request timed out (45s)' : error.message
    console.error('[ChatService] OpenRouter API call failed:', msg)
    return { error: msg }
  }
}

/**
 * Extract suggested prompt from response text.
 * Returns the content between [PROMPT_START] and [PROMPT_END] markers only.
 * Returns null if markers are absent — the AI is still in conversation mode.
 */
function extractPrompt(responseText: string): string | null {
  const startMarker = '[PROMPT_START]'
  const endMarker = '[PROMPT_END]'

  const startIdx = responseText.indexOf(startMarker)
  const endIdx = responseText.indexOf(endMarker)

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return responseText
      .substring(startIdx + startMarker.length, endIdx)
      .trim()
  }

  return null
}

/**
 * Create a new chat session for an asset.
 * Loads the asset image, resizes to 1536px, converts to base64.
 */
export async function createChatSession(jobId: string, assetId: string): Promise<ChatSession> {
  const asset = await getAsset(jobId, assetId)
  if (!asset) {
    throw new Error(`Asset not found: ${assetId}`)
  }

  const sessionId = `chat-${randomBytes(8).toString('hex')}`

  let imageBase64: string | undefined
  let imageMimeType: string | undefined

  // Load and resize image to 1536px for chat
  if (existsSync(asset.originalPath)) {
    try {
      const buffer = await sharp(asset.originalPath)
        .resize(1536, 1536, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer()

      imageBase64 = buffer.toString('base64')
      imageMimeType = 'image/jpeg'
    } catch (error: any) {
      console.error('[ChatService] Failed to load image:', error.message)
    }
  }

  const session: ChatSession = {
    id: sessionId,
    jobId,
    assetId,
    messages: [],
    suggestedPrompt: null,
    imageBase64,
    imageMimeType,
    referenceImagePaths: []
  }

  chatSessions.set(sessionId, session)
  console.log(`[ChatService] Created session ${sessionId} for asset ${assetId}`)

  return session
}

/**
 * Send a message in an existing chat session.
 * Returns the assistant's response and any suggested prompt.
 * Optional referenceImages are attached to this user message.
 */
export async function sendChatMessage(
  sessionId: string,
  userMessage: string,
  referenceImages?: ChatImageAttachment[]
): Promise<ChatResponse> {
  const session = chatSessions.get(sessionId)
  if (!session) {
    return { success: false, error: 'Session not found' }
  }

  const provider = resolveChatProvider()
  if (!provider) {
    return { success: false, error: 'No API key available (need GEMINI_API_KEY or OPENROUTER_API_KEY)' }
  }

  // Save any new reference images to disk so the generation engine can use them
  if (referenceImages && referenceImages.length > 0) {
    try {
      const jobDir = getJobDirectory(session.jobId)
      const refDir = join(jobDir, 'chat-refs', session.id)
      await mkdir(refDir, { recursive: true })

      for (const img of referenceImages) {
        const ext = img.mimeType === 'image/png' ? '.png' : '.jpg'
        const fileName = `ref-${Date.now()}-${randomBytes(4).toString('hex')}${ext}`
        const filePath = join(refDir, fileName)
        await writeFile(filePath, Buffer.from(img.base64, 'base64'))
        session.referenceImagePaths.push(filePath)
        console.log(`[ChatService] Saved reference image to ${filePath}`)
      }
    } catch (err: any) {
      console.error('[ChatService] Failed to save reference images to disk:', err.message)
    }
  }

  // Add user message to history (with any attached reference images)
  session.messages.push({
    role: 'user',
    content: userMessage,
    timestamp: new Date().toISOString(),
    ...(referenceImages && referenceImages.length > 0 ? { images: referenceImages } : {})
  })

  console.log(`[ChatService] Sending message to ${provider.type} for session ${sessionId}`)

  let result: { text: string } | { error: string }

  try {
    if (provider.type === 'gemini') {
      result = await callGeminiChat(
        provider.apiKey,
        session.messages,
        session.imageBase64,
        session.imageMimeType
      )
    } else {
      result = await callOpenRouterChat(
        provider.apiKey,
        provider.baseUrl!,
        session.messages,
        session.imageBase64,
        session.imageMimeType
      )
    }
  } catch (error: any) {
    console.error('[ChatService] API call failed:', error.message)
    return { success: false, error: `API call failed: ${error.message}` }
  }

  if ('error' in result) {
    return { success: false, error: result.error }
  }

  const responseText = result.text

  // Add assistant response to history
  session.messages.push({
    role: 'assistant',
    content: responseText,
    timestamp: new Date().toISOString()
  })

  // Extract suggested prompt
  const suggestedPrompt = extractPrompt(responseText)
  session.suggestedPrompt = suggestedPrompt

  return {
    success: true,
    message: responseText,
    suggestedPrompt
  }
}

/**
 * Get an existing chat session.
 */
export function getChatSession(sessionId: string): ChatSession | null {
  return chatSessions.get(sessionId) || null
}

/**
 * Clear a chat session.
 */
export function clearChatSession(sessionId: string): void {
  chatSessions.delete(sessionId)
  console.log(`[ChatService] Cleared session ${sessionId}`)
}

/**
 * Clear all chat sessions.
 */
export function clearAllChatSessions(): void {
  chatSessions.clear()
  console.log('[ChatService] Cleared all chat sessions')
}

/**
 * Get reference image paths saved to disk for an asset's chat session.
 * Returns an array of { path, role } ready to be stored in a VersionRecipe.
 */
export function getChatReferenceImagesForAsset(assetId: string): Array<{ path: string; role: string }> {
  for (const session of chatSessions.values()) {
    if (session.assetId === assetId && session.referenceImagePaths.length > 0) {
      return session.referenceImagePaths.map((p, i) => ({
        path: p,
        role: `Reference image ${i + 1} provided by user for context — match the furniture, styling, and layout shown as closely as possible in the staged result`
      }))
    }
  }
  return []
}
