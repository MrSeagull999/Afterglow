import { readFile, writeFile, rm } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import type { Version, VersionStatus, VersionRecipe, ModuleType, QualityTier, GenerationStatus } from '../../../shared/types'
import { getJobDirectory } from './jobStore'
import { addVersionToAsset, removeVersionFromAsset } from './assetStore'
import { getSettings } from '../settings'

function generateVersionId(): string {
  const now = new Date()
  const timestamp = now.toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .slice(0, 15)
  const random = Math.random().toString(36).slice(2, 6)
  return `ver_${timestamp}_${random}`
}

export function selectFinalModel(params: {
  advancedCustomModel?: string
  finalModel?: string
}): string {
  const custom = (params.advancedCustomModel || '').trim()
  if (custom.length > 0) return custom
  return params.finalModel || 'gemini-3-pro-image-preview'
}

export async function createFinalFromApprovedVersion(params: {
  jobId: string
  approvedVersionId: string
}): Promise<Version> {
  const approved = await getVersion(params.jobId, params.approvedVersionId)
  if (!approved) {
    throw new Error(`Source version not found: ${params.approvedVersionId}`)
  }

  if (approved.status !== 'approved' && approved.status !== 'hq_ready') {
    throw new Error('Final generation requires an approved or HQ-ready version')
  }

  const settings = await getSettings()
  const model = selectFinalModel({
    advancedCustomModel: settings.advancedCustomModel,
    finalModel: settings.finalModel
  })

  return createVersion({
    jobId: params.jobId,
    assetId: approved.assetId,
    module: approved.module,
    qualityTier: 'final',
    recipe: approved.recipe,
    sourceVersionIds: approved.sourceVersionIds,
    parentVersionId: approved.id,
    seed: approved.seed ?? null,
    model
  })
}

function getVersionPath(jobId: string, versionId: string): string {
  return join(getJobDirectory(jobId), 'versions', `${versionId}.json`)
}

export function isVersionDeletionLocked(version: Pick<Version, 'lifecycleStatus' | 'status'>): boolean {
  return version.lifecycleStatus === 'approved' || version.status === 'approved' || version.status === 'final_ready'
}

export function getApprovalInvariantUpdates(params: {
  versionsForAsset: Version[]
  approveVersionId: string
  nowMs: number
}): Array<{ versionId: string; updates: Partial<Version> }> {
  const updates: Array<{ versionId: string; updates: Partial<Version> }> = []

  for (const v of params.versionsForAsset) {
    const isApproved = v.lifecycleStatus === 'approved' || v.status === 'approved'
    if (!isApproved) continue

    if (v.id !== params.approveVersionId) {
      updates.push({
        versionId: v.id,
        updates: {
          lifecycleStatus: 'draft',
          approvedAt: undefined,
          approvedBy: undefined,
          status: v.status === 'approved' ? 'preview_ready' : v.status
        }
      })
    }
  }

  updates.push({
    versionId: params.approveVersionId,
    updates: {
      lifecycleStatus: 'approved',
      approvedAt: params.nowMs,
      status: 'approved'
    }
  })

  return updates
}

export function getGenerationStatusUpdates(
  generationStatus: GenerationStatus,
  nowMs: number,
  generationError?: string
): Pick<Version, 'generationStatus' | 'startedAt' | 'completedAt' | 'generationError'> {
  const updates: Pick<Version, 'generationStatus' | 'startedAt' | 'completedAt' | 'generationError'> = {
    generationStatus,
    startedAt: undefined,
    completedAt: undefined,
    generationError: undefined
  }

  if (generationStatus === 'pending') {
    updates.startedAt = nowMs
    updates.completedAt = undefined
    updates.generationError = undefined
  }

  if (generationStatus === 'completed') {
    updates.completedAt = nowMs
    updates.generationError = undefined
  }

  if (generationStatus === 'failed') {
    updates.completedAt = nowMs
    updates.generationError = generationError
  }

  return updates
}

