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
}
