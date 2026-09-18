import type { Book, BookStatus } from "./books";
import { getDeviceDatabase } from "./device-db";
import type { AttemptDetails, ReadingAttempt } from "./reading-attempts";
import { todayLocalDate } from "./reading-attempts";
import type { ReadingLog, ReadingLogInput } from "./reading-logs";
import { pagesFromRange } from "./reading-logs";
import { queueDeviceChange } from "./device-outbox";

async function db() {
  const database = await getDeviceDatabase();
  if (!database) throw new Error("The local database is unavailable.");
  return database;
}

function attempt(row: Record<string, unknown>): ReadingAttempt {
  return { ...row, user_id: "device" } as ReadingAttempt;
}

function log(row: Record<string, unknown>): ReadingLog {
  return { ...row, user_id: "device" } as ReadingLog;
}

async function outbox(
  entityType: "book" | "reading_attempt" | "reading_log",
  entityId: string,
  operation: "create" | "update" | "delete",
  payload: object,
) {
  await queueDeviceChange(entityType, entityId, operation, payload);
}

export async function listDeviceAttempts(bookId?: string, completedOnly = false) {
  const database = await db();
  const clauses = ["deleted_at IS NULL"];
  const values: string[] = [];
  if (bookId) {
    clauses.push("book_id = ?");
    values.push(bookId);
  }
  if (completedOnly) clauses.push("completed_at IS NOT NULL");
  const result = await database.query(
    `SELECT id,book_id,attempt_number,started_at,completed_at,rating_numeric,
      rating_tag,review,created_at,updated_at FROM reading_attempts
     WHERE ${clauses.join(" AND ")}
     ORDER BY ${bookId ? "attempt_number" : "completed_at"} DESC`,
    values,
  );
  return (result.values ?? []).map((row) => attempt(row));
}

