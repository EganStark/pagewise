import type { PagewiseBackup, PagewiseBackupData } from "./backup";
import { BACKUP_FORMAT, BACKUP_VERSION } from "./backup";
import { createDeviceBackup, restoreDeviceBackup } from "./device-backup";
import { getDeviceDatabase } from "./device-db";
import { deviceFileBlob, writeDeviceBlob } from "./device-files";
import { supabase } from "./supabase";

type Row = Record<string, unknown>;
type OutboxRow = { id: number; entity_type: string; entity_id: string; operation: "create" | "update" | "delete"; payload_json: string };

const entityTables: Record<string, string> = {
  book: "books", reading_attempt: "reading_attempts", reading_log: "reading_logs",
  list: "lists", list_book: "list_books", quote: "quotes", inventory_item: "inventory_items",
  user_settings: "user_settings", reading_goal: "reading_goals",
};

const pullTables: Array<[Exclude<keyof PagewiseBackupData, "userSettings">, string]> = [
  ["books", "books"], ["readingAttempts", "reading_attempts"], ["lists", "lists"],
  ["listBooks", "list_books"], ["readingLogs", "reading_logs"], ["quotes", "quotes"],
  ["readingGoals", "reading_goals"], ["streakFreezes", "streak_freezes"], ["inventoryItems", "inventory_items"],
];

function withoutInternalFields(row: Row) {
  const next = { ...row };
  delete next.deleted_at;
  delete next.user_id;
  return next;
}

function clean(row: Row, userId: string, type: "book" | "inventory" | "plain") {
  const next: Row = { ...withoutInternalFields(row), user_id: userId };
  if (type === "book" || type === "inventory") {
    next.cover_storage_path = null;
    next.tags = typeof row.tags_json === "string" ? JSON.parse(row.tags_json) : (row.tags ?? []);
    delete next.cover_local_path;
    delete next.tags_json;
    if (String(next.cover_image_url ?? "").startsWith("http://localhost/_capacitor_file_")) next.cover_image_url = null;
  }
  return next;
}

function cleanOutboxPayload(entityType: string, payload: Row, userId: string) {
  const next: Row = { ...payload, user_id: userId };
  delete next.deleted_at;
  if (entityType === "book" || entityType === "inventory_item") {
    if ("tags_json" in next) {
      next.tags = typeof next.tags_json === "string" ? JSON.parse(next.tags_json) : [];
      delete next.tags_json;
    }
    delete next.cover_local_path;
  }
  if (entityType === "user_settings") {
    delete next.id;
    delete next.avatar_local_path;
  }
  return next;
}

function cloudCoverPath(userId: string, entityType: "book" | "inventory_item", id: string) {
  return `${userId}/${entityType === "book" ? "pagewise" : "litshelves"}/${id}`;
}

async function uploadLocalCover(userId: string, entityType: "book" | "inventory_item", id: string, localPath: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const path = cloudCoverPath(userId, entityType, id);
  const file = await deviceFileBlob(localPath);
  const upload = await supabase.storage.from("book-covers").upload(path, file, { contentType: file.type, upsert: true });
  if (upload.error) throw new Error(`Could not back up an image: ${upload.error.message}`);
  const publicUrl = supabase.storage.from("book-covers").getPublicUrl(path).data.publicUrl;
  return { path, publicUrl };
}

async function uploadLocalAvatar(userId: string, localPath: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const path = `${userId}/avatar`;
  const file = await deviceFileBlob(localPath);
  const upload = await supabase.storage.from("profile-images").upload(path, file, { contentType: file.type, upsert: true });
  if (upload.error) throw new Error(`Could not back up the profile photo: ${upload.error.message}`);
  return path;
}

async function upsert(table: string, values: Row[], onConflict = "id") {
  if (!values.length || !supabase) return;
  const result = await supabase.from(table).upsert(values, { onConflict });
  if (result.error) throw new Error(`Could not sync ${table.replaceAll("_", " ")}: ${result.error.message}`);
}

async function setMeta(key: string, value: string) {
  const database = await getDeviceDatabase();
  if (database) await database.run("INSERT OR REPLACE INTO app_meta(key,value) VALUES (?,?)", [key, value]);
}

export async function getDeviceSyncState() {
  const database = await getDeviceDatabase();
  if (!database) return { linkedUserId: null, lastSyncedAt: null, pendingCount: 0 };
  const [meta, pending] = await Promise.all([
    database.query("SELECT key,value FROM app_meta WHERE key IN ('sync_user_id','last_full_sync_at')"),
    database.query("SELECT COUNT(*) AS count FROM sync_outbox"),
  ]);
  const values = Object.fromEntries((meta.values ?? []).map((row) => [String(row.key), String(row.value)]));
  return { linkedUserId: values.sync_user_id ?? null, lastSyncedAt: values.last_full_sync_at ?? null, pendingCount: Number(pending.values?.[0]?.count ?? 0) };
}

