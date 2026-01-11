import { ElectronAPI } from '@electron-toolkit/preload'
import { Capture, WindowInfo } from '../../shared/types'

interface CustomAPI {
  getAllCaptures: (filter?: 'all' | 'favorites' | 'trash') => Promise<Capture[]>
  deleteCapture: (id: string) => Promise<void>
  softDeleteCapture: (id: string) => Promise<void>
  restoreCapture: (id: string) => Promise<void>
  toggleFavorite: (id: string) => Promise<void>
  emptyTrash: () => Promise<void>
  renameCapture: (id: string, title: string) => Promise<void>
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
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: CustomAPI
  }
}
