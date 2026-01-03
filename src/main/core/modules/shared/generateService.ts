import { readFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { existsSync } from 'fs'
import sharp from 'sharp'
import { generateImageWithGemini, generateSeed, ImageModel } from '../../gemini/geminiClient'
import { getSettings } from '../../settings'
import { saveImageWithExifHandling } from '../../exif'
import type { Version, ModuleType } from '../../../../shared/types'
import { getVersion, setVersionStatus, setVersionOutput } from '../../store/versionStore'
import { getAsset } from '../../store/assetStore'
import { getJobDirectory } from '../../store/jobStore'

export interface GenerateResult {
  success: boolean
  outputPath?: string
  thumbnailPath?: string
  error?: string
  seed?: number | null
}

export async function generateVersionPreview(
  jobId: string,
  versionId: string,
  onProgress?: (progress: number) => void
): Promise<GenerateResult> {
  try {
    onProgress?.(5)

    const version = await getVersion(jobId, versionId)
    if (!version) {
      throw new Error(`Version not found: ${versionId}`)
    }

    const asset = await getAsset(jobId, version.assetId)
    if (!asset) {
      throw new Error(`Asset not found: ${version.assetId}`)
    }

    // Determine input path
    let inputPath = asset.originalPath
    if (version.sourceVersionIds.length > 0) {
      const sourceVersion = await getVersion(jobId, version.sourceVersionIds[0])
      if (sourceVersion?.outputPath) {
        inputPath = sourceVersion.outputPath
      }
    }

    onProgress?.(10)

    // Read and resize image
    const imageBuffer = await readFile(inputPath)
    const metadata = await sharp(imageBuffer).metadata()

    const settings = await getSettings()
    // Preview resolution: 1536px default (sufficient for module chaining and evaluation)
    // This is the max dimension before sending to Gemini API
    const targetWidth = settings.previewWidth || 1536

    let resizedBuffer: Buffer = imageBuffer as Buffer
    if (metadata.width && metadata.width > targetWidth) {
      resizedBuffer = await sharp(imageBuffer)
        .resize(targetWidth, null, { withoutEnlargement: true })
        .toBuffer() as Buffer
    }

    onProgress?.(30)

    const base64Image = resizedBuffer.toString('base64')
    const mimeType = getMimeType(inputPath)

    // Build full prompt from recipe
    const fullPrompt = version.recipe.settings.fullPrompt as string || version.recipe.basePrompt

    // Determine seed
    let seed: number | null = version.seed ?? null
    if (seed === null && settings.useSeed) {
      seed = generateSeed()
    }

    const model = (version.model || settings.previewModel) as ImageModel

    onProgress?.(40)

    console.log(`[GenerateService] Generating ${version.module} preview for version ${versionId}`)

    const response = await generateImageWithGemini({
      prompt: fullPrompt,
      imageData: base64Image,
      mimeType,
      model,
      imageSize: '1024x1024',
      seed
    })

    onProgress?.(80)

    if (!response.success || !response.imageData) {
      await setVersionStatus(jobId, versionId, 'error', response.error || 'Generation failed')
      return {
        success: false,
        error: response.error || 'Generation failed'
      }
    }

    // Save output
    const outputBuffer = Buffer.from(response.imageData, 'base64')
    const outputFormat = settings.outputFormat === 'jpeg' ? 'jpeg' : 'png'
    const ext = outputFormat === 'jpeg' ? '.jpg' : '.png'

    const jobDir = getJobDirectory(jobId)
    const outputDir = join(jobDir, 'outputs', 'previews')
    const thumbnailDir = join(jobDir, 'outputs', 'thumbnails')

    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true })
    }
    if (!existsSync(thumbnailDir)) {
      await mkdir(thumbnailDir, { recursive: true })
    }

    const outputPath = join(outputDir, `${versionId}${ext}`)
    const thumbnailPath = join(thumbnailDir, `${versionId}_thumb.jpg`)

    await saveImageWithExifHandling(outputBuffer, outputPath, settings.keepExif, outputFormat)

    // Generate thumbnail
    await sharp(outputBuffer)
      .resize(300, 300, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toFile(thumbnailPath)

    onProgress?.(95)

    // Update version
    await setVersionOutput(jobId, versionId, outputPath, thumbnailPath)
    await setVersionStatus(jobId, versionId, 'preview_ready')

    onProgress?.(100)

    return {
      success: true,
      outputPath,
      thumbnailPath,
      seed: response.seedRejected ? null : seed
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[GenerateService] Error:', errorMessage)
    await setVersionStatus(jobId, versionId, 'error', errorMessage)
    return {
      success: false,
      error: errorMessage
    }
  }
}

