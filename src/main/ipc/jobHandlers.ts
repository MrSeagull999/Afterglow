import { ipcMain } from 'electron'
import type { Job, JobMetadata, Scene, Asset } from '../../shared/types'
import {
  createJob,
  getJob,
  updateJob,
  deleteJob,
  listJobs
} from '../core/store/jobStore'
import {
  createScene,
  getScene,
  updateScene,
  deleteScene,
  listScenesForJob,
  setMasterAsset
} from '../core/store/sceneStore'
import {
  createAsset,
  getAsset,
  updateAsset,
  deleteAsset,
  listAssetsForScene,
  listAssetsForJob,
  assignAssetToScene,
  unassignAssetFromScene
} from '../core/store/assetStore'

export function registerJobHandlers(): void {
  // Job CRUD
  ipcMain.handle('job:create', async (_event, params: { name: string; metadata?: JobMetadata }) => {
    return createJob(params)
  })

  ipcMain.handle('job:get', async (_event, jobId: string) => {
    return getJob(jobId)
  })

  ipcMain.handle('job:update', async (_event, jobId: string, updates: Partial<Omit<Job, 'id' | 'createdAt'>>) => {
    return updateJob(jobId, updates)
  })

  ipcMain.handle('job:delete', async (_event, jobId: string) => {
    return deleteJob(jobId)
  })

  ipcMain.handle('job:list', async () => {
    return listJobs()
  })

  // Scene CRUD
  ipcMain.handle('scene:create', async (_event, params: { jobId: string; name: string }) => {
    return createScene(params)
  })

  ipcMain.handle('scene:get', async (_event, jobId: string, sceneId: string) => {
    return getScene(jobId, sceneId)
  })

  ipcMain.handle('scene:update', async (_event, jobId: string, sceneId: string, updates: Partial<Omit<Scene, 'id' | 'jobId' | 'createdAt'>>) => {
    return updateScene(jobId, sceneId, updates)
  })

  ipcMain.handle('scene:delete', async (_event, jobId: string, sceneId: string) => {
    return deleteScene(jobId, sceneId)
  })

  ipcMain.handle('scene:listForJob', async (_event, jobId: string) => {
    return listScenesForJob(jobId)
  })

  ipcMain.handle('scene:setMasterAsset', async (_event, jobId: string, sceneId: string, assetId: string) => {
    return setMasterAsset(jobId, sceneId, assetId)
  })

  // Asset CRUD
  ipcMain.handle('asset:create', async (_event, params: { jobId: string; sceneId: string; name: string; sourcePath: string }) => {
    return createAsset(params)
  })

  ipcMain.handle('asset:get', async (_event, jobId: string, assetId: string) => {
    return getAsset(jobId, assetId)
  })

  ipcMain.handle('asset:update', async (_event, jobId: string, assetId: string, updates: Partial<Omit<Asset, 'id' | 'jobId' | 'sceneId' | 'originalPath' | 'createdAt'>>) => {
    return updateAsset(jobId, assetId, updates)
  })

  ipcMain.handle('asset:delete', async (_event, jobId: string, assetId: string) => {
    return deleteAsset(jobId, assetId)
  })

  ipcMain.handle('asset:listForScene', async (_event, jobId: string, sceneId: string) => {
    return listAssetsForScene(jobId, sceneId)
  })

  ipcMain.handle('asset:listForJob', async (_event, jobId: string) => {
    return listAssetsForJob(jobId)
  })

  ipcMain.handle('asset:assignToScene', async (_event, jobId: string, assetId: string, sceneId: string) => {
    return assignAssetToScene(jobId, assetId, sceneId)
  })

  ipcMain.handle('asset:unassignFromScene', async (_event, jobId: string, assetId: string) => {
    return unassignAssetFromScene(jobId, assetId)
  })
}
