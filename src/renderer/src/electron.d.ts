import { ElectronAPI } from '@electron-toolkit/preload'
import { Capture, WindowInfo } from '../../shared/types'

export interface CustomAPI {
  getAllCaptures: (filter?: 'all' | 'favorites' | 'trash') => Promise<Capture[]>
  getCategoryCounts: () => Promise<{ all: number; favorites: number; trash: number }>
  deleteCapture: (id: string) => Promise<void>
  softDeleteCapture: (id: string) => Promise<void>
  restoreCapture: (id: string) => Promise<void>
  toggleFavorite: (id: string) => Promise<void>
  emptyTrash: () => Promise<void>
  renameCapture: (id: string, title: string) => Promise<void>
  updateNotes: (id: string, notes: string) => Promise<void>
  mockAddCapture: () => Promise<void>
  confirmCapture: (data: unknown) => Promise<{ success: boolean; error?: string }>
  cancelCapture: () => Promise<void>
  onCaptureSource: (callback: (source: unknown) => void) => void
  openPath: (path: string) => Promise<void>
  getOpenWindows: () => Promise<WindowInfo[]>
  captureWindow: (id: number, sourceTitle: string) => Promise<unknown>
  copyImageToClipboard: (filePath: string) => Promise<boolean>
  toggleAutoLaunch: (enabled: boolean) => Promise<void>
  log: (msg: unknown) => void
  saveCaptureAs: (id: string) => Promise<void>
  saveAnnotatedImage: (id: string, dataUrl: string, overwrite: boolean) => Promise<boolean>
  copyImageDataToClipboard: (dataUrl: string) => Promise<boolean>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: CustomAPI
  }
}
