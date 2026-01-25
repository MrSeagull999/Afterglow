export interface ReferenceImageInput {
  imageData: string
  mimeType: string
  role: string  // e.g., "lighting reference", "style reference"
}

export interface ImageGenerationRequest {
  model: string
  prompt: string
  imageData: string
  mimeType: string
  imageSize?: '1024x1024' | '1536x1536' | '2048x2048' | '4K'
  aspectRatio?: '16:9' | '4:3' | '1:1' | string
  seed?: number | null
  priorityMode?: boolean
  referenceImages?: ReferenceImageInput[]
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
