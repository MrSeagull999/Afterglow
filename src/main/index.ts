import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { config } from 'dotenv'
import { setupIpcHandlers } from './ipc'

// Load .env from project root
const envPath = app.isPackaged 
  ? join(process.resourcesPath, '.env')
  : join(__dirname, '../../.env')
config({ path: envPath })

// Log for debugging (remove in production)
console.log('Loading .env from:', envPath)
console.log('GEMINI_API_KEY configured:', !!process.env.GEMINI_API_KEY)

let mainWindow: BrowserWindow | null = null

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

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
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
