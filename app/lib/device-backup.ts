import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import type { ImportMode, PagewiseBackup, PagewiseBackupData } from "./backup";
import { BACKUP_FORMAT, BACKUP_VERSION, countBackupRecords } from "./backup";
import { getDeviceDatabase } from "./device-db";
import { readDeviceFile, writeDeviceFile } from "./device-files";

type Row = Record<string, unknown>;

async function db() {
  const database = await getDeviceDatabase();
  if (!database) throw new Error("The local database is unavailable.");
  return database;
}

async function rows(sql: string) {
  return (await (await db()).query(sql)).values ?? [];
}

export async function createDeviceBackup(): Promise<PagewiseBackup> {
  const database = await db();
  const [books, readingAttempts, lists, listBooks, readingLogs, quotes, readingGoals, streakFreezes, inventoryItems, settings] = await Promise.all([
    rows("SELECT * FROM books WHERE deleted_at IS NULL"),
    rows("SELECT * FROM reading_attempts WHERE deleted_at IS NULL"),
    rows("SELECT * FROM lists WHERE deleted_at IS NULL"),
    rows("SELECT * FROM list_books WHERE deleted_at IS NULL"),
    rows("SELECT * FROM reading_logs WHERE deleted_at IS NULL"),
    rows("SELECT * FROM quotes WHERE deleted_at IS NULL"),
    rows("SELECT * FROM reading_goals"), rows("SELECT * FROM streak_freezes"),
    rows("SELECT * FROM inventory_items WHERE deleted_at IS NULL"),
    database.query("SELECT * FROM user_settings WHERE id=1"),
  ]);
  const userSettings = settings.values?.[0] ?? { theme: "dark", timezone: "Asia/Dhaka" };
  const paths = new Set<string>();
  for (const row of [...books, ...inventoryItems])
    if (typeof row.cover_local_path === "string") paths.add(row.cover_local_path);
  if (typeof userSettings.avatar_local_path === "string") paths.add(userSettings.avatar_local_path);
  const files = await Promise.all([...paths].map(async (path) => ({ path, data: await readDeviceFile(path) })));
  const data: PagewiseBackupData = { books, readingAttempts, lists, listBooks, readingLogs, quotes, readingGoals, streakFreezes, inventoryItems, userSettings };
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), appVersion: "0.1.0", data, files };
}

export async function shareDeviceBackup(backup: PagewiseBackup) {
  const path = `pagewise-backup-${backup.exportedAt.slice(0, 10)}.json`;
  await Filesystem.writeFile({
    path,
    directory: Directory.Cache,
    data: JSON.stringify(backup),
    encoding: Encoding.UTF8,
  });
  const uri = await Filesystem.getUri({ path, directory: Directory.Cache });
  await Share.share({ title: "Pagewise backup", text: "Your private Pagewise library backup.", url: uri.uri, dialogTitle: "Save Pagewise backup" });
}

const mappings: Array<{ key: Exclude<keyof PagewiseBackupData, "userSettings">; table: string; columns: string[]; conflict: string[] }> = [
  { key: "books", table: "books", conflict: ["id"], columns: ["id","title","author","cover_image_url","cover_local_path","cover_source","open_library_work_key","open_library_edition_key","genre","total_pages","publication_year","description","isbn","status","is_favorite","current_page","active_attempt_id","tags_json","created_at","updated_at"] },
  { key: "readingAttempts", table: "reading_attempts", conflict: ["id"], columns: ["id","book_id","attempt_number","started_at","completed_at","rating_numeric","rating_tag","review","created_at","updated_at"] },
  { key: "lists", table: "lists", conflict: ["id"], columns: ["id","title","description","created_at","updated_at"] },
  { key: "listBooks", table: "list_books", conflict: ["list_id","book_id"], columns: ["list_id","book_id","position","added_at"] },
  { key: "readingLogs", table: "reading_logs", conflict: ["id"], columns: ["id","book_id","attempt_id","log_date","start_page","end_page","pages_read","note","created_at","updated_at"] },
  { key: "quotes", table: "quotes", conflict: ["id"], columns: ["id","book_id","page_number","quote_text","note","created_at","updated_at"] },
  { key: "readingGoals", table: "reading_goals", conflict: ["year"], columns: ["id","year","target_books","created_at","updated_at"] },
  { key: "streakFreezes", table: "streak_freezes", conflict: ["frozen_date"], columns: ["id","frozen_date","created_at"] },
  { key: "inventoryItems", table: "inventory_items", conflict: ["id"], columns: ["id","pagewise_book_id","title","author","isbn","publisher","publication_year","edition","language","genre","format","condition","location","shelf","quantity","acquisition_date","purchase_price","currency","is_lent","lent_to","lent_at","due_date","notes","cover_image_url","cover_local_path","tags_json","created_at","updated_at"] },
];