export async function uploadDeviceLibrary(userId: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const backup = await createDeviceBackup();
  const data = backup.data;
  const books = await Promise.all(data.books.map(async (row) => {
    const next = clean(row, userId, "book");
    if (typeof row.cover_local_path === "string") {
      const cover = await uploadLocalCover(userId, "book", String(row.id), row.cover_local_path);
      next.cover_storage_path = cover.path;
      next.cover_image_url = cover.publicUrl;
    }
    return next;
  }));
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
  const inventoryItems = await Promise.all(data.inventoryItems.map(async (row) => {
    const next = clean(row, userId, "inventory");
    if (typeof row.cover_local_path === "string") {
      const cover = await uploadLocalCover(userId, "inventory_item", String(row.id), row.cover_local_path);
      next.cover_storage_path = cover.path;
      next.cover_image_url = cover.publicUrl;
    }
    return next;
  }));
  await upsert("inventory_items", inventoryItems);

  const settings = data.userSettings;
  const avatarPath = typeof settings.avatar_local_path === "string" ? await uploadLocalAvatar(userId, settings.avatar_local_path) : null;
  const settingsPayload: Row = {
    user_id: userId, theme: settings.theme ?? "dark", timezone: settings.timezone ?? "Asia/Dhaka",
    display_name: settings.display_name ?? null, birth_year: settings.birth_year ?? null, bio: settings.bio ?? null,
  };
  if (avatarPath) settingsPayload.avatar_path = avatarPath;
  const settingsResult = await supabase.from("user_settings").upsert(settingsPayload, { onConflict: "user_id" });
  if (settingsResult.error) throw new Error(`Could not sync profile: ${settingsResult.error.message}`);

  const database = await getDeviceDatabase();
  if (database) await database.run("DELETE FROM sync_outbox");
  await setMeta("sync_user_id", userId);
  await setMeta("last_full_sync_at", new Date().toISOString());
  return Object.values(data).reduce((total, value) => total + (Array.isArray(value) ? value.length : 1), 0);
}

async function pushOutbox(userId: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const client = supabase;
  const database = await getDeviceDatabase();
  if (!database) throw new Error("The local database is unavailable.");
  const result = await database.query("SELECT id,entity_type,entity_id,operation,payload_json FROM sync_outbox ORDER BY id");
  const rows = (result.values ?? []) as OutboxRow[];
  const ordered = [...rows].sort((left, right) => {
    const priority = (item: OutboxRow) => item.operation === "create" && item.entity_type === "book" ? 0 : item.operation === "create" && item.entity_type === "reading_attempt" ? 1 : 2;
    return priority(left) - priority(right) || left.id - right.id;
  });
  for (const item of ordered) {
    const table = entityTables[item.entity_type];
    if (!table) continue;
    try {
      const source = JSON.parse(item.payload_json) as Row;
      const payload = cleanOutboxPayload(item.entity_type, source, userId);
      if ((item.entity_type === "book" || item.entity_type === "inventory_item") && typeof (source.cover_local_path ?? source.cover_storage_path) === "string") {
        const cover = await uploadLocalCover(userId, item.entity_type, item.entity_id, String(source.cover_local_path ?? source.cover_storage_path));
        payload.cover_storage_path = cover.path;
        payload.cover_image_url = cover.publicUrl;
      }
      if (item.entity_type === "user_settings" && typeof source.avatar_local_path === "string")
        payload.avatar_path = await uploadLocalAvatar(userId, source.avatar_local_path);
      if (item.entity_type === "user_settings" && source.avatar_local_path === null)
        payload.avatar_path = null;
      if ((item.entity_type === "book" || item.entity_type === "inventory_item") && (item.operation === "delete" || source.cover_storage_path === null))
        await client.storage.from("book-covers").remove([cloudCoverPath(userId, item.entity_type, item.entity_id)]);
      if (item.entity_type === "user_settings" && source.avatar_local_path === null)
        await client.storage.from("profile-images").remove([`${userId}/avatar`]);
      if (item.entity_type === "list_book") {
        const [listId, bookId] = item.entity_id.split(":");
        payload.list_id ??= listId; payload.book_id ??= bookId;
      } else payload.id ??= item.entity_id;
      let cloudResult;
      if (item.operation === "delete") {
        const query = client.from(table).delete().eq("user_id", userId);
        cloudResult = item.entity_type === "list_book" ? await query.eq("list_id", payload.list_id).eq("book_id", payload.book_id) : await query.eq("id", item.entity_id);
      } else if (item.operation === "create") {
        if (item.entity_type === "book") payload.active_attempt_id = null;
        const onConflict = item.entity_type === "list_book" ? "list_id,book_id" : item.entity_type === "reading_goal" ? "user_id,year" : item.entity_type === "user_settings" ? "user_id" : "id";
        cloudResult = await client.from(table).upsert(payload, { onConflict });
      } else {
        const changes = withoutInternalFields(payload);
        delete changes.id; delete changes.list_id; delete changes.book_id;
        const query = client.from(table).update(changes).eq("user_id", userId);
        cloudResult = item.entity_type === "list_book"
          ? await query.eq("list_id", payload.list_id).eq("book_id", payload.book_id)
          : item.entity_type === "user_settings"
            ? await query
            : item.entity_type === "reading_goal"
              ? await query.eq("year", Number(item.entity_id))
              : await query.eq("id", item.entity_id);
      }
      if (cloudResult.error) throw cloudResult.error;
      await database.run("DELETE FROM sync_outbox WHERE id=?", [item.id]);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unknown sync error";
      await database.run("UPDATE sync_outbox SET attempt_count=attempt_count+1,last_error=? WHERE id=?", [message, item.id]);
      throw new Error(`Could not sync a pending ${item.entity_type.replaceAll("_", " ")} change: ${message}`);
    }
  }
  const active = await database.query("SELECT id,active_attempt_id FROM books WHERE deleted_at IS NULL AND active_attempt_id IS NOT NULL");
  for (const book of active.values ?? []) {
    const result = await client.from("books").update({ active_attempt_id: book.active_attempt_id }).eq("user_id", userId).eq("id", book.id);
    if (result.error) throw new Error(`Could not link an active reading attempt: ${result.error.message}`);
  }
  return rows.length;
}

