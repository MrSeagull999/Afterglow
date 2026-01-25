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
import { buildRelightPreviewBasePrompt } from './relightPrompts'

export interface RelightParams {
  jobId: string
  assetId: string
  sourceVersionId?: string
  presetId: string
  promptTemplate: string
  injectorIds?: string[]
  customGuardrails?: string[]
  customInstructions?: string
  referenceImagePath?: string
  model?: string
  seed?: number | null
}

export async function generateRelightPreview(params: RelightParams): Promise<Version> {
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

  const guardrailIds = params.customGuardrails || getDefaultGuardrailIds('relight')
  const injectorIds = params.injectorIds || []
  const customInstructions = params.customInstructions?.trim() || ''

  const guardrailPrompts = guardrailIds.map(id => buildGuardrailPrompt([id])).filter(Boolean)
  const injectorPrompt = await buildInjectorPromptFromIds('relight', injectorIds)
  const injectorPrompts = injectorPrompt ? [injectorPrompt] : []

  const finalBasePrompt = params.promptTemplate
  const previewBasePrompt = buildRelightPreviewBasePrompt(params.promptTemplate)

  const assembledFinal = await PromptAssembler.assemble({
    module: 'relight',
    basePrompt: finalBasePrompt,
    injectorPrompts,
    guardrailPrompts,
    customInstructions
  })

  const assembledPreview = await PromptAssembler.assemble({
    module: 'relight',
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
      previewBasePrompt,
      customInstructions,
      injectorPrompts,
      guardrailPrompts,
      fullPrompt,
      previewPromptHash: assembledPreview.hash,
      finalPromptHash: assembledFinal.hash,
      referenceImagePath: params.referenceImagePath
    }
  }

  const version = await startPreviewGeneration({
    jobId: params.jobId,
    assetId: params.assetId,
    module: 'relight',
    recipe,
    sourceVersionIds: params.sourceVersionId ? [params.sourceVersionId] : [],
    seed: params.seed,
    model: params.model
  })

  return version
}

export async function completeRelightPreview(
  jobId: string,
  versionId: string,
  generatedImagePath: string
): Promise<Version | null> {
  const outputPath = getOutputPath(jobId, versionId, 'preview')
  const thumbnailPath = getThumbnailPath(jobId, versionId)

  return completePreviewGeneration(jobId, versionId, outputPath, thumbnailPath)
}
