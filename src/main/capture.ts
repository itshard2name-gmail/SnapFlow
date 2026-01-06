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
  private currentCapturePath: string | null = null
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
      // Play shutter sound immediately (macOS only)
      // Placed here for lowest possible latency in Main process
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

  private async startCapture(mode: 'region' | 'window' = 'region') {
    if (this.captureWindow) return

    const cursorPoint = screen.getCursorScreenPoint()
    const currentDisplay = screen.getDisplayNearestPoint(cursorPoint)
    this.currentDisplayBounds = currentDisplay.bounds
    const { x, y, width, height } = currentDisplay.bounds

    // Step 3: Ensure Integer coordinates and disable shadow
    this.captureWindow = new BrowserWindow({
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
      transparent: true,
      backgroundColor: '#00000000',
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      focusable: true, // Keep true to allow keyboard events (Esc)
      hasShadow: false,
      enableLargerThanScreen: true,
      show: false, // Fix: Do not show immediately to prevent focus stealing before capture
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    // Step 2: Force Open DevTools for Capture Window
    // this.captureWindow.webContents.openDevTools({ mode: 'detach' })

    this.captureWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
      console.error('CaptureWindow failed to load:', errorCode, errorDescription)
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      const url = `${process.env['ELECTRON_RENDERER_URL']}/index.html?mode=${mode}`
      console.log('Loading CaptureWindow URL:', url)
      this.captureWindow.loadURL(url)
    } else {
      this.captureWindow.loadFile(join(__dirname, '../renderer/index.html'), {
        search: `?mode=${mode}`
      })
    }

    // Step 2 & 1: Optimize getSources and Add Logging
    // Use actual pixel size for clarity and quality
    // Native macOS Capture Implementation
    // Replaces desktopCapturer to solve black screen/freeze issues on multi-monitor

    // CAPTURE FIRST: Take screenshot *before* showing the window or fully loading content to avoid capturing the window itself.
    // Use userData directory instead of /tmp to avoid macOS private/tmp symlink issues
    const userDataPath = app.getPath('userData')
    const tempDir = join(userDataPath, 'Captures', 'temp')

    // Ensure directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const tempPath = join(tempDir, `snapflow_temp_${Date.now()}.png`)
    this.currentCapturePath = tempPath

    console.log('CaptureWindow: Executing native capture to:', tempPath)

    // Execute screencapture
    // -x: mute sound (optional)
    // -C: capture cursor (optional)
    // -R: region
    // -t: content type
    try {
      const cmd = `screencapture -x -C -R${Math.round(x)},${Math.round(y)},${Math.round(width)},${Math.round(height)} -t png "${tempPath}"`
      execSync(cmd)
      console.log('Native screencapture command executed')
    } catch (err) {
      console.error('Native capture error:', err)
    }

    this.captureWindow.webContents.on('did-finish-load', () => {
      try {
        // Verify file exists
        if (fs.existsSync(tempPath)) {
          console.log('Capture success, sending file path to renderer')
          // Send file path to renderer
          this.captureWindow?.webContents.send('capture-source', {
            filePath: tempPath
          })
        } else {
          console.error('Capture failed: Temp file not found at', tempPath)
        }

        // Show window only AFTER capture and load
        this.captureWindow?.show()
        this.captureWindow?.focus()
      } catch (err) {
        console.error('IPC send error:', err)
      }
    })

    this.captureWindow.on('closed', () => {
      this.captureWindow = null
    })
  }

  // Remove unused getSources logic by replacing the whole block
  // The 'startCapture' function ends here.

  private closeCaptureWindow() {
    if (this.captureWindow) {
      this.captureWindow.close()
      this.captureWindow = null
    }
  }

  private async processCapture(x: number, y: number, width: number, height: number) {
    console.log(`Processing capture: x=${x}, y=${y}, w=${width}, h=${height}`)

    try {
      if (!this.currentCapturePath || !fs.existsSync(this.currentCapturePath)) {
        console.error('No capture source file found')
        return
      }

      // Load the FULL captured image (this is the source of truth)
      const fullImage = nativeImage.createFromPath(this.currentCapturePath)
      const imgSize = fullImage.getSize()

      // Use the bounds of the display where the capture happened
      // Fallback to primary if null (should not happen)
      const displayBounds = this.currentDisplayBounds || screen.getPrimaryDisplay().bounds

      // Calculate Scale Factor (Image Physical Pixels / Screen Logical Pixels)
      // If image is 3456 wide and screen is 1728 wide, scale is 2.
      const scaleX = imgSize.width / displayBounds.width
      const scaleY = imgSize.height / displayBounds.height

      // Calculate Window Offset (e.g. Menu Bar displacement)
      let offsetX = 0
      let offsetY = 0
      if (this.captureWindow && !this.captureWindow.isDestroyed()) {
        const winBounds = this.captureWindow.getBounds()
        offsetX = winBounds.x - displayBounds.x
        offsetY = winBounds.y - displayBounds.y
      }

      // Apply offset and scale to user selection
      const cropRect = {
        x: Math.round((x + offsetX) * scaleX),
        y: Math.round((y + offsetY) * scaleY),
        width: Math.round(width * scaleX),
        height: Math.round(height * scaleY)
      }

      // Safety check to ensure we don't crop outside bounds
      if (cropRect.width <= 0 || cropRect.height <= 0) {
        console.error('Invalid crop dimensions')
        return
      }

      console.log('Cropping at:', cropRect)
      const cropped = fullImage.crop(cropRect)

      // Save to disk
      const filename = `capture-${Date.now()}.png`
      const userDataPath = app.getPath('userData')
      const capturesDir = path.join(userDataPath, 'Captures')

      if (!fs.existsSync(capturesDir)) {
        fs.mkdirSync(capturesDir)
      }

      const filePath = path.join(capturesDir, filename)
      fs.writeFileSync(filePath, cropped.toPNG())

      // Post-process: Restore DPI metadata using 'sips' (macOS only)
      // nativeImage.toPNG() saves at 72 DPI, causing Retina images (2x) to look 2x larger.
      // We explicitly set the DPI to match the screen scale (e.g., 144 DPI for 2x scale).
      try {
        const dpi = 72 * scaleX
        const sipsCmd = `sips -s setProperty dpiHeight ${dpi} -s setProperty dpiWidth ${dpi} "${filePath}"`
        execSync(sipsCmd)
        console.log(`Restored DPI to ${dpi} using sips`)
      } catch (err) {
        console.error('Failed to set DPI:', err)
      }

      // Add to DB
      this.dbManager.addCapture({
        filePath,
        thumbPath: filePath,
        sourceTitle: 'Screen Capture',
        width: width, // Use logical width for display in UI
        height: height
      })

      // Notify main window to refresh
      const allWindows = BrowserWindow.getAllWindows()
      const mainWindow = allWindows.find((w) => w !== this.captureWindow && !w.isDestroyed())
      mainWindow?.webContents.send('capture-saved')
    } catch (e) {
      console.error('Error processing capture:', e)
    }
  }
}
