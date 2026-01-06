import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getAllCaptures: () => Promise<import('../shared/types').Capture[]>
      deleteCapture: (id: string) => Promise<void>
      openPath: (path: string) => Promise<void>
      confirmCapture: (rect: {
        x: number
        y: number
        width: number
        height: number
        sourceId: string
      }) => void
      cancelCapture: () => void
      mockAddCapture: () => Promise<void>
      getOpenWindows: () => Promise<
        {
          id: number
          pid: number
          app: string
          title: string
          x: number
          y: number
          width: number
          height: number
        }[]
      >
      captureWindow: (id: number, sourceTitle: string) => Promise<import('../shared/types').Capture>
    }
  }
}
