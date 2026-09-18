import type { ThemePreference } from "../hooks/useProfileSettings";
import { getDeviceDatabase } from "./device-db";
import { deleteDeviceFile, deviceFileUrl, saveDeviceImage } from "./device-files";
import { queueDeviceChange } from "./device-outbox";

export type DeviceProfile = {
  theme: ThemePreference;
  timezone: string;
  displayName: string;
  birthYear: number | null;
  bio: string;
  avatarPath: string | null;
  avatarUrl: string | null;
  goalTarget: number;
};

async function db() {
  const database = await getDeviceDatabase();
  if (!database) throw new Error("The local database is unavailable.");
  return database;
}

async function ensureSettings() {
  const database = await db();
  const now = new Date().toISOString();
  await database.run(
    `INSERT OR IGNORE INTO user_settings(id,theme,timezone,created_at,updated_at)
     VALUES (1,'dark','Asia/Dhaka',?,?)`,
    [now, now],
  );
}

export async function loadDeviceProfile(year: number): Promise<DeviceProfile> {
  const database = await db();
  await ensureSettings();
  const [settings, goal] = await Promise.all([
    database.query("SELECT * FROM user_settings WHERE id=1"),
    database.query("SELECT target_books FROM reading_goals WHERE year=?", [year]),
  ]);
  const row = settings.values?.[0] ?? {};
  const avatarPath = (row.avatar_local_path as string | null) ?? null;
  return {
    theme: (row.theme as ThemePreference) ?? "dark",
    timezone: String(row.timezone ?? "Asia/Dhaka"),
    displayName: String(row.display_name ?? ""),
    birthYear: row.birth_year == null ? null : Number(row.birth_year),
    bio: String(row.bio ?? ""),
    avatarPath,
    avatarUrl: await deviceFileUrl(avatarPath),
    goalTarget: Number(goal.values?.[0]?.target_books ?? 30),
  };
}

export async function saveDeviceTheme(theme: ThemePreference) {
  const database = await db();
  await ensureSettings();
  const now = new Date().toISOString();
  await database.run("UPDATE user_settings SET theme=?,updated_at=? WHERE id=1", [theme, now]);
  await queueDeviceChange("user_settings", "1", "update", { theme, updated_at: now });
}

export async function saveDevicePreferences(year: number, target: number, timezone: string) {
  const database = await db();
  await ensureSettings();
  const now = new Date().toISOString();
  await database.run("UPDATE user_settings SET timezone=?,updated_at=? WHERE id=1", [timezone, now]);
  await database.run(
    `INSERT INTO reading_goals(id,year,target_books,created_at,updated_at) VALUES (?,?,?,?,?)
     ON CONFLICT(year) DO UPDATE SET target_books=excluded.target_books,updated_at=excluded.updated_at`,
    [crypto.randomUUID(), year, target, now, now],
  );
  await queueDeviceChange("user_settings", "1", "update", { timezone, updated_at: now });
  await queueDeviceChange("reading_goal", String(year), "create", { year, target_books: target, updated_at: now });
}

export async function saveDevicePersonalProfile(displayName: string, birthYear: number | null, bio: string) {
  const database = await db();
  await ensureSettings();
  const now = new Date().toISOString();
  await database.run(
    "UPDATE user_settings SET display_name=?,birth_year=?,bio=?,updated_at=? WHERE id=1",
    [displayName, birthYear, bio, now],
  );
  await queueDeviceChange("user_settings", "1", "update", { display_name: displayName, birth_year: birthYear, bio, updated_at: now });
}

export async function saveDeviceAvatar(file: File, previousPath: string | null) {
  const database = await db();
  const saved = await saveDeviceImage(file, "avatars");
  await ensureSettings();
  const now = new Date().toISOString();
  await database.run("UPDATE user_settings SET avatar_local_path=?,updated_at=? WHERE id=1", [saved.path, now]);
  await queueDeviceChange("user_settings", "1", "update", { avatar_local_path: saved.path, updated_at: now });
  await deleteDeviceFile(previousPath);
  return saved;
}

export async function removeDeviceAvatar(path: string | null) {
  const database = await db();
  await ensureSettings();
  const now = new Date().toISOString();
  await database.run("UPDATE user_settings SET avatar_local_path=NULL,updated_at=? WHERE id=1", [now]);
  await queueDeviceChange("user_settings", "1", "update", { avatar_local_path: null, updated_at: now });
  await deleteDeviceFile(path);
}
