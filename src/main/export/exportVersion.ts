import { dialog } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { extname } from 'path'
import { getVersion } from '../core/store/versionStore'

export interface ExportVersionDeps {
  showSaveDialog: (options: { defaultPath: string; properties: string[] }) => Promise<{ canceled: boolean; filePath?: string }>
  getVersion: (jobId: string, versionId: string) => Promise<{ outputPath?: string } | null>
  readFile: (path: string) => Promise<Buffer>
  writeFile: (path: string, data: Buffer) => Promise<void>
}

export const defaultExportVersionDeps: ExportVersionDeps = {
  showSaveDialog: (options) => dialog.showSaveDialog(options as any) as any,
  getVersion,
  readFile,
  writeFile
}

export async function exportVersion(params: {
  jobId: string
  versionId: string
  suggestedName?: string
  deps?: ExportVersionDeps
}): Promise<{ savedPath: string } | null> {
  const deps = params.deps || defaultExportVersionDeps

  const version = await deps.getVersion(params.jobId, params.versionId)
  if (!version) return null

  const inputPath = version.outputPath
  if (!inputPath) return null

  const ext = extname(inputPath) || '.png'
  const defaultPath = params.suggestedName ? `${params.suggestedName}${ext}` : `Afterglow_Export${ext}`

  const res = await deps.showSaveDialog({
    defaultPath,
    properties: ['createDirectory', 'showOverwriteConfirmation']
  })

  if (res.canceled || !res.filePath) return null

  const bytes = await deps.readFile(inputPath)
  await deps.writeFile(res.filePath, bytes)

  return { savedPath: res.filePath }
}
