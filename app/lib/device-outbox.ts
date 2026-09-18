import { getDeviceDatabase } from "./device-db";

export const DEVICE_CHANGE_EVENT = "pagewise-device-change";

export async function queueDeviceChange(
  entityType: string,
  entityId: string,
  operation: "create" | "update" | "delete",
  payload: object,
) {
  const database = await getDeviceDatabase();
  if (!database) throw new Error("The local database is unavailable.");
  await database.run(
    `INSERT INTO sync_outbox(entity_type,entity_id,operation,payload_json,created_at)
     VALUES (?,?,?,?,?)`,
    [entityType, entityId, operation, JSON.stringify(payload), new Date().toISOString()],
  );
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DEVICE_CHANGE_EVENT));
}
