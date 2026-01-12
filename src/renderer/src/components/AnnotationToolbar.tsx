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
  copySuccess: boolean
  onCancel: () => void
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
  copySuccess,
  onCancel
}: AnnotationToolbarProps): React.JSX.Element {
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
    <div className="w-64 h-full flex flex-col bg-[#0a0a12] border-r border-white/5 shadow-2xl z-[60] shrink-0 overflow-hidden">
      {/* App Branding - Condenses on small screens (HEIGHT BASED) */}
      <div className="px-6 py-4 [@media(min-height:800px)]:py-8 items-center gap-3 opacity-50 shrink-0 hidden [@media(min-height:650px)]:flex">
        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white text-xs">
          ✎
        </div>
        <div>
          <h1 className="text-sm font-bold text-white tracking-tight">Annotating</h1>
          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
            Edition Mode
          </span>
        </div>
      </div>

      <div className="flex-1 w-full flex flex-col overflow-y-auto no-scrollbar custom-scrollbar min-h-0 py-4">
        {/* Tools Section */}
        <div className="px-4 space-y-1 mb-4 min-[800px]:mb-6">
          <h3 className="px-3 text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">
            Selection Tools
          </h3>
          <div className="space-y-1">
            {tools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                className={`w-full px-4 py-1.5 [@media(min-height:800px)]:py-2.5 flex items-center gap-3 rounded-xl transition-all ${
                  activeTool === tool.id
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
                }`}
                title={tool.label}
              >
                <span className="text-lg [@media(min-height:800px)]:text-xl w-6 flex justify-center">
                  {tool.icon}
                </span>
                <span className="text-xs [@media(min-height:800px)]:text-sm font-medium">
                  {tool.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 mb-4 min-[800px]:mb-6">
          <div className="h-px bg-white/5" />
        </div>

        {/* Colors Section */}
        <div className="px-4 mb-4 [@media(min-height:800px)]:mb-6">
          <h3 className="px-3 text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">
            Active Color
          </h3>
          <div className="grid grid-cols-6 gap-2 px-3">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-5 h-5 [@media(min-height:800px)]:w-6 [@media(min-height:800px)]:h-6 rounded-full border border-white/20 transition-all ${
                  color === c
                    ? 'scale-125 ring-2 ring-blue-500 ring-offset-2 ring-offset-[#0a0a12]'
                    : 'hover:scale-110'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="px-6 mb-4 [@media(min-height:800px)]:mb-6">
          <div className="h-px bg-white/5" />
        </div>

        {/* Actions Section */}
        <div className="px-4 space-y-3 mt-4 pb-8">
          <div className="flex gap-2 px-2">
            <button
              onClick={onUndo}
              className="flex-1 h-9 [@media(min-height:800px)]:h-10 flex items-center justify-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white transition-all border border-white/5 bg-white/5"
              title="Undo"
            >
              ↺ <span className="ml-2 text-[10px] font-bold">UNDO</span>
            </button>
            <button
              onClick={onRedo}
              className="flex-1 h-9 [@media(min-height:800px)]:h-10 flex items-center justify-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white transition-all border border-white/5 bg-white/5"
              title="Redo"
            >
              ↻ <span className="ml-2 text-[10px] font-bold">REDO</span>
            </button>
          </div>

          <div className="px-2 space-y-2">
            <button
              onClick={onCopy}
              className={`w-full py-2.5 [@media(min-height:800px)]:py-3 rounded-xl text-[10px] font-bold tracking-widest transition-all border ${
                copySuccess
                  ? 'bg-green-600 text-white border-green-500 shadow-lg shadow-green-500/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-white/10'
              }`}
            >
              {copySuccess ? 'COPIED ✅' : 'COPY IMAGE'}
            </button>
            <button
              onClick={onSave}
              className="w-full py-2.5 [@media(min-height:800px)]:py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-bold tracking-widest shadow-lg shadow-blue-500/20 transition-colors"
            >
              SAVE CHANGES
            </button>
          </div>

          <div className="pt-2 px-2">
            <button
              onClick={onCancel}
              className="w-full py-2 bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-slate-500 rounded-xl text-[9px] font-bold tracking-[0.2em] transition-all border border-white/5"
            >
              CANCEL
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
