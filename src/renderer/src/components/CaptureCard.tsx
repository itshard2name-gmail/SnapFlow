import { Capture } from '../../../shared/types'

interface CaptureCardProps {
  capture: Capture
  isSelected: boolean
  onClick: () => void
  onDoubleClick: () => void
}

export function CaptureCard({ capture, isSelected, onClick, onDoubleClick }: CaptureCardProps) {
  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`
        cursor-pointer rounded-lg overflow-hidden border transition-all duration-200
        ${
          isSelected
            ? 'border-blue-500 ring-2 ring-blue-500/20 bg-slate-800'
            : 'border-slate-700 hover:border-slate-500 bg-slate-800/50 hover:bg-slate-800'
        }
      `}
    >
      <div className="aspect-video w-full bg-slate-900 relative overflow-hidden">
        <img
          src={`media://${capture.thumbPath}`}
          alt={capture.sourceTitle}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium text-slate-200 truncate" title={capture.sourceTitle}>
          {capture.sourceTitle || 'Untitled Capture'}
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          {new Date(capture.createdAt).toLocaleString()}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          {capture.width} x {capture.height}
        </p>
      </div>
    </div>
  )
}
