import { supabase } from "./supabase";

export const BACKUP_FORMAT = "pagewise-backup" as const;
export const BACKUP_VERSION = 1 as const;

type BackupRow = Record<string, unknown>;

export type PagewiseBackupData = {
  books: BackupRow[];
  readingAttempts: BackupRow[];
  lists: BackupRow[];
  listBooks: BackupRow[];
  readingLogs: BackupRow[];
  quotes: BackupRow[];
  readingGoals: BackupRow[];
  streakFreezes: BackupRow[];
  inventoryItems: BackupRow[];
  userSettings: BackupRow;
};

export type PagewiseBackup = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  appVersion: string;
  data: PagewiseBackupData;
};

export type BackupCounts = Omit<
  Record<keyof PagewiseBackupData, number>,
  "userSettings"
> & { userSettings: number };
export type ImportMode = "merge" | "replace";
export type BackupValidation =
  | { valid: true; backup: PagewiseBackup; counts: BackupCounts }
  | { valid: false; errors: string[] };

const tableMap = [
  ["books", "books"],
  ["readingAttempts", "reading_attempts"],
  ["lists", "lists"],
  ["listBooks", "list_books"],
  ["readingLogs", "reading_logs"],
  ["quotes", "quotes"],
  ["readingGoals", "reading_goals"],
  ["streakFreezes", "streak_freezes"],
  ["inventoryItems", "inventory_items"],
] as const;

export function countBackupRecords(data: PagewiseBackupData): BackupCounts {
  return {
    books: data.books.length,
    readingAttempts: data.readingAttempts.length,
    lists: data.lists.length,
    listBooks: data.listBooks.length,
    readingLogs: data.readingLogs.length,
    quotes: data.quotes.length,
    readingGoals: data.readingGoals.length,
    streakFreezes: data.streakFreezes.length,
    inventoryItems: data.inventoryItems.length,
    userSettings: Object.keys(data.userSettings).length ? 1 : 0,
  };
}