export async function generateVersionHQPreview(
  jobId: string,
  versionId: string,
  onProgress?: (progress: number) => void
): Promise<GenerateResult> {
  try {
    onProgress?.(5)

    const version = await getVersion(jobId, versionId)
    if (!version) {
      throw new Error(`Version not found: ${versionId}`)
    }

    if (version.status !== 'approved') {
      throw new Error('Version must be approved before generating HQ preview')
    }

    await setVersionStatus(jobId, versionId, 'hq_generating')

    const asset = await getAsset(jobId, version.assetId)
    if (!asset) {
      throw new Error(`Asset not found: ${version.assetId}`)
    }

    let inputPath = asset.originalPath
    if (version.sourceVersionIds.length > 0) {
      const sourceVersion = await getVersion(jobId, version.sourceVersionIds[0])
      if (sourceVersion?.outputPath) {
        inputPath = sourceVersion.outputPath
      }
    }

    onProgress?.(10)

    const imageBuffer = await readFile(inputPath)
    const settings = await getSettings()

    // HQ Preview uses ~3K resolution (between preview and final)
    const targetWidth = (settings as any).hqPreviewWidth || 3000
    const metadata = await sharp(imageBuffer).metadata()

    let resizedBuffer: Buffer = imageBuffer as Buffer
    if (metadata.width && metadata.width > targetWidth) {
      resizedBuffer = await sharp(imageBuffer)
        .resize(targetWidth, null, { withoutEnlargement: true })
        .toBuffer() as Buffer
    }

    onProgress?.(30)

    const base64Image = resizedBuffer.toString('base64')
    const mimeType = getMimeType(inputPath)

    const fullPrompt = version.recipe.settings.fullPrompt as string || version.recipe.basePrompt

    const seed = version.seed ?? null
    const model = ((settings as any).hqPreviewModel || settings.previewModel) as ImageModel

    onProgress?.(40)

    console.log(`[GenerateService] Generating ${version.module} HQ preview for version ${versionId}`)

    const response = await generateImageWithGemini({
      prompt: fullPrompt,
      imageData: base64Image,
      mimeType,
      model,
      imageSize: '1536x1536',
      seed
    })

    onProgress?.(80)

    if (!response.success || !response.imageData) {
      await setVersionStatus(jobId, versionId, 'error', response.error || 'HQ generation failed')
      return {
        success: false,
        error: response.error || 'HQ generation failed'
      }
    }

    const outputBuffer = Buffer.from(response.imageData, 'base64')
    const outputFormat = settings.outputFormat === 'jpeg' ? 'jpeg' : 'png'
    const ext = outputFormat === 'jpeg' ? '.jpg' : '.png'

    const jobDir = getJobDirectory(jobId)
    const outputDir = join(jobDir, 'outputs', 'hq_previews')

    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true })
    }

    const outputPath = join(outputDir, `${versionId}_hq${ext}`)

    await saveImageWithExifHandling(outputBuffer, outputPath, settings.keepExif, outputFormat)

    onProgress?.(95)

    await setVersionOutput(jobId, versionId, outputPath)
    await setVersionStatus(jobId, versionId, 'hq_ready')

    // Update quality tier
    const { updateVersion } = await import('../../store/versionStore')
    await updateVersion(jobId, versionId, { qualityTier: 'hq_preview' })

    onProgress?.(100)

    return {
      success: true,
      outputPath,
      seed
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[GenerateService] HQ error:', errorMessage)
    await setVersionStatus(jobId, versionId, 'error', errorMessage)
    return {
      success: false,
      error: errorMessage
    }
  }
}

