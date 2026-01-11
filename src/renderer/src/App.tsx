import { useState, useEffect, useCallback, ReactElement } from 'react'
import { Sidebar } from './components/Sidebar'
import { CaptureCard } from './components/CaptureCard'
import { CaptureOverlay } from './components/CaptureOverlay'
import { DetailView } from './components/DetailView'
import { Capture } from '../../shared/types'

function App(): ReactElement {
  const [captures, setCaptures] = useState<Capture[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailCaptureId, setDetailCaptureId] = useState<string | null>(null)

  // View State Management
  const [activeView, setActiveView] = useState<'all' | 'favorites' | 'trash'>('all')
  const [counts, setCounts] = useState<{ all: number; favorites: number; trash: number }>({
    all: 0,
    favorites: 0,
    trash: 0
  })

  const fetchCaptures = useCallback(async (): Promise<void> => {
    try {
      const data = await window.api.getAllCaptures(activeView)
      // Sort by newest first (server side sorting preferred but good to have safety)
      const sorted = [...data].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      setCaptures(sorted)
    } catch (error) {
      console.error('Failed to fetch captures:', error)
    }
  }, [activeView])

  const fetchCounts = useCallback(async (): Promise<void> => {
    try {
      const c = await window.api.getCategoryCounts()
      setCounts(c)
    } catch (error) {
      console.error('Failed to fetch counts:', error)
    }
  }, [])

  useEffect(() => {
    setTimeout(() => {
      fetchCaptures()
      fetchCounts()
    }, 0)

    // Listen for new captures from main process
    const removeListener = window.electron.ipcRenderer.on('capture-saved', () => {
      // Only refresh if we are in 'all' view or 'favorites' (and new one is fav? unlikely)
      if (activeView === 'all') {
        fetchCaptures()
      }
      fetchCounts()
    })

    return (): void => {
      removeListener()
    }
  }, [fetchCaptures, activeView, fetchCounts])

  const handleDelete = async (id: string): Promise<void> => {
    try {
      if (activeView === 'trash') {
        // Permanent delete
        await window.api.deleteCapture(id)
      } else {
        // Soft delete
        await window.api.softDeleteCapture(id)
      }

      setDetailCaptureId(null)
      fetchCaptures()
    } catch (error) {
      console.error('Failed to delete capture:', error)
    }
  }

  const handleRestore = async (id: string): Promise<void> => {
    try {
      await window.api.restoreCapture(id)
      fetchCaptures()
    } catch (error) {
      console.error('Failed to restore capture:', error)
    }
  }

  const handleEmptyTrash = async (): Promise<void> => {
    if (activeView !== 'trash') return
    if (!confirm('Are you sure you want to empty the trash? This cannot be undone.')) return

    try {
      await window.api.emptyTrash()
      fetchCaptures()
    } catch (error) {
      console.error('Failed to empty trash:', error)
    }
  }

  const [searchQuery, setSearchQuery] = useState('')

  // Check forcapture mode
  const query = new URLSearchParams(window.location.search)
  const mode = query.get('mode') || 'dashboard'
  const isCaptureMode = mode === 'region' || mode === 'window' || mode === 'scroll'

  if (isCaptureMode) {
    return (
      <CaptureOverlay
        mode={mode as 'region' | 'window' | 'scroll'}
        onConfirm={(rect) => {
          if (rect.id && mode === 'window') {
            window.api.cancelCapture()
            window.api.captureWindow(rect.id, rect.sourceTitle || 'Window Capture')
          } else {
            window.api.confirmCapture({ ...rect, sourceId: 'primary' })
          }
        }}
        onCancel={() => {
          window.api.cancelCapture()
        }}
      />
    )
  }

  // Filter captures based on search matches
  const filteredCaptures = captures.filter((c) =>
    c.sourceTitle?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const detailCapture = captures.find((c) => c.id === detailCaptureId)

  return (
    <div className="flex h-screen bg-transparent text-slate-200 font-sans overflow-hidden">
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        onRefresh={() => {
          fetchCaptures()
          fetchCounts()
        }}
        counts={counts}
      />

      {/* Main Content - Standard Split Pane */}
      <main className="flex-1 flex flex-col min-w-0 relative z-10 glass rounded-none overflow-hidden border-l border-white/10 shadow-2xl h-screen">
        {/* Search / Header Bar */}
        <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-white/5 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-medium text-white tracking-tight flex items-center gap-2">
              {activeView === 'all' && 'All Captures'}
              {activeView === 'favorites' && 'Favorites'}
              {activeView === 'trash' && 'Trash'}
              <span className="text-xs font-normal text-slate-500 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                {filteredCaptures.length}
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-4">
            {activeView === 'trash' && captures.length > 0 && (
              <button
                onClick={handleEmptyTrash}
                className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
              >
                Empty Trash
              </button>
            )}

            <div className="relative max-w-md w-64">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
          {filteredCaptures.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
              <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-4xl shadow-inner">
                {activeView === 'trash' ? '🗑️' : activeView === 'favorites' ? '⭐️' : '📷'}
              </div>
              <div className="text-center">
                <p className="text-lg font-medium text-slate-300">
                  {searchQuery
                    ? 'No matching captures'
                    : activeView === 'trash'
                      ? 'Trash is empty'
                      : activeView === 'favorites'
                        ? 'No favorites yet'
                        : 'No captures yet'}
                </p>
                {activeView === 'all' && !searchQuery && (
                  <p className="text-sm text-slate-500 mt-1">
                    Press{' '}
                    <kbd className="px-2 py-0.5 rounded bg-white/10 font-mono text-xs">
                      Cmd+Shift+A
                    </kbd>{' '}
                    to start
                  </p>
                )}
              </div>
            </div>
          ) : (
            // Masonry-ish Grid Layout
            <div className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(200px,1fr))] content-start">
              {filteredCaptures.map((capture) => (
                <CaptureCard
                  key={capture.id}
                  capture={capture}
                  isSelected={capture.id === selectedId}
                  isTrash={activeView === 'trash'}
                  onClick={() => setSelectedId(capture.id)}
                  onDoubleClick={() => setDetailCaptureId(capture.id)}
                  onDelete={handleDelete}
                  onRestore={handleRestore}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Detail View Overlay */}
      {detailCapture && (
        <DetailView
          captures={captures}
          activeId={detailCaptureId as string}
          onSelect={setDetailCaptureId}
          onClose={() => setDetailCaptureId(null)}
          onDelete={handleDelete}
          onRename={fetchCaptures}
        />
      )}
    </div>
  )
}

export default App
