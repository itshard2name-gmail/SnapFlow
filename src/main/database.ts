import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { Capture } from '../shared/types'

export class DatabaseManager {
  private db: Database.Database

  constructor() {
    const userDataPath = app.getPath('userData')
    const dbPath = path.join(userDataPath, 'snapflow.db')
    this.db = new Database(dbPath, { verbose: console.log })
    this.init()
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS captures (
        id TEXT PRIMARY KEY,
        filePath TEXT NOT NULL,
        thumbPath TEXT NOT NULL,
        sourceTitle TEXT,
        width INTEGER,
        height INTEGER,
        createdAt INTEGER
      )
    `)
  }

  public addCapture(capture: Omit<Capture, 'id' | 'createdAt'>): Capture {
    const id = uuidv4()
    const createdAt = Date.now()
    const stmt = this.db.prepare(`
      INSERT INTO captures (id, filePath, thumbPath, sourceTitle, width, height, createdAt)
      VALUES (@id, @filePath, @thumbPath, @sourceTitle, @width, @height, @createdAt)
    `)

    const newCapture = { ...capture, id, createdAt }
    stmt.run(newCapture)
    return newCapture
  }

  public getAllCaptures(): Capture[] {
    const stmt = this.db.prepare('SELECT * FROM captures ORDER BY createdAt DESC')
    return stmt.all() as Capture[]
  }

  public getCapture(id: string): Capture | undefined {
    const stmt = this.db.prepare('SELECT * FROM captures WHERE id = ?')
    return stmt.get(id) as Capture | undefined
  }

  public deleteCapture(id: string): void {
    const stmt = this.db.prepare('DELETE FROM captures WHERE id = ?')
    stmt.run(id)
  }
}
