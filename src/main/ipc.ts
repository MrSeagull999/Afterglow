import { ipcMain, BrowserWindow } from 'electron'
import { readFile } from 'fs/promises'
import { scanDirectory } from './core/fileScan'
import { 
  createRun, 
  getRun, 
  updateRun, 
  listRuns, 
  approveImages, 
  getApprovedImages,
  updateImageStatus,
  Run,
  ImageEntry
} from './core/runStore'
import { getPresets, getPreset, getRelightPresets } from './core/promptBank'
import { generatePreview, generatePreviewBatch } from './core/gemini/previewGenerate'
import { submitBatch } from './core/gemini/batchSubmit'
import { pollBatch } from './core/gemini/batchPoll'
import { fetchBatchResults } from './core/gemini/batchFetch'
import { generateThumbnail } from './core/image/thumb'
import { stripExif, readExif } from './core/exif'
import { estimateCost } from './core/costEstimate'
import { getSettings, updateSettings, Settings } from './core/settings'
import { assembleTwilightPrompt, LightingCondition } from './core/lightingModifiers'
import { registerReferenceImageHandlers } from './ipc/referenceImageHandlers'

export function setupIpcHandlers(mainWindow: BrowserWindow): void {
  registerReferenceImageHandlers()
  ipcMain.handle('scan:directory', async (_, dirPath: string) => {
    return scanDirectory(dirPath)
  })

  ipcMain.handle('presets:getAll', async () => {
    return getPresets()
  })

  ipcMain.handle('presets:get', async (_, presetId: string) => {
    return getPreset(presetId)
  })

  ipcMain.handle('presets:getRelight', async () => {
    return getRelightPresets()
  })

  ipcMain.handle('run:create', async (_, params: { 
    inputDir: string
    listingName: string
    images: ImageEntry[]
    defaultPresetId: string
  }) => {
    return createRun(params)
  })

  ipcMain.handle('run:get', async (_, runId: string) => {
    return getRun(runId)
  })

  ipcMain.handle('run:update', async (_, runId: string, updates: Partial<Run>) => {
    return updateRun(runId, updates)
  })

  ipcMain.handle('run:list', async () => {
    return listRuns()
  })

  ipcMain.handle('run:approve', async (_, runId: string, imagePaths: string[], presetOverrides?: Record<string, string>) => {
    return approveImages(runId, imagePaths, presetOverrides)
  })

  ipcMain.handle('run:getApproved', async (_, runId: string) => {
    return getApprovedImages(runId)
  })

  ipcMain.handle('run:updateImageStatus', async (_, runId: string, imagePath: string, status: ImageEntry['status'], error?: string) => {
    return updateImageStatus(runId, imagePath, status, error)
  })

  ipcMain.handle('preview:generate', async (event, params: {
    runId: string
    imagePath: string
    presetId: string
    customPrompt?: string
  }) => {
    console.log('[IPC] Starting preview generation:', params.imagePath)
    const result = await generatePreview(params, (progress) => {
      console.log('[IPC] Preview progress:', params.imagePath, progress + '%')
      mainWindow.webContents.send('preview:progress', { ...params, progress })
    })
    console.log('[IPC] Preview generation complete:', params.imagePath, result.success ? 'SUCCESS' : 'FAILED')
    if (!result.success) {
      console.error('[IPC] Preview error:', result.error)
    }
    if (result.seedRejected) {
      console.log('[IPC] Seed was rejected by API')
      mainWindow.webContents.send('seed:rejected', { runId: params.runId })
    }
    return result
  })

  ipcMain.handle('preview:generateBatch', async (event, params: {
    runId: string
    images: Array<{ path: string; presetId: string }>
  }) => {
    const results = await generatePreviewBatch(params, (imagePath, progress, result) => {
      mainWindow.webContents.send('preview:progress', { 
        runId: params.runId, 
        imagePath, 
        progress,
        result 
      })
    })
    return results
  })

  ipcMain.handle('batch:submit', async (_, runId: string) => {
    return submitBatch(runId, (progress) => {
      mainWindow.webContents.send('batch:progress', { runId, progress })
    })
  })

  ipcMain.handle('batch:poll', async (_, runId: string, batchId: string) => {
    return pollBatch(runId, batchId, (status) => {
      mainWindow.webContents.send('batch:status', { runId, batchId, status })
    })
  })

  ipcMain.handle('batch:fetch', async (_, runId: string, batchId: string) => {
    return fetchBatchResults(runId, batchId, (imagePath, progress) => {
      mainWindow.webContents.send('batch:fetchProgress', { runId, imagePath, progress })
    })
  })

  ipcMain.handle('thumbnail:generate', async (_, imagePath: string) => {
    return generateThumbnail(imagePath)
  })

  ipcMain.handle('exif:strip', async (_, imagePath: string, outputPath: string) => {
    return stripExif(imagePath, outputPath)
  })

  ipcMain.handle('exif:read', async (_, imagePath: string) => {
    return readExif(imagePath)
  })

  ipcMain.handle('cost:estimate', async (_, params: {
    previewCount: number
    finalCount: number
  }) => {
    return estimateCost(params)
  })

  ipcMain.handle('settings:get', async () => {
    return getSettings()
  })

  ipcMain.handle('settings:update', async (_, updates: Partial<Settings>) => {
    return updateSettings(updates)
  })

  ipcMain.handle('image:readAsDataURL', async (_, imagePath: string) => {
    try {
      const buffer = await readFile(imagePath)
      const base64 = buffer.toString('base64')
      const ext = imagePath.toLowerCase().split('.').pop()
      let mimeType = 'image/jpeg'
      
      if (ext === 'png') mimeType = 'image/png'
      else if (ext === 'webp') mimeType = 'image/webp'
      else if (ext === 'gif') mimeType = 'image/gif'
      
      return `data:${mimeType};base64,${base64}`
    } catch (error) {
      console.error('Failed to read image:', error)
      return null
    }
  })

  ipcMain.handle('prompt:assemble', async (_, basePrompt: string, lightingCondition: LightingCondition, customPrompt?: string) => {
    return assembleTwilightPrompt(basePrompt, lightingCondition, customPrompt)
  })
}
