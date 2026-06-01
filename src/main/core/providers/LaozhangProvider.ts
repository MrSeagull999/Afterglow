import type { IImageProvider, ImageGenerationRequest, ImageGenerationResponse } from './IImageProvider'

/**
 * @deprecated This provider is no longer used and should not be selected at runtime.
 * 
 * Deprecated due to payment processing and compliance constraints.
 * Replaced by OpenRouterProvider which provides better routing and reliability.
 * 
 * This code is kept for reference only and is not accessible through the provider router.
 */
export class LaozhangProvider implements IImageProvider {
  name = 'laozhang'
  private apiKey: string
  private baseUrl = 'https://api.laozhang.com/v1'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.length > 0
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Laozhang API key not configured' }
    }

    const { prompt, imageData, mimeType, model, imageSize = '1024x1024', seed, priorityMode = false } = request

    try {
      console.log(`[LaozhangProvider] Generating with model: ${model}, priority: ${priorityMode}`)
      
      // Laozhang uses OpenAI-compatible API format
      // Priority mode: If supported by the provider, use priority endpoint or parameter
      // Fallback: If priority not supported, make synchronous call and wait for completion
      const endpoint = priorityMode ? '/images/generations/priority' : '/images/generations'
      const url = `${this.baseUrl}${endpoint}`
      
      const body: Record<string, any> = {
        model: model,
        prompt: prompt,
        image: `data:${mimeType};base64,${imageData}`,
        size: imageSize,
        n: 1,
        response_format: 'b64_json'
      }

      // Add seed if provided
      if (seed !== null && seed !== undefined) {
        body.seed = seed
      }

      // Priority mode parameter (if supported by API)
      // Note: If the API doesn't support priority parameter, this will be ignored
      // and we rely on synchronous behavior (waiting for completion)
      if (priorityMode) {
        body.priority = 'high'
      }

      console.log(`[LaozhangProvider] Request URL: ${url}`)
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[LaozhangProvider] API error:', errorText)
        
        // If priority endpoint not found, fallback to standard endpoint
        if (response.status === 404 && priorityMode) {
          console.log('[LaozhangProvider] Priority endpoint not found, falling back to standard endpoint')
          return this.generateImage({ ...request, priorityMode: false })
        }
        
        return { success: false, error: `API error ${response.status}: ${errorText}` }
      }

      const data = await response.json()
      const result = this.parseResponse(data)
      
      return {
        ...result,
        providerMeta: {
          provider: 'laozhang',
          model,
          priorityUsed: priorityMode,
          // Note: Priority mode behavior depends on provider API support
          // If priority endpoint/parameter not available, synchronous call is used
          priorityNote: priorityMode 
            ? 'Priority mode requested - using priority endpoint if available, otherwise synchronous'
            : 'Standard mode'
        }
      }
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[LaozhangProvider] Error:', message)
      return { success: false, error: message }
    }
  }

  private parseResponse(data: Record<string, unknown>): ImageGenerationResponse {
    // OpenAI-compatible response format
    const dataArray = data.data as Array<Record<string, unknown>> | undefined
    
    if (!dataArray || dataArray.length === 0) {
      return { success: false, error: 'No image data in response' }
    }

    const imageData = dataArray[0].b64_json as string | undefined
    
    if (!imageData) {
      return { success: false, error: 'No base64 image data found' }
    }

    return {
      success: true,
      imageData: imageData,
      mimeType: 'image/png' // Default for generated images
    }
  }
}
