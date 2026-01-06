import { useRef, useState, useEffect } from 'react'

interface WindowInfo {
  id: number
  x: number
  y: number
  width: number
  height: number
  title: string
  app: string
}

interface CaptureOverlayProps {
  mode: 'region' | 'window'
  onConfirm: (coords: { x: number; y: number; width: number; height: number }) => void
  onCancel: () => void
}

export function CaptureOverlay({ mode, onConfirm, onCancel }: CaptureOverlayProps) {
  console.log('CaptureOverlay component mounted! Mode:', mode)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null)

  // Region Selection State
  const [isSelecting, setIsSelecting] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 })

  // Window Mode State
  const [windows, setWindows] = useState<WindowInfo[]>([])
  const [activeWindow, setActiveWindow] = useState<WindowInfo | null>(null)

  const getRect = () => {
    if (mode === 'window') {
      return activeWindow
        ? {
            x: activeWindow.x,
            y: activeWindow.y,
            width: activeWindow.width,
            height: activeWindow.height
          }
        : null
    }
    return {
      x: Math.min(startPos.x, currentPos.x),
      y: Math.min(startPos.y, currentPos.y),
      width: Math.abs(currentPos.x - startPos.x),
      height: Math.abs(currentPos.y - startPos.y)
    }
  }

  const draw = (
    img: HTMLImageElement | null,
    rect: { x: number; y: number; width: number; height: number } | null
  ) => {
    const canvas = canvasRef.current
    if (!canvas || !img) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const logicalWidth = canvas.width / dpr
    const logicalHeight = canvas.height / dpr

    // Clear and draw full image
    ctx.clearRect(0, 0, logicalWidth, logicalHeight)

    if (img) {
      ctx.drawImage(img, 0, 0, logicalWidth, logicalHeight)
    }

    // Draw dim mask
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'
    ctx.fillRect(0, 0, logicalWidth, logicalHeight)

    if (rect && rect.width > 0 && rect.height > 0) {
      // Clear the mask for the selected area (making it bright)
      ctx.save()
      ctx.beginPath()
      ctx.rect(rect.x, rect.y, rect.width, rect.height)
      ctx.clip()

      // Draw the full image again into the clipped region
      ctx.drawImage(img, 0, 0, logicalWidth, logicalHeight)

      ctx.restore()

      // Draw border
      // In window mode, use a different color (e.g. green or same blue)
      ctx.strokeStyle = mode === 'window' ? '#10b981' : '#3b82f6'
      ctx.lineWidth = 2
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)

      // Draw Dimensions tooltip
      // Position appropriately
      const labelY = rect.y - 25 < 0 ? rect.y + rect.height + 5 : rect.y - 25

      ctx.fillStyle = '#1e293b'
      ctx.fillRect(rect.x, labelY, mode === 'window' ? 120 : 80, 20)
      ctx.fillStyle = 'white'
      ctx.font = '12px sans-serif'

      const label =
        mode === 'window' && activeWindow
          ? `${activeWindow.app}` // Show App Name
          : `${rect.width} x ${rect.height}`

      ctx.fillText(label, rect.x + 5, labelY + 15)
    }
  }

  useEffect(() => {
    // Setup High-DPI Canvas
    const canvas = canvasRef.current
    if (canvas) {
      const dpr = window.devicePixelRatio || 1
      // Set physical size
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr

      const ctx = canvas.getContext('2d')
      if (ctx) {
        // Scale context to match
        ctx.scale(dpr, dpr)
      }
    }

    // Force transparent background for the capture window
    document.documentElement.style.backgroundColor = 'transparent'
    document.body.style.backgroundColor = 'transparent'

    // Fetch windows if in window mode
    if (mode === 'window') {
      const fetchWindows = async () => {
        try {
          // @ts-ignore
          const winList = await window.api.getOpenWindows()
          console.log('Fetched Windows:', winList.length)
          setWindows(winList)
        } catch (err) {
          console.error('Failed to fetch windows:', err)
        }
      }
      fetchWindows()
    }

    // Listen for the background source from main process
    // @ts-ignore
    const removeSourceListener = window.api.onCaptureSource((source) => {
      console.log('Renderer received image data', source)

      let finalUrl = ''
      if (source.filePath) {
        let rawPath = source.filePath
        rawPath = rawPath.replace(/\\/g, '/')
        if (!rawPath.startsWith('media://')) {
          finalUrl = `media://${rawPath}?t=${Date.now()}`
        } else {
          finalUrl = rawPath
        }
      } else if (source.base64Image) {
        finalUrl = `data:image/png;base64,${source.base64Image}`
      }

      // Background Render Priority
      const bgUrl = `url("${finalUrl}")`
      document.body.style.backgroundImage = bgUrl
      document.body.style.backgroundRepeat = 'no-repeat'
      document.body.style.backgroundPosition = 'center'
      document.body.style.backgroundSize = 'contain'

      // Image Object Validation
      const img = new Image()
      img.onload = () => {
        setSourceImage(img)
        draw(img, null)
      }
      img.src = finalUrl
    })

    // Close on Escape
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)

    // @ts-ignore
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      // @ts-ignore (if API provides removeListener, otherwise standard event removal)
      // Note: The onCaptureSource implementation above doesn't return a remove function directly
      // usually electron usage: ipcRenderer.removeListener...
    }
  }, [mode])

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode === 'window') {
      // Capture Specific Window
      if (activeWindow) {
        // @ts-ignore
        window.api.captureWindow(activeWindow.id, activeWindow.app).then(() => {
          onCancel() // Close overlay after capture
        })
      }
      return
    }

    // Region Mode
    setIsSelecting(true)
    const pos = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY }
    setStartPos(pos)
    setCurrentPos(pos)
    draw(sourceImage, { x: pos.x, y: pos.y, width: 0, height: 0 })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY }

    if (mode === 'window') {
      // Use Global Screen Coordinates to match against Quartz Window List
      const globalX = e.screenX
      const globalY = e.screenY

      // Find top-most window under cursor in Global Space
      const found = windows.find(
        (w) =>
          globalX >= w.x && globalX <= w.x + w.width && globalY >= w.y && globalY <= w.y + w.height
      )

      if (found && found.id !== activeWindow?.id) {
        setActiveWindow(found)
        // Convert Global Window Frame to Local Canvas Coordinates for Drawing
        // We subtract the current window's global position to get the relative offset
        draw(sourceImage, {
          x: found.x - window.screenX,
          y: found.y - window.screenY,
          width: found.width,
          height: found.height
        })
      } else if (!found && activeWindow) {
        setActiveWindow(null)
        draw(sourceImage, null)
      }
      return
    }

    if (!isSelecting) return
    setCurrentPos(pos)

    const rect = {
      x: Math.min(startPos.x, pos.x),
      y: Math.min(startPos.y, pos.y),
      width: Math.abs(pos.x - startPos.x),
      height: Math.abs(pos.y - startPos.y)
    }
    draw(sourceImage, rect)
  }

  const handleMouseUp = () => {
    if (mode === 'window') return

    setIsSelecting(false)
    const rect = getRect()
    if (rect && rect.width > 5 && rect.height > 5) {
      onConfirm({ ...rect })
    } else {
      draw(sourceImage, null)
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 select-none bg-black/10 ${mode === 'window' ? 'cursor-pointer' : 'cursor-crosshair'}`}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="block touch-none w-screen h-screen object-contain"
      />
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/80 text-white px-4 py-2 rounded-full text-sm backdrop-blur border border-slate-700 pointer-events-none select-none z-[60]">
        {mode === 'window' ? 'Click to Capture Window' : 'Click and Drag to Capture'} • ESC to
        Cancel
      </div>
    </div>
  )
}