async function cloudRowsToDevice(
  key: keyof Omit<PagewiseBackupData, "userSettings">,
  rows: Row[],
  localRows: Row[],
) {
  const localById = new Map(localRows.map((row) => [String(row.id), row]));
  return Promise.all(rows.map(async (source) => {
    const row = withoutInternalFields(source);
    if (key === "books" || key === "inventoryItems") {
      const local = localById.get(String(row.id));
      row.cover_local_path = local?.cover_local_path ?? null;
      const remoteIsNewer = String(source.updated_at ?? "") > String(local?.updated_at ?? "");
      if ((!row.cover_local_path || remoteIsNewer) && typeof source.cover_storage_path === "string" && supabase) {
        const download = await supabase.storage.from("book-covers").download(source.cover_storage_path);
        if (!download.error && download.data) {
          const extension = download.data.type === "image/png" ? "png" : download.data.type === "image/webp" ? "webp" : "jpg";
          const saved = await writeDeviceBlob(`covers/cloud-${String(row.id)}.${extension}`, download.data);
          row.cover_local_path = saved.path;
        }
      }
      row.tags_json = JSON.stringify(Array.isArray(row.tags) ? row.tags : []);
      delete row.tags; delete row.cover_storage_path;
    }
    return row;
  }));
}

async function pullCloudLibrary(userId: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const client = supabase;
  const local = await createDeviceBackup();
  const [entries, settingsResult] = await Promise.all([
    Promise.all(pullTables.map(async ([key, table]) => {
    const result = await client.from(table).select("*").eq("user_id", userId);
    if (result.error) throw new Error(`Could not download ${table.replaceAll("_", " ")}: ${result.error.message}`);
    return [key, await cloudRowsToDevice(key, (result.data ?? []) as Row[], local.data[key])] as const;
    })),
    client.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  if (settingsResult.error) throw new Error(`Could not download profile settings: ${settingsResult.error.message}`);
  const data = Object.fromEntries(entries) as Omit<PagewiseBackupData, "userSettings">;
  let userSettings = local.data.userSettings;
  const remoteSettings = settingsResult.data as Row | null;
  if (remoteSettings && String(remoteSettings.updated_at ?? "") >= String(userSettings.updated_at ?? "")) {
    let avatarLocalPath: unknown = null;
    if (typeof remoteSettings.avatar_path === "string") {
      const avatar = await client.storage.from("profile-images").download(remoteSettings.avatar_path);
      if (!avatar.error && avatar.data) {
        const extension = avatar.data.type === "image/png" ? "png" : avatar.data.type === "image/webp" ? "webp" : "jpg";
        avatarLocalPath = (await writeDeviceBlob(`avatars/cloud-profile.${extension}`, avatar.data)).path;
      }
    }
    userSettings = { ...withoutInternalFields(remoteSettings), id: 1, avatar_local_path: avatarLocalPath };
    delete userSettings.avatar_path;
  }
  const backup: PagewiseBackup = {
    format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), appVersion: "0.1.0",
    data: { ...data, userSettings },
  };
  return restoreDeviceBackup(backup, "merge", true);
}

export async function synchronizeDeviceLibrary(userId: string) {
  const state = await getDeviceSyncState();
  if (state.linkedUserId !== userId) throw new Error("Confirm the first cloud merge before automatic sync can start.");
  const pushed = await pushOutbox(userId);
  const pulled = await pullCloudLibrary(userId);
  const syncedAt = new Date().toISOString();
  await setMeta("last_full_sync_at", syncedAt);
  const next = await getDeviceSyncState();
  return { pushed, pulled: pulled.records, syncedAt, pendingCount: next.pendingCount };
}
