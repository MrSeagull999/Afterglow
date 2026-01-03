import { ipcMain, BrowserWindow } from 'electron'
import { loadInjectorsForModule, reloadInjectors } from '../core/modules/shared/injectorRegistry'
import { getGuardrailsForModule, ARCHITECTURAL_GUARDRAILS } from '../core/modules/shared/guardrails'
import { generateVersionPreview, generateVersionHQPreview, generateVersionFinal } from '../core/modules/shared/generateService'
import type { ModuleType } from '../../shared/types'

import {
  generateCleanSlatePreview,
  CleanSlateParams
} from '../core/modules/interior/cleanSlate/cleanSlateModule'

import {
  generateStagingPreview,
  generateSecondaryAnglePreview,
  StagingParams,
  MultiAngleStagingParams
} from '../core/modules/interior/staging/stagingModule'

import {
  generateRenovatePreview,
  RenovateParams
} from '../core/modules/interior/renovate/renovateModule'

import {
  generateTwilightPreview,
  TwilightParams
} from '../core/modules/twilight/twilightModule'

import {
  createFurnitureSpec,
  getFurnitureSpec,
  getFurnitureSpecForScene,
  updateFurnitureSpec,
  deleteFurnitureSpec
} from '../core/modules/interior/staging/furnitureSpec'

import { ROOM_TYPES, STAGING_STYLES } from '../core/modules/interior/staging/stagingPrompts'
import { FLOOR_MATERIALS, FLOOR_COLORS, WALL_COLORS, CURTAIN_STYLES } from '../core/modules/interior/renovate/renovatePrompts'

function sendProgress(versionId: string, progress: number) {
  const windows = BrowserWindow.getAllWindows()
  windows.forEach(win => {
    win.webContents.send('version:progress', { versionId, progress })
  })
}

export function registerModuleHandlers(): void {
  // Injector handlers
  ipcMain.handle('injectors:getForModule', async (_event, module: ModuleType) => {
    return loadInjectorsForModule(module)
  })

  ipcMain.handle('injectors:reload', async (_event, module: ModuleType) => {
    return reloadInjectors(module)
  })

  // Guardrail handlers
  ipcMain.handle('guardrails:getForModule', async (_event, module: 'clean' | 'stage' | 'renovate' | 'twilight') => {
    return getGuardrailsForModule(module)
  })

  ipcMain.handle('guardrails:getAll', async () => {
    return ARCHITECTURAL_GUARDRAILS
  })

  // Clean Slate module
  ipcMain.handle('module:cleanSlate:generatePreview', async (_event, params: CleanSlateParams) => {
    const version = await generateCleanSlatePreview(params)
    // Start actual generation in background
    generateVersionPreview(params.jobId, version.id, (progress) => {
      sendProgress(version.id, progress)
    }).catch(err => console.error('[CleanSlate] Generation error:', err))
    return version
  })

  // Staging module
  ipcMain.handle('module:staging:generatePreview', async (_event, params: StagingParams) => {
    const version = await generateStagingPreview(params)
    generateVersionPreview(params.jobId, version.id, (progress) => {
      sendProgress(version.id, progress)
    }).catch(err => console.error('[Staging] Generation error:', err))
    return version
  })

  ipcMain.handle('module:staging:generateSecondaryAngle', async (_event, params: MultiAngleStagingParams) => {
    const version = await generateSecondaryAnglePreview(params)
    generateVersionPreview(params.jobId, version.id, (progress) => {
      sendProgress(version.id, progress)
    }).catch(err => console.error('[Staging] Secondary angle error:', err))
    return version
  })

  // Renovate module
  ipcMain.handle('module:renovate:generatePreview', async (_event, params: RenovateParams) => {
    const version = await generateRenovatePreview(params)
    generateVersionPreview(params.jobId, version.id, (progress) => {
      sendProgress(version.id, progress)
    }).catch(err => console.error('[Renovate] Generation error:', err))
    return version
  })

  // Twilight module
  ipcMain.handle('module:twilight:generatePreview', async (_event, params: TwilightParams) => {
    const version = await generateTwilightPreview(params)
    generateVersionPreview(params.jobId, version.id, (progress) => {
      sendProgress(version.id, progress)
    }).catch(err => console.error('[Twilight] Generation error:', err))
    return version
  })

  // Generate HQ Preview for approved versions (for chaining)
  ipcMain.handle('version:generateHQPreview', async (_event, jobId: string, versionId: string) => {
    generateVersionHQPreview(jobId, versionId, (progress) => {
      sendProgress(versionId, progress)
    }).catch(err => console.error('[HQ Preview] Generation error:', err))
    return { started: true }
  })

  // Generate final for any module
  ipcMain.handle('version:generateFinal', async (_event, jobId: string, versionId: string) => {
    generateVersionFinal(jobId, versionId, (progress) => {
      sendProgress(versionId, progress)
    }).catch(err => console.error('[Final] Generation error:', err))
    return { started: true }
  })

  // Furniture Spec handlers
  ipcMain.handle('furnitureSpec:create', async (_event, params: {
    jobId: string
    sceneId: string
    masterVersionId: string
    description: string
  }) => {
    return createFurnitureSpec(params)
  })

  ipcMain.handle('furnitureSpec:get', async (_event, jobId: string, specId: string) => {
    return getFurnitureSpec(jobId, specId)
  })

  ipcMain.handle('furnitureSpec:getForScene', async (_event, jobId: string, sceneId: string) => {
    return getFurnitureSpecForScene(jobId, sceneId)
  })

  ipcMain.handle('furnitureSpec:update', async (_event, jobId: string, specId: string, description: string) => {
    return updateFurnitureSpec(jobId, specId, description)
  })

  ipcMain.handle('furnitureSpec:delete', async (_event, jobId: string, specId: string) => {
    return deleteFurnitureSpec(jobId, specId)
  })

  // Constants for UI
  ipcMain.handle('constants:getRoomTypes', async () => {
    return ROOM_TYPES
  })

  ipcMain.handle('constants:getStagingStyles', async () => {
    return STAGING_STYLES
  })

  ipcMain.handle('constants:getFloorMaterials', async () => {
    return FLOOR_MATERIALS
  })

  ipcMain.handle('constants:getFloorColors', async () => {
    return FLOOR_COLORS
  })

  ipcMain.handle('constants:getWallColors', async () => {
    return WALL_COLORS
  })

  ipcMain.handle('constants:getCurtainStyles', async () => {
    return CURTAIN_STYLES
  })
}
