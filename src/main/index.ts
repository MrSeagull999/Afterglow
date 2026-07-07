import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, extname, basename } from 'path'
import { config } from 'dotenv'
import { setupIpcHandlers } from './ipc'
import { registerAllHandlers } from './ipc/index'
import { migrateJobsToUserData, hasLegacyJobs, getDataBasePath } from './core/paths'
import { startHttpServer } from './server/httpServer'
import { startWatching, stopWatching, getWatchFolderState } from './core/services/watchFolder/watchFolderService'
import { getSettings, updateSettings } from './core/settings'
import { createAsset } from './core/store/assetStore'

// Load .env from project root
const envPath = app.isPackaged 
  ? join(process.resourcesPath, '.env')
  : join(__dirname, '../../.env')
config({ path: envPath })

// Log for debugging (remove in production)
console.log('Loading .env from:', envPath)
console.log('GEMINI_API_KEY configured:', !!process.env.GEMINI_API_KEY)

let mainWindow: BrowserWindow | null = null
let handlersRegistered = false

// ── Open-with / Lightroom "Edit In" support ─────────────────────────────────
// Files arrive via macOS open-file events (Finder / LR "Edit In"), argv
// (CLI / second instance). They collect in pendingOpenFiles; the renderer
// drains the queue via 'openFiles:getPending' — on mount, and again whenever
// main pings 'openFiles:pending'. Queue stays the single source of truth so
// nothing is lost if the window isn't ready yet.

const OPENABLE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.webp'])
let pendingOpenFiles: string[] = []
let openFilesBatchTimer: ReturnType<typeof setTimeout> | null = null

function isOpenableImage(filePath: string): boolean {
  return OPENABLE_EXTENSIONS.has(extname(filePath).toLowerCase())
}

function queueOpenFiles(paths: string[]): void {
  const images = paths.filter(isOpenableImage).filter((p) => !pendingOpenFiles.includes(p))
  if (images.length === 0) return
  pendingOpenFiles.push(...images)

  // Multi-select opens arrive as separate open-file events; batch them so the
  // renderer shows one import dialog for the lot.
  if (openFilesBatchTimer) clearTimeout(openFilesBatchTimer)
  openFilesBatchTimer = setTimeout(notifyRendererOfPendingFiles, 600)
}

function notifyRendererOfPendingFiles(): void {
  openFilesBatchTimer = null
  if (pendingOpenFiles.length === 0) return
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
    mainWindow.webContents.send('openFiles:pending')
  } else if (app.isReady()) {
    createWindow()
    // Renderer pulls the queue on mount — no send needed.
  }
}

// Must be registered before app is ready or launch files are missed
app.on('open-file', (event, filePath) => {
  event.preventDefault()
  queueOpenFiles([filePath])
})

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    queueOpenFiles(argv.slice(1))
    notifyRendererOfPendingFiles()
  })
}

// Files passed on the command line (dev / CLI launches)
queueOpenFiles(process.argv.slice(1))

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f172a'
  })

  setupIpcHandlers(mainWindow)
  
  // Register handlers only once
  if (!handlersRegistered) {
    registerAllHandlers() // Phase 2 handlers
    handlersRegistered = true
  }

  if (!app.isPackaged) {
    const devUrl =
      process.env.VITE_DEV_SERVER_URL ||
      process.env.ELECTRON_RENDERER_URL ||
      'http://localhost:5173'
    console.log('[Main] Loading renderer dev URL:', devUrl)
    mainWindow.loadURL(devUrl)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  // Log data storage location
  console.log('Data storage path:', getDataBasePath())

  // Migrate legacy jobs from project folder to userData
  if (hasLegacyJobs()) {
    console.log('[Migration] Found legacy jobs folder, starting migration...')
    const { migrated, errors } = await migrateJobsToUserData()
    if (migrated.length > 0) {
      console.log(`[Migration] Successfully migrated ${migrated.length} jobs`)
    }
    if (errors.length > 0) {
      console.error('[Migration] Errors:', errors)
    }
  }

  startHttpServer(3737)
  createWindow()

  // Start watch folder if it was enabled in settings
  const settings = await getSettings()
  if (settings.watchFolderEnabled && settings.watchFolderPath && settings.watchFolderJobId) {
    const result = startWatching(settings.watchFolderPath, settings.watchFolderJobId)
    if (!result.success) {
      console.warn('[WatchFolder] Failed to start on launch:', result.error)
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// ── Open-with IPC handlers ───────────────────────────────────────────────────

ipcMain.handle('openFiles:getPending', () => {
  const files = [...pendingOpenFiles]
  pendingOpenFiles = []
  return files
})

ipcMain.handle('files:importToJob', async (_event, jobId: string, filePaths: string[]) => {
  const imported: string[] = []
  const errors: Array<{ path: string; error: string }> = []
  for (const filePath of filePaths) {
    try {
      const asset = await createAsset({
        jobId,
        name: basename(filePath),
        sourcePath: filePath
      })
      imported.push(asset.id)
      console.log(`[OpenFiles] Imported ${basename(filePath)} → asset ${asset.id}`)
    } catch (err: any) {
      console.error(`[OpenFiles] Failed to import ${filePath}:`, err.message)
      errors.push({ path: filePath, error: err.message })
    }
  }
  if (imported.length > 0) {
    // Same channel the watch folder uses, so an open JobPage refreshes itself
    BrowserWindow.getAllWindows().forEach((w) =>
      w.webContents.send('watchFolder:newAssets', { jobId, assetIds: imported, count: imported.length })
    )
  }
  return { imported, errors }
})

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  return result.canceled ? null : result.filePaths[0]
})

// ── Watch Folder IPC handlers ────────────────────────────────────────────────

ipcMain.handle('watchFolder:start', async (_event, folderPath: string, jobId: string) => {
  const result = startWatching(folderPath, jobId)
  if (result.success) {
    await updateSettings({ watchFolderEnabled: true, watchFolderPath: folderPath, watchFolderJobId: jobId })
  }
  return result
})

ipcMain.handle('watchFolder:stop', async () => {
  stopWatching()
  await updateSettings({ watchFolderEnabled: false })
  return { success: true }
})

ipcMain.handle('watchFolder:getState', () => {
  return getWatchFolderState()
})

ipcMain.handle('watchFolder:selectFolder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Choose watch folder (Lightroom export location)'
  })
  return result.canceled ? null : result.filePaths[0]
})
