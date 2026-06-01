import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import type { ModuleType, EvaluationResult, EvaluationScores } from '../../../../shared/types'

/**
 * Per-module evaluation prompts. Each module checks different quality criteria.
 */
const EVALUATION_PROMPTS: Record<ModuleType, string> = {
  stage: `Evaluate this virtually staged real estate photograph. Score each criterion 1-10:

1. furniture_scale: Are all furniture pieces realistically sized relative to the room (doors, windows, walls)? A 10 means every piece looks like real furniture at real scale. A 1 means furniture looks miniaturized or giant.
2. grounding: Do all items sit naturally on the floor/surfaces with realistic shadows? A 10 means perfect contact and shadows. A 1 means items float or have no shadows.
3. preservation: Are the original architectural elements (walls, floors, ceilings, windows, doors, fixtures) unchanged from the input? A 10 means perfect preservation. A 1 means the room structure was altered.
4. style_coherence: Does all furniture and decor look like it belongs together in a cohesive design? A 10 means perfectly coordinated. A 1 means a random mix of styles.
5. photo_realism: Would this pass as a real photograph of a furnished room? A 10 means indistinguishable from real. A 1 means obviously AI generated.

Respond ONLY with valid JSON in this exact format:
{"furniture_scale":N,"grounding":N,"preservation":N,"style_coherence":N,"photo_realism":N,"issues":["issue1","issue2"]}

The issues array should list specific problems found (empty array if none). Be concise.`,

  clean: `Evaluate this decluttered real estate photograph where furniture has been removed. Score each criterion 1-10:

1. preservation: Are all architectural elements (walls, floors, ceilings, windows, doors, fixtures) perfectly preserved? A 10 means flawless. A 1 means structure was altered.
2. grounding: Are the surfaces where furniture was removed filled in realistically with matching materials and textures? A 10 means seamless. A 1 means obvious patches or artifacts.
3. photo_realism: Would this pass as a real photograph of an empty room? A 10 means indistinguishable from real. A 1 means obviously AI processed.

Respond ONLY with valid JSON in this exact format:
{"preservation":N,"grounding":N,"photo_realism":N,"issues":["issue1","issue2"]}`,

  twilight: `Evaluate this twilight/dusk conversion of a real estate photograph. Score each criterion 1-10:

1. sky_realism: Does the sky look like a natural blue hour/dusk sky? A 10 means perfectly realistic gradient. A 1 means obviously fake or painted.
2. lighting_consistency: Is the lighting consistent throughout (warm interior glow, cool exterior light, proper shadows)? A 10 means perfectly balanced. A 1 means inconsistent light sources.
3. preservation: Are all architectural elements, landscaping, and structural features unchanged? A 10 means perfect. A 1 means features were altered or added.
4. photo_realism: Would this pass as a real twilight photograph? A 10 means indistinguishable from real. A 1 means obviously AI processed.

Respond ONLY with valid JSON in this exact format:
{"sky_realism":N,"lighting_consistency":N,"preservation":N,"photo_realism":N,"issues":["issue1","issue2"]}`,

  renovate: `Evaluate this renovated real estate photograph where surfaces have been changed. Score each criterion 1-10:

1. preservation: Are all elements that should NOT change (furniture, fixtures, structure) perfectly preserved? A 10 means flawless. A 1 means unwanted changes.
2. style_coherence: Do the changed surfaces (paint, flooring, curtains) look realistic and consistent with the space? A 10 means perfectly natural. A 1 means obviously fake.
3. photo_realism: Would this pass as a real photograph? A 10 means indistinguishable from real. A 1 means obviously AI processed.

Respond ONLY with valid JSON in this exact format:
{"preservation":N,"style_coherence":N,"photo_realism":N,"issues":["issue1","issue2"]}`,

  relight: `Evaluate this relit real estate photograph where lighting conditions have been adjusted. Score each criterion 1-10:

1. lighting_consistency: Is the lighting natural and consistent throughout the image? A 10 means perfectly balanced. A 1 means inconsistent.
2. preservation: Are all architectural elements and objects unchanged? A 10 means perfect. A 1 means features were altered.
3. photo_realism: Would this pass as a real photograph taken in these lighting conditions? A 10 means indistinguishable from real. A 1 means obviously AI processed.

Respond ONLY with valid JSON in this exact format:
{"lighting_consistency":N,"preservation":N,"photo_realism":N,"issues":["issue1","issue2"]}`,

  freeform: `Evaluate this custom-edited real estate photograph. Score each criterion 1-10:

1. preservation: Are elements that should remain unchanged perfectly preserved? A 10 means flawless preservation. A 1 means unwanted alterations.
2. photo_realism: Would this pass as a real photograph? A 10 means indistinguishable from real. A 1 means obviously AI processed.
3. edit_quality: Is the requested edit well-executed and believable? A 10 means seamless integration. A 1 means obvious artifacts or poor execution.

Respond ONLY with valid JSON in this exact format:
{"preservation":N,"photo_realism":N,"edit_quality":N,"issues":["issue1","issue2"]}`,

  imagegen: `Evaluate this AI-generated image for overall quality. Score each criterion 1-10:

1. photo_realism: Does this look like a real photograph or high-quality render? A 10 means indistinguishable from real. A 1 means obviously AI generated with artefacts.
2. style_coherence: Is the composition, lighting, and style internally consistent? A 10 means perfectly cohesive. A 1 means jarring or inconsistent elements.
3. edit_quality: How well does the image match the intent of a creative prompt? A 10 means excellent prompt adherence and execution. A 1 means poor execution.

Respond ONLY with valid JSON in this exact format:
{"photo_realism":N,"style_coherence":N,"edit_quality":N,"issues":["issue1","issue2"]}`
}

