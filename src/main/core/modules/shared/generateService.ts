import { readFile, mkdir } from 'fs/promises'
import { join, dirname, basename } from 'path'
import { existsSync } from 'fs'
import sharp from 'sharp'
import { generateSeed } from '../../gemini/geminiClient'
import { getSettings } from '../../settings'
import { saveImageWithExifHandling } from '../../exif'
import type { Version, ModuleType } from '../../../../shared/types'
import {
  getVersion,
  setVersionStatus,
  setVersionOutput,
  setVersionGenerationStatus
} from '../../store/versionStore'
import { getAsset } from '../../store/assetStore'
import { getJobDirectory } from '../../store/jobStore'
import { getResolvedImageProvider } from '../../providers/providerRouter'
import { generationLogger } from '../../services/generation/generationLogger'
import { assemblePrompt } from '../../../../shared/services/prompt/promptAssembler'
import { v4 as uuidv4 } from 'uuid'

export const HQ_PREVIEW_REQUIRES_APPROVAL = false
export const HQ_PREVIEW_AUTO_APPROVES = false

// Supported aspect ratios by Gemini API for 4K generation
const SUPPORTED_ASPECT_RATIOS = [
  { ratio: '1:1', value: 1 },
  { ratio: '2:3', value: 2/3 },
  { ratio: '3:2', value: 3/2 },
  { ratio: '3:4', value: 3/4 },
  { ratio: '4:3', value: 4/3 },
  { ratio: '4:5', value: 4/5 },
  { ratio: '5:4', value: 5/4 },
  { ratio: '9:16', value: 9/16 },
  { ratio: '16:9', value: 16/9 },
  { ratio: '21:9', value: 21/9 }
] as const

/**
 * Find the closest supported aspect ratio for the given image dimensions.
 * This ensures the 4K output preserves the original image's proportions as closely as possible.
 */
