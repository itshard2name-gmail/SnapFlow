import { useState, useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { CaptureCard } from './components/CaptureCard'
import { PreviewPanel } from './components/PreviewPanel'
import { CaptureOverlay } from './components/CaptureOverlay'
import { Lightbox } from './components/Lightbox'
import { Capture } from '../../shared/types'

function App() {
  const [captures, setCaptures] = useState<Capture[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [lightboxCaptureId, setLightboxCaptureId] = useState<string | null>(null)

  const fetchCaptures = async () => {
    try {
      // @ts-ignore: window.api is exposed via preload script
      const data = await window.api.getAllCaptures()
      setCaptures(data)
    } catch (error) {
      console.error('Failed to fetch captures:', error)
    }
  }

  useEffect(() => {
    fetchCaptures()

    // Listen for new captures from main process
    // @ts-ignore: window.electron is exposed via preload script
    const removeListener = window.electron.ipcRenderer.on('capture-saved', () => {
      fetchCaptures()
    })

    return () => {
      removeListener()
    }
  }, [])

  const handleDelete = async (id: string) => {
    try {
      // @ts-ignore: window.api is exposed via preload script
      await window.api.deleteCapture(id)
      if (selectedId === id) setSelectedId(null)
      fetchCaptures()
    } catch (error) {
      console.error('Failed to delete capture:', error)
    }
  }

  // Handle external file opening
  const handleOpenExternal = async (filePath: string) => {
    // @ts-ignore: window.api is exposed via preload script
    await window.api.openPath(filePath)
  }

  // Lightbox Navigation Logic
  const currentLightboxIndex = captures.findIndex((c) => c.id === lightboxCaptureId)
  const lightboxCapture = captures[currentLightboxIndex]

  const handleNext = () => {
    const nextIndex = (currentLightboxIndex + 1) % captures.length
    setLightboxCaptureId(captures[nextIndex]?.id || null)
  }

  const handlePrev = () => {
    const prevIndex = (currentLightboxIndex - 1 + captures.length) % captures.length
    setLightboxCaptureId(captures[prevIndex]?.id || null)
  }

  const selectedCapture = captures.find((c) => c.id === selectedId) || null

  // Check for capture mode
  const query = new URLSearchParams(window.location.search)
  const mode = query.get('mode') || 'dashboard'

  console.log('[DEBUG] App.tsx Rendering. Mode:', mode)
  const isCaptureMode = mode === 'region' || mode === 'window' || mode === 'scroll'

  if (isCaptureMode) {
    return (
      <CaptureOverlay
        mode={mode as 'region' | 'window' | 'scroll'}
        onConfirm={(rect) => {
          // @ts-ignore: window.api is exposed via preload script
          window.api.confirmCapture({ ...rect, sourceId: 'primary' })
        }}
        onCancel={() => {
          // @ts-ignore: window.api is exposed via preload script
          window.api.cancelCapture()
        }}
      />
    )
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans">
      <Sidebar onRefresh={fetchCaptures} />

      <main className="flex-1 flex flex-col min-w-0 border-r border-slate-800 relative z-0">
        <div className="h-16 border-b border-slate-800 flex items-center px-6 bg-slate-900/50 backdrop-blur z-20">
          <h2 className="text-lg font-semibold text-white">Dashboard</h2>
          <span className="ml-3 px-2 py-0.5 rounded-full bg-slate-800 text-xs text-slate-400 border border-slate-700">
            {captures.length} captures
          </span>
        </div>

        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
          {captures.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-3xl">
                📷
              </div>
              <p>No captures yet. Press Cmd+Shift+A to capture!</p>
            </div>
          ) : (
            // Improved Grid: Responsive Layout with auto-fill
            <div className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(220px,1fr))] p-2">
              {captures.map((capture) => (
                <CaptureCard
                  key={capture.id}
                  capture={capture}
                  isSelected={capture.id === selectedId}
                  onClick={() => setSelectedId(capture.id)}
                  onDoubleClick={() => setLightboxCaptureId(capture.id)}
                  onDelete={handleDelete}
                  onPreview={() => setLightboxCaptureId(capture.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <PreviewPanel capture={selectedCapture} onDelete={handleDelete} />

      {/* Lightbox Overlay */}
      {lightboxCapture && (
        <Lightbox
          imageSrc={`media://${lightboxCapture.filePath}`}
          title={lightboxCapture.sourceTitle}
          onClose={() => setLightboxCaptureId(null)}
          onNext={handleNext}
          onPrev={handlePrev}
          onOpenExternal={() => handleOpenExternal(lightboxCapture.filePath)}
        />
      )}
    </div>
  )
}

export default App
