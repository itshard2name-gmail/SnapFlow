import { useEffect, useCallback, ReactElement } from 'react'

interface LightboxProps {
  imageSrc: string
  onClose: () => void
  onNext: () => void
  onPrev: () => void
  onOpenExternal: () => void
  title?: string
}

export function Lightbox({
  imageSrc,
  onClose,
  onNext,
  onPrev,
  onOpenExternal,
  title
}: LightboxProps): ReactElement {
  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case 'ArrowRight':
          onNext()
          break
        case 'ArrowLeft':
          onPrev()
          break
      }
    },
    [onClose, onNext, onPrev]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    // Prevent scrolling when lightbox is open
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [handleKeyDown])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      {/* Backdrop Click to Close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white/50 hover:text-white bg-black/20 hover:bg-white/10 rounded-full transition-colors z-50"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      {/* Main Content */}
      <div className="relative z-10 max-w-[90vw] max-h-[90vh] flex flex-col items-center">
        <img
          src={imageSrc}
          alt={title || 'Preview'}
          className="max-w-full max-h-[85vh] object-contain shadow-2xl rounded-lg"
          onClick={(e) => e.stopPropagation()}
        />

        {/* Caption & Actions Bar */}
        <div
          className="mt-4 flex items-center gap-4 px-6 py-3 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-sm font-medium text-slate-200 truncate max-w-[200px]">{title}</span>
          <div className="w-px h-4 bg-white/20 mx-2" />

          <button
            onClick={onOpenExternal}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1.5"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
            Open with System
          </button>
        </div>
      </div>

      {/* Navigation Areas (Invisible but clickable) */}
      <div
        className="absolute inset-y-0 left-0 w-24 flex items-center justify-start pl-4 group cursor-pointer"
        onClick={onPrev}
      >
        <div className="p-3 rounded-full bg-black/50 text-white/50 group-hover:text-white group-hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100 transform -translate-x-4 group-hover:translate-x-0">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </div>
      </div>
      <div
        className="absolute inset-y-0 right-0 w-24 flex items-center justify-end pr-4 group cursor-pointer"
        onClick={onNext}
      >
        <div className="p-3 rounded-full bg-black/50 text-white/50 group-hover:text-white group-hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </div>
      </div>
    </div>
  )
}
