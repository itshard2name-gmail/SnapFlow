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

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS captures (
        id TEXT PRIMARY KEY,
        filePath TEXT NOT NULL,
        thumbPath TEXT NOT NULL,
        sourceTitle TEXT,
        width INTEGER,
        height INTEGER,
        createdAt INTEGER,
        isFavorite INTEGER DEFAULT 0,
        deletedAt INTEGER DEFAULT NULL
      )
    `)
    this.migrate()
  }

  private migrate(): void {
    try {
      this.db.exec('ALTER TABLE captures ADD COLUMN isFavorite INTEGER DEFAULT 0')
    } catch {
      /* ignore if exists */
    }
    try {
      this.db.exec('ALTER TABLE captures ADD COLUMN deletedAt INTEGER DEFAULT NULL')
    } catch {
      /* ignore if exists */
    }
  }

  public addCapture(
    capture: Omit<Capture, 'id' | 'createdAt' | 'isFavorite' | 'deletedAt'>
  ): Capture {
    const id = uuidv4()
    const createdAt = Date.now()
    const newCapture: Capture = {
      ...capture,
      id,
      createdAt,
      isFavorite: 0,
      deletedAt: null
    }

    const stmt = this.db.prepare(`
      INSERT INTO captures (id, filePath, thumbPath, sourceTitle, width, height, createdAt, isFavorite, deletedAt)
      VALUES (@id, @filePath, @thumbPath, @sourceTitle, @width, @height, @createdAt, @isFavorite, @deletedAt)
    `)

    stmt.run(newCapture)
    return newCapture
  }

  public getAllCaptures(filter: 'all' | 'favorites' | 'trash' = 'all'): Capture[] {
    let query = 'SELECT * FROM captures WHERE deletedAt IS NULL'

    if (filter === 'favorites') {
      query += ' AND isFavorite = 1'
    } else if (filter === 'trash') {
      query = 'SELECT * FROM captures WHERE deletedAt IS NOT NULL'
    }

    const stmt = this.db.prepare(`${query} ORDER BY createdAt DESC`)
    return stmt.all() as Capture[]
  }

  public getCapture(id: string): Capture | undefined {
    const stmt = this.db.prepare('SELECT * FROM captures WHERE id = ?')
    return stmt.get(id) as Capture | undefined
  }

  // Permanent Delete
  public deleteCapture(id: string): void {
    const stmt = this.db.prepare('DELETE FROM captures WHERE id = ?')
    stmt.run(id)
  }

  public renameCapture(id: string, newTitle: string): void {
    const stmt = this.db.prepare('UPDATE captures SET sourceTitle = ? WHERE id = ?')
    stmt.run(newTitle, id)
  }

  public toggleFavorite(id: string): void {
    // SQLite boolean toggle: 1 - x
    const stmt = this.db.prepare('UPDATE captures SET isFavorite = 1 - isFavorite WHERE id = ?')
    stmt.run(id)
  }

  public softDeleteCapture(id: string): void {
    const stmt = this.db.prepare('UPDATE captures SET deletedAt = ? WHERE id = ?')
    stmt.run(Date.now(), id)
  }

  public restoreCapture(id: string): void {
    const stmt = this.db.prepare('UPDATE captures SET deletedAt = NULL WHERE id = ?')
    stmt.run(id)
  }

  public getTrashFiles(): Capture[] {
    const stmt = this.db.prepare('SELECT * FROM captures WHERE deletedAt IS NOT NULL')
    return stmt.all() as Capture[]
  }

  public emptyTrash(): void {
    const stmt = this.db.prepare('DELETE FROM captures WHERE deletedAt IS NOT NULL')
    stmt.run()
  }
}
