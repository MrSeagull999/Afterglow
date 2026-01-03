import { contextBridge, ipcRenderer } from 'electron'

export interface ElectronAPI {
  openDirectory: () => Promise<string | null>
  scanDirectory: (dirPath: string) => Promise<any[]>
  getPresets: () => Promise<any[]>
  getPreset: (presetId: string) => Promise<any>
  createRun: (params: any) => Promise<any>
  getRun: (runId: string) => Promise<any>
  updateRun: (runId: string, updates: any) => Promise<any>
  listRuns: () => Promise<any[]>
  approveImages: (runId: string, imagePaths: string[], presetOverrides?: Record<string, string>) => Promise<void>
  getApprovedImages: (runId: string) => Promise<any[]>
  updateImageStatus: (runId: string, imagePath: string, status: string, error?: string) => Promise<void>
  generatePreview: (params: { runId: string; imagePath: string; presetId: string; customPrompt?: string }) => Promise<any>
  generatePreviewBatch: (params: { runId: string; images: Array<{ path: string; presetId: string }> }) => Promise<any[]>
  submitBatch: (runId: string) => Promise<any>
  pollBatch: (runId: string, batchId: string) => Promise<any>
  fetchBatchResults: (runId: string, batchId: string) => Promise<any>
  generateThumbnail: (imagePath: string) => Promise<string>
  stripExif: (imagePath: string, outputPath: string) => Promise<void>
  readExif: (imagePath: string) => Promise<any>
  estimateCost: (params: { previewCount: number; finalCount: number }) => Promise<any>
  getSettings: () => Promise<any>
  updateSettings: (updates: any) => Promise<any>
  readImageAsDataURL: (imagePath: string) => Promise<string | null>
  assemblePrompt: (basePrompt: string, lightingCondition: 'overcast' | 'sunny', customPrompt?: string) => Promise<string>
  onPreviewProgress: (callback: (data: any) => void) => () => void
  onBatchProgress: (callback: (data: any) => void) => () => void
  onBatchStatus: (callback: (data: any) => void) => () => void
  onBatchFetchProgress: (callback: (data: any) => void) => () => void
  onSeedRejected: (callback: (data: any) => void) => () => void
}

const electronAPI: ElectronAPI = {
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  scanDirectory: (dirPath) => ipcRenderer.invoke('scan:directory', dirPath),
  getPresets: () => ipcRenderer.invoke('presets:getAll'),
  getPreset: (presetId) => ipcRenderer.invoke('presets:get', presetId),
  createRun: (params) => ipcRenderer.invoke('run:create', params),
  getRun: (runId) => ipcRenderer.invoke('run:get', runId),
  updateRun: (runId, updates) => ipcRenderer.invoke('run:update', runId, updates),
  listRuns: () => ipcRenderer.invoke('run:list'),
  approveImages: (runId, imagePaths, presetOverrides) => 
    ipcRenderer.invoke('run:approve', runId, imagePaths, presetOverrides),
  getApprovedImages: (runId) => ipcRenderer.invoke('run:getApproved', runId),
  updateImageStatus: (runId, imagePath, status, error) => 
    ipcRenderer.invoke('run:updateImageStatus', runId, imagePath, status, error),
  generatePreview: (params) => ipcRenderer.invoke('preview:generate', params),
  generatePreviewBatch: (params) => ipcRenderer.invoke('preview:generateBatch', params),
  submitBatch: (runId) => ipcRenderer.invoke('batch:submit', runId),
  pollBatch: (runId, batchId) => ipcRenderer.invoke('batch:poll', runId, batchId),
  fetchBatchResults: (runId, batchId) => ipcRenderer.invoke('batch:fetch', runId, batchId),
  generateThumbnail: (imagePath) => ipcRenderer.invoke('thumbnail:generate', imagePath),
  stripExif: (imagePath, outputPath) => ipcRenderer.invoke('exif:strip', imagePath, outputPath),
  readExif: (imagePath) => ipcRenderer.invoke('exif:read', imagePath),
  estimateCost: (params) => ipcRenderer.invoke('cost:estimate', params),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (updates) => ipcRenderer.invoke('settings:update', updates),
  readImageAsDataURL: (imagePath) => ipcRenderer.invoke('image:readAsDataURL', imagePath),
  assemblePrompt: (basePrompt, lightingCondition, customPrompt) => 
    ipcRenderer.invoke('prompt:assemble', basePrompt, lightingCondition, customPrompt),
  
  onPreviewProgress: (callback) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('preview:progress', handler)
    return () => ipcRenderer.removeListener('preview:progress', handler)
  },
  onBatchProgress: (callback) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('batch:progress', handler)
    return () => ipcRenderer.removeListener('batch:progress', handler)
  },
  onBatchStatus: (callback) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('batch:status', handler)
    return () => ipcRenderer.removeListener('batch:status', handler)
  },
  onBatchFetchProgress: (callback) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('batch:fetchProgress', handler)
    return () => ipcRenderer.removeListener('batch:fetchProgress', handler)
  },
  onSeedRejected: (callback) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('seed:rejected', handler)
    return () => ipcRenderer.removeListener('seed:rejected', handler)
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// Phase 2: Generic IPC invoke for new handlers
const api = {
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  on: (channel: string, callback: (...args: any[]) => void) => {
    const handler = (_: any, ...args: any[]) => callback(...args)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
  onVersionProgress: (callback: (data: { versionId: string; progress: number }) => void) => {
    const handler = (_: any, data: { versionId: string; progress: number }) => callback(data)
    ipcRenderer.on('version:progress', handler)
    return () => ipcRenderer.removeListener('version:progress', handler)
  }
}

contextBridge.exposeInMainWorld('api', api)

declare global {
  interface Window {
    electronAPI: ElectronAPI
    api: {
      invoke: (channel: string, ...args: any[]) => Promise<any>
      on: (channel: string, callback: (...args: any[]) => void) => () => void
      onVersionProgress: (callback: (data: { versionId: string; progress: number }) => void) => () => void
    }
  }
}
