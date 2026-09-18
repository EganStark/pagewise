import type { BookList, ListMembership } from "./book-lists";
import { getDeviceDatabase } from "./device-db";
import type { InventoryInput, InventoryItem } from "./inventory";
import type { BookQuote, QuoteInput } from "./quotes";
import { deviceFileUrl } from "./device-files";
import { queueDeviceChange } from "./device-outbox";

async function db() {
  const database = await getDeviceDatabase();
  if (!database) throw new Error("The local database is unavailable.");
  return database;
}

async function queue(
  type: string,
  id: string,
  operation: "create" | "update" | "delete",
  payload: object,
) {
  await queueDeviceChange(type, id, operation, payload);
}

export async function listDeviceLists() {
  const database = await db();
  const [listResult, membershipResult] = await Promise.all([
    database.query(
      `SELECT id,title,description,created_at,updated_at FROM lists
       WHERE deleted_at IS NULL ORDER BY updated_at DESC`,
    ),
    database.query(
      `SELECT list_id,book_id,position,added_at FROM list_books
       WHERE deleted_at IS NULL ORDER BY list_id,position`,
    ),
  ]);
  return {
    lists: (listResult.values ?? []).map((row) => ({
      ...row,
      user_id: "device",
    })) as BookList[],
    memberships: (membershipResult.values ?? []).map((row) => ({
      ...row,
      user_id: "device",
    })) as ListMembership[],
  };
}

export async function createDeviceList(title: string, description: string) {
  const database = await db();
  const now = new Date().toISOString();
  const row: BookList = {
    id: crypto.randomUUID(),
    user_id: "device",
    title: title.trim(),
    description: description.trim() || null,
    created_at: now,
    updated_at: now,
  };
  await database.run(
    "INSERT INTO lists(id,title,description,created_at,updated_at) VALUES (?,?,?,?,?)",
    [row.id, row.title, row.description, now, now],
  );
  await queue("list", row.id, "create", row);
  return row;
}

export async function updateDeviceList(
  id: string,
  title: string,
  description: string,
) {
  const database = await db();
  const now = new Date().toISOString();
  const changes = { title: title.trim(), description: description.trim() || null };
  await database.run(
    "UPDATE lists SET title=?,description=?,updated_at=? WHERE id=? AND deleted_at IS NULL",
    [changes.title, changes.description, now, id],
  );
  await queue("list", id, "update", { ...changes, updated_at: now });
  return changes;
}

export async function deleteDeviceList(id: string) {
  const database = await db();
  const now = new Date().toISOString();
  await database.run("UPDATE lists SET deleted_at=?,updated_at=? WHERE id=?", [now, now, id]);
  await database.run("UPDATE list_books SET deleted_at=? WHERE list_id=?", [now, id]);
  await queue("list", id, "delete", { id, deleted_at: now });
}

export async function setDeviceBookLists(
  bookId: string,
  selectedIds: string[],
  memberships: ListMembership[],
) {
  const database = await db();
  const currentIds = memberships.filter((item) => item.book_id === bookId).map((item) => item.list_id);
  const addIds = selectedIds.filter((id) => !currentIds.includes(id));
  const removeIds = currentIds.filter((id) => !selectedIds.includes(id));
  const now = new Date().toISOString();
  for (const listId of removeIds) {
    await database.run("UPDATE list_books SET deleted_at=? WHERE list_id=? AND book_id=?", [now, listId, bookId]);
    await queue("list_book", `${listId}:${bookId}`, "delete", { list_id: listId, book_id: bookId });
  }
  for (const listId of addIds) {
    const position = memberships.filter((item) => item.list_id === listId).length;
    await database.run(
      `INSERT INTO list_books(list_id,book_id,position,added_at,deleted_at)
       VALUES (?,?,?,?,NULL)
       ON CONFLICT(list_id,book_id) DO UPDATE SET position=excluded.position,added_at=excluded.added_at,deleted_at=NULL`,
      [listId, bookId, position, now],
    );
    await queue("list_book", `${listId}:${bookId}`, "create", { list_id: listId, book_id: bookId, position, added_at: now });
  }
}

export async function moveDeviceListBooks(listId: string, ordered: ListMembership[]) {
  const database = await db();
  for (const item of ordered) {
    await database.run("UPDATE list_books SET position=? WHERE list_id=? AND book_id=?", [item.position, listId, item.book_id]);
    await queue("list_book", `${listId}:${item.book_id}`, "update", { position: item.position });
  }
}

export async function listDeviceQuotes(bookId: string) {
  const database = await db();
  const result = await database.query(
    `SELECT id,book_id,page_number,quote_text,note,created_at,updated_at FROM quotes
     WHERE book_id=? AND deleted_at IS NULL
     ORDER BY page_number IS NULL,page_number,created_at`,
    [bookId],
  );
  return (result.values ?? []).map((row) => ({ ...row, user_id: "device" })) as BookQuote[];
}

