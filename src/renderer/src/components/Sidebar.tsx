interface SidebarProps {
  onRefresh: () => void
}

export function Sidebar({ onRefresh }: SidebarProps) {
  return (
    <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col p-4">
      <div className="flex items-center gap-3 mb-8 px-2">
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold">S</span>
        </div>
        <h1 className="text-lg font-bold text-white">SnapFlow</h1>
      </div>

      <nav className="space-y-2 flex-1">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800 text-blue-400 font-medium text-sm transition-colors">
          <span>📸</span> All Captures
        </button>
      </nav>

      <div className="pt-4 border-t border-slate-800 space-y-3">
        <button
          onClick={onRefresh}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors border border-slate-700"
        >
          ↻ Refresh
        </button>
      </div>
    </div>
  )
}
