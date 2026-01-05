import { readFile, writeFile, rm, copyFile } from 'fs/promises'
import { join, basename, extname } from 'path'
import { existsSync } from 'fs'
import type { Asset } from '../../../shared/types'
import { getJobDirectory } from './jobStore'
import { addAssetToScene, removeAssetFromScene } from './sceneStore'
import { generateAssetId as generateSequentialAssetId, generateSanitizedFilename, getDisplayName } from '../utils/filenameSanitizer'
import { getSettings } from '../settings'

async function generateAssetId(jobId: string): Promise<string> {
  // Count existing assets to generate sequential ID
  const assets = await listAssetsForJob(jobId)
  return generateSequentialAssetId(assets.length)
}

function getAssetPath(jobId: string, assetId: string): string {
  return join(getJobDirectory(jobId), 'assets', `${assetId}.json`)
}

export async function createAsset(params: {
  jobId: string
  sceneId?: string  // Optional - assets can exist without scene
  name: string
  sourcePath?: string  // Optional - for import via path
  originalPath?: string  // Optional - for direct path reference
}): Promise<Asset> {
  const assetId = await generateAssetId(params.jobId)
  const jobDir = getJobDirectory(params.jobId)
  const settings = await getSettings()

  let finalOriginalPath: string
  let originalFilename: string
  let sanitizedFilename: string
  let displayName: string

  if (params.sourcePath) {
    // Get original filename from source
    originalFilename = basename(params.sourcePath)
    displayName = getDisplayName(originalFilename)
    
    // Generate sanitized filename for storage
    // Format: {jobId}_{assetId}_source.{ext}
    sanitizedFilename = generateSanitizedFilename(params.jobId, assetId, originalFilename)
    
    // Save file using sanitized name
    finalOriginalPath = join(jobDir, 'originals', sanitizedFilename)
    await copyFile(params.sourcePath, finalOriginalPath)
    
    console.log(`[AssetStore] Created asset with sanitized filename: ${sanitizedFilename}`)
    console.log(`[AssetStore] Original filename stored as metadata only: ${originalFilename}`)
  } else if (params.originalPath) {
    // Direct path reference (already exists)
    finalOriginalPath = params.originalPath
    originalFilename = basename(params.originalPath)
    displayName = getDisplayName(originalFilename)
    sanitizedFilename = generateSanitizedFilename(params.jobId, assetId, originalFilename)
  } else {
    throw new Error('Either sourcePath or originalPath must be provided')
  }

  const asset: Asset = {
    id: assetId,
    jobId: params.jobId,
    sceneId: params.sceneId,  // Can be undefined
    name: params.name || displayName,
    originalPath: finalOriginalPath,
    versionIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    
    // Privacy-protected filename metadata
    displayName: displayName,           // Show in UI
    originalName: originalFilename,     // Store for reference, never send to providers
    sanitizedName: sanitizedFilename,   // Use for all external API calls
    legacySanitized: false              // This is a new asset with proper sanitization
  }

  const assetPath = getAssetPath(params.jobId, assetId)
  await writeFile(assetPath, JSON.stringify(asset, null, 2))

  // Only add to scene if sceneId is provided
  if (params.sceneId) {
    await addAssetToScene(params.jobId, params.sceneId, assetId)
  }

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

  // Only remove from scene if asset was assigned to one
  if (asset.sceneId) {
    await removeAssetFromScene(jobId, asset.sceneId, assetId)
  }

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

export async function listAssetsForJob(jobId: string): Promise<Asset[]> {
  const { readdir } = await import('fs/promises')
  const jobDir = getJobDirectory(jobId)
  const assetsDir = join(jobDir, 'assets')

  if (!existsSync(assetsDir)) return []

  const files = await readdir(assetsDir)
  const assets: Asset[] = []

  for (const file of files) {
    if (file.endsWith('.json')) {
      const assetId = file.replace('.json', '')
      const asset = await getAsset(jobId, assetId)
      if (asset) {
        assets.push(asset)
      }
    }
  }

  return assets.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
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

export async function assignAssetToScene(jobId: string, assetId: string, sceneId: string): Promise<Asset | null> {
  const asset = await getAsset(jobId, assetId)
  if (!asset) return null

  // If already assigned to a different scene, remove from old scene first
  if (asset.sceneId && asset.sceneId !== sceneId) {
    await removeAssetFromScene(jobId, asset.sceneId, assetId)
  }

  // Update asset's sceneId
  const assetPath = join(getJobDirectory(jobId), 'assets', `${assetId}.json`)
  const updatedAsset: Asset = {
    ...asset,
    sceneId,
    updatedAt: new Date().toISOString()
  }
  await writeFile(assetPath, JSON.stringify(updatedAsset, null, 2))

  // Add to new scene
  await addAssetToScene(jobId, sceneId, assetId)

  return updatedAsset
}

export async function unassignAssetFromScene(jobId: string, assetId: string): Promise<Asset | null> {
  const asset = await getAsset(jobId, assetId)
  if (!asset || !asset.sceneId) return asset

  // Remove from scene
  await removeAssetFromScene(jobId, asset.sceneId, assetId)

  // Update asset's sceneId to undefined
  const assetPath = join(getJobDirectory(jobId), 'assets', `${assetId}.json`)
  const updatedAsset: Asset = {
    ...asset,
    sceneId: undefined,
    updatedAt: new Date().toISOString()
  }
  await writeFile(assetPath, JSON.stringify(updatedAsset, null, 2))

  return updatedAsset
}
