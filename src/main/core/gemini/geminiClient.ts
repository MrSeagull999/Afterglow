function getApiKeyFromEnv(): string {
  return process.env.GEMINI_API_KEY || ''
}

export function getApiKey(): string {
  return getApiKeyFromEnv()
}

export function isApiKeyConfigured(): boolean {
  const apiKey = getApiKeyFromEnv()
  return !!apiKey && apiKey !== 'your_gemini_api_key_here'
}

export type ImageModel = 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview'
export type ImageSize = '1024x1024' | '1536x1536' | '2048x2048'

export interface GeminiImageRequest {
  prompt: string
  imageData: string
  mimeType: string
  model: ImageModel
  imageSize?: ImageSize
  seed?: number | null
}

export interface GeminiImageResponse {
  success: boolean
  imageData?: string
  mimeType?: string
  error?: string
  seedRejected?: boolean
}

export function generateSeed(): number {
  return Math.floor(Math.random() * 2147483647)
}

async function makeImageGenerationRequest(
  model: ImageModel,
  prompt: string,
  imageData: string,
  mimeType: string,
  imageSize: ImageSize,
  seed: number | null,
  includeSeed: boolean
): Promise<Response> {
  const apiKey = getApiKey()
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  
  const isGeminiFlash = model.includes('gemini')
  
  const generationConfig: Record<string, unknown> = {
    responseModalities: ['IMAGE']
  }
  
  if (includeSeed && seed !== null) {
    generationConfig.seed = seed
  }
  
  const body = {
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        {
          inlineData: {
            mimeType: mimeType,
            data: imageData
          }
        }
      ]
    }],
    generationConfig
  }
  
  console.log('[GeminiClient] Request to model:', model)
  console.log('[GeminiClient] Is Gemini Flash:', isGeminiFlash)
  console.log('[GeminiClient] Seed included:', includeSeed && seed !== null ? seed : 'none')
  
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

function isSeedRejectionError(errorText: string): boolean {
  const seedErrorPatterns = [
    'unknown field',
    'seed',
    'INVALID_ARGUMENT',
    'not supported'
  ]
  const lowerError = errorText.toLowerCase()
  return seedErrorPatterns.some(pattern => lowerError.includes(pattern.toLowerCase()))
}

export async function generateImageWithGemini(
  request: GeminiImageRequest
): Promise<GeminiImageResponse> {
  const apiKey = getApiKey()
  if (!apiKey) {
    return { success: false, error: 'GEMINI_API_KEY not configured' }
  }
  
  const { prompt, imageData, mimeType, model, imageSize = '1024x1024', seed } = request
  const includeSeed = seed !== null && seed !== undefined
  
  try {
    console.log('[GeminiClient] Starting image generation...')
    let response = await makeImageGenerationRequest(
      model, prompt, imageData, mimeType, imageSize, seed ?? null, includeSeed
    )
    
    if (!response.ok) {
      const errorText = await response.text()
      console.log('[GeminiClient] First attempt failed:', errorText)
      
      if (includeSeed && isSeedRejectionError(errorText)) {
        console.log('[GeminiClient] Seed rejected, retrying without seed...')
        response = await makeImageGenerationRequest(
          model, prompt, imageData, mimeType, imageSize, null, false
        )
        
        if (!response.ok) {
          const retryErrorText = await response.text()
          return { 
            success: false, 
            error: `API error ${response.status}: ${retryErrorText}`,
            seedRejected: true
          }
        }
        
        const data = await response.json()
        const result = parseImageResponse(data)
        return { ...result, seedRejected: true }
      }
      
      return { success: false, error: `API error ${response.status}: ${errorText}` }
    }
    
    const data = await response.json()
    return parseImageResponse(data)
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[GeminiClient] Error:', message)
    return { success: false, error: message }
  }
}

function parseImageResponse(data: Record<string, unknown>): GeminiImageResponse {
  console.log('[GeminiClient] Parsing response...')
  
  const candidates = data.candidates as Array<Record<string, unknown>> | undefined
  if (!candidates || candidates.length === 0) {
    console.log('[GeminiClient] No candidates in response')
    return { success: false, error: 'No response candidates' }
  }
  
  const content = candidates[0].content as Record<string, unknown> | undefined
  const parts = content?.parts as Array<Record<string, unknown>> | undefined
  if (!parts) {
    console.log('[GeminiClient] No parts in response')
    return { success: false, error: 'No content parts' }
  }
  
  for (const part of parts) {
    const inlineData = part.inlineData as Record<string, string> | undefined
    if (inlineData) {
      console.log('[GeminiClient] Found image data, mimeType:', inlineData.mimeType)
      return {
        success: true,
        imageData: inlineData.data,
        mimeType: inlineData.mimeType
      }
    }
  }
  
  const textPart = parts.find(p => 'text' in p) as Record<string, string> | undefined
  if (textPart?.text) {
    console.log('[GeminiClient] Model returned text instead of image')
    return { success: false, error: `Model returned text instead of image: ${textPart.text.slice(0, 200)}` }
  }
  
  return { success: false, error: 'No image in response' }
}
