import { ReactElement, useState, useCallback, useEffect, useRef } from 'react'
import { Capture } from '../../../shared/types'

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }, [capture.id])

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
      // @ts-ignore: api exposed
      await window.api.toggleFavorite(id)
      onRename() // Refresh parent
    } catch (err) {
      console.error(err)
    }
  }

  const handleRestore = async (id: string): Promise<void> => {
    try {
      // @ts-ignore: api exposed
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
      switch (e.key) {
        case 'ArrowRight':
          handleNext()
          break
        case 'ArrowLeft':
          handlePrev()
          break
        case 'Escape':
          onClose()
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return (): void => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNext, handlePrev, onClose])

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
                transform: `translate(${position.x}px, ${position.y}px)`,
                willChange: 'transform'
              }}
              className="w-full h-full flex items-center justify-center pointer-events-none"
            >
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
            </div>
          </div>

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
        <div className="h-32 bg-[#050510] border-t border-white/10 flex flex-col z-30 shrink-0">
          <div className="flex px-4 py-2 border-b border-white/5 items-center justify-between">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filmstrip</h3>
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
      </div>

      {/* Right Utility Panel */}
      <div className="w-80 glass-panel border-l border-white/10 flex flex-col z-30">
        {/* Header */}
        <div className="h-14 border-b border-white/5 flex items-center gap-3 px-4">
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
              // @ts-ignore: window.api is exposed via preload in Electron
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
                // @ts-ignore: window.api is exposed
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

          {/* Notes Placeholder */}
          <div className="opacity-75">
            <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
              Notes{' '}
              <span className="ml-2 px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px]">
                Soon
              </span>
            </h3>
            <div className="h-32 rounded-lg border border-white/10 bg-black/20 p-3">
              <span className="text-sm text-slate-600 italic">Add your notes here...</span>
            </div>
          </div>

          {/* Tools Placeholder */}
          <div className="opacity-75">
            <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
              Tools{' '}
              <span className="ml-2 px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px]">
                Soon
              </span>
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="aspect-square rounded bg-white/5 flex items-center justify-center border border-white/5 hover:bg-white/10 cursor-not-allowed"
                >
                  <span className="text-slate-600 text-xs">🛠️</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
