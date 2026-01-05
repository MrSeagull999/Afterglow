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

    const { prompt, imageData, mimeType, model, imageSize = '1024x1024', seed } = request
    const includeSeed = seed !== null && seed !== undefined

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
      console.log(`[GoogleGeminiProvider] Generating with model: ${model}`)
      console.log(`[GoogleGeminiProvider] Endpoint: ${endpoint}`)
      console.log(`[GoogleGeminiProvider] Provider: google`)
      
      let response = await this.makeRequest(model, prompt, imageData, mimeType, imageSize, seed ?? null, includeSeed)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.log('[GoogleGeminiProvider] First attempt failed:', errorText)
        
        // Retry without seed if seed was rejected
        if (includeSeed && this.isSeedRejectionError(errorText)) {
          console.log('[GoogleGeminiProvider] Seed rejected, retrying without seed...')
          response = await this.makeRequest(model, prompt, imageData, mimeType, imageSize, null, false)
          
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
      return { success: false, error: message }
    }
  }

  private async makeRequest(
    model: string,
    prompt: string,
    imageData: string,
    mimeType: string,
    imageSize: string,
    seed: number | null,
    includeSeed: boolean
  ): Promise<Response> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`
    
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
    
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
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
