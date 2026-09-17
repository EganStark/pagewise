import { createDeviceBackup } from "./device-backup";
import { getDeviceDatabase } from "./device-db";
import { supabase } from "./supabase";

type Row = Record<string, unknown>;

function clean(row: Row, userId: string, type: "book" | "inventory" | "plain") {
  const next: Row = { ...row, user_id: userId };
  delete next.deleted_at;
  if (type === "book") {
    next.cover_storage_path = null;
    next.tags = typeof row.tags_json === "string" ? JSON.parse(row.tags_json) : [];
    delete next.cover_local_path;
    delete next.tags_json;
    if (String(next.cover_image_url ?? "").startsWith("http://localhost/_capacitor_file_"))
      next.cover_image_url = null;
  }
  if (type === "inventory") {
    next.cover_storage_path = null;
    next.tags = typeof row.tags_json === "string" ? JSON.parse(row.tags_json) : [];
    delete next.cover_local_path;
    delete next.tags_json;
    if (String(next.cover_image_url ?? "").startsWith("http://localhost/_capacitor_file_"))
      next.cover_image_url = null;
  }
  return next;
}

async function upsert(table: string, values: Row[], onConflict = "id") {
  if (!values.length || !supabase) return;
  const result = await supabase.from(table).upsert(values, { onConflict });
  if (result.error) throw new Error(`Could not sync ${table.replaceAll("_", " ")}: ${result.error.message}`);
}

export async function uploadDeviceLibrary(userId: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const backup = await createDeviceBackup();
  const data = backup.data;
  const books = data.books.map((row) => clean(row, userId, "book"));
  await upsert("books", books.map((row) => ({ ...row, active_attempt_id: null })));
  await upsert("reading_attempts", data.readingAttempts.map((row) => clean(row, userId, "plain")));
  for (const book of books) {
    if (!book.active_attempt_id) continue;
    const result = await supabase.from("books").update({ active_attempt_id: book.active_attempt_id }).eq("id", book.id).eq("user_id", userId);
    if (result.error) throw new Error(`Could not link an active reading attempt: ${result.error.message}`);
  }
  await upsert("lists", data.lists.map((row) => clean(row, userId, "plain")));
  await upsert("list_books", data.listBooks.map((row) => clean(row, userId, "plain")), "list_id,book_id");
  await upsert("reading_logs", data.readingLogs.map((row) => clean(row, userId, "plain")));
  await upsert("quotes", data.quotes.map((row) => clean(row, userId, "plain")));
  await upsert("reading_goals", data.readingGoals.map((row) => clean(row, userId, "plain")), "user_id,year");
  await upsert("streak_freezes", data.streakFreezes.map((row) => clean(row, userId, "plain")), "user_id,frozen_date");
  await upsert("inventory_items", data.inventoryItems.map((row) => clean(row, userId, "inventory")));

  const settings = data.userSettings;
  const settingsResult = await supabase.from("user_settings").upsert({
    user_id: userId,
    theme: settings.theme ?? "dark",
    timezone: settings.timezone ?? "Asia/Dhaka",
    display_name: settings.display_name ?? null,
    birth_year: settings.birth_year ?? null,
    bio: settings.bio ?? null,
  }, { onConflict: "user_id" });
  if (settingsResult.error) throw new Error(`Could not sync profile: ${settingsResult.error.message}`);

  const database = await getDeviceDatabase();
  if (database) {
    await database.run("DELETE FROM sync_outbox");
    await database.run("INSERT OR REPLACE INTO app_meta(key,value) VALUES ('sync_user_id',?)", [userId]);
    await database.run("INSERT OR REPLACE INTO app_meta(key,value) VALUES ('last_full_sync_at',?)", [new Date().toISOString()]);
  }
  return Object.values(data).reduce((total, value) => total + (Array.isArray(value) ? value.length : 1), 0);
}
