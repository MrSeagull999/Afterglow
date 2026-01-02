import { ipcMain } from 'electron'
import type { VersionStatus, ModuleType, VersionRecipe } from '../../shared/types'
import {
  createVersion,
  getVersion,
  updateVersion,
  deleteVersion,
  setVersionStatus,
  setVersionOutput,
  approveVersion,
  unapproveVersion,
  listVersionsForAsset,
  duplicateVersion,
  deletePreviewsExceptApproved
} from '../core/store/versionStore'

export function registerVersionHandlers(): void {
  ipcMain.handle('version:create', async (_event, params: {
    jobId: string
    assetId: string
    module: ModuleType
    qualityTier: 'preview' | 'final'
    recipe: VersionRecipe
    sourceVersionIds?: string[]
    parentVersionId?: string
    seed?: number | null
    model?: string
  }) => {
    return createVersion(params)
  })

  ipcMain.handle('version:get', async (_event, jobId: string, versionId: string) => {
    return getVersion(jobId, versionId)
  })

  ipcMain.handle('version:delete', async (_event, jobId: string, versionId: string) => {
    return deleteVersion(jobId, versionId)
  })

  ipcMain.handle('version:setStatus', async (_event, jobId: string, versionId: string, status: VersionStatus, error?: string) => {
    return setVersionStatus(jobId, versionId, status, error)
  })

  ipcMain.handle('version:setOutput', async (_event, jobId: string, versionId: string, outputPath: string, thumbnailPath?: string) => {
    return setVersionOutput(jobId, versionId, outputPath, thumbnailPath)
  })

  ipcMain.handle('version:approve', async (_event, jobId: string, versionId: string) => {
    return approveVersion(jobId, versionId)
  })

  ipcMain.handle('version:unapprove', async (_event, jobId: string, versionId: string) => {
    return unapproveVersion(jobId, versionId)
  })

  ipcMain.handle('version:listForAsset', async (_event, jobId: string, assetId: string) => {
    return listVersionsForAsset(jobId, assetId)
  })

  ipcMain.handle('version:duplicate', async (_event, jobId: string, versionId: string, modifications?: {
    module?: ModuleType
    recipe?: Partial<VersionRecipe>
  }) => {
    return duplicateVersion(jobId, versionId, modifications)
  })

  ipcMain.handle('version:deletePreviewsExceptApproved', async (_event, jobId: string, assetId: string) => {
    return deletePreviewsExceptApproved(jobId, assetId)
  })
}