export async function startDeviceAttempt(book: Book) {
  const database = await db();
  const existing = (await listDeviceAttempts(book.id)).find(
    (item) => !item.completed_at,
  );
  if (existing) {
    await database.run(
      "UPDATE books SET status = 'reading', active_attempt_id = ?, updated_at = ? WHERE id = ?",
      [existing.id, new Date().toISOString(), book.id],
    );
    await outbox("book", book.id, "update", {
      status: "reading",
      active_attempt_id: existing.id,
    });
    return existing;
  }
  const numberResult = await database.query(
    "SELECT COALESCE(MAX(attempt_number), 0) AS maximum FROM reading_attempts WHERE book_id = ?",
    [book.id],
  );
  const nextNumber = Number(numberResult.values?.[0]?.maximum ?? 0) + 1;
  const now = new Date().toISOString();
  const created: ReadingAttempt = {
    id: crypto.randomUUID(),
    book_id: book.id,
    user_id: "device",
    attempt_number: nextNumber,
    started_at: todayLocalDate(),
    completed_at: null,
    rating_numeric: null,
    rating_tag: null,
    review: null,
    created_at: now,
    updated_at: now,
  };
  await database.run(
    `INSERT INTO reading_attempts
      (id,book_id,attempt_number,started_at,completed_at,rating_numeric,rating_tag,review,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [created.id, created.book_id, created.attempt_number, created.started_at, null, null, null, null, now, now],
  );
  await database.run(
    "UPDATE books SET status = 'reading', current_page = 0, active_attempt_id = ?, updated_at = ? WHERE id = ?",
    [created.id, now, book.id],
  );
  await outbox("reading_attempt", created.id, "create", created);
  await outbox("book", book.id, "update", {
    status: "reading",
    current_page: 0,
    active_attempt_id: created.id,
  });
  return created;
}

export async function setDeviceReadingStatus(
  bookId: string,
  status: Extract<BookStatus, "on_hold" | "dropped">,
) {
  const database = await db();
  const now = new Date().toISOString();
  await database.run("UPDATE books SET status = ?, updated_at = ? WHERE id = ?", [status, now, bookId]);
  await outbox("book", bookId, "update", { status, updated_at: now });
}

export async function finishDeviceAttempt(book: Book, details: AttemptDetails) {
  const database = await db();
  const now = new Date().toISOString();
  const completedAt = details.completed_at ?? todayLocalDate();
  let current = (await listDeviceAttempts(book.id)).find((item) => !item.completed_at);
  if (!current) current = await startDeviceAttempt(book);
  const finished: ReadingAttempt = {
    ...current,
    ...details,
    completed_at: completedAt,
    updated_at: now,
  };
  await database.run(
    `UPDATE reading_attempts SET started_at=?,completed_at=?,rating_numeric=?,rating_tag=?,review=?,updated_at=? WHERE id=?`,
    [finished.started_at, finished.completed_at, finished.rating_numeric, finished.rating_tag, finished.review, now, finished.id],
  );
  await database.run(
    `UPDATE books SET status='completed',active_attempt_id=NULL,current_page=?,updated_at=? WHERE id=?`,
    [book.total_pages ?? book.current_page, now, book.id],
  );
  await outbox("reading_attempt", finished.id, "update", finished);
  await outbox("book", book.id, "update", {
    status: "completed",
    active_attempt_id: null,
    current_page: book.total_pages ?? book.current_page,
  });
  return finished;
}

export async function updateDeviceAttempt(id: string, details: AttemptDetails) {
  const database = await db();
  const now = new Date().toISOString();
  await database.run(
    `UPDATE reading_attempts SET started_at=?,completed_at=?,rating_numeric=?,rating_tag=?,review=?,updated_at=? WHERE id=?`,
    [details.started_at, details.completed_at, details.rating_numeric, details.rating_tag, details.review, now, id],
  );
  await outbox("reading_attempt", id, "update", { ...details, updated_at: now });
}

export async function deleteDeviceAttempt(id: string) {
  const database = await db();
  const now = new Date().toISOString();
  await database.run("UPDATE reading_attempts SET deleted_at=?,updated_at=? WHERE id=?", [now, now, id]);
  await outbox("reading_attempt", id, "delete", { id, deleted_at: now });
}

export async function listDeviceLogs() {
  const database = await db();
  const result = await database.query(
    `SELECT id,book_id,attempt_id,log_date,start_page,end_page,pages_read,note,created_at,updated_at
     FROM reading_logs WHERE deleted_at IS NULL ORDER BY log_date DESC, created_at DESC`,
  );
  return (result.values ?? []).map((row) => log(row));
}

export async function saveDeviceLog(
  input: ReadingLogInput,
  activeAttemptId: string,
  existingId?: string,
) {
  const database = await db();
  const now = new Date().toISOString();
  const pagesRead = pagesFromRange(input.start_page, input.end_page);
  const id = existingId ?? crypto.randomUUID();
  if (existingId) {
    await database.run(
      `UPDATE reading_logs SET log_date=?,start_page=?,end_page=?,pages_read=?,note=?,updated_at=? WHERE id=?`,
      [input.log_date, input.start_page, input.end_page, pagesRead, input.note, now, id],
    );
  } else {
    await database.run(
      `INSERT INTO reading_logs
        (id,book_id,attempt_id,log_date,start_page,end_page,pages_read,note,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [id, input.book_id, activeAttemptId, input.log_date, input.start_page, input.end_page, pagesRead, input.note, now, now],
    );
  }
  if (input.end_page !== null) {
    await database.run(
      "UPDATE books SET current_page=MAX(current_page, ?),updated_at=? WHERE id=?",
      [input.end_page, now, input.book_id],
    );
  }
  const saved: ReadingLog = {
    id,
    attempt_id: activeAttemptId,
    user_id: "device",
    pages_read: pagesRead,
    created_at: now,
    updated_at: now,
    ...input,
  };
  await outbox("reading_log", id, existingId ? "update" : "create", saved);
  if (input.end_page !== null)
    await outbox("book", input.book_id, "update", { current_page: input.end_page });
  return saved;
}

export async function deleteDeviceLog(id: string) {
  const database = await db();
  const now = new Date().toISOString();
  await database.run("UPDATE reading_logs SET deleted_at=?,updated_at=? WHERE id=?", [now, now, id]);
  await outbox("reading_log", id, "delete", { id, deleted_at: now });
}
