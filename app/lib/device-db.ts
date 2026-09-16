import { Capacitor } from "@capacitor/core";
import type {
  SQLiteConnection,
  SQLiteDBConnection,
} from "@capacitor-community/sqlite";

const DATABASE_NAME = "pagewise";
const DATABASE_VERSION = 1;

let connectionManager: SQLiteConnection | null = null;
let database: SQLiteDBConnection | null = null;
let opening: Promise<SQLiteDBConnection | null> | null = null;

const schemaV1 = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  cover_image_url TEXT,
  cover_local_path TEXT,
  cover_source TEXT,
  open_library_work_key TEXT,
  open_library_edition_key TEXT,
  genre TEXT,
  total_pages INTEGER,
  publication_year INTEGER,
  description TEXT,
  isbn TEXT,
  status TEXT NOT NULL DEFAULT 'want_to_read',
  is_favorite INTEGER NOT NULL DEFAULT 0,
  current_page INTEGER NOT NULL DEFAULT 0,
  active_attempt_id TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS reading_attempts (
  id TEXT PRIMARY KEY NOT NULL,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  rating_numeric REAL,
  rating_tag TEXT,
  review TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  UNIQUE(book_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS reading_logs (
  id TEXT PRIMARY KEY NOT NULL,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  attempt_id TEXT REFERENCES reading_attempts(id) ON DELETE SET NULL,
  log_date TEXT NOT NULL,
  start_page INTEGER,
  end_page INTEGER,
  pages_read INTEGER NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS lists (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS list_books (
  list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TEXT NOT NULL,
  deleted_at TEXT,
  PRIMARY KEY (list_id, book_id)
);

CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY NOT NULL,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  page_number INTEGER,
  quote_text TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS reading_goals (
  id TEXT PRIMARY KEY NOT NULL,
  year INTEGER NOT NULL UNIQUE,
  target_books INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  theme TEXT NOT NULL DEFAULT 'dark',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  streak_freeze_available INTEGER NOT NULL DEFAULT 1,
  streak_freeze_last_reset TEXT,
  display_name TEXT,
  birth_year INTEGER,
  bio TEXT,
  avatar_local_path TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS streak_freezes (
  id TEXT PRIMARY KEY NOT NULL,
  frozen_date TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT PRIMARY KEY NOT NULL,
  pagewise_book_id TEXT REFERENCES books(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  author TEXT,
  isbn TEXT,
  publisher TEXT,
  publication_year INTEGER,
  edition TEXT,
  language TEXT,
  genre TEXT,
  format TEXT,
  condition TEXT,
  location TEXT,
  shelf TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  acquisition_date TEXT,
  purchase_price REAL,
  currency TEXT,
  is_lent INTEGER NOT NULL DEFAULT 0,
  lent_to TEXT,
  lent_at TEXT,
  due_date TEXT,
  notes TEXT,
  cover_image_url TEXT,
  cover_local_path TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS sync_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_books_status_updated ON books(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_reading_logs_book_date ON reading_logs(book_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_reading_attempts_book ON reading_attempts(book_id, attempt_number);
CREATE INDEX IF NOT EXISTS idx_list_books_position ON list_books(list_id, position);
CREATE INDEX IF NOT EXISTS idx_inventory_updated ON inventory_items(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_author ON inventory_items(author);
CREATE INDEX IF NOT EXISTS idx_inventory_isbn ON inventory_items(isbn) WHERE isbn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sync_outbox_created ON sync_outbox(created_at);

INSERT OR REPLACE INTO app_meta(key, value) VALUES ('schema_version', '1');
PRAGMA optimize;
`;

export function isNativePagewiseApp() {
  return Capacitor.isNativePlatform();
}

export async function initializeDeviceDatabase() {
  if (!isNativePagewiseApp()) return null;
  if (database) return database;
  if (opening) return opening;

  opening = (async () => {
    const { CapacitorSQLite, SQLiteConnection } = await import(
      "@capacitor-community/sqlite"
    );
    connectionManager ??= new SQLiteConnection(CapacitorSQLite);

    const existing = await connectionManager.isConnection(
      DATABASE_NAME,
      false,
    );
    database = existing.result
      ? await connectionManager.retrieveConnection(DATABASE_NAME, false)
      : await connectionManager.createConnection(
          DATABASE_NAME,
          false,
          "no-encryption",
          DATABASE_VERSION,
          false,
        );
    await database.open();
    await database.execute(schemaV1, true, false);
    return database;
  })();

  try {
    return await opening;
  } finally {
    opening = null;
  }
}

export async function getDeviceDatabase() {
  return database ?? initializeDeviceDatabase();
}
