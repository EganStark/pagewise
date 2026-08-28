import type { BookInput } from "./books";
import { normalizeBookText, normalizeIsbn } from "./cover-images";

export type ParsedBookLine = {
  id: string;
  raw: string;
  title: string;
  author: string | null;
  isbn: string | null;
};
export type SmartImportMatch = ParsedBookLine & {
  status: "ready" | "review" | "unmatched" | "duplicate";
  confidence: string;
  selected: boolean;
  book: BookInput | null;
};

export function parseBookList(text: string): ParsedBookLine[] {
  const seen = new Set<string>();
  return text.split(/\r?\n/).flatMap((raw, index) => {
    const clean = raw.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim();
    if (!clean) return [];
    const isbn = normalizeIsbn(clean);
    const isbnOnly = /^(?:97[89])?\d{9}[\dXx]$/.test(isbn);
    let title = clean;
    let author: string | null = null;
    if (!isbnOnly) {
      const parts = clean.split(
        /\s+(?:—|–|-|by)\s+|\s*\|\s*|\s*,\s*(?=[^,]+$)/i,
      );
      title = parts[0]?.trim() || clean;
      author =
        parts.length > 1 ? parts.slice(1).join(", ").trim() || null : null;
    }
    const key = isbnOnly
      ? isbn
      : `${normalizeBookText(title)}:${normalizeBookText(author)}`;
    if (!key || seen.has(key)) return [];
    seen.add(key);
    return [
      {
        id: `${index}-${key}`,
        raw: clean,
        title: isbnOnly ? clean : title,
        author,
        isbn: isbnOnly ? isbn : null,
      },
    ];
  });
}
