import { useRef, useState, useEffect } from 'react'

interface CaptureOverlayProps {
  onConfirm: (coords: { x: number; y: number; width: number; height: number }) => void
  onCancel: () => void
}

export function CaptureOverlay({ onConfirm, onCancel }: CaptureOverlayProps) {
  console.log('CaptureOverlay component mounted!') // Step 3: Renderer lifecycle check

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 })

  const getRect = () => {
    return {
      x: Math.min(startPos.x, currentPos.x),
      y: Math.min(startPos.y, currentPos.y),
      width: Math.abs(currentPos.x - startPos.x),
      height: Math.abs(currentPos.y - startPos.y)
    }
  }

  const draw = (img: HTMLImageElement | null, rect: ReturnType<typeof getRect> | null) => {
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
      // Use clipping to ensure perfect alignment with the background image
      ctx.save()
      ctx.beginPath()
      ctx.rect(rect.x, rect.y, rect.width, rect.height)
      ctx.clip()

      // Draw the full image again into the clipped region
      // This guarantees it matches the background layer exactly (no zoom/offset)
      ctx.drawImage(img, 0, 0, logicalWidth, logicalHeight)

      ctx.restore()

      // Draw border
      ctx.strokeStyle = '#3b82f6' // blue-500
      ctx.lineWidth = 2
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)

      // Draw Dimensions tooltip
      ctx.fillStyle = '#1e293b'
      ctx.fillRect(rect.x, rect.y - 25, 80, 20)
      ctx.fillStyle = 'white'
      ctx.font = '12px sans-serif'
      ctx.fillText(`${rect.width} x ${rect.height}`, rect.x + 5, rect.y - 10)
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

    // Listen for the background source from main process
    // @ts-ignore
    window.api.onCaptureSource((source) => {
      console.log('Renderer received image data', source)

      let finalUrl = ''
      if (source.filePath) {
        // Step 1: Strict Path Handling
        let rawPath = source.filePath
        // Normalize slashes
        rawPath = rawPath.replace(/\\/g, '/')

        // Ensure media:// prefix
        if (!rawPath.startsWith('media://')) {
          // For absolute paths like /tmp/foo, we want media:///tmp/foo
          // If path already has leading slash, just join.
          // If not (Windows C:/...), media:///C:/...
          // Safe approach: ensure 3 slashes if it doesn't have protocol
          // Construct proper URL with protocol
          // Important: Add cache busting to prevent old image loading
          finalUrl = `media://${rawPath}?t=${Date.now()}`
          console.log('Using media protocol:', finalUrl)
        } else {
          finalUrl = rawPath
        }
      } else if (source.base64Image) {
        // Fallback (Deprioritized)
        console.warn('Using Base64 fallback (not recommended)')
        finalUrl = `data:image/png;base64,${source.base64Image}`
      }

      console.log('DOM SRC CHECK:', finalUrl)

      // Step 2: Background Render Priority
      // Force browser to fetch
      const bgUrl = `url("${finalUrl}")`
      document.body.style.backgroundImage = bgUrl
      document.body.style.backgroundRepeat = 'no-repeat'
      document.body.style.backgroundPosition = 'center' // Changed from top-left to center for visibility
      document.body.style.backgroundSize = 'contain'

      // Image Object Validation
      const img = new Image()
      img.onload = () => {
        console.log('Image object loaded successfully:', img.width, 'x', img.height)
        setSourceImage(img)
        draw(img, null)
      }
      img.onerror = (e) => {
        console.error('Image object failed to load:', finalUrl, e)
      }
      img.src = finalUrl
    })

    // Close on Escape
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsSelecting(true)
    const pos = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY }
    setStartPos(pos)
    setCurrentPos(pos)
    draw(sourceImage, { x: pos.x, y: pos.y, width: 0, height: 0 })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isSelecting) return
    const pos = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY }
    setCurrentPos(pos)

    // Efficient redraw
    const rect = {
      x: Math.min(startPos.x, pos.x),
      y: Math.min(startPos.y, pos.y),
      width: Math.abs(pos.x - startPos.x),
      height: Math.abs(pos.y - startPos.y)
    }
    draw(sourceImage, rect)
  }

  const handleMouseUp = () => {
    setIsSelecting(false)
    const rect = getRect()
    if (rect.width > 5 && rect.height > 5) {
      // Play shutter sound immediately for zero latency
      // Uses the custom media protocol to access the system sound

      onConfirm({ ...rect })
    } else {
      // Reset if too small
      draw(sourceImage, null)
    }
  }

  return (
    <div className="fixed inset-0 cursor-crosshair z-50 select-none bg-black/10">
      <canvas
        ref={canvasRef}
        // Width/Height are controlled by useEffect for High-DPI support
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="block touch-none w-screen h-screen object-contain"
      />
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/80 text-white px-4 py-2 rounded-full text-sm backdrop-blur border border-slate-700 pointer-events-none select-none z-[60]">
        Click and Drag to Capture • ESC to Cancel
      </div>
    </div>
  )
}
