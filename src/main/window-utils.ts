import { execFile } from 'child_process'
import { join } from 'path'
import { app } from 'electron'

// Type definition for Window Info
export interface WindowInfo {
  id: number
  pid: number
  app: string
  title: string
  x: number
  y: number
  width: number
  height: number
}

export function getOpenWindows(): Promise<WindowInfo[]> {
  return new Promise((resolve, reject) => {
    // In production, the binary is in Contents/Resources/window-utils
    // In dev, we can point to resources/window-utils in the project root
    let executablePath = ''
    
    if (app.isPackaged) {
      executablePath = join(process.resourcesPath, 'window-utils')
    } else {
      executablePath = join(__dirname, '../../resources/window-utils')
    }

    console.log('Executing window-utils from:', executablePath)

    execFile(executablePath, (error, stdout, stderr) => {
      if (error) {
        console.error('Error executing window-utils:', error)
        console.error('Stderr:', stderr)
        reject(error)
        return
      }

      try {
        const windows: WindowInfo[] = JSON.parse(stdout)
        resolve(windows)
      } catch (e) {
        console.error('Error parsing window list JSON:', e)
        resolve([]) 
      }
    })
  })
}
