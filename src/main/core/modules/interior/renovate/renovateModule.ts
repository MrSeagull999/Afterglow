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
import { buildRenovatePrompt, RenovateChanges } from './renovatePrompts'
import { PromptAssembler } from '../../../services/prompt/promptAssembler'

export interface RenovateParams {
  jobId: string
  assetId: string
  sourceVersionId: string
  changes: RenovateChanges
  injectorIds?: string[]
  customGuardrails?: string[]
  model?: string
  seed?: number | null
}

export async function generateRenovatePreview(params: RenovateParams): Promise<Version> {
  const asset = await getAsset(params.jobId, params.assetId)
  if (!asset) {
    throw new Error(`Asset not found: ${params.assetId}`)
  }

  const sourceVersion = await getVersion(params.jobId, params.sourceVersionId)
  if (!sourceVersion?.outputPath) {
    throw new Error(`Source version not found or has no output: ${params.sourceVersionId}`)
  }

  const guardrailIds = params.customGuardrails || getDefaultGuardrailIds('renovate')
  const injectorIds = params.injectorIds || []

  const guardrailPrompt = buildGuardrailPrompt(guardrailIds)
  const injectorPrompt = await buildInjectorPromptFromIds('renovate', injectorIds)

  const basePrompt = buildRenovatePrompt(params.changes)
  
  // Use PromptAssembler for consistent prompt building and hash generation
  const guardrailPrompts = guardrailIds.map(id => buildGuardrailPrompt([id])).filter(Boolean)
  const injectorPrompts = injectorPrompt ? [injectorPrompt] : []
  
  const assembled = PromptAssembler.assemble({
    module: 'renovate',
    basePrompt,
    injectorPrompts,
    guardrailPrompts
  })
  
  const fullPrompt = assembled.finalPrompt

  const recipe: VersionRecipe = {
    basePrompt,
    injectors: injectorIds,
    guardrails: guardrailIds,
    settings: {
      inputPath: sourceVersion.outputPath,
      changes: params.changes,
      fullPrompt,
      promptHash: assembled.hash
    }
  }

  const version = await startPreviewGeneration({
    jobId: params.jobId,
    assetId: params.assetId,
    module: 'renovate',
    recipe,
    sourceVersionIds: [params.sourceVersionId],
    seed: params.seed,
    model: params.model
  })

  return version
}

export async function completeRenovatePreview(
  jobId: string,
  versionId: string,
  generatedImagePath: string
): Promise<Version | null> {
  const outputPath = getOutputPath(jobId, versionId, 'preview')
  const thumbnailPath = getThumbnailPath(jobId, versionId)

  return completePreviewGeneration(jobId, versionId, outputPath, thumbnailPath)
}

export async function failRenovateGeneration(
  jobId: string,
  versionId: string,
  error: string
): Promise<Version | null> {
  return failGeneration(jobId, versionId, error)
}

export async function generateRenovateFinal(
  jobId: string,
  versionId: string
): Promise<Version | null> {
  const version = await getVersion(jobId, versionId)
  if (!version || version.status !== 'approved') {
    throw new Error('Version must be approved before generating final')
  }

  return startFinalGeneration(jobId, versionId)
}

export async function completeRenovateFinal(
  jobId: string,
  versionId: string,
  generatedImagePath: string
): Promise<Version | null> {
  const outputPath = getOutputPath(jobId, versionId, 'final')
  return completeFinalGeneration(jobId, versionId, outputPath)
}
