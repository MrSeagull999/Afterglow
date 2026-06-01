import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import sharp from 'sharp'
import { getSettings } from '../../settings'
import { getResolvedImageProvider } from '../../providers/providerRouter'
import { generateSeed } from '../../gemini/geminiClient'

export interface ImageGenReferenceImage {
  base64: string
  mimeType: string
  name?: string
}

export interface ImageGenParams {
  prompt: string
  aspectRatio?: string
  model?: string
  /** Reference images from the chat session — passed to Gemini alongside the prompt */
  referenceImages?: ImageGenReferenceImage[]
}

export interface ImageGenResult {
  success: boolean
  outputPath?: string
  imageData?: string   // base64 — returned so renderer can display without file:// issues
  mimeType?: string
  error?: string
}

/**
 * Generates an image from a text prompt, with optional reference images.
 * No source photo required — purely text-to-image (with optional composition references).
 * Saves the result to ~/Pictures/Afterglow Generated/ and returns the path + base64.
 */
export async function generateImageFromPrompt(params: ImageGenParams): Promise<ImageGenResult> {
  const settings = await getSettings()
  const model = params.model || settings.previewImageModel || settings.previewModel

  const { provider } = await getResolvedImageProvider(model)

  if (!provider.isConfigured()) {
    return { success: false, error: 'Image provider is not configured. Check your API key in Settings.' }
  }

  const seed = settings.useSeed ? generateSeed() : null

  const refCount = params.referenceImages?.length || 0
  console.log(`[ImageGen] Text-to-image request — model: ${model}, aspectRatio: ${params.aspectRatio || '16:9'}, refs: ${refCount}`)

  // Convert reference images to the provider format
  const referenceImages = params.referenceImages?.map((img, i) => ({
    imageData: img.base64,
    mimeType: img.mimeType,
    role: `Image ${i + 1}${img.name ? ` (${img.name})` : ''} — reference provided by user for composition`
  }))

  const response = await provider.generateImage({
    prompt: params.prompt,
    // No source imageData — text-to-image mode
    model,
    aspectRatio: params.aspectRatio || '16:9',
    imageSize: '1024x1024',
    seed,
    referenceImages: referenceImages && referenceImages.length > 0 ? referenceImages : undefined
  })

  if (!response.success || !response.imageData) {
    return { success: false, error: response.error || 'Generation failed' }
  }

  // Save to ~/Pictures/Afterglow Generated/
  const outputDir = join(app.getPath('pictures'), 'Afterglow Generated')
  await mkdir(outputDir, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `afterglow_${timestamp}.png`
  const outputPath = join(outputDir, filename)

  const buffer = Buffer.from(response.imageData, 'base64')
  await sharp(buffer).png().toFile(outputPath)

  console.log(`[ImageGen] Saved to: ${outputPath}`)

  return {
    success: true,
    outputPath,
    imageData: response.imageData,
    mimeType: 'image/png'
  }
}
