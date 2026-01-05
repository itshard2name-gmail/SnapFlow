import { useState, useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { CaptureCard } from './components/CaptureCard'
import { PreviewPanel } from './components/PreviewPanel'
import { CaptureOverlay } from './components/CaptureOverlay'
import { Capture } from '../../shared/types'

function App(): JSX.Element {
  const [captures, setCaptures] = useState<Capture[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const fetchCaptures = async () => {
    try {
      // @ts-ignore
      const data = await window.api.getAllCaptures()
      setCaptures(data)
    } catch (error) {
      console.error('Failed to fetch captures:', error)
    }
  }

  useEffect(() => {
    fetchCaptures()

    // Listen for new captures from main process
    // @ts-ignore
    const removeListener = window.electron.ipcRenderer.on('capture-saved', () => {
      fetchCaptures()
    })

    return () => {
      removeListener()
    }
  }, [])

  const handleDelete = async (id: string) => {
    try {
      // @ts-ignore
      await window.api.deleteCapture(id)
      if (selectedId === id) setSelectedId(null)
      fetchCaptures()
    } catch (error) {
      console.error('Failed to delete capture:', error)
    }
  }

  const selectedCapture = captures.find((c) => c.id === selectedId) || null

  // Check for capture mode
  const query = new URLSearchParams(window.location.search)
  const isCaptureMode = query.get('mode') === 'capture'

  if (isCaptureMode) {
    // Dynamic import removed to comply with Context Isolation
    // CaptureOverlay is now imported statically
    return (
      <CaptureOverlay
        onConfirm={(rect) => {
          // @ts-ignore
          window.api.confirmCapture({ ...rect, sourceId: 'primary' })
        }}
        onCancel={() => {
          // @ts-ignore
          window.api.cancelCapture()
        }}
      />
    )
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans">
      <Sidebar onRefresh={fetchCaptures} />

      <main className="flex-1 flex flex-col min-w-0 border-r border-slate-800">
        <div className="h-16 border-b border-slate-800 flex items-center px-6 bg-slate-900/50 backdrop-blur">
          <h2 className="text-lg font-semibold text-white">Dashboard</h2>
          <span className="ml-3 px-2 py-0.5 rounded-full bg-slate-800 text-xs text-slate-400 border border-slate-700">
            {captures.length} captures
          </span>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          {captures.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-3xl">
                📷
              </div>
              <p>No captures yet. Press Cmd+Shift+A to capture!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {captures.map((capture) => (
                <CaptureCard
                  key={capture.id}
                  capture={capture}
                  isSelected={capture.id === selectedId}
                  onClick={() => setSelectedId(capture.id)}
                  onDoubleClick={() => {
                    // @ts-ignore
                    window.api.openPath(capture.filePath)
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <PreviewPanel capture={selectedCapture} onDelete={handleDelete} />
    </div>
  )
}

export default App