export async function saveDeviceQuote(bookId: string, input: QuoteInput, id?: string) {
  const database = await db();
  const now = new Date().toISOString();
  const quoteId = id ?? crypto.randomUUID();
  const clean = { page_number: input.page_number, quote_text: input.quote_text.trim(), note: input.note?.trim() || null };
  if (id) {
    await database.run(
      "UPDATE quotes SET page_number=?,quote_text=?,note=?,updated_at=? WHERE id=? AND book_id=?",
      [clean.page_number, clean.quote_text, clean.note, now, id, bookId],
    );
  } else {
    await database.run(
      "INSERT INTO quotes(id,book_id,page_number,quote_text,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",
      [quoteId, bookId, clean.page_number, clean.quote_text, clean.note, now, now],
    );
  }
  const row: BookQuote = { id: quoteId, book_id: bookId, user_id: "device", ...clean, created_at: now, updated_at: now };
  await queue("quote", quoteId, id ? "update" : "create", row);
  return row;
}

export async function deleteDeviceQuote(id: string) {
  const database = await db();
  const now = new Date().toISOString();
  await database.run("UPDATE quotes SET deleted_at=?,updated_at=? WHERE id=?", [now, now, id]);
  await queue("quote", id, "delete", { id, deleted_at: now });
}

const inventoryColumns = `id,pagewise_book_id,title,author,isbn,publisher,publication_year,
 edition,language,genre,format,condition,location,shelf,quantity,acquisition_date,
 purchase_price,currency,is_lent,lent_to,lent_at,due_date,notes,cover_image_url,
 cover_local_path,tags_json,created_at,updated_at`;

async function inventory(row: Record<string, unknown>): Promise<InventoryItem> {
  let tags: string[] = [];
  try {
    const value: unknown = JSON.parse(String(row.tags_json ?? "[]"));
    if (Array.isArray(value)) tags = value.filter((tag): tag is string => typeof tag === "string");
  } catch { /* Invalid legacy tags become an empty list. */ }
  const localPath = (row.cover_local_path as string | null) ?? null;
  return {
    ...row,
    user_id: "device",
    cover_storage_path: localPath,
    cover_image_url: localPath ? await deviceFileUrl(localPath) : (row.cover_image_url as string | null),
    is_lent: Boolean(row.is_lent),
    tags,
  } as InventoryItem;
}

export async function listDeviceInventory() {
  const database = await db();
  const result = await database.query(
    `SELECT ${inventoryColumns} FROM inventory_items WHERE deleted_at IS NULL ORDER BY updated_at DESC`,
  );
  return Promise.all((result.values ?? []).map(inventory));
}

export async function createDeviceInventory(input: InventoryInput) {
  const database = await db();
  const now = new Date().toISOString();
  const row: InventoryItem = { ...input, id: crypto.randomUUID(), user_id: "device", created_at: now, updated_at: now };
  await database.run(
    `INSERT INTO inventory_items(${inventoryColumns}) VALUES (${Array(28).fill("?").join(",")})`,
    [row.id,row.pagewise_book_id,row.title,row.author,row.isbn,row.publisher,row.publication_year,row.edition,row.language,row.genre,row.format,row.condition,row.location,row.shelf,row.quantity,row.acquisition_date,row.purchase_price,row.currency,row.is_lent ? 1 : 0,row.lent_to,row.lent_at,row.due_date,row.notes,row.cover_image_url,row.cover_storage_path,JSON.stringify(row.tags),now,now],
  );
  await queue("inventory_item", row.id, "create", row);
  return row;
}

const inventoryFields: Partial<Record<keyof InventoryItem, string>> = {
  pagewise_book_id:"pagewise_book_id",title:"title",author:"author",isbn:"isbn",publisher:"publisher",
  publication_year:"publication_year",edition:"edition",language:"language",genre:"genre",format:"format",
  condition:"condition",location:"location",shelf:"shelf",quantity:"quantity",acquisition_date:"acquisition_date",
  purchase_price:"purchase_price",currency:"currency",is_lent:"is_lent",lent_to:"lent_to",lent_at:"lent_at",
  due_date:"due_date",notes:"notes",cover_image_url:"cover_image_url",cover_storage_path:"cover_local_path",tags:"tags_json",
};

export async function updateDeviceInventory(id: string, changes: Partial<InventoryItem>) {
  const database = await db();
  const entries = Object.entries(changes).filter(([key]) => inventoryFields[key as keyof InventoryItem]);
  if (!entries.length) return;
  const now = new Date().toISOString();
  const values = entries.map(([key, value]) => key === "tags" ? JSON.stringify(value ?? []) : key === "is_lent" ? (value ? 1 : 0) : value ?? null);
  const fields = entries.map(([key]) => `${inventoryFields[key as keyof InventoryItem]}=?`);
  await database.run(`UPDATE inventory_items SET ${fields.join(",")},updated_at=? WHERE id=? AND deleted_at IS NULL`, [...values, now, id]);
  await queue("inventory_item", id, "update", { ...changes, updated_at: now });
}

export async function deleteDeviceInventory(id: string) {
  const database = await db();
  const now = new Date().toISOString();
  await database.run("UPDATE inventory_items SET deleted_at=?,updated_at=? WHERE id=?", [now, now, id]);
  await queue("inventory_item", id, "delete", { id, deleted_at: now });
}
