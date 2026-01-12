import { ReactElement } from 'react'
import { AnnotationTool } from './AnnotationCanvas'

interface AnnotationToolbarProps {
  activeTool: AnnotationTool
  setActiveTool: (tool: AnnotationTool) => void
  color: string
  setColor: (color: string) => void
  onUndo: () => void
  onRedo: () => void
  onSave: () => void
  onCopy: () => void
  onExport: () => void
  copySuccess: boolean
}

export function AnnotationToolbar({
  activeTool,
  setActiveTool,
  color,
  setColor,
  onUndo,
  onRedo,
  onSave,
  onCopy,
  onExport,
  copySuccess
}: AnnotationToolbarProps): ReactElement {
  const tools: { id: AnnotationTool; label: string; icon: string }[] = [
    { id: 'select', label: 'Select', icon: '↖' },
    { id: 'arrow', label: 'Arrow', icon: '↗' },
    { id: 'text', label: 'Text', icon: 'T' },
    { id: 'rect', label: 'Box', icon: '□' },
    { id: 'pen', label: 'Pen', icon: '✎' },
    { id: 'mosaic', label: 'Mosaic', icon: '░' }
  ]

  const colors = ['#FF0000', '#FF00FF', '#00FF00', '#FFFF00', '#00FFFF', '#FFFFFF']

  return (
    <div className="w-64 h-full flex flex-col glass border-r border-white/5 z-[60] shrink-0 overflow-hidden rounded-none">
      {/* 1. App Branding - Bit-for-Bit Sync with Sidebar.tsx */}
      <div className="px-6 mb-8 flex items-center gap-3 shrink-0 pt-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-purple-500/20 flex items-center justify-center text-white">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-6 h-6"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="14.31" y1="8" x2="20.05" y2="17.94" />
            <line x1="9.69" y1="8" x2="21.17" y2="8" />
            <line x1="7.38" y1="12" x2="13.12" y2="2.06" />
            <line x1="9.69" y1="16" x2="3.95" y2="6.06" />
            <line x1="14.31" y1="16" x2="2.83" y2="16" />
            <line x1="16.62" y1="12" x2="10.88" y2="21.94" />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight leading-none">Scope</h1>
          <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">
            Creative Toolkit
          </span>
        </div>
      </div>

      <div className="flex-1 w-full flex flex-col overflow-y-auto no-scrollbar custom-scrollbar min-h-0">
        {/* 2. Design Tools Section */}
        <div className="px-3 mb-8">
          <h3 className="px-3 text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3 opacity-60">
            Design Tools
          </h3>
          <nav className="space-y-1">
            {tools.map((tool) => (
              <div
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                className={`px-3 py-2 rounded-lg font-medium text-sm flex items-center gap-3 cursor-pointer transition-all ${
                  activeTool === tool.id
                    ? 'bg-white/10 text-white shadow-sm backdrop-blur-md'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="text-lg w-6 flex justify-center">{tool.icon}</span>
                <span className="flex-1 text-xs">{tool.label}</span>
              </div>
            ))}
          </nav>
        </div>

        {/* 3. Properties Section */}
        <div className="px-6 mb-8">
          <h3 className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-4 opacity-60">
            Stroke Color
          </h3>
          <div className="grid grid-cols-6 gap-2">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full border border-white/20 transition-all ${
                  color === c
                    ? 'scale-110 ring-2 ring-blue-500 ring-offset-2 ring-offset-[#0d0d1a]'
                    : 'hover:scale-110 opacity-70 hover:opacity-100'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="px-6 mb-8">
          <div className="h-px bg-white/5" />
        </div>

        {/* 4. Canvas Operations Section */}
        <div className="px-3 mb-10">
          <h3 className="px-3 text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3 opacity-60">
            Operations
          </h3>
          <nav className="space-y-1">
            <div
              onClick={onUndo}
              className="px-3 py-2 rounded-lg font-medium text-sm flex items-center gap-3 cursor-pointer transition-colors text-slate-400 hover:bg-white/5 hover:text-white"
            >
              <span className="text-lg w-6 flex justify-center opacity-70">↺</span>
              <span className="flex-1 text-xs">Undo Changes</span>
            </div>

            <div
              onClick={onRedo}
              className="px-3 py-2 rounded-lg font-medium text-sm flex items-center gap-3 cursor-pointer transition-colors text-slate-400 hover:bg-white/5 hover:text-white"
            >
              <span className="text-lg w-6 flex justify-center opacity-70">↻</span>
              <span className="flex-1 text-xs">Redo Changes</span>
            </div>

            <div
              onClick={onCopy}
              className={`px-3 py-2 rounded-lg font-medium text-sm flex items-center gap-3 cursor-pointer transition-colors mt-2 ${
                copySuccess
                  ? 'bg-green-500/10 text-green-400 ring-1 ring-green-500/20'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="text-lg w-6 flex justify-center">{copySuccess ? '✓' : '📋'}</span>
              <span className="flex-1 text-xs">
                {copySuccess ? 'Copied to Clipboard' : 'Copy Image'}
              </span>
            </div>

            <div
              onClick={onExport}
              className="px-3 py-2 rounded-lg font-medium text-sm flex items-center gap-3 cursor-pointer transition-colors text-slate-400 hover:bg-white/5 hover:text-white"
            >
              <span className="text-lg w-6 flex justify-center opacity-70">💾</span>
              <span className="text-xs flex-1">Export to File...</span>
            </div>
          </nav>
        </div>

        {/* Fixed System Footer (Primary Actions) */}
        <div className="mt-auto px-6 pt-4 border-t border-white/5 pb-8">
          <button
            onClick={onSave}
            className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-black tracking-[0.1em] shadow-lg shadow-blue-500/20 transition-all active:scale-[0.97] flex items-center justify-center gap-2"
          >
            <span>✓</span> SAVE CHANGES
          </button>
        </div>
      </div>
    </div>
  )
}
