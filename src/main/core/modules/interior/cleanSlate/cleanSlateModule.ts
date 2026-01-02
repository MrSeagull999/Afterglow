import type { Version, VersionRecipe } from '../../../../../shared/types'
import { getAsset } from '../../../store/assetStore'
import { getVersion } from '../../../store/versionStore'
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
import { buildCleanSlatePrompt } from './cleanSlatePrompts'

export interface CleanSlateParams {
  jobId: string
  assetId: string
  sourceVersionId?: string
  injectorIds?: string[]
  customGuardrails?: string[]
  model?: string
  seed?: number | null
}

export async function generateCleanSlatePreview(params: CleanSlateParams): Promise<Version> {
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

  const guardrailIds = params.customGuardrails || getDefaultGuardrailIds('clean')
  const injectorIds = params.injectorIds || []

  const guardrailPrompt = buildGuardrailPrompt(guardrailIds)
  const injectorPrompt = await buildInjectorPromptFromIds('clean', injectorIds)

  const basePrompt = buildCleanSlatePrompt()
  const fullPrompt = [basePrompt, injectorPrompt, guardrailPrompt].filter(Boolean).join(' ')

  const recipe: VersionRecipe = {
    basePrompt,
    injectors: injectorIds,
    guardrails: guardrailIds,
    settings: {
      inputPath,
      fullPrompt
    }
  }

  const version = await startPreviewGeneration({
    jobId: params.jobId,
    assetId: params.assetId,
    module: 'clean',
    recipe,
    sourceVersionIds: params.sourceVersionId ? [params.sourceVersionId] : [],
    seed: params.seed,
    model: params.model
  })

  return version
}

export async function completeCleanSlatePreview(
  jobId: string,
  versionId: string,
  generatedImagePath: string
): Promise<Version | null> {
  const outputPath = getOutputPath(jobId, versionId, 'preview')
  const thumbnailPath = getThumbnailPath(jobId, versionId)

  return completePreviewGeneration(jobId, versionId, outputPath, thumbnailPath)
}

export async function failCleanSlateGeneration(
  jobId: string,
  versionId: string,
  error: string
): Promise<Version | null> {
  return failGeneration(jobId, versionId, error)
}

export async function generateCleanSlateFinal(
  jobId: string,
  versionId: string
): Promise<Version | null> {
  const version = await getVersion(jobId, versionId)
  if (!version || version.status !== 'approved') {
    throw new Error('Version must be approved before generating final')
  }

  return startFinalGeneration(jobId, versionId)
}

export async function completeCleanSlateFinal(
  jobId: string,
  versionId: string,
  generatedImagePath: string
): Promise<Version | null> {
  const outputPath = getOutputPath(jobId, versionId, 'final')
  return completeFinalGeneration(jobId, versionId, outputPath)
}
