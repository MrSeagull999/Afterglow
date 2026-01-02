import { readFile, writeFile, rm } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import type { Scene } from '../../../shared/types'
import { getJobDirectory, addSceneToJob, removeSceneFromJob } from './jobStore'

function generateSceneId(): string {
  const random = Math.random().toString(36).slice(2, 10)
  return `scene_${random}`
}

function getScenePath(jobId: string, sceneId: string): string {
  return join(getJobDirectory(jobId), 'scenes', `${sceneId}.json`)
}

export async function createScene(params: {
  jobId: string
  name: string
}): Promise<Scene> {
  const sceneId = generateSceneId()

  const scene: Scene = {
    id: sceneId,
    jobId: params.jobId,
    name: params.name,
    assetIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  const scenePath = getScenePath(params.jobId, sceneId)
  await writeFile(scenePath, JSON.stringify(scene, null, 2))

  await addSceneToJob(params.jobId, sceneId)

  return scene
}

export async function getScene(jobId: string, sceneId: string): Promise<Scene | null> {
  const scenePath = getScenePath(jobId, sceneId)
  if (!existsSync(scenePath)) {
    return null
  }
  const data = await readFile(scenePath, 'utf-8')
  return JSON.parse(data)
}

export async function updateScene(
  jobId: string,
  sceneId: string,
  updates: Partial<Omit<Scene, 'id' | 'jobId' | 'createdAt'>>
): Promise<Scene | null> {
  const scene = await getScene(jobId, sceneId)
  if (!scene) return null

  const updatedScene: Scene = {
    ...scene,
    ...updates,
    updatedAt: new Date().toISOString()
  }

  const scenePath = getScenePath(jobId, sceneId)
  await writeFile(scenePath, JSON.stringify(updatedScene, null, 2))
  return updatedScene
}

export async function deleteScene(jobId: string, sceneId: string): Promise<boolean> {
  const scenePath = getScenePath(jobId, sceneId)
  if (!existsSync(scenePath)) {
    return false
  }

  await rm(scenePath, { force: true })
  await removeSceneFromJob(jobId, sceneId)

  return true
}

export async function listScenesForJob(jobId: string): Promise<Scene[]> {
  const { getJob } = await import('./jobStore')
  const job = await getJob(jobId)
  if (!job) return []

  const scenes: Scene[] = []
  for (const sceneId of job.sceneIds) {
    const scene = await getScene(jobId, sceneId)
    if (scene) {
      scenes.push(scene)
    }
  }

  return scenes
}

export async function addAssetToScene(jobId: string, sceneId: string, assetId: string): Promise<Scene | null> {
  const scene = await getScene(jobId, sceneId)
  if (!scene) return null

  if (!scene.assetIds.includes(assetId)) {
    scene.assetIds.push(assetId)
    return updateScene(jobId, sceneId, { assetIds: scene.assetIds })
  }
  return scene
}

export async function removeAssetFromScene(jobId: string, sceneId: string, assetId: string): Promise<Scene | null> {
  const scene = await getScene(jobId, sceneId)
  if (!scene) return null

  const index = scene.assetIds.indexOf(assetId)
  if (index > -1) {
    scene.assetIds.splice(index, 1)
    const updates: Partial<Scene> = { assetIds: scene.assetIds }

    if (scene.masterAssetId === assetId) {
      updates.masterAssetId = undefined
    }

    return updateScene(jobId, sceneId, updates)
  }
  return scene
}

export async function setMasterAsset(jobId: string, sceneId: string, assetId: string): Promise<Scene | null> {
  const scene = await getScene(jobId, sceneId)
  if (!scene) return null

  if (!scene.assetIds.includes(assetId)) {
    return null
  }

  return updateScene(jobId, sceneId, { masterAssetId: assetId })
}
