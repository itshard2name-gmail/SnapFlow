import { useRef, useState, useEffect, useCallback, ReactElement } from 'react'

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
  mode: 'region' | 'window' | 'scroll'
  onConfirm: (coords: {
    x: number
    y: number
    width: number
    height: number
    id?: number
    sourceTitle?: string
  }) => void
  onCancel: () => void
}

export function CaptureOverlay({ mode, onConfirm, onCancel }: CaptureOverlayProps): ReactElement {
  console.log('CaptureOverlay component mounted! Mode:', mode)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  // No longer needed: sourceImage state
  // const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null)

  // Region Selection State
  const [isSelecting, setIsSelecting] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 })

  // Window Mode State
  const [windows, setWindows] = useState<WindowInfo[]>([])
  const [activeWindow, setActiveWindow] = useState<WindowInfo | null>(null)

  const getRect = useCallback(() => {
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
  }, [mode, activeWindow, startPos, currentPos])

  // STABLE DRAW FUNCTION: Removed activeWindow dependency
  const draw = useCallback(
    (
      rect: { x: number; y: number; width: number; height: number } | null,
      labelOverride?: string
    ): void => {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      const logicalWidth = canvas.width / dpr
      const logicalHeight = canvas.height / dpr

      // 1. Clear everything
      ctx.clearRect(0, 0, logicalWidth, logicalHeight)

      // 2. Fill with semi-transparent dim mask
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
      ctx.fillRect(0, 0, logicalWidth, logicalHeight)

      if (rect && rect.width > 0 && rect.height > 0) {
        // 3. Cut a hole (Destination Out)
        ctx.save()
        ctx.globalCompositeOperation = 'destination-out'
        ctx.fillStyle = 'rgba(0, 0, 0, 1)'
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
        ctx.restore()

        // 4. Draw border around the hole
        ctx.strokeStyle = mode === 'scroll' ? '#8b5cf6' : mode === 'window' ? '#10b981' : '#3b82f6'
        ctx.lineWidth = 2
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)

        // 5. Draw Dimensions tooltip
        const labelY = rect.y - 25 < 0 ? rect.y + rect.height + 5 : rect.y - 25

        ctx.fillStyle = '#1e293b'
        ctx.fillRect(rect.x, labelY, mode === 'window' ? 120 : 80, 20)
        ctx.fillStyle = 'white'
        ctx.font = '12px sans-serif'

        const label =
          labelOverride ||
          (mode === 'scroll'
            ? `Scroll Region: ${rect.width} x ${rect.height}`
            : `${rect.width} x ${rect.height}`)

        ctx.fillText(label, rect.x + 5, labelY + 15)
      }
    },
    [mode]
  )

  useEffect(() => {
    // Setup High-DPI Canvas
    const canvas = canvasRef.current
    if (canvas) {
      const dpr = window.devicePixelRatio || 1
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.scale(dpr, dpr)
    }

    document.documentElement.style.backgroundColor = 'transparent'
    document.body.style.backgroundColor = 'transparent'
    document.body.style.backgroundImage = 'none'

    draw(null)

    if (mode === 'window') {
      const fetchWindows = async (): Promise<void> => {
        try {
          // @ts-ignore: window.api is exposed via preload script
          const winList = await window.api.getOpenWindows()
          console.log('Fetched Windows:', winList.length)
          setWindows(winList)
        } catch (err) {
          console.error('Failed to fetch windows:', err)
        }
      }
      fetchWindows()
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)

    return (): void => {
      window.removeEventListener('keydown', handleKeyDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, onCancel]) // REMOVED draw from dependencies to fix loop

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent): void => {
    // @ts-ignore: window.api is exposed via preload script
    window.api.log(
      `[RENDERER-DEBUG] Mouse Down: mode=${mode} x=${e.nativeEvent.offsetX} y=${e.nativeEvent.offsetY}`
    )
    e.preventDefault()

    if (mode === 'window') {
      if (activeWindow) {
        onConfirm({
          x: activeWindow.x - window.screenX,
          y: activeWindow.y - window.screenY,
          width: activeWindow.width,
          height: activeWindow.height,
          // @ts-ignore: Extending the type implicitly for App.tsx to handle
          id: activeWindow.id,
          sourceTitle: activeWindow.app || activeWindow.title
        })
      }
      return
    }

    setIsSelecting(true)
    const pos = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY }
    setStartPos(pos)
    setCurrentPos(pos)
    draw({ x: pos.x, y: pos.y, width: 0, height: 0 })
  }

  const handleMouseMove = (e: React.MouseEvent): void => {
    const pos = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY }

    if (mode === 'window') {
      const globalX = e.screenX
      const globalY = e.screenY

      const found = windows.find(
        (w) =>
          globalX >= w.x && globalX <= w.x + w.width && globalY >= w.y && globalY <= w.y + w.height
      )

      if (found && found.id !== activeWindow?.id) {
        setActiveWindow(found)
        // Pass label directly to stable draw function
        draw(
          {
            x: found.x - window.screenX,
            y: found.y - window.screenY,
            width: found.width,
            height: found.height
          },
          found.app
        )
      } else if (!found && activeWindow) {
        setActiveWindow(null)
        draw(null)
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
    draw(rect)
  }

  const handleMouseUp = (): void => {
    if (mode === 'window') return

    setIsSelecting(false)
    const rect = getRect()
    if (rect && rect.width > 5 && rect.height > 5) {
      onConfirm({ ...rect })
    } else {
      draw(null)
    }
  }

  return (
    <div
      style={{ pointerEvents: 'auto' }}
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
        {mode === 'window'
          ? 'Click to Capture Window'
          : mode === 'scroll'
            ? 'Drag to Select Scroll Area'
            : 'Click and Drag to Capture'}{' '}
        • ESC to Cancel
      </div>
    </div>
  )
}
