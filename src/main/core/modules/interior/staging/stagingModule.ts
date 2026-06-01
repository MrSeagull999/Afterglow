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
import { buildStagingBasePrompt, buildStagingBasePromptSimplified } from '../../../../../shared/services/prompt/prompts'
import { PromptAssembler } from '../../../services/prompt/promptAssembler'
import { getSettings } from '../../../settings'

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
    backWall?: string
    leftWall?: string
    rightWall?: string
    ceilingHeight?: string
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

  const settings = await getSettings()
  const useSimplified = settings.promptStyle === 'simplified'

  const injectorIds = params.injectorIds || []
  const injectorPrompt = await buildInjectorPromptFromIds('stage', injectorIds)
  const injectorPrompts = injectorPrompt ? [injectorPrompt] : []

  // In simplified mode, guardrails are baked into the base prompt
  const guardrailIds = useSimplified ? [] : (params.customGuardrails || getDefaultGuardrailIds('stage'))
  const guardrailPrompts = guardrailIds.map(id => buildGuardrailPrompt([id])).filter(Boolean)

  const promptParams = {
    roomType: params.roomType || 'room',
    style: params.style || 'modern contemporary',
    roomDimensions: params.roomDimensions
  }
  const basePrompt = useSimplified
    ? buildStagingBasePromptSimplified(promptParams)
    : buildStagingBasePrompt(promptParams)

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

  // Support original image as source for secondary angles, same as primary staging flow.
  let inputPath: string
  let sourceVersionIds: string[] = []
  if (params.sourceVersionId.startsWith('original:')) {
    inputPath = asset.originalPath
  } else {
    const sourceVersion = await getVersion(params.jobId, params.sourceVersionId)
    if (!sourceVersion?.outputPath) {
      throw new Error(`Source version not found or has no output: ${params.sourceVersionId}`)
    }
    inputPath = sourceVersion.outputPath
    sourceVersionIds = [params.sourceVersionId]
  }

  const masterVersion = await getVersion(params.jobId, params.masterVersionId)
  if (!masterVersion?.outputPath) {
    throw new Error(`Master version not found or has no output: ${params.masterVersionId}`)
  }

  // Resolve master "before" path for a before/after reference pair.
  let masterInputPath = masterVersion.recipe?.settings?.inputPath as string | undefined
  if (!masterInputPath && masterVersion.sourceVersionIds.length > 0) {
    const masterSourceVersion = await getVersion(params.jobId, masterVersion.sourceVersionIds[0])
    if (masterSourceVersion?.outputPath) {
      masterInputPath = masterSourceVersion.outputPath
    }
  }
  if (!masterInputPath) {
    const masterAsset = await getAsset(params.jobId, masterVersion.assetId)
    masterInputPath = masterAsset?.originalPath
  }

  const guardrailIds = params.customGuardrails || getDefaultGuardrailIds('stage')
  const injectorIds = params.injectorIds || []

  const guardrailPrompts = guardrailIds.map(id => buildGuardrailPrompt([id])).filter(Boolean)
  const injectorPrompt = await buildInjectorPromptFromIds('stage', injectorIds)
  const injectorPrompts = injectorPrompt ? [injectorPrompt] : []

  const basePrompt = buildSecondaryAnglePrompt({
    furnitureSpec: params.furnitureSpec.description,
    roomType: params.roomType,
    style: params.style,
    hasVisualReference: !!masterVersion.outputPath
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
      inputPath,
      masterVersionId: params.masterVersionId,
      furnitureSpecId: params.furnitureSpec.id,
      roomType: params.roomType,
      style: params.style,
      customInstructions: params.customInstructions,
      injectorPrompts,
      guardrailPrompts,
      fullPrompt,
      // Backward-compatible single-reference fields
      referenceImagePath: masterVersion.outputPath,
      referenceImageRole: 'furniture-only reference from the same room staged at a different angle. Match furniture identity/style/materials/colors only. Preserve Image 1 camera viewpoint and geometry; do not copy reference composition or framing.',
      // Preferred multi-reference payload: master before + master after
      referenceImages: [
        {
          path: masterInputPath,
          role: 'master view BEFORE staging (empty/source). Use with the staged master to infer what furniture/decor was added and where.'
        },
        {
          path: masterVersion.outputPath,
          role: 'master view AFTER staging. Match this furniture set and relative placement, but keep Image 1 camera/viewpoint.'
        }
      ]
    }
  }

  const version = await startPreviewGeneration({
    jobId: params.jobId,
    assetId: params.assetId,
    module: 'stage',
    recipe,
    // Keep sourceVersionIds focused on the asset's actual input source.
    // masterVersionId is stored in recipe.settings for reference-image usage.
    sourceVersionIds,
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
  if (!version) {
    throw new Error('Version not found')
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
