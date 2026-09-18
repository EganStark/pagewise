import type { Book, BookInput, BookStatus } from "./books";
import { getDeviceDatabase } from "./device-db";
import { deviceFileUrl } from "./device-files";
import { queueDeviceChange } from "./device-outbox";

type DeviceBookRow = {
  id: string;
  title: string;
  author: string | null;
  cover_image_url: string | null;
  cover_local_path: string | null;
  cover_source: Book["cover_source"];
  open_library_work_key: string | null;
  open_library_edition_key: string | null;
  genre: string | null;
  total_pages: number | null;
  publication_year: number | null;
  description: string | null;
  isbn: string | null;
  status: BookStatus;
  is_favorite: number;
  current_page: number;
  active_attempt_id: string | null;
  tags_json: string;
  created_at: string;
  updated_at: string;
};

const bookColumns = `id,title,author,cover_image_url,cover_local_path,cover_source,
  open_library_work_key,open_library_edition_key,genre,total_pages,publication_year,
  description,isbn,status,is_favorite,current_page,active_attempt_id,tags_json,
  created_at,updated_at`;

function parseTags(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === "string")
      : [];
  } catch {
    return [];
  }
}

async function toBook(row: DeviceBookRow): Promise<Book> {
  return {
    id: row.id,
    user_id: "device",
    title: row.title,
    author: row.author,
    cover_image_url: row.cover_local_path
      ? await deviceFileUrl(row.cover_local_path)
      : row.cover_image_url,
    cover_storage_path: row.cover_local_path,
    cover_source: row.cover_source,
    open_library_work_key: row.open_library_work_key,
    open_library_edition_key: row.open_library_edition_key,
    genre: row.genre,
    total_pages: row.total_pages,
    publication_year: row.publication_year,
    description: row.description,
    isbn: row.isbn,
    status: row.status,
    is_favorite: Boolean(row.is_favorite),
    current_page: row.current_page,
    active_attempt_id: row.active_attempt_id,
    tags: parseTags(row.tags_json),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function requireDatabase() {
  const database = await getDeviceDatabase();
  if (!database) throw new Error("The local database is unavailable.");
  return database;
}

async function queueChange(
  entityId: string,
  operation: "create" | "update" | "delete",
  payload: object,
  entityType = "book",
) {
  await queueDeviceChange(entityType, entityId, operation, payload);
}

export async function listDeviceBooks() {
  const database = await requireDatabase();
  const result = await database.query(
    `SELECT ${bookColumns} FROM books WHERE deleted_at IS NULL ORDER BY updated_at DESC`,
  );
  return Promise.all((result.values ?? []).map((row) => toBook(row as DeviceBookRow)));
}

export async function createDeviceBook(input: BookInput) {
  const database = await requireDatabase();
  const now = new Date().toISOString();
  const attemptId = input.status === "want_to_read" ? null : crypto.randomUUID();
  const completed = input.status === "completed";
  const book: Book = {
    id: crypto.randomUUID(),
    user_id: "device",
    title: input.title.trim(),
    author: input.author ?? null,
    cover_image_url: input.cover_image_url ?? null,
    cover_storage_path: input.cover_storage_path ?? null,
    cover_source: input.cover_source ?? "placeholder",
    open_library_work_key: input.open_library_work_key ?? null,
    open_library_edition_key: input.open_library_edition_key ?? null,
    genre: input.genre ?? null,
    total_pages: input.total_pages ?? null,
    publication_year: input.publication_year ?? null,
    description: input.description ?? null,
    isbn: input.isbn ?? null,
    status: input.status,
    is_favorite: false,
    current_page: completed ? (input.total_pages ?? 0) : 0,
    active_attempt_id: completed ? null : attemptId,
    tags: input.tags ?? [],
    created_at: now,
    updated_at: now,
  };
  await database.run(
    `INSERT INTO books (${bookColumns}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      book.id, book.title, book.author, book.cover_image_url,
      book.cover_storage_path, book.cover_source, book.open_library_work_key,
      book.open_library_edition_key, book.genre, book.total_pages,
      book.publication_year, book.description, book.isbn, book.status, 0,
      book.current_page, book.active_attempt_id, JSON.stringify(book.tags), now, now,
    ],
  );
  if (attemptId) {
    const localDate = now.slice(0, 10);
    await database.run(
      `INSERT INTO reading_attempts
        (id,book_id,attempt_number,started_at,completed_at,rating_numeric,rating_tag,review,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [attemptId, book.id, 1, localDate, completed ? localDate : null, null, null, null, now, now],
    );
    await queueChange(attemptId, "create", {
      id: attemptId,
      book_id: book.id,
      attempt_number: 1,
      started_at: localDate,
      completed_at: completed ? localDate : null,
    }, "reading_attempt");
  }
  await queueChange(book.id, "create", book);
  return book;
}

const editableColumns: Partial<Record<keyof Book, string>> = {
  title: "title", author: "author", cover_image_url: "cover_image_url",
  cover_storage_path: "cover_local_path", cover_source: "cover_source",
  open_library_work_key: "open_library_work_key",
  open_library_edition_key: "open_library_edition_key", genre: "genre",
  total_pages: "total_pages", publication_year: "publication_year",
  description: "description", isbn: "isbn", status: "status",
  is_favorite: "is_favorite", current_page: "current_page",
  active_attempt_id: "active_attempt_id", tags: "tags_json",
};

export async function updateDeviceBook(id: string, changes: Partial<Book>) {
  const database = await requireDatabase();
  const entries = Object.entries(changes).filter(
    ([key]) => editableColumns[key as keyof Book],
  );
  if (!entries.length) return;
  const updatedAt = new Date().toISOString();
  const values = entries.map(([key, value]) => {
    if (key === "tags") return JSON.stringify(value ?? []);
    if (key === "is_favorite") return value ? 1 : 0;
    return value ?? null;
  });
  const assignments = entries.map(
    ([key]) => `${editableColumns[key as keyof Book]} = ?`,
  );
  await database.run(
    `UPDATE books SET ${assignments.join(", ")}, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
    [...values, updatedAt, id],
  );
  await queueChange(id, "update", { ...changes, updated_at: updatedAt });
}

export async function deleteDeviceBook(id: string) {
  const database = await requireDatabase();
  const deletedAt = new Date().toISOString();
  await database.run(
    "UPDATE books SET deleted_at = ?, updated_at = ? WHERE id = ?",
    [deletedAt, deletedAt, id],
  );
  await queueChange(id, "delete", { id, deleted_at: deletedAt });
}
