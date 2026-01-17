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
import { buildTwilightPreviewBasePrompt } from '../../../../shared/services/prompt/prompts'

export interface TwilightParams {
  jobId: string
  assetId: string
  sourceVersionId?: string
  presetId: string
  promptTemplate: string
  lightingCondition?: 'overcast' | 'sunny'
  injectorIds?: string[]
  customGuardrails?: string[]
  customInstructions?: string
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

  const guardrailIds = params.customGuardrails || getDefaultGuardrailIds('twilight')
  const injectorIds = params.injectorIds || []
  const customInstructions = params.customInstructions?.trim() || ''

  const guardrailPrompts = guardrailIds.map(id => buildGuardrailPrompt([id])).filter(Boolean)
  const injectorPrompt = await buildInjectorPromptFromIds('twilight', injectorIds)
  const injectorPrompts = injectorPrompt ? [injectorPrompt] : []

  const finalBasePrompt = params.promptTemplate
  const previewBasePrompt = buildTwilightPreviewBasePrompt(params.promptTemplate, params.lightingCondition)

  const assembledFinal = await PromptAssembler.assemble({
    module: 'twilight',
    basePrompt: finalBasePrompt,
    injectorPrompts,
    guardrailPrompts,
    customInstructions
  })

  // Use PromptAssembler for consistent prompt building and hash generation
  const assembledPreview = await PromptAssembler.assemble({
    module: 'twilight',
    basePrompt: previewBasePrompt,
    injectorPrompts,
    guardrailPrompts,
    customInstructions
  })
  
  const fullPrompt = assembledPreview.finalPrompt

  const recipe: VersionRecipe = {
    basePrompt: finalBasePrompt,
    injectors: injectorIds,
    guardrails: guardrailIds,
    settings: {
      inputPath,
      presetId: params.presetId,
      lightingCondition: params.lightingCondition,
      previewBasePrompt,
      customInstructions,
      injectorPrompts,
      guardrailPrompts,
      fullPrompt,
      previewPromptHash: assembledPreview.hash,
      finalPromptHash: assembledFinal.hash
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
