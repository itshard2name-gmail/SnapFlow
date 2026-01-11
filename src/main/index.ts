import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  clipboard,
  nativeImage,
  Tray,
  Menu,
  systemPreferences,
  protocol,
  net
} from 'electron'
import path, { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { DatabaseManager } from './database'
import { CaptureManager } from './capture'
import { getOpenWindows } from './window-utils'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import { pathToFileURL } from 'url'

const execPromise = promisify(exec)

// Check for Accessibility Permissions on macOS
if (process.platform === 'darwin') {
  const trusted = systemPreferences.isTrustedAccessibilityClient(true)
  console.log('Accessibility Permission:', trusted ? 'Granted' : 'Not Granted')
}
import icon from '../../resources/icon.png?asset'

let tray: Tray | null = null
let mainWindow: BrowserWindow | null = null
let isQuitting = false

function createWindow(): void {
  // If window exists, just show it
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
    return
  }

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    title: 'Scope',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Hide on close (macOS)
  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin' && !isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
    // On other platforms, let it close naturally
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
// const { protocol, net } = require('electron')
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

  // System Tray Setup
  const iconPath = nativeImage.createFromPath(join(__dirname, '../../resources/icon.png'))
  // Resize icon for Tray (usually 16x16 or 22x22 for macOS)
  const trayIcon = iconPath.resize({ width: 22, height: 22 })
  tray = new Tray(trayIcon)
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Scope', click: () => createWindow() },
    { type: 'separator' },
    { label: 'Quit Scope', click: () => app.quit() }
  ])
  tray.setToolTip('Scope')
  tray.setContextMenu(contextMenu)

  // Auto-launch Setup
  ipcMain.handle('settings:toggle-auto-launch', (_, enabled: boolean) => {
    app.setLoginItemSettings({
      openAtLogin: enabled
    })
    return app.getLoginItemSettings().openAtLogin
  })

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

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
      // const { pathToFileURL } = require('url')
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
    // const fs = require('fs')
    // const path = require('path')
    const now = new Date()
    const datePart = now.toISOString().split('T')[0]
    const timePart = now.toTimeString().split(' ')[0]
    const displayTime = `${datePart} ${timePart}`
    const filenameTimePart = timePart.replace(/:/g, '')

    const destPath = path.join(
      app.getPath('userData'),
      `mock-${datePart.replace(/-/g, '')}-${filenameTimePart}.png`
    )

    // Create a simple colored SVG as a placeholder image
    const svgContent = `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#${Math.floor(Math.random() * 16777215).toString(16)}"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="40" fill="white">Scope Capture</text>
    </svg>`

    fs.writeFileSync(destPath, svgContent)

    return dbManager.addCapture({
      filePath: destPath,
      thumbPath: destPath,
      sourceTitle: `Mock Window (${displayTime})`,
      width: 800,
      height: 600
    })
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    // MODIFIED: explicitly check mainWindow existence for our "Hide-on-Close" logic
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
    } else {
      createWindow()
    }
  })
})

const dbManager = new DatabaseManager()

// We can keep the old CaptureManager if it's doing something specific,
// or just use our new handlers. For now, we'll initialize it as before.
new CaptureManager(dbManager)

ipcMain.handle('get-open-windows', async () => {
  return await getOpenWindows()
})

ipcMain.handle(
  'capture-window',
  async (_, { id, sourceTitle }: { id: number; sourceTitle: string }) => {
    const now = new Date()
    const datePart = now.toISOString().split('T')[0] // YYYY-MM-DD
    const timePart = now.toTimeString().split(' ')[0] // HH:mm:ss
    const displayTime = `${datePart} ${timePart}` // YYYY-MM-DD HH:mm:ss
    const filenameTimePart = timePart.replace(/:/g, '') // HHmmss
    const filename = `capture-${datePart.replace(/-/g, '')}-${filenameTimePart}.png` // YYYYMMDD-HHmmss

    const tempPath = join(app.getPath('userData'), `temp-${Date.now()}.png`)
    const finalPath = join(app.getPath('userData'), filename)

    // Play shutter sound immediately (macOS only)
    if (process.platform === 'darwin') {
      const soundPath =
        '/System/Library/Components/CoreAudio.component/Contents/SharedSupport/SystemSounds/system/Grab.aif'
      exec(`afplay "${soundPath}"`, (error) => {
        if (error) console.error('Failed to play shutter sound:', error)
      })
    }

    try {
      await execPromise(`screencapture -x -o -l ${id} "${tempPath}"`)

      if (fs.existsSync(tempPath)) {
        fs.renameSync(tempPath, finalPath)

        const { stdout } = await execPromise(`sips -g pixelWidth -g pixelHeight "${finalPath}"`)
        const widthMatch = stdout.match(/pixelWidth: (\d+)/)
        const heightMatch = stdout.match(/pixelHeight: (\d+)/)
        const width = widthMatch ? parseInt(widthMatch[1]) : 0
        const height = heightMatch ? parseInt(heightMatch[1]) : 0

        const capture = await dbManager.addCapture({
          filePath: finalPath,
          thumbPath: finalPath,
          sourceTitle: `${sourceTitle || 'Window Capture'} (${displayTime})`,
          width,
          height
        })

        // Notify renderers
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
        BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('capture-saved'))

        return capture
      } else {
        throw new Error('Screenshot file was not created')
      }
    } catch (error) {
      console.error('Capture window failed:', error)
      throw error
    }
  }
)

