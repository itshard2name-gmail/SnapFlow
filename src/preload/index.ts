import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  getAllCaptures: (filter?: 'all' | 'favorites' | 'trash') =>
    ipcRenderer.invoke('get-all-captures', filter),
  getCategoryCounts: () => ipcRenderer.invoke('get-category-counts'),
  deleteCapture: (id: string) => ipcRenderer.invoke('delete-capture', id),
  softDeleteCapture: (id: string) => ipcRenderer.invoke('soft-delete-capture', id),
  restoreCapture: (id: string) => ipcRenderer.invoke('restore-capture', id),
  toggleFavorite: (id: string) => ipcRenderer.invoke('toggle-favorite', id),
  emptyTrash: () => ipcRenderer.invoke('empty-trash'),
  renameCapture: (id: string, title: string) => ipcRenderer.invoke('rename-capture', { id, title }),
  updateNotes: (id: string, notes: string) => ipcRenderer.invoke('update-notes', { id, notes }),
  mockAddCapture: () => ipcRenderer.invoke('mock-add-capture'),
  confirmCapture: (data: unknown) => ipcRenderer.invoke('capture-confirmed', data),
  cancelCapture: () => ipcRenderer.invoke('capture-cancelled'),
  onCaptureSource: (callback: (source: unknown) => void) => {
    ipcRenderer.on('capture-source', (_, source) => callback(source))
  },
  openPath: (path: string) => ipcRenderer.invoke('open-path', path),
  getOpenWindows: () => ipcRenderer.invoke('get-open-windows'),
  captureWindow: (id: number, sourceTitle: string) =>
    ipcRenderer.invoke('capture-window', { id, sourceTitle }),
  copyImageToClipboard: (filePath: string) =>
    ipcRenderer.invoke('copy-image-to-clipboard', filePath),
  toggleAutoLaunch: (enabled: boolean) =>
    ipcRenderer.invoke('settings:toggle-auto-launch', enabled),
  log: (msg: unknown) => ipcRenderer.send('log', msg),
  saveCaptureAs: (id: string) => ipcRenderer.invoke('save-capture-as', id),
  saveAnnotatedImage: (id: string, dataUrl: string, overwrite: boolean) =>
    ipcRenderer.invoke('save-annotated-image', { id, dataUrl, overwrite }),
  copyImageDataToClipboard: (dataUrl: string) =>
    ipcRenderer.invoke('copy-image-data-to-clipboard', dataUrl)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
