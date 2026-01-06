import { exec } from 'child_process'
import { join } from 'path' // Changed from resolve to join for cleaner path handling in electron dev/prod context could vary

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
    // Determine path to the swift script
    // In dev: src/main/scripts/get-windows.swift
    // In prod: resources/scripts/get-windows.swift (we need to handle this later, for now assuming dev structure or we can bundle it)
    
    // For now, let's assume we are running relative to the project root for the swift command if we use absolute paths
    const scriptPath = join(__dirname, '../../src/main/scripts/get-windows.swift')
    
    // Command to run the swift script
    exec(`swift "${scriptPath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error('Error executing swift script:', stderr)
        reject(error)
        return
      }

      try {
        const windows: WindowInfo[] = JSON.parse(stdout)
        resolve(windows)
      } catch (e) {
        console.error('Error parsing window list JSON:', e)
        resolve([]) // Return empty list on parse error
      }
    })
  })
}
