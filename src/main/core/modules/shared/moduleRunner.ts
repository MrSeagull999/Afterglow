import type { Version, ModuleType, QualityTier, VersionRecipe } from '../../../../shared/types'
import { createVersion, setVersionGenerationStatus, setVersionStatus, setVersionOutput } from '../../store/versionStore'
import { getJobDirectory } from '../../store/jobStore'
import { join } from 'path'

export interface ModuleRunParams {
  jobId: string
  assetId: string
  module: ModuleType
  recipe: VersionRecipe
  sourceVersionIds?: string[]
  parentVersionId?: string
  seed?: number | null
  model?: string
}

export interface ModuleRunResult {
  version: Version
  success: boolean
  error?: string
}

export async function startPreviewGeneration(params: ModuleRunParams): Promise<Version> {
  const version = await createVersion({
    ...params,
    qualityTier: 'preview'
  })

  return version
}

export async function completePreviewGeneration(
  jobId: string,
  versionId: string,
  outputPath: string,
  thumbnailPath?: string
): Promise<Version | null> {
  await setVersionOutput(jobId, versionId, outputPath, thumbnailPath)
  await setVersionGenerationStatus(jobId, versionId, 'completed')
  return setVersionStatus(jobId, versionId, 'preview_ready')
}

export async function failGeneration(
  jobId: string,
  versionId: string,
  error: string
): Promise<Version | null> {
  await setVersionGenerationStatus(jobId, versionId, 'failed', error)
  return setVersionStatus(jobId, versionId, 'error', error)
}

export async function startFinalGeneration(
  jobId: string,
  versionId: string
): Promise<Version | null> {
  await setVersionGenerationStatus(jobId, versionId, 'pending')
  return setVersionStatus(jobId, versionId, 'final_generating')
}

export async function completeFinalGeneration(
  jobId: string,
  versionId: string,
  outputPath: string
): Promise<Version | null> {
  await setVersionOutput(jobId, versionId, outputPath)
  await setVersionGenerationStatus(jobId, versionId, 'completed')
  return setVersionStatus(jobId, versionId, 'final_ready')
}

export function getOutputPath(jobId: string, versionId: string, qualityTier: QualityTier, ext: string = 'png'): string {
  const jobDir = getJobDirectory(jobId)
  const subfolder = qualityTier === 'preview' ? 'previews' : 'finals'
  return join(jobDir, 'outputs', subfolder, `${versionId}.${ext}`)
}

export function getThumbnailPath(jobId: string, versionId: string): string {
  const jobDir = getJobDirectory(jobId)
  return join(jobDir, 'outputs', 'thumbnails', `${versionId}_thumb.jpg`)
}
