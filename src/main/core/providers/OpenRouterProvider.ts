import type { IImageProvider, ImageGenerationRequest, ImageGenerationResponse } from './IImageProvider'

/**
 * OpenRouter Provider
 * 
 * Routes Gemini image generation requests through OpenRouter's API.
 * Uses OpenAI-compatible API format with synchronous request/response.
 * 
 * Base URL: https://openrouter.ai/api/v1
 * Authorization: Bearer token
 * Model: Passed directly (e.g., "gemini-3-pro-image-preview")
 */
export class OpenRouterProvider implements IImageProvider {
  name = 'openrouter'
  private apiKey: string
  private baseUrl: string

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey
    this.baseUrl = baseUrl || 'https://openrouter.ai/api/v1'
  }

  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.length > 0
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    if (!this.isConfigured()) {
      return { success: false, error: 'OpenRouter API key not configured' }
    }

    const { prompt, imageData, mimeType, model, imageSize = '1024x1024', seed } = request

    try {
      const url = `${this.baseUrl}/chat/completions`
      console.log(`[OpenRouterProvider] Generating with model: ${model}`)
      console.log(`[OpenRouterProvider] Image size: ${imageSize}`)
      console.log(`[OpenRouterProvider] Provider: openrouter`)
      console.log(`[OpenRouterProvider] Endpoint: ${url}`)
      
      // OpenRouter uses OpenAI-compatible format
      
      const body: Record<string, any> = {
        model: model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${imageData}`
                }
              }
            ]
          }
        ],
        // Request image generation
        response_format: { type: 'image' },
        max_tokens: 1000
      }

      // Add seed if provided
      if (seed !== null && seed !== undefined) {
        body.seed = seed
      }

      console.log(`[OpenRouterProvider] Request URL: ${url}`)
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://afterglow.studio',
          'X-Title': 'Afterglow Studio'
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[OpenRouterProvider] API error:', errorText)
        return { success: false, error: `API error ${response.status}: ${errorText}` }
      }

      const data = await response.json()
      const result = this.parseResponse(data)
      
      return {
        ...result,
        providerMeta: {
          provider: 'openrouter',
          model,
          baseUrl: this.baseUrl
        }
      }
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[OpenRouterProvider] Error:', message)
      return { success: false, error: message }
    }
  }

  private parseResponse(data: Record<string, unknown>): ImageGenerationResponse {
    // OpenAI-compatible response format
    const choices = data.choices as Array<Record<string, unknown>> | undefined
    
    if (!choices || choices.length === 0) {
      return { success: false, error: 'No choices in response' }
    }

    const message = choices[0].message as Record<string, unknown> | undefined
    const content = message?.content as string | undefined
    
    if (!content) {
      return { success: false, error: 'No content in response' }
    }

    // Check if content is base64 image data
    if (content.startsWith('data:image/')) {
      // Extract base64 data
      const matches = content.match(/^data:image\/(\w+);base64,(.+)$/)
      if (matches) {
        return {
          success: true,
          imageData: matches[2],
          mimeType: `image/${matches[1]}`
        }
      }
    }

    // If content is already base64 without prefix
    if (this.isBase64(content)) {
      return {
        success: true,
        imageData: content,
        mimeType: 'image/png'
      }
    }

    return { success: false, error: 'Invalid image format in response' }
  }

  private isBase64(str: string): boolean {
    try {
      return Buffer.from(str, 'base64').toString('base64') === str
    } catch {
      return false
    }
  }
}