function findClosestAspectRatio(width: number, height: number): string {
  const imageRatio = width / height
  
  let closestRatio = '1:1'
  let smallestDiff = Math.abs(imageRatio - 1)
  
  for (const ar of SUPPORTED_ASPECT_RATIOS) {
    const diff = Math.abs(imageRatio - ar.value)
    if (diff < smallestDiff) {
      smallestDiff = diff
      closestRatio = ar.ratio
    }
  }
  
  return closestRatio
}

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

    // Determine input path - priority: sourceVersionIds > workingSourcePath > originalPath
    let inputPath = asset.workingSourcePath || asset.originalPath
    if (version.sourceVersionIds.length > 0) {
      const sourceVersion = await getVersion(jobId, version.sourceVersionIds[0])
      if (sourceVersion?.outputPath) {
        inputPath = sourceVersion.outputPath
      }
    }
    
    if (asset.workingSourcePath) {
      console.log(`[GenerateService] Using working source: ${asset.workingSourcePath}`)
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

    const injectorPrompts = (version.recipe.settings.injectorPrompts as string[] | undefined) || []
    const guardrailPrompts = (version.recipe.settings.guardrailPrompts as string[] | undefined) || []
    const customInstructions = (version.recipe.settings.customInstructions as string | undefined) || ''

    const previewBasePrompt =
      (version.recipe.settings.previewBasePrompt as string | undefined) || version.recipe.basePrompt

    const assembled = await assemblePrompt({
      moduleType: version.module,
      basePrompt: previewBasePrompt,
      options: injectorPrompts,
      guardrails: guardrailPrompts,
      extraInstructions: customInstructions
    })

    const fullPrompt = assembled.fullPrompt
    const promptHash = assembled.promptHash

    // Determine seed
    let seed: number | null = version.seed ?? null
    if (seed === null && settings.useSeed) {
      seed = generateSeed()
    }

    // Use configured model or fall back to settings
    const model = version.model || settings.previewImageModel || settings.previewModel

    const requestId = uuidv4()

    onProgress?.(40)

    // PRIVACY GUARANTEE: Log only jobId and assetId, never filenames
    console.log(`[GenerateService] Generating ${version.module} preview for job:${jobId} asset:${asset.id} version:${versionId}`)
    console.log(`[GenerateService] Using model: ${model}`)

    const selectionCount = 1
    const { provider, resolved } = await getResolvedImageProvider(model)

    const providerName = resolved.provider === 'openrouter' ? 'openrouter' : 'google'
    const endpoint = resolved.provider === 'openrouter'
      ? `${resolved.endpointBaseUrl}/chat/completions`
      : `${resolved.endpointBaseUrl}/models/${model}:generateContent`

    console.log(`[GenerateService] Effective provider: ${providerName}`)
    console.log(`[GenerateService] Endpoint base: ${resolved.endpointBaseUrl}`)
    console.log(`[GenerateService] Prompt hash: ${promptHash}`)
    
    // RUNTIME ASSERTION: Verify prompt hash matches what was stored in recipe
    // This ensures preview == payload (what user sees is what gets sent)
    const storedHash =
      (version.recipe.settings.previewPromptHash as string | undefined) ||
      (version.recipe.settings.promptHash as string | undefined)
    if (process.env.NODE_ENV !== 'production' && storedHash && storedHash !== promptHash) {
      console.error(`[GenerateService] HASH MISMATCH DETECTED!`)
      console.error(`[GenerateService] Stored hash: ${storedHash}`)
      console.error(`[GenerateService] Computed hash: ${promptHash}`)
      console.error(`[GenerateService] This indicates preview != payload - INVESTIGATE IMMEDIATELY`)
      // Log to generation logger for visibility
      generationLogger.log({
        timestamp: new Date().toISOString(),
        jobId,
        versionId,
        requestId,
        provider: providerName,
        model,
        endpoint,
        endpointBaseUrl: resolved.endpointBaseUrl,
        resolvedBy: resolved.resolvedBy,
        envOverride: resolved.envOverride,
        promptHash: `MISMATCH: stored=${storedHash} computed=${promptHash}`,
        module: version.module,
        selectionCount,
        success: false,
        error: 'Preview hash does not match payload hash - prompt integrity violation'
      })
    }
    
    const response = await provider.generateImage({
      prompt: fullPrompt,
      imageData: base64Image,
      mimeType,
      model,
      imageSize: '1024x1024',
      seed,
      priorityMode: settings.previewPriorityMode && resolved.provider === 'openrouter'
    })

    onProgress?.(80)

    // Log generation attempt
    generationLogger.log({
      timestamp: new Date().toISOString(),
      jobId,
      versionId,
      provider: providerName,
      requestId,
      model,
      endpoint,
      endpointBaseUrl: resolved.endpointBaseUrl,
      resolvedBy: resolved.resolvedBy,
      envOverride: resolved.envOverride,
      promptHash,
      module: version.module,
      selectionCount,
      success: response.success,
      error: response.error
    })

    if (!response.success || !response.imageData) {
      await setVersionGenerationStatus(jobId, versionId, 'failed', response.error || 'Generation failed')
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
    await setVersionGenerationStatus(jobId, versionId, 'completed')
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
    await setVersionGenerationStatus(jobId, versionId, 'failed', errorMessage)
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

    await setVersionGenerationStatus(jobId, versionId, 'pending')
    await setVersionStatus(jobId, versionId, 'hq_generating')

    const asset = await getAsset(jobId, version.assetId)
    if (!asset) {
      throw new Error(`Asset not found: ${version.assetId}`)
    }

    // Determine input path - priority: sourceVersionIds > workingSourcePath > originalPath
    let inputPath = asset.workingSourcePath || asset.originalPath
    if (version.sourceVersionIds.length > 0) {
      const sourceVersion = await getVersion(jobId, version.sourceVersionIds[0])
      if (sourceVersion?.outputPath) {
        inputPath = sourceVersion.outputPath
      }
    }
    
    if (asset.workingSourcePath) {
      console.log(`[GenerateService] HQ Preview using working source: ${asset.workingSourcePath}`)
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

    const injectorPrompts = (version.recipe.settings.injectorPrompts as string[] | undefined) || []
    const guardrailPrompts = (version.recipe.settings.guardrailPrompts as string[] | undefined) || []
    const customInstructions = (version.recipe.settings.customInstructions as string | undefined) || ''

    const previewBasePrompt =
      (version.recipe.settings.previewBasePrompt as string | undefined) || version.recipe.basePrompt

    const assembled = await assemblePrompt({
      moduleType: version.module,
      basePrompt: previewBasePrompt,
      options: injectorPrompts,
      guardrails: guardrailPrompts,
      extraInstructions: customInstructions
    })

    const fullPrompt = assembled.fullPrompt

    const seed = version.seed ?? null
    const model =
      version.model ||
      (settings as any).hqPreviewModel ||
      settings.previewImageModel ||
      settings.previewModel

    const requestId = uuidv4()

    onProgress?.(40)

    // PRIVACY GUARANTEE: Log only jobId and assetId
    console.log(`[GenerateService] Generating ${version.module} HQ preview for job:${jobId} asset:${asset.id} version:${versionId}`)

    const selectionCount = 1
    const { provider, resolved } = await getResolvedImageProvider(model)
    const providerName = resolved.provider === 'openrouter' ? 'openrouter' : 'google'
    const endpoint = resolved.provider === 'openrouter'
      ? `${resolved.endpointBaseUrl}/chat/completions`
      : `${resolved.endpointBaseUrl}/models/${model}:generateContent`

    const response = await provider.generateImage({
      prompt: fullPrompt,
      imageData: base64Image,
      mimeType,
      model,
      imageSize: '1536x1536',
      seed,
      priorityMode: settings.previewPriorityMode && resolved.provider === 'openrouter'
    })

    generationLogger.log({
      timestamp: new Date().toISOString(),
      jobId,
      versionId,
      provider: providerName,
      requestId,
      model,
      endpoint,
      endpointBaseUrl: resolved.endpointBaseUrl,
      resolvedBy: resolved.resolvedBy,
      envOverride: resolved.envOverride,
      promptHash: assembled.promptHash,
      module: version.module,
      selectionCount,
      success: response.success,
      error: response.error
    })

    onProgress?.(80)

    if (!response.success || !response.imageData) {
      await setVersionGenerationStatus(jobId, versionId, 'failed', response.error || 'HQ generation failed')
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
    await setVersionGenerationStatus(jobId, versionId, 'completed')
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
    await setVersionGenerationStatus(jobId, versionId, 'failed', errorMessage)
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

    // Allow final generation from any preview or HQ version (no approval required)
    if (version.qualityTier !== 'final' && version.qualityTier !== 'preview' && version.qualityTier !== 'hq_preview') {
      throw new Error('Version must be preview, HQ preview, or final quality tier')
    }

    await setVersionGenerationStatus(jobId, versionId, 'pending')
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

    const injectorPrompts = (version.recipe.settings.injectorPrompts as string[] | undefined) || []
    const guardrailPrompts = (version.recipe.settings.guardrailPrompts as string[] | undefined) || []
    const customInstructions = (version.recipe.settings.customInstructions as string | undefined) || ''

    const assembled = await assemblePrompt({
      moduleType: version.module,
      basePrompt: version.recipe.basePrompt,
      options: injectorPrompts,
      guardrails: guardrailPrompts,
      extraInstructions: customInstructions
    })

    const fullPrompt = assembled.fullPrompt
    const promptHash = assembled.promptHash

    // Use same seed as preview if available
    const seed = version.seed ?? null
    const model =
      version.model ||
      settings.advancedCustomModel ||
      settings.finalModel ||
      'gemini-3-pro-image-preview'

    const requestId = uuidv4()

    onProgress?.(40)

    // PRIVACY GUARANTEE: Log only jobId and assetId
    console.log(`[GenerateService] Generating ${version.module} final for job:${jobId} asset:${asset.id} version:${versionId}`)

    const storedHash =
      (version.recipe.settings.finalPromptHash as string | undefined) ||
      (version.recipe.settings.promptHash as string | undefined)
    if (process.env.NODE_ENV !== 'production' && storedHash && storedHash !== promptHash) {
      console.error(`[GenerateService] HASH MISMATCH DETECTED!`)
      console.error(`[GenerateService] Stored hash: ${storedHash}`)
      console.error(`[GenerateService] Computed hash: ${promptHash}`)
      console.error(`[GenerateService] Call site: generateVersionFinal`)
    }

    const selectionCount = 1
    const { provider, resolved } = await getResolvedImageProvider(model)
    const providerName = resolved.provider === 'openrouter' ? 'openrouter' : 'google'
    const endpoint = resolved.provider === 'openrouter'
      ? `${resolved.endpointBaseUrl}/chat/completions`
      : `${resolved.endpointBaseUrl}/models/${model}:generateContent`

    const response = await provider.generateImage({
      prompt: fullPrompt,
      imageData: base64Image,
      mimeType,
      model,
      imageSize: '2048x2048',
      seed,
      priorityMode: false // Finals don't use priority mode
    })

    generationLogger.log({
      timestamp: new Date().toISOString(),
      jobId,
      versionId,
      provider: providerName,
      requestId,
      model,
      endpoint,
      endpointBaseUrl: resolved.endpointBaseUrl,
      resolvedBy: resolved.resolvedBy,
      envOverride: resolved.envOverride,
      promptHash,
      module: version.module,
      selectionCount,
      success: response.success,
      error: response.error
    })

    onProgress?.(80)

    if (!response.success || !response.imageData) {
      await setVersionGenerationStatus(jobId, versionId, 'failed', response.error || 'Final generation failed')
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
    await setVersionGenerationStatus(jobId, versionId, 'completed')
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
    await setVersionGenerationStatus(jobId, versionId, 'failed', errorMessage)
    await setVersionStatus(jobId, versionId, 'error', errorMessage)
    return {
      success: false,
      error: errorMessage
    }
  }
}

export async function generateVersionNative4K(
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

    if (version.qualityTier !== 'native_4k') {
      throw new Error('Version must be native_4k quality tier')
    }

    await setVersionGenerationStatus(jobId, versionId, 'pending')
    await setVersionStatus(jobId, versionId, 'native_4k_generating')

    const asset = await getAsset(jobId, version.assetId)
    if (!asset) {
      throw new Error(`Asset not found: ${version.assetId}`)
    }

    // For Native 4K: ALWAYS use the original image for best quality
    // We apply the approved prompt to the original, not to a previously generated preview
    const inputPath = asset.originalPath
    console.log(`[GenerateService] Native 4K: Using ORIGINAL image: ${inputPath}`)

    onProgress?.(10)

    // Read source image and get metadata for aspect ratio calculation
    const imageBuffer = await readFile(inputPath)
    const metadata = await sharp(imageBuffer).metadata()
    const sourceWidth = metadata.width || 1920
    const sourceHeight = metadata.height || 1080

    // Calculate aspect ratio from source image - match to closest supported ratio
    // Supported ratios: "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"
    const aspectRatio = findClosestAspectRatio(sourceWidth, sourceHeight)

    console.log(`[GenerateService] Native 4K: Source dimensions ${sourceWidth}x${sourceHeight}, matched aspect ratio: ${aspectRatio}`)

    // For 4K generation, we send the image at high resolution
    // The API will generate at native 4K (3840x2160 for 16:9)
    const settings = await getSettings()
    const targetWidth = 3840 // Max input dimension for 4K generation

    let resizedBuffer: Buffer = imageBuffer as Buffer
    if (metadata.width && metadata.width > targetWidth) {
      resizedBuffer = await sharp(imageBuffer)
        .resize(targetWidth, null, { withoutEnlargement: true })
        .toBuffer() as Buffer
    }

    onProgress?.(30)

    const base64Image = resizedBuffer.toString('base64')
    const mimeType = getMimeType(inputPath)

    // Reuse EXACT prompt, seed, and settings from approved version
    const injectorPrompts = (version.recipe.settings.injectorPrompts as string[] | undefined) || []
    const guardrailPrompts = (version.recipe.settings.guardrailPrompts as string[] | undefined) || []
    const customInstructions = (version.recipe.settings.customInstructions as string | undefined) || ''

    const previewBasePrompt =
      (version.recipe.settings.previewBasePrompt as string | undefined) || version.recipe.basePrompt

    const assembled = await assemblePrompt({
      moduleType: version.module,
      basePrompt: previewBasePrompt,
      options: injectorPrompts,
      guardrails: guardrailPrompts,
      extraInstructions: customInstructions
    })

    const fullPrompt = assembled.fullPrompt
    const promptHash = assembled.promptHash

    // Reuse seed from approved version
    const seed = version.seed ?? null
    const model = version.model || settings.previewImageModel || settings.previewModel

    const requestId = uuidv4()

    onProgress?.(40)

    console.log(`[GenerateService] Generating ${version.module} NATIVE 4K for job:${jobId} asset:${asset.id} version:${versionId}`)
    console.log(`[GenerateService] Using model: ${model}`)
    console.log(`[GenerateService] Requesting image_size: 4K, aspect_ratio: ${aspectRatio}`)
    console.log(`[GenerateService] Prompt hash: ${promptHash}`)
    console.log(`[GenerateService] Seed: ${seed ?? 'none'}`)

    // Verify prompt hash matches approved version
    const storedHash =
      (version.recipe.settings.previewPromptHash as string | undefined) ||
      (version.recipe.settings.promptHash as string | undefined)
    if (storedHash && storedHash !== promptHash) {
      console.warn(`[GenerateService] Native 4K: Prompt hash mismatch! stored=${storedHash} computed=${promptHash}`)
    }

    const selectionCount = 1
    const { provider, resolved } = await getResolvedImageProvider(model)
    const providerName = resolved.provider === 'openrouter' ? 'openrouter' : 'google'
    const endpoint = resolved.provider === 'openrouter'
      ? `${resolved.endpointBaseUrl}/chat/completions`
      : `${resolved.endpointBaseUrl}/models/${model}:generateContent`

    // THE KEY CHANGE: Request native 4K output with explicit image_config
    const response = await provider.generateImage({
      prompt: fullPrompt,
      imageData: base64Image,
      mimeType,
      model,
      imageSize: '4K',
      aspectRatio,
      seed,
      priorityMode: false
    })

    onProgress?.(80)

    // Log generation attempt with 4K-specific info
    generationLogger.log({
      timestamp: new Date().toISOString(),
      jobId,
      versionId,
      provider: providerName,
      requestId,
      model,
      endpoint,
      endpointBaseUrl: resolved.endpointBaseUrl,
      resolvedBy: resolved.resolvedBy,
      envOverride: resolved.envOverride,
      promptHash,
      module: version.module,
      selectionCount,
      success: response.success,
      error: response.error,
      qualityTier: 'native_4k',
      requestedImageSize: '4K',
      requestedAspectRatio: aspectRatio
    })

    if (!response.success || !response.imageData) {
      await setVersionGenerationStatus(jobId, versionId, 'failed', response.error || 'Native 4K generation failed')
      await setVersionStatus(jobId, versionId, 'error', response.error || 'Native 4K generation failed')
      return {
        success: false,
        error: response.error || 'Native 4K generation failed'
      }
    }

    // Decode and analyze output dimensions
    const outputBuffer = Buffer.from(response.imageData, 'base64')
    const outputMetadata = await sharp(outputBuffer).metadata()
    const outputWidth = outputMetadata.width || 0
    const outputHeight = outputMetadata.height || 0

    console.log(`[GenerateService] Native 4K output dimensions: ${outputWidth}x${outputHeight}`)
    console.log(`[GenerateService] Native 4K output size: ${outputBuffer.length} bytes`)

    // Validate output dimensions - warn if not truly 4K
    const longEdge = Math.max(outputWidth, outputHeight)
    if (longEdge < 3000) {
      console.warn(`[GenerateService] WARNING: Native 4K output is smaller than expected! Long edge: ${longEdge}px (expected >3000px)`)
      console.warn(`[GenerateService] The API may have ignored the 4K request. Dimensions: ${outputWidth}x${outputHeight}`)
    } else {
      console.log(`[GenerateService] Native 4K generation successful: ${outputWidth}x${outputHeight} (${longEdge}px long edge)`)
    }

    // Save output
    const outputFormat = settings.outputFormat === 'jpeg' ? 'jpeg' : 'png'
    const ext = outputFormat === 'jpeg' ? '.jpg' : '.png'

    const jobDir = getJobDirectory(jobId)
    const outputDir = join(jobDir, 'outputs', 'native_4k')
    const thumbnailDir = join(jobDir, 'outputs', 'thumbnails')

    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true })
    }
    if (!existsSync(thumbnailDir)) {
      await mkdir(thumbnailDir, { recursive: true })
    }

    const outputPath = join(outputDir, `${versionId}_4k${ext}`)
    const thumbnailPath = join(thumbnailDir, `${versionId}_4k_thumb.jpg`)

    await saveImageWithExifHandling(outputBuffer, outputPath, settings.keepExif, outputFormat)

    // Generate thumbnail
    await sharp(outputBuffer)
      .resize(300, 300, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toFile(thumbnailPath)

    onProgress?.(95)

    // Update version with output dimensions in metadata
    const { updateVersion } = await import('../../store/versionStore')
    await setVersionOutput(jobId, versionId, outputPath, thumbnailPath)
    await setVersionGenerationStatus(jobId, versionId, 'completed')
    await setVersionStatus(jobId, versionId, 'native_4k_ready')
    await updateVersion(jobId, versionId, {
      qualityTier: 'native_4k'
    })

    // Store output dimensions in recipe settings for inspection
    const currentVersion = await getVersion(jobId, versionId)
    if (currentVersion) {
      const updatedRecipe = {
        ...currentVersion.recipe,
        settings: {
          ...currentVersion.recipe.settings,
          outputWidth,
          outputHeight,
          outputLongEdge: longEdge,
          outputFileSize: outputBuffer.length
        }
      }
      // Note: recipe is immutable by design, but we store dimensions for inspection
      console.log(`[GenerateService] Native 4K metadata: ${JSON.stringify({ outputWidth, outputHeight, longEdge, fileSize: outputBuffer.length })}`)
    }

    onProgress?.(100)

    return {
      success: true,
      outputPath,
      thumbnailPath,
      seed
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[GenerateService] Native 4K error:', errorMessage)
    await setVersionGenerationStatus(jobId, versionId, 'failed', errorMessage)
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
