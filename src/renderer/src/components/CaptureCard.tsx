import { Capture } from '../../../shared/types'
import { useState, useRef, useEffect, ReactElement } from 'react'

interface CaptureCardProps {
  capture: Capture
  isSelected: boolean
  onClick: () => void
  onDoubleClick: () => void
  onDelete: (id: string) => void
  onPreview: () => void
}

export function CaptureCard({
  capture,
  isSelected,
  onClick,
  onDoubleClick,
  onDelete,
  onPreview
}: CaptureCardProps): ReactElement {
  const [showConfirm, setShowConfirm] = useState(false)
  const [showCopied, setShowCopied] = useState(false)
  const confirmTimeoutRef = useRef<NodeJS.Timeout | null>(null)
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
    if (showConfirm) {
      onDelete(capture.id)
      setShowConfirm(false)
    } else {
      setShowConfirm(true)
      confirmTimeoutRef.current = setTimeout(() => {
        setShowConfirm(false)
      }, 3000)
    }
  }

  const handlePreviewClick = (e: React.MouseEvent): void => {
    e.stopPropagation()
    onPreview()
  }

  useEffect(() => {
    return (): void => {
      if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current)
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    }
  }, [])

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`
        group relative cursor-pointer rounded-xl overflow-hidden border transition-all duration-300
        ${
          isSelected
            ? 'border-blue-500 ring-2 ring-blue-500/20 bg-slate-800 shadow-lg scale-[1.02]'
            : 'border-slate-700/50 hover:border-slate-600 bg-slate-900 shadow-md hover:shadow-xl hover:-translate-y-0.5'
        }
      `}
    >
      {/* Aspect Ratio Container */}
      <div className="aspect-[16/10] w-full bg-slate-950 relative overflow-hidden">
        <img
          src={`media://${capture.thumbPath}`}
          alt={capture.sourceTitle}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />

        {/* Hover Overlay with Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-start justify-end p-2 gap-2">
          {/* Preview Button */}
          <div className="relative group/btn">
            <button
              onClick={handlePreviewClick}
              className="p-2 rounded-full bg-blue-500 hover:bg-blue-400 text-white shadow-lg backdrop-blur-sm transition-transform hover:scale-110 active:scale-95"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 3h6v6" />
                <path d="M10 14L21 3" />
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              </svg>
            </button>
            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-[10px] rounded opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Preview
            </span>
          </div>

          {/* Copy Button */}
          <div className="relative group/btn">
            <button
              onClick={handleCopyClick}
              className={`
                p-2 rounded-full text-white shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-110 active:scale-95
                ${showCopied ? 'bg-green-500 hover:bg-green-400' : 'bg-slate-500 hover:bg-slate-400'}
              `}
            >
              {showCopied ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-[10px] rounded opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              {showCopied ? 'Copied!' : 'Copy Img'}
            </span>
          </div>

          {/* Delete Button */}
          <div className="relative group/btn">
            <button
              onClick={handleDeleteClick}
              className={`
                p-2 rounded-full text-white shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-110 active:scale-95
                ${showConfirm ? 'bg-red-600' : 'bg-red-500 hover:bg-red-400'}
              `}
            >
              {showConfirm ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              )}
            </button>
            <span className="absolute -bottom-8 right-0 px-2 py-1 bg-black/80 text-white text-[10px] rounded opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              {showConfirm ? 'Confirm?' : 'Delete'}
            </span>
          </div>
        </div>
      </div>

      {/* Card Details */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/50 backdrop-blur-md">
        <h3
          className="text-sm font-medium text-slate-200 truncate pr-4"
          title={capture.sourceTitle}
        >
          {capture.sourceTitle || 'Untitled Capture'}
        </h3>
        <div className="flex justify-between items-end mt-1">
          <p className="text-[10px] text-slate-500 font-mono">
            {capture.width} × {capture.height}
          </p>
          <p className="text-[10px] text-slate-400">
            {new Date(capture.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  )
}
