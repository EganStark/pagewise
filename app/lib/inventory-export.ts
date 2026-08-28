import type { InventoryItem } from "./inventory";
import { safeCsvCell } from "./csv";

const columns = [
  "title",
  "author",
  "isbn",
  "publisher",
  "publication_year",
  "edition",
  "language",
  "genre",
  "format",
  "condition",
  "location",
  "shelf",
  "quantity",
  "acquisition_date",
  "purchase_price",
  "currency",
  "is_lent",
  "lent_to",
  "lent_at",
  "due_date",
  "notes",
  "tags",
] as const;

export function inventoryToCsv(items: InventoryItem[]) {
  const rows = items.map((item) =>
    columns
      .map((column) => {
        const value = item[column];
        return safeCsvCell(Array.isArray(value) ? value.join("; ") : value);
      })
      .join(","),
  );
  return `\uFEFF${columns.join(",")}\r\n${rows.join("\r\n")}`;
}

export function downloadInventoryCsv(items: InventoryItem[]) {
  const blob = new Blob([inventoryToCsv(items)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `litshelves-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
