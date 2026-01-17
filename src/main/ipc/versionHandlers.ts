import { BrowserWindow, ipcMain } from 'electron'
import type { VersionStatus, ModuleType, VersionRecipe } from '../../shared/types'
import { generateVersionHQPreview, generateVersionPreview } from '../core/modules/shared/generateService'
import { exportVersion } from '../export/exportVersion'
import {
  createVersion,
  createHQRegenVersion,
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

function sendProgress(versionId: string, progress: number) {
  const windows = BrowserWindow.getAllWindows()
  windows.forEach((win) => {
    win.webContents.send('version:progress', { versionId, progress })
  })
}

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

  ipcMain.handle('version:export', async (_event, params: { jobId: string; versionId: string; suggestedName?: string }) => {
    return exportVersion(params)
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

  ipcMain.handle('version:retry', async (_event, params: { jobId: string; versionId: string }) => {
    const base = await getVersion(params.jobId, params.versionId)
    if (!base) return null

    const version = await createVersion({
      jobId: params.jobId,
      assetId: base.assetId,
      module: base.module,
      qualityTier: base.qualityTier,
      recipe: base.recipe,
      sourceVersionIds: [base.id],
      parentVersionId: undefined,
      seed: base.seed ?? null,
      model: base.model
    })

    generateVersionPreview(params.jobId, version.id, (progress) => {
      sendProgress(version.id, progress)
    }).catch((err) => console.error('[Version Retry] Generation error:', err))

    return version
  })

  ipcMain.handle('version:regenerateHQ', async (_event, jobId: string, approvedVersionId: string) => {
    const version = await createHQRegenVersion({ jobId, approvedVersionId })

    generateVersionHQPreview(jobId, version.id, (progress) => {
      sendProgress(version.id, progress)
    }).catch((err) => console.error('[HQ Regenerate] Generation error:', err))

    return version
  })
}
