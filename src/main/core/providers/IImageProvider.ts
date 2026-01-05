export interface ImageGenerationRequest {
  model: string
  prompt: string
  imageData: string
  mimeType: string
  imageSize?: '1024x1024' | '1536x1536' | '2048x2048'
  seed?: number | null
  priorityMode?: boolean
}

export interface ImageGenerationResponse {
  success: boolean
  imageData?: string
  mimeType?: string
  error?: string
  seedRejected?: boolean
  providerMeta?: {
    provider: string
    model: string
    priorityUsed?: boolean
    [key: string]: any
  }
}

export interface IImageProvider {
  name: string
  generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse>
  isConfigured(): boolean
}
