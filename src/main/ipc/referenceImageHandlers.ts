import { ipcMain, dialog } from 'electron'
import type { ModuleType, ReferenceImage } from '../../shared/types'
import {
  getReferenceImages,
  getReferenceImage,
  addReferenceImage,
  deleteReferenceImage,
  updateReferenceImage
} from '../core/services/referenceImageService'

export function registerReferenceImageHandlers() {
  ipcMain.handle('references:getForModule', async (_event, module: ModuleType) => {
    return await getReferenceImages(module)
  })

  ipcMain.handle('references:get', async (_event, module: ModuleType, id: string) => {
    return await getReferenceImage(module, id)
  })

  ipcMain.handle('references:add', async (_event, params: {
    module: ModuleType
    name: string
    sourceImagePath: string
    description?: string
  }) => {
    return await addReferenceImage(
      params.module,
      params.name,
      params.sourceImagePath,
      params.description
    )
  })

  ipcMain.handle('references:delete', async (_event, module: ModuleType, id: string) => {
    await deleteReferenceImage(module, id)
  })

  ipcMain.handle('references:update', async (_event, params: {
    module: ModuleType
    id: string
    name?: string
    description?: string
  }) => {
    return await updateReferenceImage(params.module, params.id, {
      name: params.name,
      description: params.description
    })
  })

  ipcMain.handle('references:selectFile', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  })
}
