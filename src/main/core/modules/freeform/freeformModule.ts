import type { Version, VersionRecipe } from '../../../../shared/types'
import { getAsset } from '../../store/assetStore'
import { getVersion } from '../../store/versionStore'
import {
  startPreviewGeneration,
  completePreviewGeneration,
  failGeneration,
  startFinalGeneration,
  completeFinalGeneration,
  getOutputPath,
  getThumbnailPath
} from '../shared/moduleRunner'
import { buildGuardrailPrompt, getDefaultGuardrailIds } from '../shared/guardrails'
import { buildInjectorPromptFromIds } from '../shared/injectorRegistry'
import { PromptAssembler } from '../../services/prompt/promptAssembler'

export interface FreeformParams {
  jobId: string
  assetId: string
  craftedPrompt: string
  sourceVersionId?: string
  injectorIds?: string[]
  customGuardrails?: string[]
  customInstructions?: string
  model?: string
  seed?: number | null
  /** Reference image paths from chat session to pass to the generation engine */
  referenceImagePaths?: Array<{ path: string; role: string }>
}

export async function generateFreeformPreview(params: FreeformParams): Promise<Version> {
  const asset = await getAsset(params.jobId, params.assetId)
  if (!asset) {
    throw new Error(`Asset not found: ${params.assetId}`)
  }

  if (!params.craftedPrompt?.trim()) {
    throw new Error('Crafted prompt is required for freeform generation')
  }

  let inputPath = asset.originalPath
  if (params.sourceVersionId) {
    const sourceVersion = await getVersion(params.jobId, params.sourceVersionId)
    if (sourceVersion?.outputPath) {
      inputPath = sourceVersion.outputPath
    }
  }

  const guardrailIds = params.customGuardrails || getDefaultGuardrailIds('freeform')
  const injectorIds = params.injectorIds || []

  const guardrailPrompt = buildGuardrailPrompt(guardrailIds)
  const injectorPrompt = await buildInjectorPromptFromIds('freeform', injectorIds)

  const basePrompt = params.craftedPrompt.trim()
  const customInstructions = params.customInstructions?.trim() || ''

  // Use PromptAssembler for consistent prompt building and hash generation
  const guardrailPrompts = guardrailIds.map(id => buildGuardrailPrompt([id])).filter(Boolean)
  const injectorPrompts = injectorPrompt ? [injectorPrompt] : []

  const assembled = await PromptAssembler.assemble({
    module: 'freeform',
    basePrompt,
    injectorPrompts,
    guardrailPrompts,
    customInstructions
  })

  const fullPrompt = assembled.finalPrompt

  const recipe: VersionRecipe = {
    basePrompt,
    injectors: injectorIds,
    guardrails: guardrailIds,
    settings: {
      inputPath,
      customInstructions,
      injectorPrompts,
      guardrailPrompts,
      fullPrompt,
      promptHash: assembled.hash,
      ...(params.referenceImagePaths && params.referenceImagePaths.length > 0
        ? { referenceImages: params.referenceImagePaths }
        : {})
    }
  }

  const version = await startPreviewGeneration({
    jobId: params.jobId,
    assetId: params.assetId,
    module: 'freeform',
    recipe,
    sourceVersionIds: params.sourceVersionId ? [params.sourceVersionId] : [],
    seed: params.seed,
    model: params.model
  })

  return version
}

export async function completeFreeformPreview(
  jobId: string,
  versionId: string,
  generatedImagePath: string
): Promise<Version | null> {
  const outputPath = getOutputPath(jobId, versionId, 'preview')
  const thumbnailPath = getThumbnailPath(jobId, versionId)

  return completePreviewGeneration(jobId, versionId, outputPath, thumbnailPath)
}

export async function failFreeformGeneration(
  jobId: string,
  versionId: string,
  error: string
): Promise<Version | null> {
  return failGeneration(jobId, versionId, error)
}

export async function generateFreeformFinal(
  jobId: string,
  versionId: string
): Promise<Version | null> {
  const version = await getVersion(jobId, versionId)
  if (!version) {
    throw new Error('Version not found')
  }

  return startFinalGeneration(jobId, versionId)
}

export async function completeFreeformFinal(
  jobId: string,
  versionId: string,
  generatedImagePath: string
): Promise<Version | null> {
  const outputPath = getOutputPath(jobId, versionId, 'final')
  return completeFinalGeneration(jobId, versionId, outputPath)
}
