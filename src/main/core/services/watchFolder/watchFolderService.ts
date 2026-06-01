import { watch, FSWatcher, existsSync, statSync, readdirSync } from 'fs'
import { readdir } from 'fs/promises'
import { join, extname, basename } from 'path'
import { BrowserWindow } from 'electron'
import { createAsset } from '../../store/assetStore'

const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.webp'])

interface WatchFolderState {
  watcher: FSWatcher | null
  folderPath: string
  jobId: string
  // Track files already imported: filename -> mtime (ms)
  importedFiles: Map<string, number>
  debounceTimer: ReturnType<typeof setTimeout> | null
  pendingFiles: Set<string>
}

let state: WatchFolderState | null = null

function sendToRenderer(channel: string, data: unknown) {
  const wins = BrowserWindow.getAllWindows()
  wins.forEach(w => w.webContents.send(channel, data))
}

function isImageFile(filePath: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extname(filePath).toLowerCase())
}

function isTempFile(filename: string): boolean {
  return filename.startsWith('.') || filename.startsWith('._') || filename.endsWith('.tmp')
}

async function processNewFiles(folderPath: string, jobId: string, importedFiles: Map<string, number>) {
  if (!existsSync(folderPath)) return

  let entries: string[]
  try {
    entries = await readdir(folderPath)
  } catch {
    return
  }

  const newFiles: string[] = []

  for (const filename of entries) {
    if (isTempFile(filename)) continue

    const filePath = join(folderPath, filename)
    if (!isImageFile(filePath)) continue

    let mtime: number
    try {
      const stat = statSync(filePath)
      mtime = stat.mtimeMs
      if (!stat.isFile()) continue
    } catch {
      continue
    }

    const known = importedFiles.get(filename)
    if (known === mtime) continue // Already imported this exact version

    newFiles.push(filePath)
    importedFiles.set(filename, mtime)
  }

  if (newFiles.length === 0) return

  console.log(`[WatchFolder] Detected ${newFiles.length} new file(s) in ${folderPath}`)

  const createdAssetIds: string[] = []
  for (const filePath of newFiles) {
    try {
      const asset = await createAsset({
        jobId,
        name: basename(filePath),
        sourcePath: filePath
      })
      createdAssetIds.push(asset.id)
      console.log(`[WatchFolder] Imported: ${basename(filePath)} → asset ${asset.id}`)
    } catch (err: any) {
      console.error(`[WatchFolder] Failed to import ${filePath}:`, err.message)
    }
  }

  if (createdAssetIds.length > 0) {
    sendToRenderer('watchFolder:newAssets', { jobId, assetIds: createdAssetIds, count: createdAssetIds.length })
  }
}

export function startWatching(folderPath: string, jobId: string): { success: boolean; error?: string } {
  if (!existsSync(folderPath)) {
    return { success: false, error: `Folder does not exist: ${folderPath}` }
  }

  // Stop any existing watcher
  stopWatching()

  const importedFiles = new Map<string, number>()

  // Snapshot existing files so we don't re-import them on start
  try {
    const existing = readdirSync(folderPath)
    for (const filename of existing) {
      if (isTempFile(filename)) continue
      const filePath = join(folderPath, filename)
      if (!isImageFile(filePath)) continue
      try {
        const stat = statSync(filePath)
        if (stat.isFile()) importedFiles.set(filename, stat.mtimeMs)
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  const pendingFiles = new Set<string>()

  const watcher = watch(folderPath, { persistent: false }, (event, filename) => {
    if (!filename || isTempFile(filename) || !isImageFile(filename)) return

    pendingFiles.add(filename)

    // Debounce: wait 2s after last change before processing
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      processNewFiles(folderPath, jobId, importedFiles)
      pendingFiles.clear()
      debounceTimer = null
    }, 2000)
  })

  watcher.on('error', (err) => {
    console.error('[WatchFolder] Watcher error:', err)
    sendToRenderer('watchFolder:error', { error: err.message })
  })

  state = { watcher, folderPath, jobId, importedFiles, debounceTimer, pendingFiles }
  console.log(`[WatchFolder] Watching ${folderPath} for job ${jobId}`)
  sendToRenderer('watchFolder:status', { active: true, folderPath, jobId })

  return { success: true }
}

export function stopWatching(): void {
  if (!state) return

  if (state.debounceTimer) clearTimeout(state.debounceTimer)
  try { state.watcher?.close() } catch { /* ignore */ }
  state = null
  console.log('[WatchFolder] Stopped watching')

  const wins = BrowserWindow.getAllWindows()
  wins.forEach(w => {
    try { w.webContents.send('watchFolder:status', { active: false }) } catch { /* ignore */ }
  })
}

export function getWatchFolderState(): { active: boolean; folderPath?: string; jobId?: string } {
  if (!state) return { active: false }
  return { active: true, folderPath: state.folderPath, jobId: state.jobId }
}
