import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { config } from 'dotenv'
import { setupIpcHandlers } from './ipc'
import { registerAllHandlers } from './ipc/index'
import { migrateJobsToUserData, hasLegacyJobs, getDataBasePath } from './core/paths'

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
  
  createWindow()

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

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  return result.canceled ? null : result.filePaths[0]
})