ipcMain.handle('get-all-captures', (_, filter: 'all' | 'favorites' | 'trash' = 'all') => {
  return dbManager.getAllCaptures(filter)
})

ipcMain.handle('get-category-counts', () => {
  return dbManager.getCategoryCounts()
})

ipcMain.handle('delete-capture', (_, id: string) => {
  const capture = dbManager.getCapture(id)
  if (capture) {
    try {
      // Delete files immediately for permanent delete
      if (capture.filePath && fs.existsSync(capture.filePath)) fs.unlinkSync(capture.filePath)
      if (
        capture.thumbPath &&
        capture.thumbPath !== capture.filePath &&
        fs.existsSync(capture.thumbPath)
      ) {
        fs.unlinkSync(capture.thumbPath)
      }
    } catch (error) {
      console.error('Error deleting capture files:', error)
    }
    dbManager.deleteCapture(id)
  }
})

ipcMain.handle('soft-delete-capture', (_, id: string) => {
  dbManager.softDeleteCapture(id)
})

ipcMain.handle('restore-capture', (_, id: string) => {
  dbManager.restoreCapture(id)
})

ipcMain.handle('toggle-favorite', (_, id: string) => {
  dbManager.toggleFavorite(id)
})

ipcMain.handle('empty-trash', () => {
  const trashed = dbManager.getTrashFiles()
  trashed.forEach((capture) => {
    try {
      if (capture.filePath && fs.existsSync(capture.filePath)) fs.unlinkSync(capture.filePath)
      if (
        capture.thumbPath &&
        capture.thumbPath !== capture.filePath &&
        fs.existsSync(capture.thumbPath)
      ) {
        fs.unlinkSync(capture.thumbPath)
      }
    } catch (error) {
      console.error(`Error deleting trashed file ${capture.id}:`, error)
    }
  })
  dbManager.emptyTrash()
})

ipcMain.handle('rename-capture', (_, { id, title }: { id: string; title: string }) => {
  return dbManager.renameCapture(id, title)
})

ipcMain.handle('update-notes', (_, { id, notes }: { id: string; notes: string }) => {
  return dbManager.updateNotes(id, notes)
})

ipcMain.handle('open-path', async (_, path: string) => {
  await shell.openPath(path)
})

ipcMain.handle('copy-image-to-clipboard', async (_, filePath: string) => {
  try {
    const image = nativeImage.createFromPath(filePath)
    clipboard.writeImage(image)
    return true
  } catch (error) {
    console.error('Failed to copy image to clipboard:', error)
    return false
  }
})

ipcMain.handle('save-capture-as', async (_, id: string) => {
  const { dialog } = await import('electron')
  const capture = dbManager.getCapture(id)

  if (!capture || !fs.existsSync(capture.filePath)) {
    return false
  }

  const result = await dialog.showSaveDialog(mainWindow!, {
    title: 'Export Capture',
    defaultPath: `Capture-${new Date(capture.createdAt).toISOString().split('T')[0]}.png`,
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }]
  })

  if (!result.canceled && result.filePath) {
    try {
      fs.copyFileSync(capture.filePath, result.filePath)
      return true
    } catch (error) {
      console.error('Failed to export file:', error)
      return false
    }
  }
  return false
})

ipcMain.handle(
  'save-annotated-image',
  async (_, { id, dataUrl, overwrite }: { id: string; dataUrl: string; overwrite: boolean }) => {
    const capture = dbManager.getCapture(id)
    if (!capture) return false

    try {
      const base64Data = dataUrl.split(';base64,').pop()
      if (!base64Data) return false

      const buffer = Buffer.from(base64Data, 'base64')

      if (overwrite) {
        fs.writeFileSync(capture.filePath, buffer)
        if (capture.thumbPath && fs.existsSync(capture.thumbPath)) {
          fs.writeFileSync(capture.thumbPath, buffer)
        }
      } else {
        // Save as copy
        const dir = path.dirname(capture.filePath)
        const ext = path.extname(capture.filePath)
        const base = path.basename(capture.filePath, ext)
        const now = new Date()
        const datePart = now.toISOString().split('T')[0] // YYYY-MM-DD
        const timePart = now.toTimeString().split(' ')[0] // HH:mm:ss
        const displayTime = `${datePart} ${timePart}` // YYYY-MM-DD HH:mm:ss
        const filenameTimePart = timePart.replace(/:/g, '') // HHmmss

        const newPath = path.join(
          dir,
          `${base.split('-annotated-')[0]}-annotated-${datePart.replace(/-/g, '')}-${filenameTimePart}${ext}`
        )
        fs.writeFileSync(newPath, buffer)

        // Add to DB
        await dbManager.addCapture({
          filePath: newPath,
          thumbPath: newPath,
          sourceTitle: `${capture.sourceTitle.split(' (')[0]} (Annotated) (${displayTime})`,
          width: capture.width,
          height: capture.height
        })
      }

      // Notify all windows to refresh
      BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('capture-saved'))
      return true
    } catch (error) {
      console.error('Failed to save annotated image:', error)
      return false
    }
  }
)

ipcMain.handle('copy-image-data-to-clipboard', async (_, dataUrl: string) => {
  try {
    const img = nativeImage.createFromDataURL(dataUrl)
    clipboard.writeImage(img)
    return true
  } catch (error) {
    console.error('Failed to copy image to clipboard:', error)
    return false
  }
})

app.on('before-quit', () => {
  isQuitting = true
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
