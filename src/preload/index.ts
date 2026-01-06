import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  getAllCaptures: () => ipcRenderer.invoke('get-all-captures'),
  deleteCapture: (id: string) => ipcRenderer.invoke('delete-capture', id),
  mockAddCapture: () => ipcRenderer.invoke('mock-add-capture'),
  confirmCapture: (data: any) => ipcRenderer.invoke('capture-confirmed', data),
  cancelCapture: () => ipcRenderer.invoke('capture-cancelled'),
  onCaptureSource: (callback: (source: any) => void) => {
    ipcRenderer.on('capture-source', (_, source) => callback(source))
  },
  openPath: (path: string) => ipcRenderer.invoke('open-path', path),
  getOpenWindows: () => ipcRenderer.invoke('get-open-windows'),
  captureWindow: (id: number, sourceTitle: string) => ipcRenderer.invoke('capture-window', { id, sourceTitle })
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
