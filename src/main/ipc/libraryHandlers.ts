import { ipcMain } from 'electron'
import type { ModuleType, VersionStatus } from '../../shared/types'
import {
  queryLibrary,
  getVersionsAvailableForChaining,
  getCleanSlateOutputsForStaging,
  getStagedVersionsForScene,
  getVersionsByModule,
  getApprovedVersions,
  getFinalVersions,
  getJobStats,
  LibraryQuery
} from '../core/library/libraryService'

export function registerLibraryHandlers(): void {
  ipcMain.handle('library:query', async (_event, query: LibraryQuery) => {
    return queryLibrary(query)
  })

  ipcMain.handle('library:getVersionsForChaining', async (_event, jobId: string, targetModule: ModuleType) => {
    return getVersionsAvailableForChaining(jobId, targetModule)
  })

  ipcMain.handle('library:getCleanSlateOutputsForStaging', async (_event, jobId: string, sceneId?: string) => {
    return getCleanSlateOutputsForStaging(jobId, sceneId)
  })

  ipcMain.handle('library:getStagedVersionsForScene', async (_event, jobId: string, sceneId: string) => {
    return getStagedVersionsForScene(jobId, sceneId)
  })

  ipcMain.handle('library:getVersionsByModule', async (_event, jobId: string, module: ModuleType) => {
    return getVersionsByModule(jobId, module)
  })

  ipcMain.handle('library:getApprovedVersions', async (_event, jobId: string) => {
    return getApprovedVersions(jobId)
  })

  ipcMain.handle('library:getFinalVersions', async (_event, jobId: string) => {
    return getFinalVersions(jobId)
  })

  ipcMain.handle('library:getJobStats', async (_event, jobId: string) => {
    return getJobStats(jobId)
  })
}
