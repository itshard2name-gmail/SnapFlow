import { ReactElement } from 'react'
// import logo from '../assets/icon.png' // Not using image anymore

interface SidebarProps {
  activeView: 'all' | 'favorites' | 'trash'
  onViewChange: (view: 'all' | 'favorites' | 'trash') => void
  onRefresh: () => void
  counts: { all: number; favorites: number; trash: number }
}

export function Sidebar({
  activeView,
  onViewChange,
  onRefresh,
  counts
}: SidebarProps): ReactElement {
  return (
    <div className="w-64 h-full glass flex flex-col pt-6 pb-4 transition-colors duration-300 relative z-20">
      {/* App Branding */}
      <div className="px-6 mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-purple-500/20 flex items-center justify-center text-white">
          {/* Aperture / Lens Icon (SVG) */}
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
            Personal Workspace
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        <div
          onClick={() => onViewChange('all')}
          className={`px-3 py-2 rounded-lg font-medium text-sm flex items-center gap-3 cursor-pointer transition-colors ${
            activeView === 'all'
              ? 'bg-white/10 text-white shadow-sm backdrop-blur-sm'
              : 'text-slate-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          <span className="text-lg">📸</span>
          <span className="flex-1">All Captures</span>
          {counts.all > 0 && (
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                activeView === 'all' ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-500'
              }`}
            >
              {counts.all}
            </span>
          )}
        </div>

        <div
          onClick={() => onViewChange('favorites')}
          className={`px-3 py-2 rounded-lg font-medium text-sm flex items-center gap-3 cursor-pointer transition-colors ${
            activeView === 'favorites'
              ? 'bg-white/10 text-white shadow-sm backdrop-blur-sm'
              : 'text-slate-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          <span className="text-lg">⭐️</span>
          <span className="flex-1">Favorites</span>
          {counts.favorites > 0 && (
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                activeView === 'favorites' ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-500'
              }`}
            >
              {counts.favorites}
            </span>
          )}
        </div>

        <div
          onClick={() => onViewChange('trash')}
          className={`px-3 py-2 rounded-lg font-medium text-sm flex items-center gap-3 cursor-pointer transition-colors ${
            activeView === 'trash'
              ? 'bg-white/10 text-white shadow-sm backdrop-blur-sm'
              : 'text-slate-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          <span className="text-lg">🗑️</span>
          <span className="flex-1">Trash</span>
          {counts.trash > 0 && (
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md animate-pulse-subtle ${
                activeView === 'trash'
                  ? 'bg-red-500/30 text-red-200 ring-1 ring-red-500/50'
                  : 'bg-red-500/10 text-red-400/70 border border-red-500/20'
              }`}
            >
              {counts.trash}
            </span>
          )}
        </div>
      </nav>

      {/* Footer Actions */}
      <div className="mt-auto px-4 pt-4 border-t border-white/5">
        <button
          onClick={onRefresh}
          className="w-full group flex items-center justify-center gap-2 px-4 py-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-all duration-200"
        >
          <span className="group-hover:rotate-180 transition-transform duration-500">↻</span>
          <span className="text-xs font-medium">Sync Library</span>
        </button>
      </div>
    </div>
  )
}
