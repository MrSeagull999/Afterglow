import type { Version, VersionRecipe, FurnitureSpec } from '../../../../../shared/types'
import { getAsset } from '../../../store/assetStore'
import { getVersion } from '../../../store/versionStore'
import { getScene } from '../../../store/sceneStore'
import {
  startPreviewGeneration,
  completePreviewGeneration,
  failGeneration,
  startFinalGeneration,
  completeFinalGeneration,
  getOutputPath,
  getThumbnailPath
} from '../../shared/moduleRunner'
import { buildGuardrailPrompt, getDefaultGuardrailIds } from '../../shared/guardrails'
import { buildInjectorPromptFromIds } from '../../shared/injectorRegistry'
import { buildSecondaryAnglePrompt } from './stagingPrompts'
import { buildStagingBasePrompt } from '../../../../../shared/services/prompt/prompts'
import { PromptAssembler } from '../../../services/prompt/promptAssembler'

export interface StagingParams {
  jobId: string
  assetId: string
  sourceVersionId: string
  roomType?: string
  style?: string
  roomDimensions?: {
    enabled: boolean
    width: string
    length: string
    unit: 'feet' | 'meters'
  }
  injectorIds?: string[]
  customGuardrails?: string[]
  customInstructions?: string
  model?: string
  seed?: number | null
}

export interface MultiAngleStagingParams extends StagingParams {
  masterVersionId: string
  furnitureSpec: FurnitureSpec
}

export async function generateStagingPreview(params: StagingParams): Promise<Version> {
  const asset = await getAsset(params.jobId, params.assetId)
  if (!asset) {
    throw new Error(`Asset not found: ${params.assetId}`)
  }

  // Handle original image source (for empty rooms)
  let sourceVersionIds: string[] = []
  if (params.sourceVersionId.startsWith('original:')) {
    // Using original image, no source version
    sourceVersionIds = []
  } else {
    const sourceVersion = await getVersion(params.jobId, params.sourceVersionId)
    if (!sourceVersion?.outputPath) {
      throw new Error(`Source version not found or has no output: ${params.sourceVersionId}`)
    }
    sourceVersionIds = [params.sourceVersionId]
  }

  const guardrailIds = params.customGuardrails || getDefaultGuardrailIds('stage')
  const injectorIds = params.injectorIds || []

  const guardrailPrompts = guardrailIds.map(id => buildGuardrailPrompt([id])).filter(Boolean)
  const injectorPrompt = await buildInjectorPromptFromIds('stage', injectorIds)
  const injectorPrompts = injectorPrompt ? [injectorPrompt] : []

  const basePrompt = buildStagingBasePrompt({
    roomType: params.roomType || 'room',
    style: params.style || 'modern contemporary',
    roomDimensions: params.roomDimensions
  })

  const assembled = await PromptAssembler.assemble({
    module: 'stage',
    basePrompt,
    injectorPrompts,
    guardrailPrompts,
    customInstructions: params.customInstructions,
    roomType: params.roomType,
    style: params.style
  })
  
  const fullPrompt = assembled.finalPrompt

  // Determine input path
  let inputPath: string
  if (sourceVersionIds.length === 0) {
    inputPath = asset.originalPath
  } else {
    const sourceVersion = await getVersion(params.jobId, sourceVersionIds[0])
    inputPath = sourceVersion!.outputPath!
  }

  const recipe: VersionRecipe = {
    basePrompt,
    injectors: injectorIds,
    guardrails: guardrailIds,
    settings: {
      inputPath,
      roomType: params.roomType,
      style: params.style,
      customInstructions: params.customInstructions,
      injectorPrompts,
      guardrailPrompts,
      fullPrompt,
      promptHash: assembled.hash
    }
  }

  const version = await startPreviewGeneration({
    jobId: params.jobId,
    assetId: params.assetId,
    module: 'stage',
    recipe,
    sourceVersionIds,
    seed: params.seed,
    model: params.model
  })

  return version
}

export async function generateSecondaryAnglePreview(params: MultiAngleStagingParams): Promise<Version> {
  const asset = await getAsset(params.jobId, params.assetId)
  if (!asset) {
    throw new Error(`Asset not found: ${params.assetId}`)
  }

  const sourceVersion = await getVersion(params.jobId, params.sourceVersionId)
  if (!sourceVersion?.outputPath) {
    throw new Error(`Source version not found or has no output: ${params.sourceVersionId}`)
  }

  const masterVersion = await getVersion(params.jobId, params.masterVersionId)
  if (!masterVersion?.outputPath) {
    throw new Error(`Master version not found or has no output: ${params.masterVersionId}`)
  }

  const guardrailIds = params.customGuardrails || getDefaultGuardrailIds('stage')
  const injectorIds = params.injectorIds || []

  const guardrailPrompts = guardrailIds.map(id => buildGuardrailPrompt([id])).filter(Boolean)
  const injectorPrompt = await buildInjectorPromptFromIds('stage', injectorIds)
  const injectorPrompts = injectorPrompt ? [injectorPrompt] : []

  const basePrompt = buildSecondaryAnglePrompt({
    furnitureSpec: params.furnitureSpec.description,
    roomType: params.roomType,
    style: params.style
  })

  const assembled = await PromptAssembler.assemble({
    module: 'stage',
    basePrompt,
    injectorPrompts,
    guardrailPrompts,
    customInstructions: params.customInstructions,
    roomType: params.roomType,
    style: params.style
  })

  const fullPrompt = assembled.finalPrompt

  const recipe: VersionRecipe = {
    basePrompt,
    injectors: injectorIds,
    guardrails: guardrailIds,
    settings: {
      inputPath: sourceVersion.outputPath,
      masterVersionId: params.masterVersionId,
      furnitureSpecId: params.furnitureSpec.id,
      roomType: params.roomType,
      style: params.style,
      customInstructions: params.customInstructions,
      injectorPrompts,
      guardrailPrompts,
      fullPrompt
    }
  }

  const version = await startPreviewGeneration({
    jobId: params.jobId,
    assetId: params.assetId,
    module: 'stage',
    recipe,
    sourceVersionIds: [params.sourceVersionId, params.masterVersionId],
    seed: params.seed,
    model: params.model
  })

  return version
}

export async function completeStagingPreview(
  jobId: string,
  versionId: string,
  generatedImagePath: string
): Promise<Version | null> {
  const outputPath = getOutputPath(jobId, versionId, 'preview')
  const thumbnailPath = getThumbnailPath(jobId, versionId)

  return completePreviewGeneration(jobId, versionId, outputPath, thumbnailPath)
}

export async function failStagingGeneration(
  jobId: string,
  versionId: string,
  error: string
): Promise<Version | null> {
  return failGeneration(jobId, versionId, error)
}

export async function generateStagingFinal(
  jobId: string,
  versionId: string
): Promise<Version | null> {
  const version = await getVersion(jobId, versionId)
  if (!version || version.status !== 'approved') {
    throw new Error('Version must be approved before generating final')
  }

  return startFinalGeneration(jobId, versionId)
}

export async function completeStagingFinal(
  jobId: string,
  versionId: string,
  generatedImagePath: string
): Promise<Version | null> {
  const outputPath = getOutputPath(jobId, versionId, 'final')
  return completeFinalGeneration(jobId, versionId, outputPath)
}
