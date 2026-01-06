import { BrowserWindow, screen, ipcMain, globalShortcut, app, nativeImage } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { execSync, exec } from 'child_process'
import * as fs from 'fs'
import path from 'path'
import { DatabaseManager } from './database'

export class CaptureManager {
  private captureWindow: BrowserWindow | null = null
  private dbManager: DatabaseManager
  private currentDisplayBounds: Electron.Rectangle | null = null

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager
    app.whenReady().then(() => {
      this.registerShortcuts()
    })
    this.registerIPC()
  }

  private registerShortcuts() {
    const register = (accelerator: string, callback: () => void) => {
      if (globalShortcut.isRegistered(accelerator)) {
        globalShortcut.unregister(accelerator)
      }
      const success = globalShortcut.register(accelerator, callback)
      if (!success) {
        console.error(`Hotkey Conflict: ${accelerator}`)
      } else {
        console.log(`Hotkey Registered: ${accelerator}`)
      }
    }

    register('Control+Shift+A', () => {
      this.startCapture('region')
    })

    register('Control+Shift+W', () => {
      this.startCapture('window')
    })
  }

  private registerIPC() {
    ipcMain.handle('capture-confirmed', async (_, { x, y, width, height }) => {
      // Unregister Escape immediately to restore system behavior
      this.cleanupCaptureShortcuts()

      // Play shutter sound immediately (macOS only)
      if (process.platform === 'darwin') {
        const soundPath =
          '/System/Library/Components/CoreAudio.component/Contents/SharedSupport/SystemSounds/system/Grab.aif'
        exec(`afplay "${soundPath}"`, (error) => {
          if (error) console.error('Failed to play shutter sound:', error)
        })
      }

      try {
        await this.processCapture(x, y, width, height)
        this.closeCaptureWindow()
        return { success: true }
      } catch (error) {
        console.error('Capture processing failed:', error)
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('capture-cancelled', () => {
      this.closeCaptureWindow()
    })
  }

  private setupCaptureShortcuts() {
    // Register ESC to cancel capture since window is not focused
    // We check if it's already registered to avoid error
    if (!globalShortcut.isRegistered('Escape')) {
      globalShortcut.register('Escape', () => {
        console.log('Global Escape triggered - cancelling capture')
        this.closeCaptureWindow()
      })
    }
  }

  private cleanupCaptureShortcuts() {
    // Unregister ESC only (don't unregister main hotkeys)
    if (globalShortcut.isRegistered('Escape')) {
      globalShortcut.unregister('Escape')
    }
  }

  private async startCapture(mode: 'region' | 'window' = 'region') {
    const cursorPoint = screen.getCursorScreenPoint()
    const currentDisplay = screen.getDisplayNearestPoint(cursorPoint)
    this.currentDisplayBounds = currentDisplay.bounds
    const { x, y, width, height } = currentDisplay.bounds

    // Ensure window exists
    if (!this.captureWindow || this.captureWindow.isDestroyed()) {
      this.captureWindow = new BrowserWindow({
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height),
        // Robust Window Configuration for macOS
        // 'panel' type ensures it floats like Spotlight/HUD and doesn't steal focus
        type: 'panel', 
        transparent: true,
        backgroundColor: '#00000000',
        frame: false,
        // High level floating
        alwaysOnTop: true, 
        skipTaskbar: true,
        resizable: false,
        movable: false,
        focusable: false, // Maintain focusable: false
        hasShadow: false,
        enableLargerThanScreen: true,
        roundedCorners: false, // Ensure full edge-to-edge
        show: false,
        webPreferences: {
          preload: join(__dirname, '../preload/index.js'),
          sandbox: false,
          contextIsolation: true,
          nodeIntegration: false
        }
      })
      
      // Ensure visible everywhere
      this.captureWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

      this.captureWindow.on('closed', () => {
        this.captureWindow = null
        this.cleanupCaptureShortcuts() // Safety cleanup
      })

      if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        const url = `${process.env['ELECTRON_RENDERER_URL']}/index.html?mode=${mode}`
        this.captureWindow.loadURL(url)
      } else {
        this.captureWindow.loadFile(join(__dirname, '../renderer/index.html'), {
          search: `?mode=${mode}`
        })
      }
    } else {
      // Reuse existing window: Move and Resize
      this.captureWindow.setBounds({
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height)
      })
      // Reload to reset state if switching modes
      const url = is.dev && process.env['ELECTRON_RENDERER_URL'] 
         ? `${process.env['ELECTRON_RENDERER_URL']}/index.html?mode=${mode}`
         : `file://${join(__dirname, '../renderer/index.html')}?mode=${mode}`
      
      this.captureWindow.loadURL(url)
    }

    // Capture Shortcuts (ESC)
    this.setupCaptureShortcuts()

    // Show INACTIVE - ZERO LATENCY & NO FOCUS STEALING
    this.captureWindow.showInactive()
    // Do NOT call focus()
  }

  private closeCaptureWindow() {
    this.cleanupCaptureShortcuts()
    
    if (this.captureWindow && !this.captureWindow.isDestroyed()) {
      this.captureWindow.hide()
      // Optional: notify renderer to reset?
      // For now, reloading on next startCapture is sufficient.
    }
  }

  private async processCapture(x: number, y: number, width: number, height: number) {
    console.log(`Processing capture: x=${x}, y=${y}, w=${width}, h=${height}`)

    try {
      // 1. Hide the overlay window so it doesn't block the screenshot
      if (this.captureWindow && !this.captureWindow.isDestroyed()) {
        this.captureWindow.hide()
      }

      // 2. Wait a tiny bit for window to hide (Electron is usually fast, but 50ms safety)
      await new Promise(r => setTimeout(r, 50))

      // 3. Take the screenshot of the SELECTED REGION
      const displayBounds = this.currentDisplayBounds || screen.getPrimaryDisplay().bounds
      const globalX = displayBounds.x + x
      const globalY = displayBounds.y + y

      const filename = `capture-${Date.now()}.png`
      const userDataPath = app.getPath('userData')
      const capturesDir = path.join(userDataPath, 'Captures')

      if (!fs.existsSync(capturesDir)) {
        fs.mkdirSync(capturesDir, { recursive: true })
      }

      const filePath = path.join(capturesDir, filename)

      // Use native screencapture CLI
      const cmd = `screencapture -x -R${Math.round(globalX)},${Math.round(globalY)},${Math.round(width)},${Math.round(height)} -t png "${filePath}"`
      
      console.log('Executing capture:', cmd)
      execSync(cmd)

      if (fs.existsSync(filePath)) {
        // Add to DB
        this.dbManager.addCapture({
          filePath,
          thumbPath: filePath,
          sourceTitle: 'Screen Capture',
          width: width,
          height: height
        })

        // Notify main window
        const allWindows = BrowserWindow.getAllWindows()
        const mainWindow = allWindows.find((w) => w !== this.captureWindow) // strict inequality check
        mainWindow?.webContents.send('capture-saved')
      } else {
        console.error('Capture failed: file not created')
      }

    } catch (e) {
      console.error('Error processing capture:', e)
    }
  }
}
