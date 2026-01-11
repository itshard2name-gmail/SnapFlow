import { ReactElement } from 'react'
import { Capture } from '../../../shared/types'

interface PreviewPanelProps {
  capture: Capture | null
  onDelete: (id: string) => void
}

export function PreviewPanel({ capture, onDelete }: PreviewPanelProps): ReactElement {
  if (!capture) {
    return (
      <div className="w-80 bg-slate-900 border-l border-slate-800 flex items-center justify-center p-6 text-center">
        <div className="text-slate-500">
          <p className="mb-2 text-4xl">👈</p>
          <p className="text-sm">Select a capture to view details</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col h-full">
      <div className="p-4 border-b border-slate-800">
        <h2 className="text-sm font-bold text-slate-200">Details</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div
          className="rounded-lg overflow-hidden border border-slate-700 bg-slate-950 mb-4 cursor-pointer hover:border-blue-500 transition-colors group relative"
          onClick={async () => {
            await window.api.openPath(capture.filePath)
          }}
          title="Click to open full image"
        >
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center pointer-events-none">
            <span className="opacity-0 group-hover:opacity-100 bg-black/75 px-3 py-1 rounded-full text-xs text-white backdrop-blur">
              Open File
            </span>
          </div>
          <img
            src={`media://${capture.filePath}`}
            alt={capture.sourceTitle}
            className="w-full h-auto"
          />
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Source
            </label>
            <p className="text-sm text-slate-200 mt-1">{capture.sourceTitle}</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Dimensions
            </label>
            <p className="text-sm text-slate-200 mt-1">
              {capture.width} x {capture.height} px
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Created
            </label>
            <p className="text-sm text-slate-200 mt-1">
              {new Date(capture.createdAt).toLocaleString()}
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Path
            </label>
            <code
              className="block text-xs text-slate-400 mt-1 bg-slate-950 p-2 rounded border border-slate-800 break-all cursor-pointer hover:text-blue-400 hover:border-blue-900 transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                window.api.openPath(capture.filePath)
              }}
              title="Click to open"
            >
              {capture.filePath}
            </code>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-slate-800 bg-slate-900 flex gap-2">
        <button
          onClick={() => window.api.openPath(capture.filePath)}
          className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors border border-slate-700 hover:border-slate-600"
        >
          Open
        </button>
        <button
          onClick={() => onDelete(capture.id)}
          className="flex-1 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-400 rounded-lg text-sm font-medium transition-colors border border-red-500/20"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
