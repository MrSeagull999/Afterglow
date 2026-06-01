import { readFile } from 'fs/promises'
import { join, basename } from 'path'
import sharp from 'sharp'
import { generateImageWithGemini, generateSeed, ImageModel } from './geminiClient'
import { getPreset } from '../promptBank'
import { getRun, updateRun, updateImageStatus, setImagePreviewPath } from '../runStore'
import { saveImageWithExifHandling } from '../exif'
import { getSettings } from '../settings'
import { assembleTwilightPrompt } from '../lightingModifiers'

export interface PreviewResult {
  imagePath: string
  success: boolean
  previewPath?: string
  error?: string
  seed?: number | null
  seedRejected?: boolean
}

export async function generatePreview(
  params: {
    runId: string
    imagePath: string
    presetId: string
    customPrompt?: string
  },
  onProgress?: (progress: number) => void
): Promise<PreviewResult> {
  const { runId, imagePath, presetId, customPrompt } = params
  
  try {
    console.log('[PreviewGen] Starting:', imagePath)
    onProgress?.(10)
    
    console.log('[PreviewGen] Updating status to preview_generating')
    await updateImageStatus(runId, imagePath, 'preview_generating')
    
    console.log('[PreviewGen] Getting run:', runId)
    const run = await getRun(runId)
    if (!run) {
      throw new Error(`Run not found: ${runId}`)
    }
    
    console.log('[PreviewGen] Getting preset:', presetId)
    const preset = await getPreset(presetId)
    if (!preset) {
      throw new Error(`Preset not found: ${presetId}`)
    }
    
    const settings = await getSettings()
    
    onProgress?.(20)
    
    console.log('[PreviewGen] Reading image file')
    const imageBuffer = await readFile(imagePath)
    const metadata = await sharp(imageBuffer).metadata()
    console.log('[PreviewGen] Image size:', metadata.width, 'x', metadata.height)
    
    const targetWidth = preset.settings.previewWidth || 1536
    let resizedBuffer = imageBuffer
    
    if (metadata.width && metadata.width > targetWidth) {
      console.log('[PreviewGen] Resizing to', targetWidth)
      resizedBuffer = await sharp(imageBuffer)
        .resize(targetWidth, null, { withoutEnlargement: true })
        .toBuffer()
    }
    
    onProgress?.(40)
    
    console.log('[PreviewGen] Converting to base64')
    const base64Image = resizedBuffer.toString('base64')
    const mimeType = getMimeType(imagePath)
    console.log('[PreviewGen] Image size:', Math.round(base64Image.length / 1024), 'KB')
    
    onProgress?.(50)
    
    // Assemble prompt with lighting modifier
    const lightingCondition = run.lightingCondition || settings.defaultLightingCondition
    const finalPrompt = assembleTwilightPrompt(
      preset.promptTemplate,
      lightingCondition,
      customPrompt
    )
    
    console.log('[PreviewGen] Lighting condition:', lightingCondition)
    
    // Determine seed based on settings
    let seed: number | null = null
    if (settings.useSeed) {
      if (settings.seedStrategy === 'fixedPerRun' && settings.fixedRunSeed !== null) {
        seed = settings.fixedRunSeed
      } else {
        seed = generateSeed()
      }
    }
    
    const previewModel = settings.previewModel as ImageModel
    console.log('[PreviewGen] Using model:', previewModel)
    console.log('[PreviewGen] Seed:', seed !== null ? seed : 'disabled')
    
    console.log('[PreviewGen] Calling Gemini IMAGE API...')
    const response = await generateImageWithGemini({
      prompt: finalPrompt,
      imageData: base64Image,
      mimeType,
      model: previewModel,
      imageSize: '1024x1024',
      seed
    })
    console.log('[PreviewGen] Gemini API response:', response.success ? 'SUCCESS' : 'FAILED')
    if (!response.success) {
      console.log('[PreviewGen] Error details:', response.error)
    }
    
    // Handle seed rejection
    if (response.seedRejected) {
      console.log('[PreviewGen] Seed was rejected by API, updating run metadata')
      await updateRun(runId, { seedSupported: false })
    }
    
    onProgress?.(80)
    
    if (!response.success || !response.imageData) {
      await updateImageStatus(runId, imagePath, 'error', response.error)
      return {
        imagePath,
        success: false,
        error: response.error || 'Failed to generate preview',
        seedRejected: response.seedRejected
      }
    }
    
    const outputBuffer = Buffer.from(response.imageData, 'base64')
    const outputFormat = settings.outputFormat === 'jpeg' ? 'jpeg' : 'png'
    const ext = outputFormat === 'jpeg' ? '.jpg' : '.png'
    
    const previewFileName = `${basename(imagePath, getExtension(imagePath))}_preview${ext}`
    const previewPath = join(run.outputDir, '_previews', previewFileName)
    
    await saveImageWithExifHandling(
      outputBuffer,
      previewPath,
      settings.keepExif,
      outputFormat
    )
    
    await setImagePreviewPath(runId, imagePath, previewPath)
    
    // Update image with seed and model info
    const updatedImages = run.images.map(img => {
      if (img.path === imagePath) {
        return {
          ...img,
          status: 'preview_ready' as const,
          previewPath,
          previewSeed: response.seedRejected ? null : seed,
          previewModel: previewModel,
          previewGeneratedAt: new Date().toISOString()
        }
      }
      return img
    })
    await updateRun(runId, { images: updatedImages })
    
    onProgress?.(100)
    
    return {
      imagePath,
      success: true,
      previewPath,
      seed: response.seedRejected ? null : seed,
      seedRejected: response.seedRejected
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[PreviewGen] Error:', errorMessage)
    await updateImageStatus(runId, imagePath, 'error', errorMessage)
    return {
      imagePath,
      success: false,
      error: errorMessage
    }
  }
}

export async function generatePreviewBatch(
  params: {
    runId: string
    images: Array<{ path: string; presetId: string }>
  },
  onProgress?: (imagePath: string, progress: number, result?: PreviewResult) => void
): Promise<PreviewResult[]> {
  const results: PreviewResult[] = []
  const settings = await getSettings()
  const concurrency = settings.concurrentPreviews || 3
  
  const chunks: Array<Array<{ path: string; presetId: string }>> = []
  for (let i = 0; i < params.images.length; i += concurrency) {
    chunks.push(params.images.slice(i, i + concurrency))
  }
  
  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(async (img) => {
        const result = await generatePreview(
          {
            runId: params.runId,
            imagePath: img.path,
            presetId: img.presetId
          },
          (progress) => onProgress?.(img.path, progress)
        )
        onProgress?.(img.path, 100, result)
        return result
      })
    )
    results.push(...chunkResults)
  }
  
  return results
}

function getMimeType(filePath: string): string {
  const ext = getExtension(filePath).toLowerCase()
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    case '.gif':
      return 'image/gif'
    default:
      return 'image/jpeg'
  }
}

function getExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.')
  return lastDot >= 0 ? filePath.slice(lastDot) : ''
}
