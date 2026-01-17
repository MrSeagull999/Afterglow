import { ipcMain, BrowserWindow } from 'electron'
import { loadInjectorsForModule, reloadInjectors } from '../core/modules/shared/injectorRegistry'
import { getGuardrailsForModule, ARCHITECTURAL_GUARDRAILS, buildGuardrailPrompt } from '../core/modules/shared/guardrails'
import { generateVersionPreview, generateVersionHQPreview, generateVersionFinal } from '../core/modules/shared/generateService'
import type { ModuleType } from '../../shared/types'
import { generationLogger } from '../core/services/generation/generationLogger'
import { getSettings } from '../core/settings'
import { getResolvedProviderConfig } from '../../shared/services/provider/resolvedProviderConfig'
import { getPreset } from '../core/promptBank'
import { createFinalFromApprovedVersion } from '../core/store/versionStore'

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
  ipcMain.handle('version:generateFinal', async (_event, ...args: any[]) => {
    const jobId = typeof args[0] === 'string' ? (args[0] as string) : (args[0]?.jobId as string)
    const approvedVersionId = typeof args[0] === 'string' ? (args[1] as string) : (args[0]?.versionId as string)

    const version = await createFinalFromApprovedVersion({
      jobId,
      approvedVersionId
    })

    generateVersionFinal(jobId, version.id, (progress) => {
      sendProgress(version.id, progress)
    }).catch(err => console.error('[Final] Generation error:', err))

    return version
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

  // ─────────────────────────────────────────────────────────────
  // BATCH GENERATION HANDLERS (for grid-first workflow)
  // ─────────────────────────────────────────────────────────────

  // Batch Clean Slate generation
  ipcMain.handle('module:clean:batchGenerate', async (_event, params: {
    jobId: string
    assetIds: string[]
    sourceVersionIdByAssetId?: Record<string, string>
    injectorIds?: string[]
    guardrailIds?: string[]
  }) => {
    const { jobId, assetIds, sourceVersionIdByAssetId, injectorIds, guardrailIds } = params
    const results: { assetId: string; versionId?: string; error?: string }[] = []

    for (const assetId of assetIds) {
      try {
        const version = await generateCleanSlatePreview({
          jobId,
          assetId,
          sourceVersionId: sourceVersionIdByAssetId?.[assetId],
          injectorIds: injectorIds || [],
          customGuardrails: guardrailIds || []
        })
        
        // Start generation in background
        generateVersionPreview(jobId, version.id, (progress) => {
          sendProgress(version.id, progress)
        }).catch(err => console.error('[CleanSlate Batch] Generation error:', err))
        
        results.push({ assetId, versionId: version.id })
      } catch (error) {
        results.push({ assetId, error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return results
  })

  // Batch Staging generation
  ipcMain.handle('module:stage:batchGenerate', async (_event, params: {
    jobId: string
    assetIds: string[]
    roomType?: string
    style?: string
    sourceVersionId?: string
    sourceVersionIdByAssetId?: Record<string, string>
    injectorIds?: string[]
    guardrailIds?: string[]
  }) => {
    const { jobId, assetIds, roomType, style, sourceVersionId, sourceVersionIdByAssetId, injectorIds, guardrailIds } = params
    const results: { assetId: string; versionId?: string; error?: string }[] = []

    for (const assetId of assetIds) {
      try {
        // Use provided sourceVersionId or default to original image
        const source = sourceVersionIdByAssetId?.[assetId] || sourceVersionId || `original:${assetId}`
        
        const version = await generateStagingPreview({
          jobId,
          assetId,
          sourceVersionId: source,
          roomType: roomType || 'living room',
          style: style || 'modern contemporary',
          injectorIds: injectorIds || [],
          customGuardrails: guardrailIds || []
        })
        
        generateVersionPreview(jobId, version.id, (progress) => {
          sendProgress(version.id, progress)
        }).catch(err => console.error('[Staging Batch] Generation error:', err))
        
        results.push({ assetId, versionId: version.id })
      } catch (error) {
        results.push({ assetId, error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return results
  })

  // Batch Renovate generation
  ipcMain.handle('module:renovate:batchGenerate', async (_event, params: {
    jobId: string
    assetIds: string[]
    changes?: any
    sourceVersionId?: string
    sourceVersionIdByAssetId?: Record<string, string>
    injectorIds?: string[]
    guardrailIds?: string[]
  }) => {
    const { jobId, assetIds, changes, sourceVersionId, sourceVersionIdByAssetId, injectorIds, guardrailIds } = params
    const results: { assetId: string; versionId?: string; error?: string }[] = []

    for (const assetId of assetIds) {
      try {
        // Use provided sourceVersionId or default to original image
        const source = sourceVersionIdByAssetId?.[assetId] || sourceVersionId || `original:${assetId}`
        
        const version = await generateRenovatePreview({
          jobId,
          assetId,
          sourceVersionId: source,
          changes: changes || { floor: { enabled: false, material: 'hardwood' } },
          injectorIds: injectorIds || [],
          customGuardrails: guardrailIds || []
        })
        
        generateVersionPreview(jobId, version.id, (progress) => {
          sendProgress(version.id, progress)
        }).catch(err => console.error('[Renovate Batch] Generation error:', err))
        
        results.push({ assetId, versionId: version.id })
      } catch (error) {
        results.push({ assetId, error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return results
  })

  // Batch Twilight generation
  ipcMain.handle('module:twilight:batchGenerate', async (_event, params: {
    jobId: string
    assetIds: string[]
    presetId?: string
    promptTemplate?: string
    lightingCondition?: 'overcast' | 'sunny'
    sourceVersionIdByAssetId?: Record<string, string>
    injectorIds?: string[]
    guardrailIds?: string[]
    customInstructions?: string
  }) => {
    const {
      jobId,
      assetIds,
      presetId,
      promptTemplate,
      lightingCondition,
      sourceVersionIdByAssetId,
      injectorIds,
      guardrailIds,
      customInstructions
    } = params
    const results: { assetId: string; versionId?: string; error?: string }[] = []

    const effectivePresetId = presetId || 'twilight_exterior_classic'
    const preset = await getPreset(effectivePresetId)
    const template = promptTemplate || preset?.promptTemplate || ''

    if (!template || template.trim().length === 0) {
      throw new Error(`Twilight batchGenerate missing promptTemplate and preset not found/empty: ${effectivePresetId}`)
    }

    for (const assetId of assetIds) {
      try {
        const version = await generateTwilightPreview({
          jobId,
          assetId,
          sourceVersionId: sourceVersionIdByAssetId?.[assetId],
          presetId: effectivePresetId,
          promptTemplate: template,
          lightingCondition: lightingCondition || 'overcast',
          injectorIds: injectorIds || [],
          customGuardrails: guardrailIds || [],
          customInstructions: customInstructions || ''
        })
        
        generateVersionPreview(jobId, version.id, (progress) => {
          sendProgress(version.id, progress)
        }).catch(err => console.error('[Twilight Batch] Generation error:', err))
        
        results.push({ assetId, versionId: version.id })
      } catch (error) {
        results.push({ assetId, error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return results
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

  // Debug handlers
  ipcMain.handle('debug:getLastLog', async () => {
    return generationLogger.getLastLog()
  })

  ipcMain.handle('debug:getRecentLogs', async (_event, count: number = 10) => {
    return generationLogger.getRecentLogs(count)
  })

  ipcMain.handle('provider:getResolvedProviderConfig', async (_event, params: {
    uiProvider?: 'google' | 'openrouter'
    intendedModel: string
  }) => {
    const settings = await getSettings()
    return getResolvedProviderConfig({
      uiProvider: params.uiProvider || settings.imageProvider,
      intendedModel: params.intendedModel,
      env: process.env
    })
  })
}
