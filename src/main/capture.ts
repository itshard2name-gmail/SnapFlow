import { BrowserWindow, screen, ipcMain, globalShortcut, app } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { execSync, exec } from 'child_process'
import * as fs from 'fs'
import path from 'path'
import { DatabaseManager } from './database'
import sharp from 'sharp'

export class CaptureManager {
  private captureWindow: BrowserWindow | null = null
  private dbManager: DatabaseManager
  private currentDisplayBounds: Electron.Rectangle | null = null
  private currentMode: 'region' | 'window' | 'scroll' = 'region'

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager
    app.whenReady().then(() => {
      this.registerShortcuts()
    })
    this.registerIPC()
  }

  private registerShortcuts(): void {
    const register = (accelerator: string, callback: () => void): void => {
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

    register('Control+Shift+S', () => {
      this.startCapture('scroll')
    })
  }

  private registerIPC(): void {
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
        if (this.currentMode === 'scroll') {
          // Scroll Capture Logic
          this.closeCaptureWindow() // Accessing internal method to hide overlay
          await this.startScrollCaptureLoop(x, y, width, height)
        } else {
          // Standard Capture
          await this.processCapture(x, y, width, height)
          this.closeCaptureWindow()
        }
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

  private setupCaptureShortcuts(): void {
    // Register ESC to cancel capture since window is not focused
    // We check if it's already registered to avoid error
    if (!globalShortcut.isRegistered('Escape')) {
      globalShortcut.register('Escape', () => {
        console.log('Global Escape triggered - cancelling capture')
        this.closeCaptureWindow()
      })
    }
  }

  private cleanupCaptureShortcuts(): void {
    // Unregister ESC only (don't unregister main hotkeys)
    if (globalShortcut.isRegistered('Escape')) {
      globalShortcut.unregister('Escape')
    }
  }

  private async startCapture(mode: 'region' | 'window' | 'scroll' = 'region'): Promise<void> {
    this.currentMode = mode
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
        type: 'panel', // Restored per user request (Fixed Dropdown Capture)
        transparent: true,
        backgroundColor: '#00000000',
        frame: false,
        // High level floating
        alwaysOnTop: true,
        skipTaskbar: false,
        resizable: false,
        movable: false,
        focusable: true, // Keep true for now to debug input issues
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

      // DEBUG: Monitor loading
      this.captureWindow.webContents.on('did-finish-load', () => {
        // @ts-ignore: logging for debugging purposes
        console.log('[MAIN] Capture Window Loaded Successfully')
      })

      this.captureWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
        // @ts-ignore: logging for debugging purposes
        console.error('[MAIN-ERROR] Capture Window Failed to Load:', errorCode, errorDescription)
      })

      // DEBUG: Open DevTools to inspect renderer errors
      // this.captureWindow.webContents.openDevTools({ mode: 'detach' })

      // Force Dock Icon to appear (Fix for type: 'panel' hiding it)
      if (process.platform === 'darwin' && app.dock) {
        app.dock.show().catch((err) => console.error('Failed to show dock icon:', err))
      }

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
      const url =
        is.dev && process.env['ELECTRON_RENDERER_URL']
          ? `${process.env['ELECTRON_RENDERER_URL']}/index.html?mode=${mode}`
          : `file://${join(__dirname, '../renderer/index.html')}?mode=${mode}`

      this.captureWindow.loadURL(url)
    }

    // Capture Shortcuts (ESC)
    this.setupCaptureShortcuts()

    // Show INACTIVE - ZERO LATENCY & NO FOCUS STEALING
    // this.captureWindow.showInactive()
    this.captureWindow.show()
    this.captureWindow.focus() // Force focus to ensure mouse events works
  }

  private closeCaptureWindow(): void {
    this.cleanupCaptureShortcuts()

    if (this.captureWindow && !this.captureWindow.isDestroyed()) {
      this.captureWindow.hide()
      // Optional: notify renderer to reset?
      // For now, reloading on next startCapture is sufficient.
    }
  }

  private async startScrollCaptureLoop(
    x: number,
    y: number,
    width: number,
    height: number
  ): Promise<void> {
    // SAFETY GUARD: Ensure we are strictly in scroll mode
    if (this.currentMode !== 'scroll') {
      console.error('[FATAL] startScrollCaptureLoop called but mode is:', this.currentMode)
      return
    }

    console.log('[DEBUG] Starting Scroll Capture Loop with Region:', { x, y, width, height })
    const userDataPath = app.getPath('userData')
    const tempDir = path.join(userDataPath, 'TempCaptures')
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

    const captures: string[] = []
    // const _SCROLL_AMOUNT = Math.floor(height * 0.8) // Used for stitching prediction
    const MAX_SCROLLS = 20
    // Note: scrollScriptPath variable removed as we switched to keypress

    const clickScriptPath = is.dev
      ? path.join(__dirname, '../../src/main/scripts/click.swift')
      : path.join(process.resourcesPath, 'src/main/scripts/click.swift')

    const keypressScriptPath = is.dev
      ? path.join(__dirname, '../../src/main/scripts/keypress.swift')
      : path.join(process.resourcesPath, 'src/main/scripts/keypress.swift')

    // 0. Hide the ENTIRE App to force focus switch to the underlying window (Browser)
    // This is more reliable than just hiding the window + clicking
    if (process.platform === 'darwin') {
      app.hide()
    } else {
      if (this.captureWindow) this.captureWindow.hide()
    }

    // Wait for App to hide and OS to switch focus
    await new Promise((r) => setTimeout(r, 800))

    // Calculate Coordinates (Moved outside try block to fix scope)
    const displayBounds = this.currentDisplayBounds || screen.getPrimaryDisplay().bounds
    const globalX = displayBounds.x + x
    const globalY = displayBounds.y + y
    const centerX = Math.round(globalX + width / 2)
    const centerY = Math.round(globalY + height / 2)

    // (Optional) We could still Click to be safe, but app.hide() should usually work.
    try {
      execSync(`swift "${clickScriptPath}" ${centerX} ${centerY}`)
      await new Promise((r) => setTimeout(r, 300))
    } catch (e) {
      console.error('Focus click failed', e)
    }

    // 1. Initial Capture
    const isScrolling = true
    let scrollCount = 0
    // MAX_SCROLLS already defined above

    let isAborted = false

    // Register ESCAPE shortcut to stop scrolling
    try {
      globalShortcut.register('Escape', () => {
        console.log('[DEBUG] Escape pressed! Aborting scroll capture...')
        isAborted = true
      })
    } catch (e) {
      console.error('Failed to register Escape shortcut', e)
    }

    try {
      while (isScrolling && scrollCount < MAX_SCROLLS) {
        if (isAborted) {
          console.log('[DEBUG] Capture aborted by user.')
          break
        }

        console.log(`[DEBUG] Scroll Iteration ${scrollCount + 1}/${MAX_SCROLLS}`)
        const filename = `scroll-part-${scrollCount}-${Date.now()}.png`
        const filePath = path.join(tempDir, filename)

        // Use the specific region coordinates passed in (User Selected Region)
        // Note: globalX/Y are already calculated above

        const cmd = `screencapture -x -R${Math.round(globalX)},${Math.round(globalY)},${Math.round(width)},${Math.round(height)} -t png "${filePath}"`
        execSync(cmd)

        if (fs.existsSync(filePath)) {
          captures.push(filePath)
        } else {
          console.error('Failed to capture part', scrollCount)
          break
        }

        // Check if we should continue (Compare with previous to detect bottom)
        if (scrollCount > 0) {
          const prevFile = captures[scrollCount - 1]
          const currFile = captures[scrollCount]

          // Simple duplicate detection
          const buf1 = fs.readFileSync(prevFile)
          const buf2 = fs.readFileSync(currFile)
          if (buf1.equals(buf2)) {
            console.log('Reached bottom (identical images)')
            captures.pop() // Remove duplicate
            break
          }
        }

        // Scroll (using Keyboard ArrowDown x10 - Matches successful standalone test)
        console.log(`Scrolling down (Arrow Down x10)...`)
        const kVK_DownArrow = 125
        const scrollRepeats = 10
        try {
          execSync(`swift "${keypressScriptPath}" ${scrollRepeats} ${kVK_DownArrow}`)
        } catch (e) {
          console.error('Scroll script failed', e)
        }

        // Wait for scroll + animation + render
        // Using Arrow Down is slower/smoother, so we wait accordingly
        await new Promise((r) => setTimeout(r, 1500))

        scrollCount++
      }

      // Stitching
      await this.stitchImages(captures, width)
    } finally {
      // CLEANUP: Always unregister the shortcut
      globalShortcut.unregister('Escape')
      console.log('[DEBUG] Unregistered Escape shortcut')
    }
  }

  private async stitchImages(files: string[], width: number): Promise<void> {
    if (files.length === 0) return

    try {
      console.log('Stitching images with Smart Stitching...', files.length)

      // 1. Load all images and get metadata
      const images = await Promise.all(
        files.map(async (f) => {
          const img = sharp(f)
          const meta = await img.metadata()
          const buffer = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
          return { file: f, img, meta, buffer }
        })
      )

      if (images.length === 0) return

      const composites: { input: string; top: number; left: number }[] = []
      let currentY = 0
      const actualWidth = images[0].meta.width || width
      // const actualHeight = images[0].meta.height || height // Each image might differ slightly if cropped, though unlikely in this loop

      // Add first image
      composites.push({
        input: images[0].file,
        top: 0,
        left: 0
      })
      currentY += images[0].meta.height || 0

      // 2. Iterate and stitch subsequent images
      for (let i = 1; i < images.length; i++) {
        const prev = images[i - 1]
        const curr = images[i]

        // Calculate Overlap
        // We look for the top of 'curr' inside the bottom of 'prev'
        const overlap = this.findOverlap(prev.buffer, curr.buffer, actualWidth)
        console.log(`[DEBUG] Stitching ${i}: Overlap detected = ${overlap}px`)

        // Position current image:
        // Top should be: (Previous Top + Previous Height) - Overlap
        // But since we are accumulating, 'currentY' tracks the bottom of the composite so far.
        // So new Top = currentY - Overlap.

        const effectiveOverlap = overlap > 0 ? overlap : 0
        const top = currentY - effectiveOverlap

        composites.push({
          input: curr.file,
          top: top,
          left: 0
        })

        // Update currentY to be the bottom of this new image
        currentY = top + (curr.meta.height || 0)
      }

      const finalHeight = currentY
      const outputPath = path.join(app.getPath('userData'), `capture-long-${Date.now()}.png`)

      console.log(`[DEBUG] Final Stitch Dimensions: ${actualWidth}x${finalHeight}`)

      // 3. Render final composite
      await sharp({
        create: {
          width: actualWidth,
          height: finalHeight,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        },
        limitInputPixels: false // Correct way to disable limit
      })
        .composite(composites)
        .png()
        .toFile(outputPath)

      // Add to DB
      this.dbManager.addCapture({
        filePath: outputPath,
        thumbPath: outputPath,
        sourceTitle: 'Scroll Capture',
        width: actualWidth,
        height: finalHeight
      })

      const allWindows = BrowserWindow.getAllWindows()
      const mainWindow = allWindows.find((w) => w !== this.captureWindow)

      // Restore App Visibility
      if (process.platform === 'darwin') {
        app.show()
      }
      if (this.captureWindow) this.captureWindow.hide()
      if (mainWindow) {
        mainWindow.show()
        mainWindow.focus()
      }

      mainWindow?.webContents.send('capture-saved')
    } catch (e) {
      console.error('Stitching failed', e)
    }
  }

  // A helper to find how many pixels of 'curr' (top) match 'prev' (bottom)
  private findOverlap(
    prev: { data: Buffer; info: sharp.OutputInfo },
    curr: { data: Buffer; info: sharp.OutputInfo },
    width: number
  ): number {
    const prevData = prev.data
    const currData = curr.data
    const prevHeight = prev.info.height
    const currHeight = curr.info.height // should be same as prevHeight usually

    // 1. Find a "Smart Anchor" in the current image (curr)
    // We want a row that has high variance (not just a solid color like white/black background)
    // We start searching from 10% down to avoid top headers/edges.
    // If we can't find a good row, we default to something reasonable.

    let anchorY = -1
    const startSearchY = Math.floor(prevHeight * 0.1)
    const endSearchY = Math.floor(prevHeight * 0.4) // Don't go too deep

    // Scan for a row with detail
    for (let r = startSearchY; r < endSearchY; r++) {
      if (this.getRowVariance(currData, r, width) > 100) {
        // Threshold for "detail"
        anchorY = r
        break
      }
    }

    // Fallback if image is extremely plain
    if (anchorY === -1) {
      console.log('[DEBUG] No high-variance row found, defaulting anchor.')
      anchorY = startSearchY
    }

    console.log(`[DEBUG] Smart Anchor chosen at Y=${anchorY}`)

    // 2. Search for this anchor in 'prev'
    // We expect 'curr' to be scrolled DOWN, so 'curr[anchor]' should match 'prev[y]' where y > anchor.
    // (y = anchor + scrollAmount). S > 0 means y > anchor.
    // We search from 'anchor' (S=0) to bottom.

    const searchStartRow = anchorY
    // const searchStartRow = anchorY + 1 // Force S > 0? Maybe not, duplicate check handles S=0.

    // Optimize loop bounds
    const startX = Math.floor(width * 0.1) // Check central 80% to be safe
    const scanWidth = Math.floor(width * 0.8)

    // We stop before the bottom allowing for the anchor space
    for (let y = searchStartRow; y < prevHeight - 5; y++) {
      // Check if prev[y] matches curr[anchorY]
      if (this.compareRowsFuzzy(prevData, y, currData, anchorY, width, startX, scanWidth)) {
        // Potential match! Verify a block of rows to confirm
        // (Block check handles false positives from repeating patterns)
        let confirmed = true
        const checkDepth = 40 // Check a large block (40 rows) for robustness

        for (let offset = 1; offset < checkDepth; offset++) {
          // Make sure we don't go out of bounds
          if (y + offset >= prevHeight || anchorY + offset >= currHeight) break

          if (
            !this.compareRowsFuzzy(
              prevData,
              y + offset,
              currData,
              anchorY + offset,
              width,
              startX,
              scanWidth
            )
          ) {
            confirmed = false
            break
          }
        }

        if (confirmed) {
          const scrollAmount = y - anchorY
          console.log(`[DEBUG] Match found! Scroll amount: ${scrollAmount}`)
          // Overlap is the remaining part of prev
          return prevHeight - scrollAmount
        }
      }
    }

    console.log('[DEBUG] No overlap match found.')
    return 0
  }

  // Calculate generic variance of a row (sum of abs differences between adjacent pixels)
  private getRowVariance(buf: Buffer, y: number, width: number): number {
    const idxBase = y * width * 4
    let variance = 0
    const step = 4 // Sample every 4th pixel for speed

    for (let x = 0; x < width - step; x += step) {
      const i1 = idxBase + x * 4
      const i2 = idxBase + (x + step) * 4
      // Check difference between pixel X and pixel X+STEP
      const diff =
        Math.abs(buf[i1] - buf[i2]) +
        Math.abs(buf[i1 + 1] - buf[i2 + 1]) +
        Math.abs(buf[i1 + 2] - buf[i2 + 2])
      variance += diff
    }
    return variance
  }

  private compareRowsFuzzy(
    buf1: Buffer,
    y1: number,
    buf2: Buffer,
    y2: number,
    width: number,
    startX: number,
    scanWidth: number
  ): boolean {
    const idx1Base = y1 * width * 4
    const idx2Base = y2 * width * 4
    const endX = startX + scanWidth

    let mismatchCount = 0
    const maxMismatch = Math.floor((scanWidth / 4) * 0.1) // 10% mismatch allowed (robust)

    for (let x = startX; x < endX; x += 4) {
      const idx1 = idx1Base + x * 4
      const idx2 = idx2Base + x * 4

      const diffR = Math.abs(buf1[idx1] - buf2[idx2])
      const diffG = Math.abs(buf1[idx1 + 1] - buf2[idx2 + 1])
      const diffB = Math.abs(buf1[idx1 + 2] - buf2[idx2 + 2])

      // Tolerance 10 (out of 255) maps to ~4% color shift.
      // Allows for slight focus ring / shadow diffs but rejects structure changes.
      if (diffR > 10 || diffG > 10 || diffB > 10) {
        mismatchCount++
        if (mismatchCount > maxMismatch) return false
      }
    }
    return true
  }

  private async processCapture(x: number, y: number, width: number, height: number): Promise<void> {
    console.log(`[DEBUG] Processing capture: x=${x}, y=${y}, w=${width}, h=${height}`)

    try {
      // 1. Hide the overlay window so it doesn't block the screenshot
      if (this.captureWindow && !this.captureWindow.isDestroyed()) {
        this.captureWindow.hide()
      }

      // 2. Wait a tiny bit for window to hide (Electron is usually fast, but 50ms safety)
      await new Promise((r) => setTimeout(r, 50))

      // 3. Take the screenshot of the SELECTED REGION
      const displayBounds = this.currentDisplayBounds || screen.getPrimaryDisplay().bounds
      const globalX = displayBounds.x + x
      const globalY = displayBounds.y + y

      const filename = `capture-${Date.now()}.png`
      const userDataPath = app.getPath('userData')
      const capturesDir = path.join(userDataPath, 'Captures')
      console.log('[DEBUG] Captures Dir:', capturesDir)

      if (!fs.existsSync(capturesDir)) {
        fs.mkdirSync(capturesDir, { recursive: true })
      }

      const filePath = path.join(capturesDir, filename)

      // Use native screencapture CLI
      const cmd = `screencapture -x -R${Math.round(globalX)},${Math.round(globalY)},${Math.round(width)},${Math.round(height)} -t png "${filePath}"`

      console.log('[DEBUG] Executing capture cmd:', cmd)
      execSync(cmd)

      if (fs.existsSync(filePath)) {
        console.log('[DEBUG] File created successfully:', filePath)
        // Add to DB
        const capture = this.dbManager.addCapture({
          filePath,
          thumbPath: filePath,
          sourceTitle: 'Screen Capture',
          width: width,
          height: height
        })
        console.log('[DEBUG] Added to DB:', capture)

        // Notify main window
        const allWindows = BrowserWindow.getAllWindows()
        console.log('[DEBUG] All Windows Count:', allWindows.length)
        const mainWindow = allWindows.find((w) => w !== this.captureWindow) // strict inequality check

        if (mainWindow) {
          console.log('[DEBUG] Finding Main Window SUCCESS. Sending event...')
          mainWindow.show()
          mainWindow.focus()
          mainWindow.webContents.send('capture-saved')
        } else {
          console.error('[DEBUG] Main Window NOT FOUND')
        }
      } else {
        console.error('[DEBUG] Capture failed: file not created at', filePath)
      }
    } catch (e) {
      console.error('[DEBUG] Error processing capture:', e)
    }
  }
}
