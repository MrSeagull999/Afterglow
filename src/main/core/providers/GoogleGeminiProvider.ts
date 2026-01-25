import type { IImageProvider, ImageGenerationRequest, ImageGenerationResponse } from './IImageProvider'

export class GoogleGeminiProvider implements IImageProvider {
  name = 'google'
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey !== 'your_gemini_api_key_here'
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Google API key not configured' }
    }

    const { prompt, imageData, mimeType, model, imageSize = '1024x1024', aspectRatio, seed, referenceImages } = request
    const includeSeed = seed !== null && seed !== undefined

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
      console.log(`[GoogleGeminiProvider] Generating with model: ${model}`)
      console.log(`[GoogleGeminiProvider] Endpoint: ${endpoint}`)
      console.log(`[GoogleGeminiProvider] Provider: google`)
      console.log(`[GoogleGeminiProvider] Image size: ${imageSize}`)
      if (aspectRatio) {
        console.log(`[GoogleGeminiProvider] Aspect ratio: ${aspectRatio}`)
      }
      if (referenceImages && referenceImages.length > 0) {
        console.log(`[GoogleGeminiProvider] Reference images: ${referenceImages.length}`)
      }
      
      let response = await this.makeRequest(model, prompt, imageData, mimeType, imageSize, aspectRatio, seed ?? null, includeSeed, referenceImages)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.log('[GoogleGeminiProvider] First attempt failed:', errorText)
        
        // Retry without seed if seed was rejected
        if (includeSeed && this.isSeedRejectionError(errorText)) {
          console.log('[GoogleGeminiProvider] Seed rejected, retrying without seed...')
          response = await this.makeRequest(model, prompt, imageData, mimeType, imageSize, aspectRatio, null, false, referenceImages)
          
          if (!response.ok) {
            const retryErrorText = await response.text()
            return { 
              success: false, 
              error: `API error ${response.status}: ${retryErrorText}`,
              seedRejected: true
            }
          }
          
          const data = await response.json()
          const result = this.parseResponse(data)
          return { 
            ...result, 
            seedRejected: true,
            providerMeta: {
              provider: 'google',
              model
            }
          }
        }
        
        return { success: false, error: `API error ${response.status}: ${errorText}` }
      }
      
      const data = await response.json()
      const result = this.parseResponse(data)
      return {
        ...result,
        providerMeta: {
          provider: 'google',
          model
        }
      }
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[GoogleGeminiProvider] Error:', message)
      if (error instanceof Error) {
        console.error('[GoogleGeminiProvider] Error details:', {
          name: error.name,
          message: error.message,
          cause: (error as any).cause,
          code: (error as any).code
        })
      }
      return { success: false, error: message }
    }
  }

  private async makeRequest(
    model: string,
    prompt: string,
    imageData: string,
    mimeType: string,
    imageSize: string,
    aspectRatio: string | undefined,
    seed: number | null,
    includeSeed: boolean,
    referenceImages?: Array<{ imageData: string; mimeType: string; role: string }>
  ): Promise<Response> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`
    
    // Set timeout based on image size - 4K takes much longer, especially with complex prompts
    const timeoutMs = imageSize === '4K' ? 600000 : 120000 // 10 min for 4K, 2 min for others
    
    const generationConfig: Record<string, unknown> = {
      responseModalities: ['IMAGE']
    }
    
    if (includeSeed && seed !== null) {
      generationConfig.seed = seed
    }

    // Configure image output size via imageConfig
    // Gemini API imageSize values: "1K", "2K", "4K" (only supported on gemini-3-pro-image-preview)
    // Map our internal sizes to Gemini API values
    const imageConfig: Record<string, string> = {}
    
    // Map internal size values to Gemini API format
    let geminiImageSize: string | null = null
    if (imageSize === '4K') {
      geminiImageSize = '4K'
    } else if (imageSize === '1536x1536' || imageSize === '2K') {
      // HQ Preview - use 2K resolution
      geminiImageSize = '2K'
    } else if (imageSize === '1024x1024' || imageSize === '1K') {
      // Standard Preview - use 1K resolution
      geminiImageSize = '1K'
    }
    
    // imageSize is only supported on gemini-3-pro-image-preview
    const supportsImageSize = model.includes('gemini-3')
    
    if (supportsImageSize && geminiImageSize) {
      imageConfig.imageSize = geminiImageSize
      console.log(`[GoogleGeminiProvider] Using imageSize: ${geminiImageSize}`)
    }
    
    if (aspectRatio) {
      imageConfig.aspectRatio = aspectRatio
    } else if (geminiImageSize === '4K') {
      // 4K requires aspect ratio
      imageConfig.aspectRatio = '16:9'
    }
    
    if (Object.keys(imageConfig).length > 0) {
      generationConfig.imageConfig = imageConfig
      console.log(`[GoogleGeminiProvider] imageConfig:`, JSON.stringify(imageConfig))
    }

    // Build parts array with prompt, source image, and optional reference images
    // For multi-image composition with Nano Banana Pro:
    // - Image 1: source photograph to enhance
    // - Image 2+: reference images with role assignments
    const parts: Array<Record<string, unknown>> = []

    // Build prompt with reference image role assignments if present
    let fullPrompt = prompt
    if (referenceImages && referenceImages.length > 0) {
      const roleAssignments = [
        'Image 1: source photograph to enhance - preserve all architectural elements and composition'
      ]
      referenceImages.forEach((ref, index) => {
        roleAssignments.push(`Image ${index + 2}: ${ref.role}`)
      })
      fullPrompt = `${roleAssignments.join('\n')}\n\n${prompt}`
      console.log(`[GoogleGeminiProvider] Using ${referenceImages.length} reference image(s)`)
    }

    parts.push({ text: fullPrompt })
    
    // Add source image (Image 1)
    parts.push({
      inlineData: {
        mimeType: mimeType,
        data: imageData
      }
    })

    // Add reference images (Image 2+)
    if (referenceImages && referenceImages.length > 0) {
      for (const ref of referenceImages) {
        parts.push({
          inlineData: {
            mimeType: ref.mimeType,
            data: ref.imageData
          }
        })
      }
    }
    
    const body = {
      contents: [{
        role: 'user',
        parts
      }],
      generationConfig
    }
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeoutMs / 1000}s`)
      }
      throw error
    }
  }

  private isSeedRejectionError(errorText: string): boolean {
    const seedErrorPatterns = [
      'unknown field',
      'seed',
      'INVALID_ARGUMENT',
      'not supported'
    ]
    const lowerError = errorText.toLowerCase()
    return seedErrorPatterns.some(pattern => lowerError.includes(pattern.toLowerCase()))
  }

  private parseResponse(data: Record<string, unknown>): ImageGenerationResponse {
    const candidates = data.candidates as Array<Record<string, unknown>> | undefined
    if (!candidates || candidates.length === 0) {
      return { success: false, error: 'No response candidates' }
    }
    
    const content = candidates[0].content as Record<string, unknown> | undefined
    const parts = content?.parts as Array<Record<string, unknown>> | undefined
    if (!parts) {
      return { success: false, error: 'No content parts' }
    }
    
    for (const part of parts) {
      const inlineData = part.inlineData as Record<string, string> | undefined
      if (inlineData) {
        return {
          success: true,
          imageData: inlineData.data,
          mimeType: inlineData.mimeType
        }
      }
    }
    
    const textPart = parts.find(p => 'text' in p) as Record<string, string> | undefined
    if (textPart?.text) {
      return { success: false, error: `Model returned text instead of image: ${textPart.text.slice(0, 200)}` }
    }
    
    return { success: false, error: 'No image in response' }
  }
}
