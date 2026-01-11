export interface Capture {
  id: string
  filePath: string
  thumbPath: string
  sourceTitle: string
  width: number
  height: number
  createdAt: number
  isFavorite: number // 0 or 1
  deletedAt: number | null
  notes?: string
}

export interface WindowInfo {
  id: number
  x: number
  y: number
  width: number
  height: number
  title: string
  app: string
}
