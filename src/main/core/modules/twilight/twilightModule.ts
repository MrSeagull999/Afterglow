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
import { PromptAssembler } from '../../services/prompt/promptAssembler'

export interface TwilightParams {
  jobId: string
  assetId: string
  sourceVersionId?: string
  presetId: string
  promptTemplate: string
  lightingCondition?: 'overcast' | 'sunny'
  model?: string
  seed?: number | null
}

export async function generateTwilightPreview(params: TwilightParams): Promise<Version> {
  const asset = await getAsset(params.jobId, params.assetId)
  if (!asset) {
    throw new Error(`Asset not found: ${params.assetId}`)
  }

  let inputPath = asset.originalPath
  if (params.sourceVersionId) {
    const sourceVersion = await getVersion(params.jobId, params.sourceVersionId)
    if (sourceVersion?.outputPath) {
      inputPath = sourceVersion.outputPath
    }
  }

  const guardrailIds = getDefaultGuardrailIds('twilight')
  const guardrailPrompts = guardrailIds.map(id => buildGuardrailPrompt([id])).filter(Boolean)
  const injectorPrompts: string[] = []

  // Use PromptAssembler for consistent prompt building and hash generation
  const assembled = await PromptAssembler.assemble({
    module: 'twilight',
    basePrompt: params.promptTemplate,
    injectorPrompts,
    guardrailPrompts
  })
  
  const fullPrompt = assembled.finalPrompt

  const recipe: VersionRecipe = {
    basePrompt: params.promptTemplate,
    injectors: [],
    guardrails: guardrailIds,
    settings: {
      inputPath,
      presetId: params.presetId,
      lightingCondition: params.lightingCondition,
      injectorPrompts,
      guardrailPrompts,
      fullPrompt,
      promptHash: assembled.hash
    }
  }

  const version = await startPreviewGeneration({
    jobId: params.jobId,
    assetId: params.assetId,
    module: 'twilight',
    recipe,
    sourceVersionIds: params.sourceVersionId ? [params.sourceVersionId] : [],
    seed: params.seed,
    model: params.model
  })

  return version
}

export async function completeTwilightPreview(
  jobId: string,
  versionId: string,
  generatedImagePath: string
): Promise<Version | null> {
  const outputPath = getOutputPath(jobId, versionId, 'preview')
  const thumbnailPath = getThumbnailPath(jobId, versionId)

  return completePreviewGeneration(jobId, versionId, outputPath, thumbnailPath)
}

export async function failTwilightGeneration(
  jobId: string,
  versionId: string,
  error: string
): Promise<Version | null> {
  return failGeneration(jobId, versionId, error)
}

export async function generateTwilightFinal(
  jobId: string,
  versionId: string
): Promise<Version | null> {
  const version = await getVersion(jobId, versionId)
  if (!version || version.status !== 'approved') {
    throw new Error('Version must be approved before generating final')
  }

  return startFinalGeneration(jobId, versionId)
}

export async function completeTwilightFinal(
  jobId: string,
  versionId: string,
  generatedImagePath: string
): Promise<Version | null> {
  const outputPath = getOutputPath(jobId, versionId, 'final')
  return completeFinalGeneration(jobId, versionId, outputPath)
}
