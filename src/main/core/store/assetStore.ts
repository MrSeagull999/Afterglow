import { readFile, writeFile, rm, copyFile } from 'fs/promises'
import { join, basename, extname } from 'path'
import { existsSync } from 'fs'
import type { Asset } from '../../../shared/types'
import { getJobDirectory } from './jobStore'
import { addAssetToScene, removeAssetFromScene } from './sceneStore'

function generateAssetId(): string {
  const random = Math.random().toString(36).slice(2, 10)
  return `asset_${random}`
}

function getAssetPath(jobId: string, assetId: string): string {
  return join(getJobDirectory(jobId), 'assets', `${assetId}.json`)
}

export async function createAsset(params: {
  jobId: string
  sceneId: string
  name: string
  sourcePath: string
}): Promise<Asset> {
  const assetId = generateAssetId()
  const jobDir = getJobDirectory(params.jobId)

  const ext = extname(params.sourcePath)
  const originalFilename = `${assetId}${ext}`
  const originalPath = join(jobDir, 'originals', originalFilename)

  await copyFile(params.sourcePath, originalPath)

  const asset: Asset = {
    id: assetId,
    jobId: params.jobId,
    sceneId: params.sceneId,
    name: params.name || basename(params.sourcePath, ext),
    originalPath,
    versionIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  const assetPath = getAssetPath(params.jobId, assetId)
  await writeFile(assetPath, JSON.stringify(asset, null, 2))

  await addAssetToScene(params.jobId, params.sceneId, assetId)

  return asset
}

export async function getAsset(jobId: string, assetId: string): Promise<Asset | null> {
  const assetPath = getAssetPath(jobId, assetId)
  if (!existsSync(assetPath)) {
    return null
  }
  const data = await readFile(assetPath, 'utf-8')
  return JSON.parse(data)
}

export async function updateAsset(
  jobId: string,
  assetId: string,
  updates: Partial<Omit<Asset, 'id' | 'jobId' | 'sceneId' | 'originalPath' | 'createdAt'>>
): Promise<Asset | null> {
  const asset = await getAsset(jobId, assetId)
  if (!asset) return null

  const updatedAsset: Asset = {
    ...asset,
    ...updates,
    updatedAt: new Date().toISOString()
  }

  const assetPath = getAssetPath(jobId, assetId)
  await writeFile(assetPath, JSON.stringify(updatedAsset, null, 2))
  return updatedAsset
}

export async function deleteAsset(jobId: string, assetId: string): Promise<boolean> {
  const asset = await getAsset(jobId, assetId)
  if (!asset) return false

  const assetPath = getAssetPath(jobId, assetId)
  await rm(assetPath, { force: true })

  await removeAssetFromScene(jobId, asset.sceneId, assetId)

  return true
}

export async function listAssetsForScene(jobId: string, sceneId: string): Promise<Asset[]> {
  const { getScene } = await import('./sceneStore')
  const scene = await getScene(jobId, sceneId)
  if (!scene) return []

  const assets: Asset[] = []
  for (const assetId of scene.assetIds) {
    const asset = await getAsset(jobId, assetId)
    if (asset) {
      assets.push(asset)
    }
  }

  return assets
}

export async function addVersionToAsset(jobId: string, assetId: string, versionId: string): Promise<Asset | null> {
  const asset = await getAsset(jobId, assetId)
  if (!asset) return null

  if (!asset.versionIds.includes(versionId)) {
    asset.versionIds.push(versionId)
    return updateAsset(jobId, assetId, { versionIds: asset.versionIds })
  }
  return asset
}

export async function removeVersionFromAsset(jobId: string, assetId: string, versionId: string): Promise<Asset | null> {
  const asset = await getAsset(jobId, assetId)
  if (!asset) return null

  const index = asset.versionIds.indexOf(versionId)
  if (index > -1) {
    asset.versionIds.splice(index, 1)
    return updateAsset(jobId, assetId, { versionIds: asset.versionIds })
  }
  return asset
}

export async function setAssetThumbnail(jobId: string, assetId: string, thumbnailPath: string): Promise<Asset | null> {
  return updateAsset(jobId, assetId, { originalThumbnailPath: thumbnailPath })
}