function isObject(value: unknown): value is BackupRow {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasString(row: BackupRow, key: string) {
  return typeof row[key] === "string" && Boolean((row[key] as string).trim());
}

export function validatePagewiseBackup(input: unknown): BackupValidation {
  const errors: string[] = [];
  if (!isObject(input))
    return {
      valid: false,
      errors: ["The selected file does not contain a JSON object."],
    };
  if (input.format !== BACKUP_FORMAT)
    errors.push("This is not a Pagewise backup file.");
  if (input.version !== BACKUP_VERSION)
    errors.push(
      `Backup version ${String(input.version)} is not supported. Expected version ${BACKUP_VERSION}.`,
    );
  if (
    typeof input.exportedAt !== "string" ||
    Number.isNaN(Date.parse(input.exportedAt))
  )
    errors.push("The backup export timestamp is missing or invalid.");
  if (typeof input.appVersion !== "string")
    errors.push("The backup app version is missing.");
  if (!isObject(input.data))
    return {
      valid: false,
      errors: [...errors, "The backup data section is missing."],
    };

  const data = input.data;
  const arrayKeys = [
    "books",
    "readingAttempts",
    "lists",
    "listBooks",
    "readingLogs",
    "quotes",
    "readingGoals",
    "streakFreezes",
  ] as const;
  for (const key of arrayKeys) {
    if (!Array.isArray(data[key])) errors.push(`${key} must be a record list.`);
    else if ((data[key] as unknown[]).length > 100000)
      errors.push(`${key} exceeds the 100,000-record safety limit.`);
  }
  if (!isObject(data.userSettings))
    errors.push("userSettings must be an object.");
  else if (
    !hasString(data.userSettings, "theme") ||
    !hasString(data.userSettings, "timezone")
  )
    errors.push("User settings are incomplete.");
  if (errors.length) return { valid: false, errors };

  // inventoryItems was added without changing the format version, so backups
  // made before LitShelves remain valid and restore as an empty inventory.
  const inventoryItems = data.inventoryItems ?? [];
  if (!Array.isArray(inventoryItems))
    errors.push("inventoryItems must be a record list.");
  else if (inventoryItems.length > 100000)
    errors.push("inventoryItems exceeds the 100,000-record safety limit.");
  if (errors.length) return { valid: false, errors };

  const backupData = { ...data, inventoryItems } as PagewiseBackupData;
  const ids = (rows: BackupRow[], label: string) => {
    const found = new Set<string>();
    rows.forEach((row, index) => {
      if (!isObject(row) || !hasString(row, "id"))
        errors.push(`${label} record ${index + 1} has no valid id.`);
      else if (found.has(row.id as string))
        errors.push(`${label} contains duplicate id ${row.id}.`);
      else found.add(row.id as string);
    });
    return found;
  };
  const bookIds = ids(backupData.books, "Books");
  const attemptIds = ids(backupData.readingAttempts, "Reading attempts");
  const listIds = ids(backupData.lists, "Lists");
  ids(backupData.readingLogs, "Reading logs");
  ids(backupData.quotes, "Quotes");
  ids(backupData.readingGoals, "Reading goals");
  ids(backupData.streakFreezes, "Streak freezes");
  ids(backupData.inventoryItems, "Inventory items");

  backupData.books.forEach((row, index) => {
    if (!hasString(row, "title"))
      errors.push(`Book ${index + 1} has no title.`);
    if (
      row.active_attempt_id != null &&
      !attemptIds.has(String(row.active_attempt_id))
    )
      errors.push(`Book ${index + 1} references a missing active attempt.`);
  });
  backupData.readingAttempts.forEach((row, index) => {
    if (!bookIds.has(String(row.book_id)))
      errors.push(`Reading attempt ${index + 1} references a missing book.`);
  });
  const memberships = new Set<string>();
  backupData.listBooks.forEach((row, index) => {
    const key = `${String(row.list_id)}:${String(row.book_id)}`;
    if (memberships.has(key))
      errors.push(`List membership ${index + 1} is duplicated.`);
    memberships.add(key);
    if (!listIds.has(String(row.list_id)))
      errors.push(`List membership ${index + 1} references a missing list.`);
    if (!bookIds.has(String(row.book_id)))
      errors.push(`List membership ${index + 1} references a missing book.`);
  });
  backupData.readingLogs.forEach((row, index) => {
    if (!bookIds.has(String(row.book_id)))
      errors.push(`Reading log ${index + 1} references a missing book.`);
    if (row.attempt_id != null && !attemptIds.has(String(row.attempt_id)))
      errors.push(`Reading log ${index + 1} references a missing attempt.`);
  });
  backupData.quotes.forEach((row, index) => {
    if (!bookIds.has(String(row.book_id)))
      errors.push(`Quote ${index + 1} references a missing book.`);
  });
  backupData.inventoryItems.forEach((row, index) => {
    if (!hasString(row, "title"))
      errors.push(`Inventory item ${index + 1} has no title.`);
    if (
      row.pagewise_book_id != null &&
      !bookIds.has(String(row.pagewise_book_id))
    )
      errors.push(
        `Inventory item ${index + 1} references a missing Pagewise book.`,
      );
  });

  if (errors.length) return { valid: false, errors: errors.slice(0, 20) };
  const backup = {
    ...input,
    data: backupData,
  } as PagewiseBackup;
  return { valid: true, backup, counts: countBackupRecords(backup.data) };
}

export async function createPagewiseBackup(
  userId: string | null,
  previewMode: boolean,
): Promise<PagewiseBackup> {
  if (previewMode) {
    return {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      appVersion: "0.1.0",
      data: {
        books: [],
        readingAttempts: [],
        lists: [],
        listBooks: [],
        readingLogs: [],
        quotes: [],
        readingGoals: [],
        streakFreezes: [],
        inventoryItems: [],
        userSettings: { theme: "dark", timezone: "Asia/Dhaka" },
      },
    };
  }
  if (!supabase || !userId)
    throw new Error("Sign in is required to export your backup.");

  const client = supabase;
  const [tableResults, settingsResult] = await Promise.all([
    Promise.all(
      tableMap.map(async ([key, table]) => {
        const result = await client
          .from(table)
          .select("*")
          .eq("user_id", userId);
        if (result.error)
          throw new Error(
            `Could not export ${table.replaceAll("_", " ")}: ${result.error.message}`,
          );
        return [key, result.data ?? []] as const;
      }),
    ),
    client
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (settingsResult.error)
    throw new Error(
      `Could not export settings: ${settingsResult.error.message}`,
    );

  const collections = Object.fromEntries(tableResults) as Omit<
    PagewiseBackupData,
    "userSettings"
  >;
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: "0.1.0",
    data: { ...collections, userSettings: settingsResult.data ?? {} },
  };
}

export function downloadBackup(backup: PagewiseBackup) {
  const date = backup.exportedAt.slice(0, 10);
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `pagewise-backup-${date}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function restorePagewiseBackup(
  backup: PagewiseBackup,
  mode: ImportMode,
  previewMode: boolean,
) {
  if (previewMode)
    return {
      mode,
      records: Object.values(countBackupRecords(backup.data)).reduce(
        (sum, count) => sum + count,
        0,
      ),
    };
  if (!supabase) throw new Error("Sign in is required to restore a backup.");
  const result = await supabase.rpc("restore_pagewise_backup", {
    p_backup: backup,
    p_mode: mode,
  });
  if (result.error) throw new Error(result.error.message);
  return result.data as { mode: ImportMode; records: number };
}
