import { readFile, mkdir } from 'fs/promises'
import { join, dirname, basename } from 'path'
import { existsSync } from 'fs'
import sharp from 'sharp'
import { BrowserWindow } from 'electron'
import { generateSeed } from '../../gemini/geminiClient'
import { getSettings } from '../../settings'
import { saveImageWithExifHandling } from '../../exif'
import type { Version, ModuleType, EvaluationResult } from '../../../../shared/types'
import type { ReferenceImageInput } from '../../providers/IImageProvider'
import {
  getVersion,
  setVersionStatus,
  setVersionOutput,
  setVersionGenerationStatus,
  updateVersion
} from '../../store/versionStore'
import { getAsset } from '../../store/assetStore'
import { getJobDirectory } from '../../store/jobStore'
import { getResolvedImageProvider } from '../../providers/providerRouter'
import { generationLogger } from '../../services/generation/generationLogger'
import { assemblePrompt } from '../../../../shared/services/prompt/promptAssembler'
import { evaluateGeneration } from '../../services/evaluation/evaluationService'
import { v4 as uuidv4 } from 'uuid'

/**
 * Load a reference image from disk and prepare it for the API
 */
async function loadReferenceImage(imagePath: string, role: string): Promise<ReferenceImageInput | null> {
  if (!imagePath || !existsSync(imagePath)) {
    console.log(`[GenerateService] Reference image not found: ${imagePath}`)
    return null
  }

  try {
    const imageBuffer = await readFile(imagePath)
    const base64Image = imageBuffer.toString('base64')
    const ext = imagePath.toLowerCase().split('.').pop()
    let mimeType = 'image/jpeg'
    if (ext === 'png') mimeType = 'image/png'
    else if (ext === 'webp') mimeType = 'image/webp'

    return {
      imageData: base64Image,
      mimeType,
      role
    }
  } catch (error) {
    console.error(`[GenerateService] Failed to load reference image: ${error}`)
    return null
  }
}

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
    
    // Load reference image if specified in recipe
    const referenceImages: ReferenceImageInput[] = []
    const recipeReferenceImages = version.recipe.settings.referenceImages as Array<{ path?: string; role?: string }> | undefined

    console.log(`[GenerateService] 🖼️  Preview: Checking for reference image(s) in recipe...`)
    if (Array.isArray(recipeReferenceImages) && recipeReferenceImages.length > 0) {
      console.log(`[GenerateService] 📚 Preview: Found ${recipeReferenceImages.length} structured reference image(s)`)
      for (const [index, ref] of recipeReferenceImages.entries()) {
        if (!ref?.path) continue
        const role = ref.role || `reference image ${index + 1}`
        console.log(`[GenerateService] 📎 Preview: Ref ${index + 1} path: ${ref.path}`)
        console.log(`[GenerateService] 📎 Preview: Ref ${index + 1} role: ${role.substring(0, 80)}...`)
        const refImage = await loadReferenceImage(ref.path, role)
        if (refImage) {
          referenceImages.push(refImage)
          console.log(`[GenerateService] ✅ Preview: Ref ${index + 1} LOADED (${(refImage.imageData.length / 1024).toFixed(1)}KB)`)
        } else {
          console.log(`[GenerateService] ❌ Preview: Ref ${index + 1} FAILED to load`)
        }
      }
    } else {
      const referenceImagePath = version.recipe.settings.referenceImagePath as string | undefined
      const referenceImageRole = (version.recipe.settings.referenceImageRole as string | undefined) ||
        'lighting reference - apply the exact lighting conditions, sky color and gradient, interior light color temperature, and ambient atmosphere from this reference'
      if (referenceImagePath) {
        console.log(`[GenerateService] 📎 Preview: Found reference image path: ${referenceImagePath}`)
        console.log(`[GenerateService] 📎 Preview: Reference role: ${referenceImageRole.substring(0, 80)}...`)
        const refImage = await loadReferenceImage(referenceImagePath, referenceImageRole)
        if (refImage) {
          referenceImages.push(refImage)
          console.log(`[GenerateService] ✅ Preview: Reference image LOADED successfully (${(refImage.imageData.length / 1024).toFixed(1)}KB)`)
        } else {
          console.log(`[GenerateService] ❌ Preview: Reference image FAILED to load (file may not exist)`)
        }
      } else {
        console.log(`[GenerateService] ℹ️  Preview: No reference image in recipe for ${version.module}`)
        if (version.module === 'stage') {
          console.log(`[GenerateService] ℹ️  (For multi-angle staging: this is either the master view, or multi-angle mode wasn't enabled)`)
        }
      }
    }

    // Setup output paths
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

    // Determine evaluation settings
    const evalEnabled = settings.evaluationEnabled ?? false
    const evalThreshold = settings.evaluationThreshold ?? 7
    const evalMaxRetries = settings.evaluationMaxRetries ?? 1
    const evalReviewMode = (settings as any).evaluationReviewMode ?? 'flag_for_review'
    const flagForReview = evalEnabled && evalReviewMode === 'flag_for_review'
    // In flag_for_review mode: only 1 attempt (no auto-retry), then flag if below threshold
    const maxAttempts = evalEnabled && !flagForReview ? (1 + evalMaxRetries) : 1

    let bestEvaluation: EvaluationResult | null = null
    let bestOutputBuffer: Buffer | null = null
    let bestSeed: number | null = seed
    let lastSeedRejected = false

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const currentSeed = attempt === 1 ? seed : generateSeed()

      const response = await provider.generateImage({
        prompt: fullPrompt,
        imageData: base64Image,
        mimeType,
        model,
        imageSize: '1024x1024',
        seed: currentSeed,
        priorityMode: settings.previewPriorityMode && resolved.provider === 'openrouter',
        referenceImages: referenceImages.length > 0 ? referenceImages : undefined
      })

      // Log generation attempt
      generationLogger.log({
        timestamp: new Date().toISOString(),
        jobId,
        versionId,
        provider: providerName,
        requestId: attempt === 1 ? requestId : uuidv4(),
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
        // If first attempt fails, report error. If retry fails, use best previous result.
        if (bestOutputBuffer) break
        await setVersionGenerationStatus(jobId, versionId, 'failed', response.error || 'Generation failed')
        await setVersionStatus(jobId, versionId, 'error', response.error || 'Generation failed')
        return {
          success: false,
          error: response.error || 'Generation failed'
        }
      }

      lastSeedRejected = response.seedRejected ?? false
      const outputBuffer = Buffer.from(response.imageData, 'base64')

      // Save the output (overwrite if retrying)
      await saveImageWithExifHandling(outputBuffer, outputPath, settings.keepExif, outputFormat)
      await sharp(outputBuffer)
        .resize(300, 300, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath)

      // Evaluate if enabled
      if (evalEnabled) {
        console.log(`[GenerateService] 🔍 Evaluation enabled - assessing output quality...`)
        const evalRefPath = Array.isArray(recipeReferenceImages) && recipeReferenceImages.length > 0
          ? recipeReferenceImages[0].path
          : (version.recipe.settings.referenceImagePath as string | undefined)
        const evaluation = await evaluateGeneration(outputPath, version.module, undefined, attempt, evalRefPath)

        if (evaluation) {
          if (!bestEvaluation || evaluation.overallScore > bestEvaluation.overallScore) {
            bestEvaluation = evaluation
            bestOutputBuffer = outputBuffer
            bestSeed = response.seedRejected ? null : currentSeed
          }

          // Good enough - stop retrying
          if (evaluation.overallScore >= evalThreshold) {
            console.log(`[GenerateService] Evaluation passed (${evaluation.overallScore}/${evalThreshold}) on attempt ${attempt}`)
            break
          }

          // Below threshold — flag for review instead of auto-retrying
          if (flagForReview) {
            console.log(`[GenerateService] Score ${evaluation.overallScore} below threshold ${evalThreshold} — flagging for user review`)
            bestOutputBuffer = outputBuffer
            bestSeed = response.seedRejected ? null : currentSeed
            break
          }

          // Below threshold - retry if we have attempts left
          if (attempt < maxAttempts) {
            console.log(`[GenerateService] Score ${evaluation.overallScore} below threshold ${evalThreshold}, retrying (attempt ${attempt + 1}/${maxAttempts})...`)
          } else {
            console.log(`[GenerateService] Score ${evaluation.overallScore} below threshold ${evalThreshold}, no retries left. Using best result.`)
          }
        } else {
          // Evaluation failed - keep this result and stop
          bestOutputBuffer = outputBuffer
          bestSeed = response.seedRejected ? null : currentSeed
          break
        }
      } else {
        // No evaluation - keep first result
        console.log(`[GenerateService] ⏭️  Evaluation disabled - using first generation result`)
        bestOutputBuffer = outputBuffer
        bestSeed = response.seedRejected ? null : currentSeed
        break
      }
    }

    // If we retried and a previous attempt was better, restore it
    if (bestEvaluation && bestOutputBuffer && bestEvaluation.attempt > 0) {
      // If the best result isn't the last one saved, rewrite the output
      const lastSavedAttempt = Math.min(maxAttempts, bestEvaluation.attempt)
      if (lastSavedAttempt !== bestEvaluation.attempt) {
        await saveImageWithExifHandling(bestOutputBuffer, outputPath, settings.keepExif, outputFormat)
        await sharp(bestOutputBuffer)
          .resize(300, 300, { fit: 'cover' })
          .jpeg({ quality: 80 })
          .toFile(thumbnailPath)
      }
    }

    onProgress?.(95)

    // Update version with output and evaluation
    await setVersionOutput(jobId, versionId, outputPath, thumbnailPath)
    if (bestEvaluation) {
      console.log(`[GenerateService] 💾 Saving evaluation score ${bestEvaluation.overallScore}/10 to version ${versionId}`)
      const belowThreshold = bestEvaluation.overallScore < evalThreshold
      const evalFlag = (flagForReview && belowThreshold) ? 'needs_review' : undefined
      await updateVersion(jobId, versionId, {
        evaluation: bestEvaluation,
        ...(evalFlag ? { evaluationFlag: evalFlag } : {})
      })
      // Notify renderer when flagging for review
      if (evalFlag === 'needs_review') {
        const wins = BrowserWindow.getAllWindows()
        wins.forEach(w => w.webContents.send('version:evaluation-flagged', {
          versionId,
          evaluation: bestEvaluation
        }))
      }
    } else if (evalEnabled) {
      console.log(`[GenerateService] ⚠️  Evaluation was enabled but no score was generated`)
    }
    await setVersionGenerationStatus(jobId, versionId, 'completed')
    await setVersionStatus(jobId, versionId, 'preview_ready')

    onProgress?.(100)

    return {
      success: true,
      outputPath,
      thumbnailPath,
      seed: bestSeed
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[GenerateService] Error:', errorMessage)
    await setVersionGenerationStatus(jobId, versionId, 'failed', errorMessage)
    await setVersionStatus(jobId, versionId, 'error', errorMessage)
    onProgress?.(100) // Always notify renderer so tile updates to error state
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
    console.log(`[GenerateService] HQ Preview input resolved for asset:${asset.id} version:${versionId} sourceVersion:${version.sourceVersionIds[0] || 'none'} path:${inputPath}`)
    
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

    // Load reference image if specified in recipe
    const referenceImages: ReferenceImageInput[] = []
    const recipeReferenceImages = version.recipe.settings.referenceImages as Array<{ path?: string; role?: string }> | undefined

    console.log(`[GenerateService] 🖼️  HQ Preview: Checking for reference image(s) in recipe...`)
    if (Array.isArray(recipeReferenceImages) && recipeReferenceImages.length > 0) {
      console.log(`[GenerateService] 📚 HQ Preview: Found ${recipeReferenceImages.length} structured reference image(s)`)
      for (const [index, ref] of recipeReferenceImages.entries()) {
        if (!ref?.path) continue
        const role = ref.role || `reference image ${index + 1}`
        console.log(`[GenerateService] 📎 HQ Preview: Ref ${index + 1} path: ${ref.path}`)
        console.log(`[GenerateService] 📎 HQ Preview: Ref ${index + 1} role: ${role.substring(0, 80)}...`)
        const refImage = await loadReferenceImage(ref.path, role)
        if (refImage) {
          referenceImages.push(refImage)
          console.log(`[GenerateService] ✅ HQ Preview: Ref ${index + 1} LOADED (${(refImage.imageData.length / 1024).toFixed(1)}KB)`)
        } else {
          console.log(`[GenerateService] ❌ HQ Preview: Ref ${index + 1} FAILED to load`)
        }
      }
    } else {
      const referenceImagePath = version.recipe.settings.referenceImagePath as string | undefined
      const referenceImageRole = (version.recipe.settings.referenceImageRole as string | undefined) ||
        'lighting reference - apply the exact lighting conditions, sky color and gradient, interior light color temperature, and ambient atmosphere from this reference'
      if (referenceImagePath) {
        console.log(`[GenerateService] 📎 HQ Preview: Found reference image path: ${referenceImagePath}`)
        console.log(`[GenerateService] 📎 HQ Preview: Reference role: ${referenceImageRole.substring(0, 80)}...`)
        const refImage = await loadReferenceImage(referenceImagePath, referenceImageRole)
        if (refImage) {
          referenceImages.push(refImage)
          console.log(`[GenerateService] ✅ HQ Preview: Reference image LOADED successfully (${(refImage.imageData.length / 1024).toFixed(1)}KB)`)
        } else {
          console.log(`[GenerateService] ❌ HQ Preview: Reference image FAILED to load (file may not exist)`)
        }
      } else {
        console.log(`[GenerateService] ℹ️  HQ Preview: No reference image in recipe for ${version.module}`)
      }
    }

    const response = await provider.generateImage({
      prompt: fullPrompt,
      imageData: base64Image,
      mimeType,
      model,
      imageSize: '1536x1536',
      seed,
      priorityMode: settings.previewPriorityMode && resolved.provider === 'openrouter',
      referenceImages: referenceImages.length > 0 ? referenceImages : undefined
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

    onProgress?.(90)

    await setVersionOutput(jobId, versionId, outputPath)

    // Evaluate HQ output if enabled
    const evalEnabled = settings.evaluationEnabled ?? false
    const { updateVersion } = await import('../../store/versionStore')

    if (evalEnabled) {
      console.log(`[GenerateService] 🔍 HQ Evaluation enabled - assessing output quality...`)
      const evalRefPath = Array.isArray(recipeReferenceImages) && recipeReferenceImages.length > 0
        ? recipeReferenceImages[0].path
        : (version.recipe.settings.referenceImagePath as string | undefined)
      const evaluation = await evaluateGeneration(outputPath, version.module, undefined, 1, evalRefPath)
      if (evaluation) {
        console.log(`[GenerateService] 💾 HQ Evaluation score ${evaluation.overallScore}/10 for version ${versionId}`)
        await updateVersion(jobId, versionId, { evaluation })
      } else {
        console.log(`[GenerateService] ⚠️  HQ Evaluation was enabled but no score was generated`)
      }
    } else {
      console.log(`[GenerateService] ⏭️  HQ Evaluation disabled`)
    }

    onProgress?.(95)

    await setVersionGenerationStatus(jobId, versionId, 'completed')
    await setVersionStatus(jobId, versionId, 'hq_ready')

    // Update quality tier
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
    onProgress?.(100) // Always notify renderer so tile updates to error state
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
    onProgress?.(100) // Always notify renderer so tile updates to error state
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
    // Note: Input size must be reasonable to avoid request payload size limits
    const settings = await getSettings()
    const targetWidth = 2048 // Max input dimension - reduced to prevent payload size issues

    let resizedBuffer: Buffer = imageBuffer as Buffer
    if (metadata.width && metadata.width > targetWidth) {
      resizedBuffer = await sharp(imageBuffer)
        .resize(targetWidth, null, { withoutEnlargement: true })
        .jpeg({ quality: 85 }) // Convert to JPEG to reduce size
        .toBuffer() as Buffer
    } else {
      // Even if not resizing, convert to JPEG to reduce payload size
      resizedBuffer = await sharp(imageBuffer)
        .jpeg({ quality: 85 })
        .toBuffer() as Buffer
    }

    onProgress?.(30)

    const base64Image = resizedBuffer.toString('base64')
    const payloadSizeMB = (base64Image.length / 1024 / 1024).toFixed(2)
    console.log(`[GenerateService] Native 4K: Base64 payload size: ${payloadSizeMB}MB`)
    
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

    // Load reference images from recipe (e.g. freeform chat reference images)
    const referenceImages: ReferenceImageInput[] = []
    const recipeReferenceImages = version.recipe.settings.referenceImages as Array<{ path?: string; role?: string }> | undefined
    console.log(`[GenerateService] 🖼️  Native 4K: Checking for reference image(s) in recipe...`)
    if (Array.isArray(recipeReferenceImages) && recipeReferenceImages.length > 0) {
      console.log(`[GenerateService] 📚 Native 4K: Found ${recipeReferenceImages.length} reference image(s)`)
      for (const [index, ref] of recipeReferenceImages.entries()) {
        if (!ref?.path) continue
        const role = ref.role || `reference image ${index + 1}`
        const refImage = await loadReferenceImage(ref.path, role)
        if (refImage) {
          referenceImages.push(refImage)
          console.log(`[GenerateService] ✅ Native 4K: Ref ${index + 1} LOADED (${(refImage.imageData.length / 1024).toFixed(1)}KB)`)
        } else {
          console.warn(`[GenerateService] ❌ Native 4K: Ref ${index + 1} FAILED to load from ${ref.path}`)
        }
      }
    } else {
      console.log(`[GenerateService] ℹ️  Native 4K: No reference images in recipe`)
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
      priorityMode: false,
      referenceImages: referenceImages.length > 0 ? referenceImages : undefined
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
    onProgress?.(100) // Always notify renderer so tile updates to error state
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
