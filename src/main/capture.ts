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
    this.verifyExternalResources()
    app.whenReady().then(() => {
      this.registerShortcuts()
    })
    this.registerIPC()
  }

  private verifyExternalResources(): void {
    const scripts = ['click.swift', 'keypress.swift']
    const baseDir = is.dev
      ? path.join(__dirname, '../../src/main/scripts')
      : path.join(process.resourcesPath, 'scripts')

    scripts.forEach((script) => {
      const scriptPath = path.join(baseDir, script)
      if (!fs.existsSync(scriptPath)) {
        console.error(`[CRITICAL] Missing external resource: ${scriptPath}`)
        if (!is.dev) {
          // In production, this is a fatal error
          // We can't use dialog here easily before ready, but we should log loud
        }
      } else {
        console.log(`[OK] Found resource: ${script}`)
      }
    })
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
      this.cleanupCaptureShortcuts()

      if (process.platform === 'darwin') {
        const soundPath =
          '/System/Library/Components/CoreAudio.component/Contents/SharedSupport/SystemSounds/system/Grab.aif'
        exec(`afplay "${soundPath}"`, (error) => {
          if (error) console.error('Failed to play shutter sound:', error)
        })
      }

      try {
        if (this.currentMode === 'scroll') {
          this.closeCaptureWindow()
          await this.startScrollCaptureLoop(x, y, width, height)
        } else {
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
    if (!globalShortcut.isRegistered('Escape')) {
      globalShortcut.register('Escape', () => {
        console.log('Global Escape triggered - cancelling capture')
        this.closeCaptureWindow()
      })
    }
  }

  private cleanupCaptureShortcuts(): void {
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

    if (!this.captureWindow || this.captureWindow.isDestroyed()) {
      this.captureWindow = new BrowserWindow({
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height),
        type: 'panel',
        transparent: true,
        backgroundColor: '#00000000',
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: false,
        resizable: false,
        movable: false,
        focusable: true,
        hasShadow: false,
        enableLargerThanScreen: true,
        roundedCorners: false,
        show: false,
        webPreferences: {
          preload: join(__dirname, '../preload/index.js'),
          sandbox: false,
          contextIsolation: true,
          nodeIntegration: false
        }
      })

      this.captureWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

      this.captureWindow.on('closed', () => {
        this.captureWindow = null
        this.cleanupCaptureShortcuts()
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
      this.captureWindow.setBounds({
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height)
      })
      const url =
        is.dev && process.env['ELECTRON_RENDERER_URL']
          ? `${process.env['ELECTRON_RENDERER_URL']}/index.html?mode=${mode}`
          : `file://${join(__dirname, '../renderer/index.html')}?mode=${mode}`

      this.captureWindow.loadURL(url)
    }

    this.setupCaptureShortcuts()
    this.captureWindow.show()
    this.captureWindow.focus()
  }

  private closeCaptureWindow(): void {
    this.cleanupCaptureShortcuts()
    if (this.captureWindow && !this.captureWindow.isDestroyed()) {
      this.captureWindow.hide()
    }
  }

  // --- SCROLL CAPTURE ---

  private async startScrollCaptureLoop(
    x: number,
    y: number,
    width: number,
    height: number
  ): Promise<void> {
    if (this.currentMode !== 'scroll') return

    console.log('[DEBUG] Starting Scroll Capture Loop', { x, y, width, height })
    const userDataPath = app.getPath('userData')
    const tempDir = path.join(userDataPath, 'TempCaptures')
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

    const captures: string[] = []
    const MAX_SCROLLS = 20

    const clickScriptPath = is.dev
      ? path.join(__dirname, '../../src/main/scripts/click.swift')
      : path.join(process.resourcesPath, 'scripts/click.swift')

    const keypressScriptPath = is.dev
      ? path.join(__dirname, '../../src/main/scripts/keypress.swift')
      : path.join(process.resourcesPath, 'scripts/keypress.swift')

    // Hide app
    if (process.platform === 'darwin') {
      app.hide()
    } else {
      if (this.captureWindow) this.captureWindow.hide()
    }
    await new Promise((r) => setTimeout(r, 800))

    const displayBounds = this.currentDisplayBounds || screen.getPrimaryDisplay().bounds
    const globalX = displayBounds.x + x
    const globalY = displayBounds.y + y
    const centerX = Math.round(globalX + width / 2)
    const centerY = Math.round(globalY + height / 2)

    try {
      execSync(`swift "${clickScriptPath}" ${centerX} ${centerY}`)
      await new Promise((r) => setTimeout(r, 300))
    } catch (e) {
      console.error('Focus click failed', e)
    }

    const isScrolling = true
    let scrollCount = 0
    let isAborted = false

    try {
      globalShortcut.register('Escape', () => {
        isAborted = true
      })
    } catch (e) {
      console.error('Failed to register Escape shortcut', e)
    }

    try {
      while (isScrolling && scrollCount < MAX_SCROLLS) {
        if (isAborted) break

        console.log(`[DEBUG] Scroll Iteration ${scrollCount}`)
        const filename = `scroll-${scrollCount}-${Date.now()}.png`
        const filePath = path.join(tempDir, filename)

        const cmd = `screencapture -x -R${Math.round(globalX)},${Math.round(globalY)},${Math.round(width)},${Math.round(height)} -t png "${filePath}"`
        execSync(cmd)

        if (fs.existsSync(filePath)) {
          captures.push(filePath)
        } else {
          break
        }

        // Duplicate Check (Identical Frames)
        if (scrollCount > 0) {
          const prevFile = captures[scrollCount - 1]
          const currFile = captures[scrollCount]
          const buf1 = fs.readFileSync(prevFile)
          const buf2 = fs.readFileSync(currFile)
          if (buf1.equals(buf2)) {
            console.log('Reached bottom (identical images)')
            captures.pop()
            break
          }
        }

        // Scroll Action
        const kVK_DownArrow = 125
        const scrollRepeats = 10
        try {
          execSync(`swift "${keypressScriptPath}" ${scrollRepeats} ${kVK_DownArrow}`)
        } catch (e) {
          console.error('Scroll script failed', e)
        }

        await new Promise((r) => setTimeout(r, 1500))
        scrollCount++
      }

      await this.stitchImages(captures, width)
    } finally {
      globalShortcut.unregister('Escape')
      if (process.platform === 'darwin') app.show()
    }
  }

  // --- STITCHING LOGIC (BLOCK MATCHING + INERTIA) ---

  private async stitchImages(files: string[], width: number): Promise<void> {
    if (files.length === 0) return

    try {
      console.log('Stitching images (Block Matching + Inertia)...', files.length)

      const images = await Promise.all(
        files.map(async (f) => {
          const img = sharp(f)
          const meta = await img.metadata()
          const buffer = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
          return { file: f, img, meta, buffer }
        })
      )

      if (images.length === 0) return

      const composites: { input: Buffer | string; top: number; left: number }[] = []
      let currentY = 0
      const actualWidth = images[0].meta.width || width

      // Add first image
      composites.push({
        input: images[0].file,
        top: 0,
        left: 0
      })
      currentY += images[0].meta.height || 0

      // INERTIA STATE
      let lastScrollDelta = 0 // 0 means unknown

      for (let i = 1; i < images.length; i++) {
        const prev = images[i - 1]
        const curr = images[i]

        // 1. Sticky Header Detection & Cropping
        const headerHeight = this.scanStaticHeaderHeight(
          prev.buffer,
          curr.buffer,
          actualWidth,
          Math.floor((prev.meta.height || 0) * 0.3)
        )

        let bufferToMatch = curr.buffer
        let croppedInput: Buffer | null = null

        if (headerHeight > 0) {
          console.log(`[DEBUG] Sticky Header: ${headerHeight}px`)

          // Prepare match buffer (Skip header)
          const byteOffset = headerHeight * actualWidth * 4
          const newHeight = (curr.meta.height || 0) - headerHeight

          if (newHeight > 0 && byteOffset < curr.buffer.data.length) {
            const slicedData = curr.buffer.data.subarray(byteOffset)
            bufferToMatch = {
              data: slicedData,
              info: { ...curr.buffer.info, height: newHeight }
            }
          }

          // Prepare visual composite (Crop png)
          try {
            croppedInput = await sharp(curr.file)
              .extract({
                left: 0,
                top: headerHeight,
                width: actualWidth,
                height: newHeight
              })
              .png()
              .toBuffer()
          } catch (e) {
            console.warn('Crop failed', e)
          }
        }

        // 2. BLOCK MATCHING with INERTIA
        const overlap = this.findOverlapBlock(
          prev.buffer,
          bufferToMatch,
          actualWidth,
          lastScrollDelta
        )

        console.log(`[DEBUG] Stitch ${i}: Overlap=${overlap} (LastDelta=${lastScrollDelta})`)

        // 3. Post-Match Validation
        if (overlap < 0) {
          console.warn('[WARN] No overlap found using Block Matching.')
          // Heuristic: If we are deep in scroll, assume end of page Duplicate
          if (i > 2) {
            console.warn('Deep scroll failure -> Assuming duplicate/end. Skipping.')
            continue
          }
          // Fallback: Just append? Or skip?
          // If we append with 0 overlap, it looks broken.
          // Let's assume duplicate for safety in this robust mode.
          continue
        }

        // Calculate Delta for Inertia
        const currentDelta = (prev.meta.height || 0) - overlap

        // Sanity Check: If delta is tiny (< 50px), likely a duplicate/footer error
        if (currentDelta < 50) {
          console.warn('[WARN] Very small scroll delta detected. Likely duplicate. Skipping.')
          continue
        }

        // Update Inertia
        lastScrollDelta = currentDelta

        const top = currentY - overlap
        const addedHeight = croppedInput
          ? (curr.meta.height || 0) - headerHeight
          : curr.meta.height || 0

        composites.push({
          input: croppedInput || curr.file,
          top: top,
          left: 0
        })

        currentY = top + addedHeight
      }

      // Render
      const finalHeight = currentY
      const outputPath = path.join(app.getPath('userData'), `capture-long-${Date.now()}.png`)

      console.log(`[DEBUG] Final Output: ${actualWidth}x${finalHeight}`)

      await sharp({
        create: {
          width: actualWidth,
          height: finalHeight,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        },
        limitInputPixels: false
      })
        .composite(composites)
        .png()
        .toFile(outputPath)

      this.dbManager.addCapture({
        filePath: outputPath,
        thumbPath: outputPath,
        sourceTitle: 'Scroll Capture',
        width: actualWidth,
        height: finalHeight
      })

      // Notify
      const mainWindow = BrowserWindow.getAllWindows().find((w) => w !== this.captureWindow)
      if (mainWindow) {
        mainWindow.show()
        mainWindow.focus()
        mainWindow.webContents.send('capture-saved')
      }
    } catch (e) {
      console.error('Stitch failed', e)
    }
  }

  // --- CORE ALGORITHM: BLOCK MATCHING ---

  private findOverlapBlock(
    prev: { data: Buffer; info: sharp.OutputInfo },
    curr: { data: Buffer; info: sharp.OutputInfo },
    width: number,
    expectedDelta: number // Inertia
  ): number {
    const prevHeight = prev.info.height
    const currHeight = curr.info.height

    // 1. Define Source Block (Bottom 20% of Prev)
    // We want a large enough block to be unique
    const blockHeight = Math.floor(prevHeight * 0.2)
    const blockStartY = prevHeight - blockHeight

    // 2. Define Search Range in Curr
    // Where do we expect this block to appear in Curr?
    // If we scrolled down by 'delta', the content moved UP by 'delta'.
    // So 'blockStartY' in Prev should be at 'blockStartY - delta' in Curr.

    let searchStart = 0
    let searchEnd = currHeight - blockHeight

    if (expectedDelta > 0) {
      // INERTIA MODE
      const estimatedY = blockStartY - expectedDelta
      const tolerance = Math.floor(expectedDelta * 0.25) // 25% tolerance
      searchStart = Math.max(0, estimatedY - tolerance)
      searchEnd = Math.min(currHeight - blockHeight, estimatedY + tolerance)
      console.log(
        `[DEBUG] Inertia Active. Range: [${searchStart}, ${searchEnd}] (Est: ${estimatedY})`
      )
    } else {
      // FULL SEARCH MODE (First stitch or unknown)
      // Search upper 70% of current image (usually we match near top)
      searchEnd = Math.min(currHeight - blockHeight, Math.floor(currHeight * 0.7))
    }

    // 3. Scan & Score
    let bestY = -1
    let minScore = Number.MAX_VALUE

    // Optimization: Step 2 or 4 for coarse search?
    // Let's do step 1 for maximum precision on "Block" but skip x-pixels?
    // Actually, "Block Difference" is expensive.
    // Efficient heuristic: Check 3 bands (Top, Mid, Bot of block) and sum errors.

    for (let y = searchStart; y <= searchEnd; y++) {
      const score = this.calculateBlockDiff(
        prev.data,
        blockStartY,
        curr.data,
        y,
        width,
        blockHeight
      )

      if (score < minScore) {
        minScore = score
        bestY = y
      }
    }

    // 4. Threshold Validation
    // What is a good score? It depends on block size.
    // Normalized score per pixel?
    // Let's assume a strict threshold.
    // If minScore is too high, it's not a match.

    // Threshold heuristic: Average difference per pixel < 10 (out of 255)
    // But we focus on 3 bands.
    // Let's just monitor scores.

    const threshold = width * 3 * 20 * 15 // Width * 3 lines * Samples? No.
    // calculateBlockDiff samples 3 lines. width/4 samples per line. = 0.75 * width pixels.
    // Max diff per pixel = 255 * 3 (RGB) = 765.
    // Acceptable diff = ~20-30 per channel?

    // Let's just rely on relative best for now, but reject massive failures.
    console.log(`[DEBUG] Best Match Y=${bestY}, Score=${minScore}, Threshold=${threshold}`)

    if (minScore > threshold) {
      // Arbitrary large safety net (tuned for 1080p width approx)
      if (expectedDelta > 0) {
        console.warn('[WARN] Inertia match failed (Score too high). fallback to full search?')
        // Optional: Recursive call with expectedDelta=0?
        // prevent infinite loop
        return this.findOverlapBlock(prev, curr, width, 0)
      }
      return -1
    }

    // Overlap Calculation
    // We matched 'blockStartY' (in prev) to 'bestY' (in curr).
    // The content at 'prevHeight' is 'blockHeight' pixels below 'blockStartY'.
    // So in curr, it is at 'bestY + blockHeight'.
    // Wait.
    // Delta = blockStartY - bestY.
    // Overlap = prevHeight - Delta.

    const delta = blockStartY - bestY
    const overlap = prevHeight - delta

    return overlap
  }

  // Efficient Block Difference (3-Band Sampling)
  private calculateBlockDiff(
    buf1: Buffer,
    y1: number,
    buf2: Buffer,
    y2: number,
    width: number,
    height: number
  ): number {
    // Check Top, Middle, Bottom rows of resolution block
    const rowsToCheck = [0, Math.floor(height / 2), height - 1]
    let totalDiff = 0

    const step = 4 // Sample every 4th pixel x

    for (const r of rowsToCheck) {
      const rowY1 = y1 + r
      const rowY2 = y2 + r
      const idx1 = rowY1 * width * 4
      const idx2 = rowY2 * width * 4

      for (let x = 0; x < width; x += step) {
        const p1 = idx1 + x * 4
        const p2 = idx2 + x * 4

        // Sum of Absolute Differences (RGB)
        totalDiff +=
          Math.abs(buf1[p1] - buf2[p2]) +
          Math.abs(buf1[p1 + 1] - buf2[p2 + 1]) +
          Math.abs(buf1[p1 + 2] - buf2[p2 + 2])
      }
    }
    return totalDiff
  }

  private scanStaticHeaderHeight(
    prev: { data: Buffer; info: sharp.OutputInfo },
    curr: { data: Buffer; info: sharp.OutputInfo },
    width: number,
    maxScanHeight: number
  ): number {
    const prevData = prev.data
    const currData = curr.data
    let staticRows = 0
    for (let y = 0; y < maxScanHeight; y++) {
      if (this.compareRowsStrict(prevData, y, currData, y, width)) {
        staticRows++
      } else {
        break
      }
    }
    return staticRows
  }

  private compareRowsStrict(
    buf1: Buffer,
    y1: number,
    buf2: Buffer,
    y2: number,
    width: number
  ): boolean {
    const step = 8
    const i1 = y1 * width * 4
    const i2 = y2 * width * 4
    for (let x = 0; x < width; x += step) {
      const p1 = i1 + x * 4
      const p2 = i2 + x * 4
      if (
        Math.abs(buf1[p1] - buf2[p2]) > 5 ||
        Math.abs(buf1[p1 + 1] - buf2[p2 + 1]) > 5 ||
        Math.abs(buf1[p1 + 2] - buf2[p2 + 2]) > 5
      )
        return false
    }
    return true
  }

  private async processCapture(x: number, y: number, width: number, height: number): Promise<void> {
    const displayBounds = this.currentDisplayBounds || screen.getPrimaryDisplay().bounds
    const globalX = displayBounds.x + x
    const globalY = displayBounds.y + y
    const tempDir = path.join(app.getPath('userData'), 'Captures')
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })
    const filename = `capture-${Date.now()}.png`
    const filePath = path.join(tempDir, filename)

    if (this.captureWindow) this.captureWindow.hide()
    await new Promise((r) => setTimeout(r, 50))

    execSync(
      `screencapture -x -R${Math.round(globalX)},${Math.round(globalY)},${Math.round(width)},${Math.round(height)} -t png "${filePath}"`
    )

    if (fs.existsSync(filePath)) {
      this.dbManager.addCapture({
        filePath,
        thumbPath: filePath,
        sourceTitle: 'Screen Capture',
        width,
        height
      })
      const win = BrowserWindow.getAllWindows().find((w) => w !== this.captureWindow)
      if (win) {
        win.show()
        win.focus()
        win.webContents.send('capture-saved')
      }
    }
  }
}