/**
 * Map raw JSON response keys to EvaluationScores fields
 */
function mapScores(raw: Record<string, unknown>): EvaluationScores {
  const scores: EvaluationScores = {}
  if (typeof raw.furniture_scale === 'number') scores.furnitureScale = raw.furniture_scale
  if (typeof raw.grounding === 'number') scores.grounding = raw.grounding
  if (typeof raw.preservation === 'number') scores.preservation = raw.preservation
  if (typeof raw.style_coherence === 'number') scores.styleCoherence = raw.style_coherence
  if (typeof raw.photo_realism === 'number') scores.photoRealism = raw.photo_realism
  if (typeof raw.sky_realism === 'number') scores.skyRealism = raw.sky_realism
  if (typeof raw.lighting_consistency === 'number') scores.lightingConsistency = raw.lighting_consistency
  if (typeof raw.reference_match === 'number') scores.referenceMatch = raw.reference_match
  return scores
}

function buildReferenceComparisonSuffix(modulePrompt: string): string {
  return `${modulePrompt}

REFERENCE COMPARISON: You are also provided with a REFERENCE IMAGE (Image 1) and the GENERATED OUTPUT (Image 2). Score one additional criterion:
- reference_match: How closely does the OUTPUT match the REFERENCE in sky color, color temperature, atmospheric tone, and overall mood? A 10 means the sky/atmosphere is visually indistinguishable from the reference. A 5 means noticeable color or mood differences. A 1 means completely different sky treatment or color palette.

Add "reference_match": N to your JSON response alongside the other scores.`
}

function calculateOverallScore(scores: EvaluationScores): number {
  const values = Object.values(scores).filter((v): v is number => typeof v === 'number')
  if (values.length === 0) return 0
  return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10
}

/**
 * Resolve which API to use for evaluation.
 * Prefers GEMINI_API_KEY (direct, cheapest), falls back to OPENROUTER_API_KEY.
 */
