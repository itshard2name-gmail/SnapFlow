import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Register privileged schemes before app is ready
const { protocol, net } = require('electron')
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      bypassCSP: true,
      corsEnabled: true
    }
  }
])

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  console.log('--- APP STARTING ---')
  console.log('Build Verification ID:', Date.now()) // PROOF OF NEW BUILD
  console.log('--------------------')

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Register 'media' protocol for accessing local files
  protocol.handle('media', (request) => {
    try {
      console.log('Media Protocol Request:', request.url)

      const url = new URL(request.url)
      // Robust handling: sometimes "Users" is parsed as host if slashes are ambiguous
      // e.g. media://Users/Kevin... -> host: Users, pathname: /Kevin...
      // e.g. media:///Users/Kevin... -> host: "", pathname: /Users/Kevin...

      let filePath = url.pathname
      if (url.host) {
        filePath = `/${url.host}${url.pathname}`
      }

      // Decode: %20 -> space
      filePath = decodeURIComponent(filePath)

      console.log('Resolved File Path:', filePath)

      // Use net.fetch with file:// protocol
      // pathToFileURL handles encoding safe characters for us
      const { pathToFileURL } = require('url')
      const fileUrl = pathToFileURL(filePath).toString()

      console.log('Fetching:', fileUrl)
      return net.fetch(fileUrl)
    } catch (error) {
      console.error('Protocol Error:', error)
      return new Response('Bad Request', { status: 400 })
    }
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.handle('mock-add-capture', () => {
    // Mock logic: Create a dummy file in userData and add to DB
    const fs = require('fs')
    const path = require('path')
    const destPath = path.join(app.getPath('userData'), `mock-${Date.now()}.png`)

    // Create a simple colored SVG as a placeholder image
    const svgContent = `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#${Math.floor(Math.random() * 16777215).toString(16)}"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="40" fill="white">SnapFlow Capture</text>
    </svg>`

    fs.writeFileSync(destPath, svgContent)

    return dbManager.addCapture({
      filePath: destPath,
      thumbPath: destPath, // Using same file for thumb for simplicity in mock
      sourceTitle: 'Mock Window',
      width: 800,
      height: 600
    })
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
import { DatabaseManager } from './database'
import { CaptureManager } from './capture'

const dbManager = new DatabaseManager()
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const captureManager = new CaptureManager(dbManager)

ipcMain.handle('get-all-captures', () => {
  return dbManager.getAllCaptures()
})

ipcMain.handle('delete-capture', (_, id: string) => {
  dbManager.deleteCapture(id)
})

ipcMain.handle('open-path', async (_, path: string) => {
  await shell.openPath(path)
})
