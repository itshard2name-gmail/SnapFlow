import { ReactElement, useState, useCallback, useEffect, useRef } from 'react'
import { Capture } from '../../../shared/types'
import { AnnotationCanvas, AnnotationCanvasHandle, AnnotationTool } from './AnnotationCanvas'
import { AnnotationToolbar } from './AnnotationToolbar'
import { CustomAPI } from '../electron'

interface DetailViewProps {
  captures: Capture[]
  activeId: string
  onSelect: (id: string) => void
  onClose: () => void
  onDelete: (id: string) => void
  onRename: () => void
}

export function DetailView({
  captures,
  activeId,
  onSelect,
  onClose,
  onDelete,
  onRename
}: DetailViewProps): ReactElement | null {
  const activeCapture = captures.find((c) => c.id === activeId)
  // Fallback if activeId not found (shouldn't happen)
  const capture = activeCapture || captures[0]

  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const filmstripRef = useRef<HTMLDivElement>(null)
  const annotationCanvasRef = useRef<AnnotationCanvasHandle>(null)

  // Annotation State
  const [isAnnotating, setIsAnnotating] = useState(false)
  const [activeTool, setActiveTool] = useState<AnnotationTool>('select')
  const [activeColor, setActiveColor] = useState('#FF0000')
  const [showSavePrompt, setShowSavePrompt] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [binaryCopySuccess, setBinaryCopySuccess] = useState(false)
  const [notes, setNotes] = useState('')

  // Ref to access current scale inside non-react event listener
  const scaleRef = useRef(1)
  useEffect(() => {
    scaleRef.current = scale
  }, [scale])

  const handleZoomIn = useCallback(() => {
    setScale((s) => Math.min(s + 0.1, 5))
  }, [])

  const handleZoomOut = useCallback(() => {
    setScale((s) => Math.max(s - 0.1, 0.25))
  }, [])

  const handleResetZoom = useCallback(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }, [])

  // Native Wheel Handler for non-passive support
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()

      // Zoom with Ctrl/Meta + Scroll
      if (e.ctrlKey || e.metaKey) {
        const delta = e.deltaY < 0 ? 0.1 : -0.1
        setScale((s) => Math.min(Math.max(s + delta, 0.25), 5))
      } else {
        // Pan with normal scroll (Always allow panning)
        const scrollSpeed = 1.5
        setPosition((p) => ({
          x: p.x - e.deltaX * scrollSpeed,
          y: p.y - e.deltaY * scrollSpeed
        }))
      }
    }

    container.addEventListener('wheel', onWheel, { passive: false })
    return (): void => container.removeEventListener('wheel', onWheel)
  }, [])

  // Panning Handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return // Only left click
      e.preventDefault()
      setIsDragging(true)
      dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y }
    },
    [position]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !dragStartRef.current) return
      e.preventDefault()
      const newX = e.clientX - dragStartRef.current.x
      const newY = e.clientY - dragStartRef.current.y
      setPosition({ x: newX, y: newY })
    },
    [isDragging]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    dragStartRef.current = null
  }, [])

  // Reset zoom & position when capture changes
  useEffect(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
    setNotes(capture.notes || '')
  }, [capture.id, capture.notes])

  const handleNotesBlur = async (): Promise<void> => {
    if (notes !== (capture.notes || '')) {
      await window.api.updateNotes(capture.id, notes)
      onRename() // Refresh parent state
    }
  }

  // Navigation Logic
  const handleNext = useCallback(() => {
    const currentIndex = captures.findIndex((c) => c.id === activeId)
    if (currentIndex < captures.length - 1) {
      onSelect(captures[currentIndex + 1].id)
    }
  }, [captures, activeId, onSelect])

  const handlePrev = useCallback(() => {
    const currentIndex = captures.findIndex((c) => c.id === activeId)
    if (currentIndex > 0) {
      onSelect(captures[currentIndex - 1].id)
    }
  }, [captures, activeId, onSelect])

  const handleToggleFavorite = async (e: React.MouseEvent, id: string): Promise<void> => {
    e.stopPropagation()
    try {
      await window.api.toggleFavorite(id)
      onRename() // Refresh parent
    } catch (err) {
      console.error(err)
    }
  }

  const handleRestore = async (id: string): Promise<void> => {
    try {
      await window.api.restoreCapture(id)
      onRename() // Refresh parent
      onClose() // Close detail since it moved out of trash
    } catch (err) {
      console.error(err)
    }
  }

  // Keyboard Navigation & Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Priority 1: ESC key
      if (e.key === 'Escape') {
        if (!isAnnotating) {
          onClose()
        }
        return
      }

      // Priority 2: Navigation (only if not annotating)
      if (!isAnnotating) {
        switch (e.key) {
          case 'ArrowRight':
            handleNext()
            break
          case 'ArrowLeft':
            handlePrev()
            break
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return (): void => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNext, handlePrev, isAnnotating, onClose])

  // Auto-scroll filmstrip to active item
  useEffect(() => {
    if (filmstripRef.current && activeId) {
      const activeEl = filmstripRef.current.querySelector(`[data-id="${activeId}"]`)
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      }
    }
  }, [activeId])

  if (!capture) return null

  const isTrash = !!capture.deletedAt

  const handleSave = async (overwrite: boolean = false): Promise<void> => {
    if (annotationCanvasRef.current && capture) {
      try {
        setIsSaving(true)
        const dataUrl = await annotationCanvasRef.current.save()
        const success = await (window.api as CustomAPI).saveAnnotatedImage(
          capture.id,
          dataUrl,
          overwrite
        )
        if (success) {
          setIsAnnotating(false)
          setShowSavePrompt(false)
          onRename()
        }
      } catch (err) {
        console.error('Failed to save:', err)
      } finally {
        setIsSaving(false)
      }
    }
  }

  const handleCopy = async (): Promise<void> => {
    if (annotationCanvasRef.current) {
      try {
        const dataUrl = await annotationCanvasRef.current.save()
        await (window.api as CustomAPI).copyImageDataToClipboard(dataUrl)
        setCopySuccess(true)
        setTimeout(() => setCopySuccess(false), 2000)
      } catch (err) {
        console.error('Copy failed:', err)
      }
    }
  }

  const handleBinaryCopy = async (): Promise<void> => {
    try {
      await (window.api as CustomAPI).copyImageToClipboard(capture.filePath)
      setBinaryCopySuccess(true)
      setTimeout(() => setBinaryCopySuccess(false), 2000)
    } catch (err) {
      console.error('Binary copy failed:', err)
    }
  }

  const handleCancel = (): void => {
    setIsAnnotating(false)
  }

  return (
    <div className="absolute inset-0 z-50 flex h-full bg-[#050510] animate-in fade-in duration-200">
      {/* Main Content Area (Column) */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Top Bar with Close Button */}
        <div className="absolute top-0 left-0 right-0 h-14 flex items-center justify-between px-4 z-30 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2">
            {/* Left side actions like restore could go here too if desired */}
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors pointer-events-auto border border-white/5"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Main Canvas Area */}
        <div
          ref={containerRef}
          className="flex-1 flex items-center justify-center relative overflow-hidden group select-none bg-[#0a0a12]"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div className="absolute inset-0 pattern-grid opacity-5 pointer-events-none" />

          {/* Image */}
          <div
            className={`relative w-full h-full flex items-center justify-center overflow-hidden ${scale > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'}`}
          >
            {/* Pan Wrapper - Instant updates (No transition) */}
            <div
              style={{
                transform: isAnnotating ? 'none' : `translate(${position.x}px, ${position.y}px)`,
                willChange: 'transform'
              }}
              className="w-full h-full flex items-center justify-center pointer-events-none"
            >
              {!isAnnotating && (
                <img
                  src={`media://${capture.filePath}`}
                  alt="Capture"
                  style={{
                    transform: `scale(${scale})`,
                    transition: 'transform 0.1s ease-out',
                    willChange: 'transform'
                  }}
                  className="max-h-full max-w-full object-contain shadow-2xl rounded-lg ring-1 ring-white/10 origin-center pointer-events-none"
                />
              )}
            </div>

            {isAnnotating ? (
              <div className="absolute inset-0 flex bg-[#0a0a12] animate-in fade-in duration-300">
                <AnnotationToolbar
                  activeTool={activeTool}
                  setActiveTool={setActiveTool}
                  color={activeColor}
                  setColor={setActiveColor}
                  onUndo={() => annotationCanvasRef.current?.undo()}
                  onRedo={() => annotationCanvasRef.current?.redo()}
                  onSave={() => setShowSavePrompt(true)}
                  onCopy={handleCopy}
                  copySuccess={copySuccess}
                  onCancel={handleCancel}
                />
                <div className="flex-1 relative flex items-center justify-center p-8 overflow-hidden">
                  <AnnotationCanvas
                    ref={annotationCanvasRef}
                    imagePath={capture.filePath}
                    activeTool={activeTool}
                    color={activeColor}
                    onToolChange={setActiveTool}
                  />
                </div>
              </div>
            ) : null}
          </div>

          {/* Save Prompt Modal */}
          {showSavePrompt && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 w-80 shadow-2xl scale-in-95 animate-in zoom-in-95 duration-200">
                <h3 className="text-lg font-bold text-white mb-2">Save Annotation</h3>
                <p className="text-sm text-slate-400 mb-6">
                  How would you like to save your changes?
                </p>

                <div className="space-y-3">
                  <button
                    disabled={isSaving}
                    onClick={() => handleSave(false)}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-600/20"
                  >
                    {isSaving ? 'Saving...' : 'Save as New Copy'}
                  </button>
                  <button
                    disabled={isSaving}
                    onClick={() => handleSave(true)}
                    className="w-full py-3 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all border border-white/10"
                  >
                    Overwrite Original
                  </button>
                  <button
                    disabled={isSaving}
                    onClick={() => setShowSavePrompt(false)}
                    className="w-full py-2 text-slate-500 hover:text-slate-300 text-xs transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Floating Zoom Controls (Positioned above filmstrip) */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-2 py-1.5 bg-slate-900/90 backdrop-blur-md rounded-full border border-white/10 shadow-xl z-20 transition-opacity opacity-0 group-hover:opacity-100 mb-2">
            <button
              onClick={handleZoomOut}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-200 transition-colors"
              title="Zoom Out (Cmd -)"
            >
              -
            </button>
            <span className="text-xs font-mono text-slate-400 w-12 text-center select-none">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-200 transition-colors"
              title="Zoom In (Cmd +)"
            >
              +
            </button>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <button
              onClick={handleResetZoom}
              className="px-3 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-xs font-medium text-slate-300 transition-colors"
              title="Reset Zoom"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Bottom Filmstrip Panel */}
        {!isAnnotating && (
          <div className="h-32 bg-[#050510] border-t border-white/10 flex flex-col z-30 shrink-0">
            <div className="flex px-4 py-2 border-b border-white/5 items-center justify-between">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Filmstrip
              </h3>
              <span className="text-xs text-slate-600">
                {captures.findIndex((c) => c.id === activeId) + 1} / {captures.length}
              </span>
            </div>
            <div
              ref={filmstripRef}
              className="flex-1 flex overflow-x-auto items-center p-3 gap-3 custom-scrollbar"
              onWheel={(e) => {
                // Enable horizontal scroll with vertical wheel for filmstrip
                if (e.deltaY !== 0) {
                  e.currentTarget.scrollLeft += e.deltaY
                }
              }}
            >
              {captures.map((c) => (
                <button
                  key={c.id}
                  data-id={c.id}
                  onClick={() => onSelect(c.id)}
                  className={`relative group shrink-0 h-full aspect-[16/10] rounded-md overflow-hidden border-2 transition-all duration-200 ${
                    c.id === activeId
                      ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] ring-1 ring-blue-500/50'
                      : 'border-transparent hover:border-white/20 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={`media://${c.thumbPath}`}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Utility Panel */}
      {!isAnnotating && (
        <div className="w-80 glass-panel border-l border-white/10 flex flex-col z-30">
          {/* Header */}
          <div className="h-14 border-b border-white/5 flex items-center gap-3 px-4 bg-[#1a1a2e]">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              title="Back to Grid"
            >
              ←
            </button>

            <div className="w-px h-6 bg-white/10" />

            {/* Favorite Toggle */}
            <button
              onClick={(e) => handleToggleFavorite(e, capture.id)}
              className={`p-1.5 rounded-lg transition-colors ${
                capture.isFavorite
                  ? 'text-yellow-400 hover:text-yellow-300 bg-yellow-400/10'
                  : 'text-slate-400 hover:text-yellow-400 hover:bg-white/10'
              }`}
              title={capture.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
            >
              {capture.isFavorite ? '⭐️' : '☆'}
            </button>

            {isTrash && (
              <button
                onClick={() => handleRestore(capture.id)}
                className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 text-xs font-medium border border-green-500/20"
              >
                Restore
              </button>
            )}

            <div className="flex-1" />

            {/* Delete Action in Header */}
            <button
              onClick={() => {
                if (isTrash) {
                  // Permanent Delete Confirmation
                  if (confirm('Delete this capture permanently? This cannot be undone.')) {
                    onDelete(capture.id)
                  }
                } else {
                  // Soft Delete
                  onDelete(capture.id)
                }
              }}
              className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
              title={isTrash ? 'Delete Permanently' : 'Move to Trash'}
            >
              {isTrash ? '🗑️' : '🗑️'}
            </button>
          </div>

          <div className="px-6 py-4 border-b border-white/5">
            <input
              type="text"
              defaultValue={capture.sourceTitle || 'Untitled'}
              onBlur={async (e) => {
                const newTitle = e.target.value.trim() || 'Untitled'
                await window.api.renameCapture(capture.id, newTitle)
                onRename()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur()
                }
                e.stopPropagation() // Prevent triggering other shortcuts
              }}
              className="bg-transparent font-semibold text-lg text-slate-200 focus:text-white focus:bg-white/5 focus:outline-none focus:ring-1 focus:ring-blue-500/50 rounded px-2 -ml-2 py-1 w-full transition-all"
            />
          </div>

          {/* Metadata Section */}
          <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
            <div>
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                Info
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">Resolution</span>
                  <span className="text-sm text-slate-200 font-mono">
                    {capture.width} × {capture.height}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">Created</span>
                  <span className="text-sm text-slate-200">
                    {new Date(capture.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">Time</span>
                  <span className="text-sm text-slate-200">
                    {new Date(capture.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  window.api.saveCaptureAs(capture.id)
                }}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Export
              </button>
              <button
                onClick={() => {
                  // Instant delete (Soft delete)
                  onDelete(capture.id)
                }}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg text-sm font-medium transition-colors"
              >
                Delete
              </button>
            </div>

            <div className="h-px bg-white/5" />

            {/* Notes Functional */}
            <div className="">
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                Notes
              </h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleNotesBlur}
                placeholder="Add your notes here..."
                className="w-full h-32 rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:bg-white/5 transition-all resize-none custom-scrollbar"
              />
            </div>

            {/* Tools Placeholder */}
            <div className="">
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                Tools
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setIsAnnotating(true)}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-xl text-sm font-medium transition-all group"
                >
                  <span className="group-hover:scale-110 transition-transform">✎</span> Annotate
                </button>
                <button
                  onClick={handleBinaryCopy}
                  className={`flex items-center justify-center gap-2 px-4 py-3 border rounded-xl text-sm font-medium transition-all ${
                    binaryCopySuccess
                      ? 'bg-green-600/20 text-green-400 border-green-500/30'
                      : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                  }`}
                >
                  {binaryCopySuccess ? 'COPIED ✅' : 'Copy IMAGE'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