function resolveEvaluationProvider(): { type: 'gemini' | 'openrouter'; apiKey: string; baseUrl?: string } | null {
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
 * Call Gemini API directly for evaluation.
 */
async function callGeminiEvaluation(
  apiKey: string,
  evaluationPrompt: string,
  base64Image: string,
  mimeType: string,
  referenceBase64?: string,
  referenceMimeType?: string
): Promise<string | null> {
  const model = 'gemini-3-flash-preview'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const parts: any[] = []
  if (referenceBase64 && referenceMimeType) {
    parts.push({ text: 'Image 1 (REFERENCE — this is the approved style to match):' })
    parts.push({ inlineData: { mimeType: referenceMimeType, data: referenceBase64 } })
    parts.push({ text: 'Image 2 (GENERATED OUTPUT — evaluate this against the reference):' })
  }
  parts.push({ text: evaluationPrompt })
  parts.push({ inlineData: { mimeType, data: base64Image } })

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: 0.1 }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal
  })
  clearTimeout(timeoutId)

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[EvaluationService] Gemini API error ${response.status}: ${errorText.slice(0, 200)}`)
    return null
  }

  const data = await response.json()
  const candidates = data.candidates as Array<Record<string, unknown>> | undefined
  const content = candidates?.[0]?.content as Record<string, unknown> | undefined
  const responseParts = content?.parts as Array<Record<string, unknown>> | undefined
  const textPart = responseParts?.find(p => 'text' in p) as Record<string, string> | undefined
  return textPart?.text || null
}

/**
 * Call OpenRouter API for evaluation (OpenAI-compatible format).
 */
async function callOpenRouterEvaluation(
  apiKey: string,
  baseUrl: string,
  evaluationPrompt: string,
  base64Image: string,
  mimeType: string,
  referenceBase64?: string,
  referenceMimeType?: string
): Promise<string | null> {
  const model = 'google/gemini-3-flash-preview'
  const url = `${baseUrl}/chat/completions`

  const content: any[] = []
  if (referenceBase64 && referenceMimeType) {
    content.push({ type: 'text', text: 'Image 1 (REFERENCE — this is the approved style to match):' })
    content.push({ type: 'image_url', image_url: { url: `data:${referenceMimeType};base64,${referenceBase64}` } })
    content.push({ type: 'text', text: 'Image 2 (GENERATED OUTPUT — evaluate this against the reference):' })
  }
  content.push({ type: 'text', text: evaluationPrompt })
  content.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } })

  const body = {
    model,
    messages: [{ role: 'user', content }],
    temperature: 0.1,
    max_tokens: 1000
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

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
    console.error(`[EvaluationService] OpenRouter API error ${response.status}: ${errorText.slice(0, 200)}`)
    return null
  }

  const data = await response.json()
  const choices = data.choices as Array<Record<string, any>> | undefined
  const message = choices?.[0]?.message as Record<string, any> | undefined
  return (message?.content as string) || null
}

/**
 * Evaluate a generated image using a text model.
 * Automatically uses GEMINI_API_KEY if available, otherwise falls back to OpenRouter.
 * Returns structured scores or null if evaluation fails.
 */
export async function evaluateGeneration(
  imagePath: string,
  module: ModuleType,
  _apiKey?: string,
  attempt: number = 1,
  referenceImagePath?: string
): Promise<EvaluationResult | null> {
  if (!imagePath || !existsSync(imagePath)) {
    console.log(`[EvaluationService] Image not found: ${imagePath}`)
    return null
  }

  const provider = resolveEvaluationProvider()
  if (!provider) {
    console.warn('[EvaluationService] ⚠️  No API key available for evaluation (need GEMINI_API_KEY or OPENROUTER_API_KEY in .env)')
    console.warn('[EvaluationService] ⚠️  Evaluation is enabled in settings but cannot run without API key')
    return null
  }

  const hasReference = !!(referenceImagePath && existsSync(referenceImagePath))
  console.log(`[EvaluationService] 🔍 Starting evaluation for ${module} module (attempt ${attempt})${hasReference ? ' + reference comparison' : ''}`)
  console.log(`[EvaluationService] 🔑 Using ${provider.type} provider for evaluation`)

  try {
    const imageBuffer = await readFile(imagePath)
    const base64Image = imageBuffer.toString('base64')
    const ext = imagePath.toLowerCase().split('.').pop()
    let mimeType = 'image/jpeg'
    if (ext === 'png') mimeType = 'image/png'
    else if (ext === 'webp') mimeType = 'image/webp'

    // Load reference image if provided
    let referenceBase64: string | undefined
    let referenceMimeType: string | undefined
    if (hasReference) {
      const refBuffer = await readFile(referenceImagePath!)
      referenceBase64 = refBuffer.toString('base64')
      const refExt = referenceImagePath!.toLowerCase().split('.').pop()
      referenceMimeType = refExt === 'png' ? 'image/png' : refExt === 'webp' ? 'image/webp' : 'image/jpeg'
    }

    const basePrompt = EVALUATION_PROMPTS[module]
    if (!basePrompt) {
      console.log(`[EvaluationService] No evaluation prompt for module: ${module}`)
      return null
    }

    const evaluationPrompt = hasReference
      ? buildReferenceComparisonSuffix(basePrompt)
      : basePrompt

    console.log(`[EvaluationService] Evaluating ${module} output via ${provider.type} (attempt ${attempt})...`)

    let responseText: string | null = null
    if (provider.type === 'gemini') {
      responseText = await callGeminiEvaluation(provider.apiKey, evaluationPrompt, base64Image, mimeType, referenceBase64, referenceMimeType)
    } else {
      responseText = await callOpenRouterEvaluation(provider.apiKey, provider.baseUrl!, evaluationPrompt, base64Image, mimeType, referenceBase64, referenceMimeType)
    }

    if (!responseText) {
      console.error('[EvaluationService] No text response from evaluation')
      return null
    }

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = responseText.trim()
    const jsonMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    }

    const parsed = JSON.parse(jsonStr)
    const scores = mapScores(parsed)
    const overallScore = calculateOverallScore(scores)
    const issues: string[] = Array.isArray(parsed.issues)
      ? parsed.issues.filter((i: unknown) => typeof i === 'string')
      : []

    const result: EvaluationResult = {
      overallScore,
      scores,
      issues,
      evaluatedAt: new Date().toISOString(),
      attempt
    }

    console.log(`[EvaluationService] ✅ ${module} score: ${overallScore}/10 via ${provider.type} (attempt ${attempt})${issues.length > 0 ? ` - issues: ${issues.join('; ')}` : ''}`)
    console.log(`[EvaluationService] 📊 Detailed scores:`, scores)
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[EvaluationService] Evaluation failed: ${message}`)
    return null
  }
}
