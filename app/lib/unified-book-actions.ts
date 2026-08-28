import type { Book, BookInput } from "./books";
import { normalizeBookText, normalizeIsbn } from "./cover-images";
import type { InventoryInput, InventoryItem } from "./inventory";
import type { MetadataCandidate } from "./metadata";

export type UnifiedAddTarget = "pagewise" | "inventory" | "both";

export function candidateToBookInput(candidate: MetadataCandidate): BookInput {
  const fromOpenLibrary = candidate.providers.includes("open_library");
  return {
    title: candidate.title,
    author: candidate.authors.join(", ") || null,
    status: "want_to_read",
    cover_image_url: candidate.coverUrl,
    cover_source: candidate.coverUrl
      ? fromOpenLibrary
        ? "open_library"
        : "url"
      : "placeholder",
    open_library_work_key: fromOpenLibrary ? candidate.workKey : null,
    open_library_edition_key: fromOpenLibrary ? candidate.editionKey : null,
    publication_year: candidate.publicationYear,
    total_pages: candidate.pageCount,
    isbn: candidate.isbn,
    description: candidate.description,
    genre: candidate.genres[0] ?? null,
    tags: [],
  };
}

export function candidateToInventoryInput(
  candidate: MetadataCandidate,
  pagewiseBookId: string | null = null,
): InventoryInput {
  return {
    pagewise_book_id: pagewiseBookId,
    title: candidate.title,
    author: candidate.authors.join(", ") || null,
    isbn: candidate.isbn,
    publisher: null,
    publication_year: candidate.publicationYear,
    edition: null,
    language: candidate.language,
    genre: candidate.genres[0] ?? null,
    format: null,
    condition: "good",
    location: null,
    shelf: null,
    quantity: 1,
    acquisition_date: null,
    purchase_price: null,
    currency: "BDT",
    is_lent: false,
    lent_to: null,
    lent_at: null,
    due_date: null,
    notes: candidate.description,
    cover_image_url: candidate.coverUrl,
    cover_storage_path: null,
    tags: [],
  };
}

export function findPagewiseMatch(candidate: MetadataCandidate, books: Book[]) {
  const isbn = normalizeIsbn(candidate.isbn);
  const title = normalizeBookText(candidate.title);
  const author = normalizeBookText(candidate.authors.join(", "));
  return books.find(
    (book) =>
      (isbn && normalizeIsbn(book.isbn) === isbn) ||
      (normalizeBookText(book.title) === title &&
        normalizeBookText(book.author) === author),
  );
}

export function findInventoryMatch(
  candidate: MetadataCandidate,
  items: InventoryItem[],
) {
  const isbn = normalizeIsbn(candidate.isbn);
  const title = normalizeBookText(candidate.title);
  const author = normalizeBookText(candidate.authors.join(", "));
  return items.find(
    (item) =>
      (isbn && normalizeIsbn(item.isbn) === isbn) ||
      (normalizeBookText(item.title) === title &&
        normalizeBookText(item.author) === author),
  );
}