function value(row: Row, column: string) {
  if (column === "cover_local_path") return row.cover_local_path ?? row.cover_storage_path ?? null;
  if (column === "tags_json") return row.tags_json ?? JSON.stringify(row.tags ?? []);
  if (column === "is_favorite" || column === "is_lent") return row[column] ? 1 : 0;
  return row[column] ?? null;
}

async function upsert(table: string, columns: string[], conflict: string[], row: Row, preferNewer = false) {
  const database = await db();
  const updates = columns.filter((column) => !conflict.includes(column)).map((column) => `${column}=excluded.${column}`);
  const freshness = preferNewer && columns.includes("updated_at")
    ? ` WHERE excluded.updated_at >= ${table}.updated_at`
    : "";
  await database.run(
    `INSERT INTO ${table}(${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")}) ON CONFLICT(${conflict.join(",")}) DO UPDATE SET ${updates.join(",")}${freshness}`,
    columns.map((column) => value(row, column)),
  );
}

export async function restoreDeviceBackup(backup: PagewiseBackup, mode: ImportMode, preferNewer = false) {
  const database = await db();
  if (mode === "replace") {
    for (const table of ["sync_outbox","list_books","reading_logs","quotes","reading_attempts","inventory_items","lists","books","reading_goals","streak_freezes","user_settings"])
      await database.execute(`DELETE FROM ${table};`, true, false);
  }
  const activeAttempts = new Map<string, { id: unknown; updatedAt: unknown }>();
  for (const mapping of mappings) {
    for (const sourceRow of backup.data[mapping.key]) {
      const row = { ...sourceRow };
      if (mapping.table === "books" && row.active_attempt_id) {
        activeAttempts.set(String(row.id), { id: row.active_attempt_id, updatedAt: row.updated_at });
        row.active_attempt_id = null;
      }
      await upsert(mapping.table, mapping.columns, mapping.conflict, row, preferNewer);
    }
  }
  for (const [bookId, attempt] of activeAttempts) {
    await database.run(
      `UPDATE books SET active_attempt_id=? WHERE id=?
       AND EXISTS (SELECT 1 FROM reading_attempts WHERE id=?)
       AND (?=0 OR updated_at<=?)`,
      [attempt.id, bookId, attempt.id, preferNewer ? 1 : 0, attempt.updatedAt ?? ""],
    );
  }
  const settings = backup.data.userSettings;
  const now = new Date().toISOString();
  const settingsRow: Row = {
    id: 1, theme: settings.theme ?? "dark", timezone: settings.timezone ?? "Asia/Dhaka",
    streak_freeze_available: settings.streak_freeze_available ?? 1,
    streak_freeze_last_reset: settings.streak_freeze_last_reset ?? null,
    display_name: settings.display_name ?? "", birth_year: settings.birth_year ?? null,
    bio: settings.bio ?? "", avatar_local_path: settings.avatar_local_path ?? settings.avatar_path ?? null,
    created_at: settings.created_at ?? now, updated_at: settings.updated_at ?? now,
  };
  await upsert("user_settings", ["id","theme","timezone","streak_freeze_available","streak_freeze_last_reset","display_name","birth_year","bio","avatar_local_path","created_at","updated_at"], ["id"], settingsRow, preferNewer);
  for (const file of backup.files ?? []) await writeDeviceFile(file.path, file.data);
  await database.execute("PRAGMA optimize;", true, false);
  return { mode, records: Object.values(countBackupRecords(backup.data)).reduce((sum, count) => sum + count, 0) };
}