export function buildNewVersion(params: {
  jobId: string
  assetId: string
  module: ModuleType
  qualityTier: QualityTier
  recipe: VersionRecipe
  sourceVersionIds?: string[]
  parentVersionId?: string
  seed?: number | null
  model?: string
  nowMs: number
  createdAtIso: string
  versionId: string
}): Version {
  return {
    id: params.versionId,
    assetId: params.assetId,
    jobId: params.jobId,
    module: params.module,
    qualityTier: params.qualityTier,
    status: 'generating',
    generationStatus: 'pending',
    startedAt: params.nowMs,
    recipe: params.recipe,
    sourceVersionIds: params.sourceVersionIds || [],
    parentVersionId: params.parentVersionId,
    seed: params.seed,
    model: params.model,
    createdAt: params.createdAtIso
  }
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

  const nowMs = Date.now()
  const createdAtIso = new Date().toISOString()

  const version: Version = buildNewVersion({
    ...params,
    nowMs,
    createdAtIso,
    versionId
  })

  const versionPath = getVersionPath(params.jobId, versionId)
  await writeFile(versionPath, JSON.stringify(version, null, 2))

  await addVersionToAsset(params.jobId, params.assetId, versionId)

  return version
}

export async function setVersionGenerationStatus(
  jobId: string,
  versionId: string,
  generationStatus: GenerationStatus,
  generationError?: string
): Promise<Version | null> {
  const nowMs = Date.now()
  const updates: Partial<Version> = getGenerationStatusUpdates(generationStatus, nowMs, generationError)
  return updateVersion(jobId, versionId, updates)
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

  if (isVersionDeletionLocked(version)) {
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
    updates.lifecycleStatus = 'approved'
    updates.approvedAt = Date.now()
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

export async function approveVersion(jobId: string, versionId: string): Promise<Version[] | null> {
  const version = await getVersion(jobId, versionId)
  if (!version) return null

  const versionsForAsset = await listVersionsForAsset(jobId, version.assetId)
  const updatesToApply = getApprovalInvariantUpdates({
    versionsForAsset,
    approveVersionId: versionId,
    nowMs: Date.now()
  })

  const updated: Version[] = []
  for (const u of updatesToApply) {
    const res = await updateVersion(jobId, u.versionId, u.updates)
    if (res) updated.push(res)
  }

  return updated.length > 0 ? updated : null
}

export async function unapproveVersion(jobId: string, versionId: string): Promise<Version | null> {
  const version = await getVersion(jobId, versionId)
  if (!version) return null

  if (version.status === 'final_ready' || version.status === 'final_generating') {
    return null
  }

  return updateVersion(jobId, versionId, {
    lifecycleStatus: 'draft',
    status: 'preview_ready',
    approvedAt: undefined,
    approvedBy: undefined
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

export function resolveHqRegenSourceVersionId(params: {
  approvedVersion: Pick<Version, 'parentVersionId'>
  parentVersion: Pick<Version, 'id' | 'outputPath'> | null
}): string | null {
  if (!params.approvedVersion.parentVersionId) return null
  if (!params.parentVersion?.outputPath) return null
  return params.parentVersion.id
}

export function selectHqRegenModel(params: {
  advancedCustomModel?: string
  previewImageModel?: string
  previewModel?: string
}): string {
  const custom = (params.advancedCustomModel || '').trim()
  if (custom.length > 0) return custom
  return params.previewImageModel || params.previewModel || 'gemini-3-pro-image-preview'
}

export function buildHqRegenCreateVersionInput(params: {
  approvedVersion: Pick<Version, 'id' | 'assetId' | 'module' | 'recipe' | 'seed' | 'parentVersionId'>
  parentVersion: Pick<Version, 'id' | 'outputPath'> | null
  model: string
}): Pick<Parameters<typeof createVersion>[0], 'assetId' | 'module' | 'qualityTier' | 'recipe' | 'sourceVersionIds' | 'parentVersionId' | 'seed' | 'model'> {
  const sourceVersionId = resolveHqRegenSourceVersionId({
    approvedVersion: params.approvedVersion,
    parentVersion: params.parentVersion
  })

  return {
    assetId: params.approvedVersion.assetId,
    module: params.approvedVersion.module,
    qualityTier: 'hq_preview',
    recipe: params.approvedVersion.recipe,
    sourceVersionIds: sourceVersionId ? [sourceVersionId] : [],
    parentVersionId: params.approvedVersion.id,
    seed: params.approvedVersion.seed ?? null,
    model: params.model
  }
}

export async function createHQRegenVersion(params: {
  jobId: string
  approvedVersionId: string
}): Promise<Version> {
  const approved = await getVersion(params.jobId, params.approvedVersionId)
  if (!approved) {
    throw new Error(`Approved version not found: ${params.approvedVersionId}`)
  }

  if (approved.status !== 'approved') {
    throw new Error('HQ regenerate requires an approved version')
  }

  const parent = approved.parentVersionId
    ? await getVersion(params.jobId, approved.parentVersionId)
    : null

  const sourceVersionId = resolveHqRegenSourceVersionId({
    approvedVersion: approved,
    parentVersion: parent
  })

  const settings = await getSettings()
  const model = selectHqRegenModel({
    advancedCustomModel: settings.advancedCustomModel,
    previewImageModel: settings.previewImageModel,
    previewModel: settings.previewModel
  })

  const input = buildHqRegenCreateVersionInput({
    approvedVersion: approved,
    parentVersion: parent,
    model
  })

  return createVersion({
    jobId: params.jobId,
    ...input
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

export function selectNative4KModel(params: {
  advancedCustomModel?: string
  previewImageModel?: string
  previewModel?: string
}): string {
  const custom = (params.advancedCustomModel || '').trim()
  if (custom.length > 0) return custom
  return params.previewImageModel || params.previewModel || 'gemini-3-pro-image-preview'
}

export function resolveNative4KSourceVersionId(params: {
  approvedVersion: Pick<Version, 'parentVersionId'>
  parentVersion: Pick<Version, 'id' | 'outputPath'> | null
}): string | null {
  if (!params.approvedVersion.parentVersionId) return null
  if (!params.parentVersion?.outputPath) return null
  return params.parentVersion.id
}

export function buildNative4KCreateVersionInput(params: {
  approvedVersion: Pick<Version, 'id' | 'assetId' | 'module' | 'recipe' | 'seed' | 'parentVersionId'>
  parentVersion: Pick<Version, 'id' | 'outputPath'> | null
  model: string
}): Pick<Parameters<typeof createVersion>[0], 'assetId' | 'module' | 'qualityTier' | 'recipe' | 'sourceVersionIds' | 'parentVersionId' | 'seed' | 'model'> {
  const sourceVersionId = resolveNative4KSourceVersionId({
    approvedVersion: params.approvedVersion,
    parentVersion: params.parentVersion
  })

  return {
    assetId: params.approvedVersion.assetId,
    module: params.approvedVersion.module,
    qualityTier: 'native_4k',
    recipe: params.approvedVersion.recipe,
    sourceVersionIds: sourceVersionId ? [sourceVersionId] : [],
    parentVersionId: params.approvedVersion.id,
    seed: params.approvedVersion.seed ?? null,
    model: params.model
  }
}

export async function createNative4KFromApprovedVersion(params: {
  jobId: string
  approvedVersionId: string
}): Promise<Version> {
  const approved = await getVersion(params.jobId, params.approvedVersionId)
  if (!approved) {
    throw new Error(`Approved version not found: ${params.approvedVersionId}`)
  }

  if (approved.status !== 'approved') {
    throw new Error('Native 4K generation requires an approved version')
  }

  const parent = approved.parentVersionId
    ? await getVersion(params.jobId, approved.parentVersionId)
    : null

  const settings = await getSettings()
  const model = selectNative4KModel({
    advancedCustomModel: settings.advancedCustomModel,
    previewImageModel: settings.previewImageModel,
    previewModel: settings.previewModel
  })

  const input = buildNative4KCreateVersionInput({
    approvedVersion: approved,
    parentVersion: parent,
    model
  })

  return createVersion({
    jobId: params.jobId,
    ...input
  })
}
