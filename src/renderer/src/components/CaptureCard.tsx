import { Capture } from '../../../shared/types'
import { useState, useRef, useEffect, ReactElement } from 'react'

interface CaptureCardProps {
  capture: Capture
  isSelected: boolean
  isTrash?: boolean
  onClick: () => void
  onDoubleClick: () => void
  onDelete: (id: string) => void
  onRestore?: (id: string) => void
}

export function CaptureCard({
  capture,
  isSelected,
  isTrash,
  onClick,
  onDoubleClick,
  onDelete,
  onRestore
}: CaptureCardProps): ReactElement {
  const [showCopied, setShowCopied] = useState(false)
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleCopyClick = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    try {
      // @ts-ignore: window.api is exposed via preload script
      const success = await window.api.copyImageToClipboard(capture.filePath)
      if (success) {
        setShowCopied(true)
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
        copyTimeoutRef.current = setTimeout(() => {
          setShowCopied(false)
        }, 2000)
      }
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleDeleteClick = (e: React.MouseEvent): void => {
    e.stopPropagation()
    // Soft delete is instant (Trash feature enabled)
    // Permanent delete checking is handled downstream or acceptable risk for efficiency as requested
    onDelete(capture.id)
  }

  useEffect(() => {
    return (): void => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    }
  }, [])

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`
        group relative cursor-pointer rounded-xl overflow-hidden transition-all duration-300
        ${
          isSelected
            ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20 scale-[1.02] z-10'
            : 'hover:scale-[1.02] hover:shadow-xl hover:z-10'
        }
      `}
    >
      {/* Aspect Ratio Container - Enforce 16:10 for uniform grid */}
      <div className="relative w-full aspect-[16/10] bg-slate-900 group-hover:shadow-inner transition-all duration-300">
        <img
          src={`media://${capture.thumbPath}`}
          alt={capture.sourceTitle}
          className="w-full h-full object-cover object-top block"
          loading="lazy"
        />

        {/* Top-Right Action Toolbar (Visible on hover) */}
        <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
          {isTrash ? (
            // RESTORE BUTTON
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRestore?.(capture.id)
              }}
              className="group/btn relative w-8 h-8 rounded-lg bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/50 flex items-center justify-center transition-all hover:scale-105 active:scale-95 border border-white/10"
            >
              <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover/btn:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-xl border border-white/10 z-30">
                Restore
              </span>
              <span className="text-lg">↩</span>
            </button>
          ) : (
            // COPY BUTTON
            <button
              onClick={handleCopyClick}
              className="group/btn relative w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/50 flex items-center justify-center transition-all hover:scale-105 active:scale-95 border border-white/10"
            >
              {/* Tooltip */}
              <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover/btn:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-xl border border-white/10 z-30">
                Copy Image
              </span>

              {showCopied ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4 text-white"
                >
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              )}
            </button>
          )}

          {/* Delete Button */}
          <button
            onClick={handleDeleteClick}
            className="group/btn relative w-8 h-8 rounded-lg bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/50 flex items-center justify-center transition-all hover:scale-105 active:scale-95 border border-white/10"
          >
            {/* Tooltip */}
            <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover/btn:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-xl border border-white/10 z-30">
              {isTrash ? 'Delete Permanently' : 'Trash'}
            </span>

            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              {}
              {isTrash ? (
                <>
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="14" y2="15"></line>
                  <line x1="14" y1="11" x2="10" y2="15"></line>
                </>
              ) : (
                <>
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </>
              )}
            </svg>
          </button>
        </div>

        {/* Selection Indicator */}
        {isSelected && (
          <div className="absolute inset-0 border-2 border-blue-500 rounded-xl pointer-events-none" />
        )}
      </div>

      {/* Info Gradient overlay at bottom - Visible on hover only */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        <h3 className="text-white text-xs font-medium truncate drop-shadow-md">
          {capture.sourceTitle || 'Untitled'}
        </h3>
        <p className="text-[10px] text-slate-300 font-mono mt-0.5">
          {capture.width} × {capture.height}
        </p>
      </div>
    </div>
  )
}
