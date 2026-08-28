import { parseBookList } from "./smart-import";

export type InventoryImportRow = {
  id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  publisher: string | null;
  language: string | null;
  genre: string | null;
  format: string | null;
  location: string | null;
  shelf: string | null;
  quantity: number;
};

function csvColumns(line: string) {
  const columns: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      columns.push(value.trim());
      value = "";
    } else value += char;
  }
  columns.push(value.trim());
  return columns;
}

function safeQuantity(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.min(10_000, Math.max(1, Math.trunc(parsed)))
    : 1;
}

export function parseInventoryImport(text: string): InventoryImportRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const header = csvColumns(lines[0]).map((value) =>
    value.toLocaleLowerCase().replaceAll(" ", "_"),
  );
  if (header.includes("title")) {
    const get = (values: string[], key: string) =>
      values[header.indexOf(key)]?.trim() || null;
    return lines.slice(1, 101).flatMap((line, index) => {
      const values = csvColumns(line);
      const title = get(values, "title");
      if (!title) return [];
      return [
        {
          id: `csv-${index}-${title}`,
          title,
          author: get(values, "author"),
          isbn: get(values, "isbn"),
          publisher: get(values, "publisher"),
          language: get(values, "language"),
          genre: get(values, "genre"),
          format: get(values, "format"),
          location: get(values, "location"),
          shelf: get(values, "shelf"),
          quantity: safeQuantity(get(values, "quantity")),
        },
      ];
    });
  }
  return parseBookList(text)
    .slice(0, 100)
    .map((row) => ({
      id: row.id,
      title: row.title,
      author: row.author,
      isbn: row.isbn,
      publisher: null,
      language: null,
      genre: null,
      format: null,
      location: null,
      shelf: null,
      quantity: 1,
    }));
}
