import { readFile, writeFile, rm } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import type { Version, VersionStatus, VersionRecipe, ModuleType, QualityTier } from '../../../shared/types'
import { getJobDirectory } from './jobStore'
import { addVersionToAsset, removeVersionFromAsset } from './assetStore'

function generateVersionId(): string {
  const now = new Date()
  const timestamp = now.toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .slice(0, 15)
  const random = Math.random().toString(36).slice(2, 6)
  return `ver_${timestamp}_${random}`
}

function getVersionPath(jobId: string, versionId: string): string {
  return join(getJobDirectory(jobId), 'versions', `${versionId}.json`)
}

export async function createVersion(params: {
  jobId: string
  assetId: string
  module: ModuleType
  qualityTier: QualityTier
  recipe: VersionRecipe
  sourceVersionIds?: string[]
  parentVersionId?: string
  seed?: number | null
  model?: string
}): Promise<Version> {
  const versionId = generateVersionId()

  const version: Version = {
    id: versionId,
    assetId: params.assetId,
    jobId: params.jobId,
    module: params.module,
    qualityTier: params.qualityTier,
    status: 'generating',
    recipe: params.recipe,
    sourceVersionIds: params.sourceVersionIds || [],
    parentVersionId: params.parentVersionId,
    seed: params.seed,
    model: params.model,
    createdAt: new Date().toISOString()
  }

  const versionPath = getVersionPath(params.jobId, versionId)
  await writeFile(versionPath, JSON.stringify(version, null, 2))

  await addVersionToAsset(params.jobId, params.assetId, versionId)

  return version
}

export async function getVersion(jobId: string, versionId: string): Promise<Version | null> {
  const versionPath = getVersionPath(jobId, versionId)
  if (!existsSync(versionPath)) {
    return null
  }
  const data = await readFile(versionPath, 'utf-8')
  return JSON.parse(data)
}

export async function updateVersion(
  jobId: string,
  versionId: string,
  updates: Partial<Omit<Version, 'id' | 'jobId' | 'assetId' | 'createdAt' | 'recipe' | 'sourceVersionIds' | 'parentVersionId'>>
): Promise<Version | null> {
  const version = await getVersion(jobId, versionId)
  if (!version) return null

  const updatedVersion: Version = {
    ...version,
    ...updates
  }

  const versionPath = getVersionPath(jobId, versionId)
  await writeFile(versionPath, JSON.stringify(updatedVersion, null, 2))
  return updatedVersion
}

export async function deleteVersion(jobId: string, versionId: string): Promise<boolean> {
  const version = await getVersion(jobId, versionId)
  if (!version) return false

  if (version.status === 'approved' || version.status === 'final_ready') {
    return false
  }

  const versionPath = getVersionPath(jobId, versionId)
  await rm(versionPath, { force: true })

  await removeVersionFromAsset(jobId, version.assetId, versionId)

  return true
}

export async function setVersionStatus(
  jobId: string,
  versionId: string,
  status: VersionStatus,
  error?: string
): Promise<Version | null> {
  const updates: Partial<Version> = { status }

  if (error) {
    updates.error = error
  }

  if (status === 'approved') {
    updates.approvedAt = new Date().toISOString()
  }

  if (status === 'final_ready') {
    updates.finalGeneratedAt = new Date().toISOString()
  }

  return updateVersion(jobId, versionId, updates)
}

export async function setVersionOutput(
  jobId: string,
  versionId: string,
  outputPath: string,
  thumbnailPath?: string
): Promise<Version | null> {
  const updates: Partial<Version> = { outputPath }
  if (thumbnailPath) {
    updates.thumbnailPath = thumbnailPath
  }
  return updateVersion(jobId, versionId, updates)
}

export async function approveVersion(jobId: string, versionId: string): Promise<Version | null> {
  return setVersionStatus(jobId, versionId, 'approved')
}

export async function unapproveVersion(jobId: string, versionId: string): Promise<Version | null> {
  const version = await getVersion(jobId, versionId)
  if (!version) return null

  if (version.status === 'final_ready' || version.status === 'final_generating') {
    return null
  }

  return updateVersion(jobId, versionId, {
    status: 'preview_ready',
    approvedAt: undefined
  })
}

export async function listVersionsForAsset(jobId: string, assetId: string): Promise<Version[]> {
  const { getAsset } = await import('./assetStore')
  const asset = await getAsset(jobId, assetId)
  if (!asset) return []

  const versions: Version[] = []
  for (const versionId of asset.versionIds) {
    const version = await getVersion(jobId, versionId)
    if (version) {
      versions.push(version)
    }
  }

  return versions.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export async function duplicateVersion(
  jobId: string,
  versionId: string,
  modifications?: {
    module?: ModuleType
    recipe?: Partial<VersionRecipe>
  }
): Promise<Version | null> {
  const original = await getVersion(jobId, versionId)
  if (!original) return null

  const newRecipe: VersionRecipe = modifications?.recipe
    ? {
        ...original.recipe,
        ...modifications.recipe,
        settings: { ...original.recipe.settings, ...modifications.recipe.settings }
      }
    : original.recipe

  return createVersion({
    jobId: original.jobId,
    assetId: original.assetId,
    module: modifications?.module || original.module,
    qualityTier: 'preview',
    recipe: newRecipe,
    sourceVersionIds: original.sourceVersionIds,
    parentVersionId: original.id,
    seed: original.seed,
    model: original.model
  })
}

export async function deletePreviewsExceptApproved(jobId: string, assetId: string): Promise<number> {
  const versions = await listVersionsForAsset(jobId, assetId)
  let deletedCount = 0

  for (const version of versions) {
    if (
      version.qualityTier === 'preview' &&
      version.status !== 'approved' &&
      version.status !== 'final_generating' &&
      version.status !== 'final_ready'
    ) {
      const deleted = await deleteVersion(jobId, version.id)
      if (deleted) deletedCount++
    }
  }

  return deletedCount
}
