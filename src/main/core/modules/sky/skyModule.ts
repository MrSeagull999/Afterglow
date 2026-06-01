import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import sharp from 'sharp'
import { getSettings } from '../../settings'
import { getResolvedImageProvider } from '../../providers/providerRouter'
import { generateSeed } from '../../gemini/geminiClient'

export interface SkyParams {
  prompt: string
  aspectRatio?: string  // '16:9' | '4:3' | '3:2' | '1:1' — default '16:9'
  model?: string
  referenceImage?: {
    base64: string
    mimeType: string
    name?: string
  }
}

export interface SkyResult {
  success: boolean
  outputPath?: string
  imageData?: string  // base64 — returned so renderer can display without file:// issues
  mimeType?: string
  error?: string
}

/**
 * Generates a standalone full-frame sky photograph from an optional reference image.
 * No source photo required — purely text-to-image with optional mood reference.
 * Saves the result to ~/Pictures/Afterglow Generated/sky/ and returns the path + base64.
 */
export async function generateSkyImage(params: SkyParams): Promise<SkyResult> {
  const settings = await getSettings()
  const model = params.model || settings.previewImageModel || settings.previewModel

  const { provider } = await getResolvedImageProvider(model)

  if (!provider.isConfigured()) {
    return { success: false, error: 'Image provider is not configured. Check your API key in Settings.' }
  }

  const seed = settings.useSeed ? generateSeed() : null

  console.log(`[Sky] Generation request — model: ${model}, aspectRatio: ${params.aspectRatio || '16:9'}, hasRef: ${!!params.referenceImage}`)

  const referenceImages = params.referenceImage
    ? [{
        imageData: params.referenceImage.base64,
        mimeType: params.referenceImage.mimeType,
        role: `Reference image — match the mood, colours, and atmosphere of this image`
      }]
    : undefined

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

  const outputDir = join(app.getPath('pictures'), 'Afterglow Generated', 'sky')
  await mkdir(outputDir, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `sky_${timestamp}.png`
  const outputPath = join(outputDir, filename)

  const buffer = Buffer.from(response.imageData, 'base64')
  await sharp(buffer).png().toFile(outputPath)

  console.log(`[Sky] Saved to: ${outputPath}`)

  return {
    success: true,
    outputPath,
    imageData: response.imageData,
    mimeType: 'image/png'
  }
}
