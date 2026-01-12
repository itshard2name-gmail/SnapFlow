import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react'
import * as fabric from 'fabric'

export type AnnotationTool = 'select' | 'pen' | 'arrow' | 'rect' | 'text' | 'mosaic'

interface AnnotationCanvasProps {
  imagePath: string
  activeTool: AnnotationTool
  color: string
  onToolChange?: (tool: AnnotationTool) => void
}

export interface AnnotationCanvasHandle {
  undo: () => void
  redo: () => void
  save: () => Promise<string>
  clear: () => void
}

export const AnnotationCanvas = forwardRef<AnnotationCanvasHandle, AnnotationCanvasProps>(
  ({ imagePath, activeTool, color, onToolChange }, ref): React.JSX.Element => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const fabricCanvasRef = useRef<fabric.Canvas | null>(null)
    const historyRef = useRef<string[]>([])
    const historyIndexRef = useRef<number>(-1)
    const resolutionScaleRef = useRef<number>(1)
    const clipboardRef = useRef<fabric.FabricObject | null>(null)
    const lastExitEditingTimeRef = useRef<number>(0)
    const isDraggingViewportRef = useRef(false)
    const lastPointerRef = useRef({ x: 0, y: 0 })

    const saveState = useCallback((): void => {
      const canvas = fabricCanvasRef.current
      if (!canvas) return

      const json = JSON.stringify(canvas.toJSON())
      if (historyRef.current[historyIndexRef.current] === json) return

      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
      historyRef.current.push(json)
      historyIndexRef.current++
    }, [])

    useEffect(() => {
      if (!canvasRef.current || !containerRef.current) return

      const canvas = new fabric.Canvas(canvasRef.current, {
        backgroundColor: 'transparent',
        enableRetinaScaling: true,
        fireMiddleClick: true,
        stopContextMenu: true
      })
      fabricCanvasRef.current = canvas

      const updateCanvasLayout = (img?: HTMLImageElement): void => {
        if (!containerRef.current || !canvas) return
        const imgElement = img || (canvas.backgroundImage as fabric.FabricImage)?.getElement()
        if (!imgElement) return

        const imgW = (imgElement as HTMLImageElement).naturalWidth
        const imgH = (imgElement as HTMLImageElement).naturalHeight
        const containerW = containerRef.current.clientWidth - 40 // Padding
        const containerH = containerRef.current.clientHeight - 40 // Padding

        const scale = Math.min(containerW / imgW, containerH / imgH, 1)

        // Fabric 6 Native Fit-to-Screen:
        // Set display dimensions to match screen space
        canvas.setDimensions({
          width: imgW * scale,
          height: imgH * scale
        })

        // Apply zoom so internal coords are 1:1 with image pixels
        canvas.setZoom(scale)

        // Standardize tool sizes based on resolution
        resolutionScaleRef.current = imgW / 1200

        canvas.calcOffset()
        canvas.renderAll()
      }

      const imgElement = new Image()
      imgElement.src = `media://${imagePath}`
      imgElement.onload = (): void => {
        const fabricImg = new fabric.FabricImage(imgElement, {
          left: 0,
          top: 0,
          originX: 'left',
          originY: 'top',
          selectable: false,
          evented: false
        })
        canvas.backgroundImage = fabricImg
        updateCanvasLayout(imgElement)
        saveState()
      }

      const resizeObserver = new ResizeObserver(() => {
        updateCanvasLayout()
      })
      resizeObserver.observe(containerRef.current)

      canvas.on('object:added', () => saveState())
      canvas.on('object:modified', () => saveState())
      canvas.on('object:removed', () => saveState())

      // Track when any text object exits editing mode
      canvas.on('text:editing:exited', () => {
        lastExitEditingTimeRef.current = Date.now()
      })

      // Pen auto-selection: Switch to arrow tool after path creation
      canvas.on('path:created', (opt) => {
        const path = opt.path
        if (path) {
          canvas.isDrawingMode = false
          canvas.setActiveObject(path)
          canvas.renderAll()
          if (onToolChange) {
            onToolChange('select')
          }
        }
      })

      // Zoom Handler
      canvas.on('mouse:wheel', (opt) => {
        const delta = opt.e.deltaY
        let zoom = canvas.getZoom()
        zoom *= 0.999 ** delta
        if (zoom > 20) zoom = 20
        if (zoom < 0.01) zoom = 0.01
        canvas.zoomToPoint(new fabric.Point(opt.e.offsetX, opt.e.offsetY), zoom)
        opt.e.preventDefault()
        opt.e.stopPropagation()
      })

      return (): void => {
        resizeObserver.disconnect()
        canvas.dispose()
      }
    }, [imagePath, saveState, onToolChange])

    useEffect(() => {
      const canvas = fabricCanvasRef.current
      if (!canvas) return

      const resScale = resolutionScaleRef.current
      canvas.isDrawingMode = activeTool === 'pen'

      if (canvas.isDrawingMode) {
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas)
        canvas.freeDrawingBrush.color = color
        canvas.freeDrawingBrush.width = 5 * resScale
        canvas.freeDrawingBrush.shadow = new fabric.Shadow({
          color: 'rgba(255,255,255,0.5)',
          blur: 2 * resScale,
          offsetX: 1 * resScale,
          offsetY: 1 * resScale
        })
      }

      const handleMouseDown = (opt: fabric.TPointerEventInfo): void => {
        if (canvas.isDrawingMode) return

        const startViewportPanning = (e: MouseEvent | TouchEvent | PointerEvent): void => {
          const mouseEvent = e as MouseEvent
          isDraggingViewportRef.current = true
          lastPointerRef.current = { x: mouseEvent.clientX, y: mouseEvent.clientY }
          canvas.setCursor('grabbing')

          const onMove = (moveOpt: MouseEvent): void => {
            if (!isDraggingViewportRef.current) return
            const deltaX = moveOpt.clientX - lastPointerRef.current.x
            const deltaY = moveOpt.clientY - lastPointerRef.current.y
            lastPointerRef.current = { x: moveOpt.clientX, y: moveOpt.clientY }
            canvas.relativePan(new fabric.Point(deltaX, deltaY))
          }

          const onUp = (): void => {
            isDraggingViewportRef.current = false
            canvas.setCursor('default')
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
          }

          window.addEventListener('mousemove', onMove)
          window.addEventListener('mouseup', onUp)
        }

        // Viewport Pan with Alt Key (Global Override)
        if (opt.e.altKey) {
          startViewportPanning(opt.e)
          return
        }

        const hit = canvas.findTarget(opt.e)
        const target = hit ? (hit as { target: fabric.FabricObject }).target : null

        if (activeTool === 'select') {
          // If in select mode and we DID NOT hit an object, pan the background
          if (!target || target === canvas.backgroundImage) {
            startViewportPanning(opt.e)
          }
          return
        }

        // Hit-test: If we clicked an existing object, don't create a new one
        if (target && target !== canvas.backgroundImage) {
          return
        }

        // Text editing escape:
        // Use a timestamp check to see if we just exited a text editing session.
        // Fabric clears the editing state before mouse:down, so we block new creation
        // if an edit session just ended (within 200ms).
        if (Date.now() - lastExitEditingTimeRef.current < 200) {
          return
        }

        const pointer = canvas.getScenePoint(opt.e)

        if (activeTool === 'arrow') {
          const tail = new fabric.Polygon(
            [
              { x: pointer.x, y: pointer.y },
              { x: pointer.x, y: pointer.y },
              { x: pointer.x, y: pointer.y },
              { x: pointer.x, y: pointer.y }
            ],
            {
              fill: color,
              selectable: false,
              evented: false,
              strokeUniform: true,
              shadow: new fabric.Shadow({
                color: 'white',
                blur: 2 * resScale,
                offsetX: 0,
                offsetY: 0
              })
            }
          )

          const head = new fabric.Triangle({
            width: 32 * resScale,
            height: 38 * resScale,
            fill: color,
            left: pointer.x,
            top: pointer.y,
            originX: 'center',
            originY: 'center',
            angle: 0,
            selectable: false,
            evented: false,
            shadow: new fabric.Shadow({
              color: 'white',
              blur: 2 * resScale,
              offsetX: 0,
              offsetY: 0
            })
          })

          canvas.add(tail, head)

          const onMove = (moveOpt: fabric.TPointerEventInfo): void => {
            const p = canvas.getScenePoint(moveOpt.e)
            const dx = p.x - pointer.x
            const dy = p.y - pointer.y
            const len = Math.sqrt(dx * dx + dy * dy)
            if (len < 1) return

            const ux = dx / len
            const uy = dy / len
            const nx = -uy
            const ny = ux

            const w1 = 3 * resScale // Thin start
            const w2 = 12 * resScale // Thick end

            const p1 = { x: pointer.x + (w1 / 2) * nx, y: pointer.y + (w1 / 2) * ny }
            const p2 = { x: pointer.x - (w1 / 2) * nx, y: pointer.y - (w1 / 2) * ny }
            const p3 = { x: p.x - (w2 / 2) * nx, y: p.y - (w2 / 2) * ny }
            const p4 = { x: p.x + (w2 / 2) * nx, y: p.y + (w2 / 2) * ny }

            tail.set({
              points: [p1, p2, p3, p4]
            })

            const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90
            head.set({ left: p.x, top: p.y, angle })
            canvas.renderAll()
          }

          const onUp = (): void => {
            canvas.off('mouse:move', onMove)
            canvas.off('mouse:up', onUp)

            // Remove individual components and add as a group for manipulation
            canvas.remove(tail, head)
            const arrowGroup = new fabric.Group([tail, head], {
              selectable: true,
              hasControls: true,
              lockScalingFlip: true
            })
            canvas.add(arrowGroup)
            canvas.setActiveObject(arrowGroup)

            saveState()
          }

          canvas.on('mouse:move', onMove)
          canvas.on('mouse:up', onUp)
        } else if (activeTool === 'rect') {
          const rect = new fabric.Rect({
            left: pointer.x,
            top: pointer.y,
            originX: 'left',
            originY: 'top',
            width: 0,
            height: 0,
            fill: 'rgba(255, 255, 255, 0.0001)', // Semi-transparent but hit-testable
            stroke: color,
            strokeWidth: 6 * resScale,
            strokeUniform: true,
            shadow: new fabric.Shadow({
              color: 'white',
              blur: 1 * resScale,
              offsetX: 1 * resScale,
              offsetY: 1 * resScale
            })
          })
          canvas.add(rect)
          canvas.setActiveObject(rect)

          const onMove = (moveOpt: fabric.TPointerEventInfo): void => {
            const p = canvas.getScenePoint(moveOpt.e)
            rect.set({
              width: Math.abs(p.x - pointer.x),
              height: Math.abs(p.y - pointer.y),
              left: Math.min(p.x, pointer.x),
              top: Math.min(p.y, pointer.y)
            })
            rect.setCoords()
            canvas.renderAll()
          }

          const onUp = (): void => {
            canvas.off('mouse:move', onMove)
            canvas.off('mouse:up', onUp)
            saveState()
          }

          canvas.on('mouse:move', onMove)
          canvas.on('mouse:up', onUp)
        } else if (activeTool === 'text') {
          const text = new fabric.IText('Text here', {
            left: pointer.x,
            top: pointer.y,
            fill: color,
            fontSize: 40 * resScale,
            fontFamily: 'sans-serif',
            fontWeight: 'bold',
            shadow: new fabric.Shadow({
              color: 'white',
              blur: 3 * resScale,
              offsetX: 1 * resScale,
              offsetY: 1 * resScale
            })
          })
          canvas.add(text)
          canvas.setActiveObject(text)
          text.enterEditing()
          saveState()
        } else if (activeTool === 'mosaic') {
          const mosaic = new fabric.Rect({
            left: pointer.x,
            top: pointer.y,
            originX: 'left',
            originY: 'top',
            width: 0,
            height: 0,
            fill: 'transparent',
            stroke: 'rgba(255,255,255,0.5)',
            strokeWidth: 1 * resScale,
            strokeDashArray: [5 * resScale, 5 * resScale],
            selectable: false
          })
          canvas.add(mosaic)

          const onMove = (moveOpt: fabric.TPointerEventInfo): void => {
            const p = canvas.getScenePoint(moveOpt.e)
            mosaic.set({
              width: Math.abs(p.x - pointer.x),
              height: Math.abs(p.y - pointer.y),
              left: Math.min(p.x, pointer.x),
              top: Math.min(p.y, pointer.y)
            })
            mosaic.setCoords()
            canvas.renderAll()
          }

          const onUp = async (): Promise<void> => {
            canvas.off('mouse:move', onMove)
            canvas.off('mouse:up', onUp)

            // Fix Mosaic Offset: Use Math.round for all physical coordinates
            const mWidth = Math.round(mosaic.width)
            const mHeight = Math.round(mosaic.height)
            const mLeft = Math.round(mosaic.left)
            const mTop = Math.round(mosaic.top)

            if (mWidth > 5 && mHeight > 5) {
              const bg = canvas.backgroundImage as fabric.FabricImage
              if (bg) {
                const cropCanvas = document.createElement('canvas')
                cropCanvas.width = mWidth
                cropCanvas.height = mHeight
                const ctx = cropCanvas.getContext('2d')
                if (ctx) {
                  ctx.drawImage(
                    bg.getElement() as HTMLImageElement,
                    mLeft,
                    mTop,
                    mWidth,
                    mHeight,
                    0,
                    0,
                    mWidth,
                    mHeight
                  )

                  const pixelatedImg = await fabric.FabricImage.fromURL(cropCanvas.toDataURL())
                  pixelatedImg.set({
                    left: mLeft,
                    top: mTop,
                    selectable: true,
                    // Ensure the pixelated image also has correct origins
                    originX: 'left',
                    originY: 'top'
                  })

                  // Fixed at "Low" intensity (5px) as requested
                  const baseBlockSize = 5

                  const filter = new fabric.filters.Pixelate({
                    blocksize: Math.max(Math.round(baseBlockSize * resScale), 2)
                  })
                  pixelatedImg.filters.push(filter)
                  pixelatedImg.applyFilters()

                  canvas.remove(mosaic)
                  canvas.add(pixelatedImg)
                  canvas.setActiveObject(pixelatedImg)
                  canvas.renderAll()
                  saveState()
                }
              }
            } else {
              canvas.remove(mosaic)
            }
          }

          canvas.on('mouse:move', onMove)
          canvas.on('mouse:up', onUp)
        }
      }

      canvas.on('mouse:down', handleMouseDown)

      // Keyboard Shortcuts
      const handleKeyDown = async (e: KeyboardEvent): Promise<void> => {
        // Detect if user is typing in a text object
        const activeObject = canvas.getActiveObject()
        if (activeObject instanceof fabric.IText && activeObject.isEditing) {
          return
        }

        const isMod = e.metaKey || e.ctrlKey
        const key = e.key.toLowerCase()

        // 1. Delete / Backspace
        if (key === 'delete' || key === 'backspace') {
          const targets = canvas.getActiveObjects()
          if (targets.length > 0) {
            canvas.remove(...targets)
            canvas.discardActiveObject()
            canvas.renderAll()
            saveState()
          }
          return
        }

        // 2. Undo/Redo (Cmd+Z, Cmd+Shift+Z, Cmd+Y)
        if (isMod && key === 'z') {
          if (e.shiftKey) {
            // redo
            if (historyIndexRef.current < historyRef.current.length - 1) {
              historyIndexRef.current++
              await canvas.loadFromJSON(historyRef.current[historyIndexRef.current])
              canvas.renderAll()
            }
          } else {
            // undo
            if (historyIndexRef.current > 0) {
              historyIndexRef.current--
              await canvas.loadFromJSON(historyRef.current[historyIndexRef.current])
              canvas.renderAll()
            }
          }
          e.preventDefault()
          return
        }

        if (isMod && key === 'y') {
          if (historyIndexRef.current < historyRef.current.length - 1) {
            historyIndexRef.current++
            await canvas.loadFromJSON(historyRef.current[historyIndexRef.current])
            canvas.renderAll()
          }
          e.preventDefault()
          return
        }

        // 3. Copy (Cmd+C)
        if (isMod && key === 'c') {
          const active = canvas.getActiveObject()
          if (active && active !== canvas.backgroundImage) {
            active.clone().then((cloned) => {
              clipboardRef.current = cloned
            })
          }
          e.preventDefault()
          return
        }

        // 4. Paste (Cmd+V)
        if (isMod && key === 'v') {
          if (clipboardRef.current) {
            clipboardRef.current.clone().then((cloned) => {
              canvas.discardActiveObject()
              cloned.set({
                left: cloned.left! + 20 * resolutionScaleRef.current,
                top: cloned.top! + 20 * resolutionScaleRef.current,
                evented: true
              })
              if (cloned instanceof fabric.Group) {
                // Group requires additional handling for coordinates
                cloned.setCoords()
              }
              canvas.add(cloned)
              canvas.setActiveObject(cloned)
              canvas.renderAll()
              saveState()
              // Update clipboard for next paste
              clipboardRef.current = cloned
            })
          }
          e.preventDefault()
          return
        }

        // 5. Cut (Cmd+X)
        if (isMod && key === 'x') {
          const active = canvas.getActiveObject()
          if (active && active !== canvas.backgroundImage) {
            active.clone().then((cloned) => {
              clipboardRef.current = cloned
              canvas.remove(active)
              canvas.discardActiveObject()
              canvas.renderAll()
              saveState()
            })
          }
          e.preventDefault()
          return
        }
      }

      window.addEventListener('keydown', handleKeyDown)

      return (): void => {
        window.removeEventListener('keydown', handleKeyDown)
        canvas.off('mouse:down', handleMouseDown)
      }
    }, [activeTool, color, saveState, onToolChange])

    useImperativeHandle(ref, () => ({
      undo: () => {
        if (historyIndexRef.current > 0) {
          historyIndexRef.current--
          fabricCanvasRef.current
            ?.loadFromJSON(historyRef.current[historyIndexRef.current])
            .then(() => {
              fabricCanvasRef.current?.renderAll()
            })
        }
      },
      redo: () => {
        if (historyIndexRef.current < historyRef.current.length - 1) {
          historyIndexRef.current++
          fabricCanvasRef.current
            ?.loadFromJSON(historyRef.current[historyIndexRef.current])
            .then(() => {
              fabricCanvasRef.current?.renderAll()
            })
        }
      },
      save: async () => {
        if (!fabricCanvasRef.current) return ''
        const canvas = fabricCanvasRef.current

        const bg = canvas.backgroundImage as fabric.FabricImage
        if (!bg) return ''

        const imgElement = bg.getElement() as HTMLImageElement
        const originalWidth = imgElement.naturalWidth
        const originalHeight = imgElement.naturalHeight

        // Viewport-independent export:
        // We temporarily reset the transform to scene origin to capture the full original image.
        const vtp = canvas.viewportTransform.slice()
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0])

        const dataUrl = canvas.toDataURL({
          format: 'png',
          quality: 1,
          multiplier: 1,
          left: 0,
          top: 0,
          width: originalWidth,
          height: originalHeight
        })

        // Restore transform
        canvas.setViewportTransform(vtp as fabric.TMat2D)
        canvas.renderAll()

        return dataUrl
      },
      clear: () => {
        fabricCanvasRef.current?.clear()
        saveState()
      }
    }))

    return (
      <div
        ref={containerRef}
        className="relative w-full h-full flex items-center justify-center bg-transparent overflow-hidden"
      >
        <div className="relative shadow-2xl rounded-lg overflow-hidden ring-1 ring-white/10">
          <canvas ref={canvasRef} />
        </div>
      </div>
    )
  }
)

AnnotationCanvas.displayName = 'AnnotationCanvas'