export async function generateVersionFinal(
  jobId: string,
  versionId: string,
  onProgress?: (progress: number) => void
): Promise<GenerateResult> {
  try {
    onProgress?.(5)

    const version = await getVersion(jobId, versionId)
    if (!version) {
      throw new Error(`Version not found: ${versionId}`)
    }

    // Allow final generation from approved or hq_ready status
    if (version.status !== 'approved' && version.status !== 'hq_ready') {
      throw new Error('Version must be approved or HQ ready before generating final')
    }

    await setVersionStatus(jobId, versionId, 'final_generating')

    const asset = await getAsset(jobId, version.assetId)
    if (!asset) {
      throw new Error(`Asset not found: ${version.assetId}`)
    }

    // For final, use original resolution
    let inputPath = asset.originalPath
    if (version.sourceVersionIds.length > 0) {
      const sourceVersion = await getVersion(jobId, version.sourceVersionIds[0])
      if (sourceVersion?.outputPath) {
        inputPath = sourceVersion.outputPath
      }
    }

    onProgress?.(10)

    const imageBuffer = await readFile(inputPath)
    const settings = await getSettings()

    // Final resolution: 4000px default (4K quality for client delivery)
    // This is the max dimension before sending to Gemini API
    const targetWidth = settings.finalWidth || 4000
    const metadata = await sharp(imageBuffer).metadata()

    let resizedBuffer: Buffer = imageBuffer as Buffer
    if (metadata.width && metadata.width > targetWidth) {
      resizedBuffer = await sharp(imageBuffer)
        .resize(targetWidth, null, { withoutEnlargement: true })
        .toBuffer() as Buffer
    }

    onProgress?.(30)

    const base64Image = resizedBuffer.toString('base64')
    const mimeType = getMimeType(inputPath)

    const fullPrompt = version.recipe.settings.fullPrompt as string || version.recipe.basePrompt

    // Use same seed as preview if available
    const seed = version.seed ?? null
    const model = (settings.finalModel || 'gemini-3-pro-image-preview') as ImageModel

    onProgress?.(40)

    console.log(`[GenerateService] Generating ${version.module} final for version ${versionId}`)

    const response = await generateImageWithGemini({
      prompt: fullPrompt,
      imageData: base64Image,
      mimeType,
      model,
      imageSize: '2048x2048',
      seed
    })

    onProgress?.(80)

    if (!response.success || !response.imageData) {
      await setVersionStatus(jobId, versionId, 'error', response.error || 'Final generation failed')
      return {
        success: false,
        error: response.error || 'Final generation failed'
      }
    }

    // Save final output
    const outputBuffer = Buffer.from(response.imageData, 'base64')
    const outputFormat = settings.outputFormat === 'jpeg' ? 'jpeg' : 'png'
    const ext = outputFormat === 'jpeg' ? '.jpg' : '.png'

    const jobDir = getJobDirectory(jobId)
    const outputDir = join(jobDir, 'outputs', 'finals')

    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true })
    }

    const outputPath = join(outputDir, `${versionId}_final${ext}`)

    await saveImageWithExifHandling(outputBuffer, outputPath, settings.keepExif, outputFormat)

    onProgress?.(95)

    await setVersionOutput(jobId, versionId, outputPath)
    await setVersionStatus(jobId, versionId, 'final_ready')

    onProgress?.(100)

    return {
      success: true,
      outputPath,
      seed
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[GenerateService] Final error:', errorMessage)
    await setVersionStatus(jobId, versionId, 'error', errorMessage)
    return {
      success: false,
      error: errorMessage
    }
  }
}

function getMimeType(filePath: string): string {
  const ext = filePath.toLowerCase().split('.').pop() || ''
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    default:
      return 'image/jpeg'
  }
}
