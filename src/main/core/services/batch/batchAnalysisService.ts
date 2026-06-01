import sharp from 'sharp'
import { existsSync } from 'fs'
import { getAsset } from '../../store/assetStore'

/**
 * Batch analysis service.
 * Sends multiple images + a single instruction to Gemini Flash.
 * Returns a consistency brief + per-image prompts.
 */

export interface BatchAnalysisParams {
  jobId: string
  assetIds: string[]
  instruction: string
  referenceVisualBrief?: string  // Pre-extracted text description of the reference image
}

export interface PerImagePrompt {
  assetId: string
  prompt: string
  notes?: string
}

export interface BatchAnalysisResult {
  consistencyBrief: string
  perImagePrompts: PerImagePrompt[]
}

function resolveChatProvider(): { type: 'gemini' | 'openrouter'; apiKey: string; baseUrl?: string } | null {
  const geminiKey = process.env.GEMINI_API_KEY || ''
  if (geminiKey) return { type: 'gemini', apiKey: geminiKey }

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

function resizePxForBatchSize(count: number): number {
  if (count <= 10) return 768
  if (count <= 20) return 512
  return 512 // for 21+, we only send the first 15
}

const MAX_IMAGES_TO_SEND = 15

async function loadImageBase64(imagePath: string, maxPx: number): Promise<{ base64: string; mimeType: string } | null> {
  if (!existsSync(imagePath)) return null
  try {
    const buffer = await sharp(imagePath)
      .resize(maxPx, maxPx, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer()
    return { base64: buffer.toString('base64'), mimeType: 'image/jpeg' }
  } catch {
    return null
  }
}

function buildSystemPrompt(instruction: string, sentCount: number, totalCount: number, referenceVisualBrief?: string): string {
  const noteSuffix = sentCount < totalCount
    ? `\n\nNote: You are viewing ${sentCount} representative images out of ${totalCount} total. Create prompts for all ${sentCount} images shown, and I will apply the consistency brief to the remaining ${totalCount - sentCount} images separately.`
    : ''

  const referenceSection = referenceVisualBrief
    ? `\n\nCRITICAL REFERENCE CONSTRAINT: The photographer has provided an approved reference image with the following specific visual parameters that MUST be matched exactly across all outputs:\n"${referenceVisualBrief}"\n\nEvery per-image prompt MUST explicitly describe replicating these exact parameters. Do not deviate from this reference's sky color, atmosphere, or lighting characteristics.`
    : ''

  return `You are analyzing a batch of ${sentCount} real estate photos for consistent editing.

The photographer wants: "${instruction}"${referenceSection}

Analyze all images carefully and produce:
1. A CONSISTENCY BRIEF — shared visual parameters that must be identical across all outputs (e.g. sky color, cloud style, lighting direction, color temperature, time of day, overall mood). Be specific and descriptive. If a reference brief is provided above, it takes priority over all other style choices.
2. A per-image PROMPT — a detailed editing prompt for each image that references the consistency brief and accounts for the unique composition/features of that specific image.

Respond with valid JSON only, no markdown, no extra text:
{
  "consistencyBrief": "...",
  "prompts": [
    { "imageIndex": 0, "prompt": "...", "notes": "..." },
    { "imageIndex": 1, "prompt": "...", "notes": "..." }
  ]
}

Each prompt should:
- Be detailed and specific (2-4 sentences)
- Reference the consistency brief parameters
- Preserve all architectural features, fixtures and surfaces unchanged
- Be photorealistic in result${noteSuffix}`
}

async function callGeminiBatchAnalysis(
  apiKey: string,
  instruction: string,
  images: Array<{ base64: string; mimeType: string }>,
  totalCount: number,
  referenceVisualBrief?: string
): Promise<string | null> {
  const model = 'gemini-3-flash-preview'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const textPart = { text: buildSystemPrompt(instruction, images.length, totalCount, referenceVisualBrief) }
  const imageParts = images.map((img, i) => [
    { text: `Image ${i + 1}:` },
    { inlineData: { mimeType: img.mimeType, data: img.base64 } }
  ]).flat()

  const body = {
    contents: [{ role: 'user', parts: [textPart, ...imageParts] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 4096
    }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 120000) // 2 min for batch

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
      console.error(`[BatchAnalysis] Gemini error ${response.status}: ${errorText.slice(0, 300)}`)
      return null
    }

    const data = await response.json()
    const candidates = data.candidates as Array<Record<string, unknown>> | undefined
    const content = candidates?.[0]?.content as Record<string, unknown> | undefined
    const parts = content?.parts as Array<Record<string, unknown>> | undefined
    const textResult = parts?.find(p => 'text' in p) as Record<string, string> | undefined
    return textResult?.text || null
  } catch (error: any) {
    clearTimeout(timeoutId)
    console.error('[BatchAnalysis] Gemini call failed:', error.message)
    return null
  }
}

async function callOpenRouterBatchAnalysis(
  apiKey: string,
  baseUrl: string,
  instruction: string,
  images: Array<{ base64: string; mimeType: string }>,
  totalCount: number,
  referenceVisualBrief?: string
): Promise<string | null> {
  const model = 'google/gemini-3-flash-preview'
  const url = `${baseUrl}/chat/completions`

  const contentParts: any[] = [
    { type: 'text', text: buildSystemPrompt(instruction, images.length, totalCount, referenceVisualBrief) }
  ]

  images.forEach((img, i) => {
    contentParts.push({ type: 'text', text: `Image ${i + 1}:` })
    contentParts.push({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.base64}` } })
  })

  const body = {
    model,
    messages: [{ role: 'user', content: contentParts }],
    temperature: 0.4,
    max_tokens: 4096
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 120000)

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
      console.error(`[BatchAnalysis] OpenRouter error ${response.status}: ${errorText.slice(0, 300)}`)
      return null
    }

    const data = await response.json()
    const choices = data.choices as Array<Record<string, any>> | undefined
    const message = choices?.[0]?.message as Record<string, any> | undefined
    return (message?.content as string) || null
  } catch (error: any) {
    clearTimeout(timeoutId)
    console.error('[BatchAnalysis] OpenRouter call failed:', error.message)
    return null
  }
}

function parseAnalysisResponse(
  responseText: string,
  assetIds: string[],
  sentAssetIds: string[],
  instruction: string,
  consistencyBriefFallback?: string
): BatchAnalysisResult {
  // Strip markdown fences if present
  const cleaned = responseText.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '')

  let parsed: { consistencyBrief?: string; prompts?: Array<{ imageIndex: number; prompt: string; notes?: string }> } = {}
  try {
    parsed = JSON.parse(cleaned)
  } catch (e) {
    console.error('[BatchAnalysis] Failed to parse JSON response:', e)
    // Fallback: use instruction as prompt for all images
    const brief = consistencyBriefFallback || `Apply the following edit consistently: ${instruction}`
    return {
      consistencyBrief: brief,
      perImagePrompts: assetIds.map(id => ({ assetId: id, prompt: instruction }))
    }
  }

  const brief = parsed.consistencyBrief || `Apply the following edit consistently: ${instruction}`
  const promptsMap = new Map<number, { prompt: string; notes?: string }>()
  for (const p of (parsed.prompts || [])) {
    promptsMap.set(p.imageIndex, { prompt: p.prompt, notes: p.notes })
  }

  // Map prompts back to assetIds — sentAssetIds are in order
  const perImagePrompts: PerImagePrompt[] = assetIds.map((assetId, globalIndex) => {
    const sentIndex = sentAssetIds.indexOf(assetId)
    if (sentIndex !== -1 && promptsMap.has(sentIndex)) {
      const p = promptsMap.get(sentIndex)!
      return { assetId, prompt: p.prompt, notes: p.notes }
    }
    // Not analysed individually — generate from consistency brief
    return {
      assetId,
      prompt: `${brief} ${instruction}. Apply these changes while preserving all architectural features, fixtures, and surfaces exactly as they appear in the original image.`
    }
  })

  return { consistencyBrief: brief, perImagePrompts }
}

/**
 * Analyze a batch of images with a single instruction.
 * Returns a consistency brief + per-image prompts.
 */
export async function analyzeBatch(params: BatchAnalysisParams): Promise<BatchAnalysisResult> {
  const { jobId, assetIds, instruction } = params

  const provider = resolveChatProvider()
  if (!provider) {
    throw new Error('No API key available (need GEMINI_API_KEY or OPENROUTER_API_KEY)')
  }

  const maxPx = resizePxForBatchSize(assetIds.length)

  // Determine which assets to actually send (cap at MAX_IMAGES_TO_SEND)
  const sentAssetIds = assetIds.slice(0, MAX_IMAGES_TO_SEND)

  // Load images for the assets we're sending
  const images: Array<{ base64: string; mimeType: string }> = []
  const loadedAssetIds: string[] = []

  for (const assetId of sentAssetIds) {
    const asset = await getAsset(jobId, assetId)
    if (!asset) continue

    const imagePath = asset.workingSourcePath || asset.originalPath
    const imageData = await loadImageBase64(imagePath, maxPx)
    if (imageData) {
      images.push(imageData)
      loadedAssetIds.push(assetId)
    }
  }

  if (images.length === 0) {
    throw new Error('No images could be loaded for analysis')
  }

  const { referenceVisualBrief } = params
  console.log(`[BatchAnalysis] Analyzing ${images.length} images (${assetIds.length} total) via ${provider.type}`)
  if (referenceVisualBrief) {
    console.log('[BatchAnalysis] Reference visual brief provided — injecting into prompts')
  }

  let responseText: string | null = null

  if (provider.type === 'gemini') {
    responseText = await callGeminiBatchAnalysis(provider.apiKey, instruction, images, assetIds.length, referenceVisualBrief)
  } else {
    responseText = await callOpenRouterBatchAnalysis(provider.apiKey, provider.baseUrl!, instruction, images, assetIds.length, referenceVisualBrief)
  }

  if (!responseText) {
    throw new Error('No response from AI — check your API key and try again')
  }

  return parseAnalysisResponse(responseText, assetIds, loadedAssetIds, instruction)
}

/**
 * Analyze a single reference image and extract a concrete visual brief.
 * Returns a text description of the sky, colours, atmosphere and lighting
 * that can be injected into generation prompts as hard text constraints.
 */
export async function analyzeReferenceImage(imagePath: string): Promise<string> {
  const provider = resolveChatProvider()
  if (!provider) {
    throw new Error('No API key available')
  }

  const imageData = await loadImageBase64(imagePath, 1024)
  if (!imageData) {
    throw new Error('Could not load reference image')
  }

  const prompt = `Analyze this reference image and extract precise visual parameters for sky/atmosphere consistency.

Describe ONLY:
1. Sky: exact color temperature, dominant hues, gradient description (e.g. "warm blue #4A7AB5 at zenith fading to golden-orange at horizon")
2. Clouds: type, density, position (e.g. "thin scattered cirrus, no heavy cloud mass")
3. Time of day: blue hour timing (e.g. "30-45 minutes after sunset, last light fading")
4. Ambient light mood: overall atmospheric quality
5. Building/artificial lighting: color temperature of lights, intensity

Be extremely specific and concrete — this description will be used as a hard constraint to ensure pixel-level consistency across a batch of generated images. No fluff. 3-5 sentences maximum.`

  if (provider.type === 'gemini') {
    const model = 'gemini-3-flash-preview'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${provider.apiKey}`

    const body = {
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: imageData.mimeType, data: imageData.base64 } }
        ]
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (!response.ok) throw new Error(`Gemini error ${response.status}`)
    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text
    if (!text) throw new Error('No response from AI')
    return text.trim()
  } else {
    const url = `${provider.baseUrl}/chat/completions`
    const body = {
      model: 'google/gemini-3-flash-preview',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${imageData.mimeType};base64,${imageData.base64}` } }
        ]
      }],
      temperature: 0.1,
      max_tokens: 1024
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`,
        'HTTP-Referer': 'https://afterglow.studio',
        'X-Title': 'Afterglow Studio'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) throw new Error(`OpenRouter error ${response.status}`)
    const data = await response.json()
    const text = data.choices?.[0]?.message?.content
    if (!text) throw new Error('No response from AI')
    return text.trim()
  }
}

/**
 * Interpret casual human feedback into a precise image-generation correction instruction.
 * e.g. "sky too orange" → "Reduce warm orange sky tones significantly; shift sky toward
 * cooler blue-purple twilight palette matching the anchor image."
 */
export async function interpretUserFeedback(feedback: string, currentPrompt: string): Promise<string> {
  const provider = resolveChatProvider()
  if (!provider) throw new Error('No API key available')

  const systemPrompt = `You are an expert at translating casual photography feedback into precise image generation correction instructions.

The current image generation prompt is:
"""
${currentPrompt.slice(0, 600)}
"""

The photographer said: "${feedback}"

Convert this feedback into a specific, actionable correction instruction for the image generator.
- Be concrete and technical (name specific colors, brightness values, regions of the image)
- Keep it to 1-2 sentences
- Focus only on what needs to change
- Do not repeat the full prompt, just describe the correction

Return only the correction instruction text, nothing else.`

  if (provider.type === 'gemini') {
    const model = 'gemini-3-flash-preview'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${provider.apiKey}`
    const body = {
      contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 256 }
    }
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!response.ok) throw new Error(`Gemini error ${response.status}`)
    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text
    if (!text) throw new Error('No response from AI')
    return text.trim()
  } else {
    const url = `${provider.baseUrl}/chat/completions`
    const body = {
      model: 'google/gemini-3-flash-preview',
      messages: [{ role: 'user', content: systemPrompt }],
      temperature: 0.2,
      max_tokens: 256
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${provider.apiKey}`, 'HTTP-Referer': 'https://afterglow.studio', 'X-Title': 'Afterglow Studio' },
      body: JSON.stringify(body)
    })
    if (!response.ok) throw new Error(`OpenRouter error ${response.status}`)
    const data = await response.json()
    const text = data.choices?.[0]?.message?.content
    if (!text) throw new Error('No response from AI')
    return text.trim()
  }
}
