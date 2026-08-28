import assert from "node:assert/strict";
import test from "node:test";
import type { Book } from "../app/lib/books";
import type { ReadingAttempt } from "../app/lib/reading-attempts";
import type { ReadingLog } from "../app/lib/reading-logs";
import { pagesFromRange } from "../app/lib/reading-logs";
import {
  buildReadingStats,
  calculateStreak,
  estimateBookFinish,
} from "../app/lib/reading-stats";
import { parseBookList } from "../app/lib/smart-import";
import { parseInventoryImport } from "../app/lib/inventory-import";
import { normalizeBookText } from "../app/lib/cover-images";
import {
  candidateToInventoryInput,
  findInventoryMatch,
  findPagewiseMatch,
} from "../app/lib/unified-book-actions";
import type { InventoryItem } from "../app/lib/inventory";
import { inventoryToCsv } from "../app/lib/inventory-export";
import { safeCsvCell } from "../app/lib/csv";
import type { MetadataCandidate } from "../app/lib/metadata";
import { validatePagewiseBackup } from "../app/lib/backup";
import manifest from "../app/manifest";
import { readFile } from "node:fs/promises";
import {
  aiMetadataJsonSchema,
  isAiMetadataSuggestion,
  prepareAiMetadataRequest,
} from "../app/lib/ai-metadata";

const book: Book = {
  id: "book-1",
  user_id: "user-1",
  title: "Test Book",
  author: "Test Author",
  cover_image_url: null,
  cover_storage_path: null,
  cover_source: "placeholder",
  open_library_work_key: null,
  open_library_edition_key: null,
  genre: "Fiction",
  total_pages: 300,
  publication_year: 2024,
  description: null,
  isbn: "9780000000001",
  status: "completed",
  is_favorite: false,
  current_page: 300,
  active_attempt_id: null,
  tags: [],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};
const log = (id: string, date: string, pages: number): ReadingLog => ({
  id,
  book_id: book.id,
  attempt_id: "attempt-1",
  user_id: "user-1",
  log_date: date,
  start_page: 0,
  end_page: pages,
  pages_read: pages,
  note: null,
  created_at: `${date}T00:00:00Z`,
  updated_at: `${date}T00:00:00Z`,
});
const attempt: ReadingAttempt = {
  id: "attempt-1",
  book_id: book.id,
  user_id: "user-1",
  attempt_number: 1,
  started_at: "2026-01-01",
  completed_at: "2026-01-10",
  rating_numeric: 4.5,
  rating_tag: "Very Good",
  review: "Strong",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-10T00:00:00Z",
};

test("page ranges never produce negative progress", () => {
  assert.equal(pagesFromRange(10, 25), 15);
  assert.equal(pagesFromRange(25, 10), 0);
  assert.equal(pagesFromRange(null, 10), 0);
});

test("streak calculation supports yesterday grace and freeze dates", () => {
  const logs = [log("1", "2026-08-24", 10), log("2", "2026-08-26", 10)];
  const result = calculateStreak(logs, new Date("2026-08-27T12:00:00"), [
    "2026-08-25",
  ]);
  assert.deepEqual(result, { current: 3, best: 3 });
});

test("pace estimate requires history and calculates remaining days", () => {
  const readingBook = {
    ...book,
    status: "reading" as const,
    current_page: 100,
  };
  const result = estimateBookFinish(
    readingBook,
    [log("1", "2026-08-25", 20), log("2", "2026-08-26", 20)],
    new Date("2026-08-26T12:00:00"),
  );
  assert.ok(result);
  assert.equal(result.sessionCount, 2);
  assert.equal(result.daysRemaining, 10);
});

test("year statistics scope attempts and logs to the selected year", () => {
  const stats = buildReadingStats(
    [book],
    [log("1", "2026-01-02", 20), log("2", "2025-01-02", 5)],
    new Date("2026-08-27T12:00:00"),
    [],
    [attempt],
    2026,
  );
  assert.equal(stats.yearPages, 20);
  assert.equal(stats.previousYearPages, 5);
  assert.equal(stats.completedThisYear, 1);
  assert.equal(stats.averageRating, 4.5);
  assert.equal(stats.mostReadAuthor, "Test Author");
});

test("smart import parses titles, authors, ISBNs, and removes duplicates", () => {
  const parsed = parseBookList(
    "1. Pather Panchali - Bibhutibhushan Bandyopadhyay\n9780547928227\nPather Panchali - Bibhutibhushan Bandyopadhyay",
  );
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].author, "Bibhutibhushan Bandyopadhyay");
  assert.equal(parsed[1].isbn, "9780547928227");
});

test("backup validation accepts linked records and rejects missing parents", () => {
  const backup = {
    format: "pagewise-backup",
    version: 1,
    exportedAt: "2026-08-27T00:00:00Z",
    appVersion: "0.1.0",
    data: {
      books: [{ id: "book-1", title: "Book", active_attempt_id: null }],
      readingAttempts: [{ id: "attempt-1", book_id: "book-1" }],
      lists: [],
      listBooks: [],
      readingLogs: [
        { id: "log-1", book_id: "book-1", attempt_id: "attempt-1" },
      ],
      quotes: [],
      readingGoals: [],
      streakFreezes: [],
      userSettings: { theme: "dark", timezone: "Asia/Dhaka" },
    },
  };
  assert.equal(validatePagewiseBackup(backup).valid, true);
  const legacyResult = validatePagewiseBackup(backup);
  assert.equal(legacyResult.valid, true);
  if (legacyResult.valid)
    assert.deepEqual(legacyResult.backup.data.inventoryItems, []);
  const broken = structuredClone(backup);
  broken.data.readingLogs[0].book_id = "missing";
  const result = validatePagewiseBackup(broken);
  assert.equal(result.valid, false);
  if (!result.valid) assert.match(result.errors.join(" "), /missing book/i);
});

test("backup validation protects LitShelves links", () => {
  const backup = {
    format: "pagewise-backup",
    version: 1,
    exportedAt: "2026-08-28T00:00:00Z",
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
      inventoryItems: [
        { id: "owned-1", title: "Owned book", pagewise_book_id: "missing" },
      ],
      userSettings: { theme: "dark", timezone: "Asia/Dhaka" },
    },
  };
  const result = validatePagewiseBackup(backup);
  assert.equal(result.valid, false);
  if (!result.valid)
    assert.match(result.errors.join(" "), /missing Pagewise book/i);
});

test("PWA manifest and service worker keep install and privacy requirements", async () => {
  const appManifest = manifest();
  assert.equal(appManifest.display, "standalone");
  assert.ok(appManifest.icons?.some((icon) => icon.purpose === "maskable"));
  assert.ok(
    appManifest.shortcuts?.some(
      (shortcut) => shortcut.url === "/?action=quick-log",
    ),
  );
  const worker = await readFile(
    new URL("../public/sw.js", import.meta.url),
    "utf8",
  );
  assert.match(worker, /offline\.html/);
  assert.match(worker, /hostname\.includes\("supabase"\)/);
  assert.match(worker, /request\.method !== "GET"/);
});

test("AI metadata output is strict and validated before use", () => {
  assert.equal(aiMetadataJsonSchema.additionalProperties, false);
  assert.deepEqual(aiMetadataJsonSchema.required, [
    "fields",
    "confidence",
    "explanation",
  ]);
  assert.equal(
    isAiMetadataSuggestion({
      fields: {
        title: "পথের পাঁচালী",
        author: "বিভূতিভূষণ বন্দ্যোপাধ্যায়",
        genre: null,
        total_pages: null,
        publication_year: 1929,
        isbn: null,
        description: null,
        tags: ["বাংলা"],
      },
      confidence: "high",
      explanation: "Provider-backed title and author.",
    }),
    true,
  );
  assert.equal(
    isAiMetadataSuggestion({ fields: {}, confidence: "high" }),
    false,
  );
});

test("AI metadata requests are bounded before leaving the server", () => {
  assert.equal(prepareAiMetadataRequest({ fields: {} }), null);
  const request = prepareAiMetadataRequest({
    fields: { title: `  ${"A".repeat(400)}  `, tags: Array(20).fill("tag") },
    providerCandidates: Array(10).fill({ title: "Candidate" }),
  });
  assert.ok(request);
  assert.equal(request.fields.title?.length, 300);
  assert.equal(request.fields.tags?.length, 8);
  assert.equal(request.providerCandidates.length, 6);
});

test("LitShelves migration keeps inventory private and Pagewise links optional", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/0006_litshelves_inventory.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(
    migration,
    /pagewise_book_id uuid references public\.books\(id\) on delete set null/i,
  );
  assert.match(
    migration,
    /alter table public\.inventory_items enable row level security/i,
  );
  assert.match(migration, /auth\.uid\(\) = user_id/i);
  assert.match(migration, /condition.*new.*like_new.*good.*fair.*poor/i);
  assert.match(
    migration,
    /due_date is null or lent_at is null or due_date >= lent_at/i,
  );
});

test("LitShelves import accepts quoted CSV and simple book lists", () => {
  const csv = parseInventoryImport(
    'title,author,publisher,location,shelf,quantity\n"Book, The","Author One",Press,Study,A,2',
  );
  assert.equal(csv.length, 1);
  assert.equal(csv[0].title, "Book, The");
  assert.equal(csv[0].quantity, 2);
  assert.equal(csv[0].shelf, "A");
  const list = parseInventoryImport("Piranesi — Susanna Clarke\n9780547928227");
  assert.equal(list.length, 2);
  assert.equal(list[0].author, "Susanna Clarke");
  assert.equal(list[1].isbn, "9780547928227");
});

test("Bengali metadata normalization and import quantities stay usable", () => {
  assert.equal(normalizeBookText("পথের পাঁচালী"), "পথের পাঁচালী");
  assert.equal(
    normalizeBookText("  বিভূতিভূষণ বন্দ্যোপাধ্যায়  "),
    normalizeBookText("বিভূতিভূষণ বন্দ্যোপাধ্যায়"),
  );
  assert.equal(
    parseBookList(
      "পথের পাঁচালী — বিভূতিভূষণ বন্দ্যোপাধ্যায়\nপথের পাঁচালী — বিভূতিভূষণ বন্দ্যোপাধ্যায়",
    ).length,
    1,
  );
  const rows = parseInventoryImport(
    "title,quantity\nInfinite,Infinity\nNegative,-3\nLarge,999999",
  );
  assert.deepEqual(
    rows.map((row) => row.quantity),
    [1, 1, 10_000],
  );
});

test("LitShelves CSV export preserves Bengali, commas, quotes, and lending", () => {
  const item = {
    id: "owned-1",
    title: "পথের পাঁচালী, প্রথম খণ্ড",
    author: 'বিভূতিভূষণ "মানিক" বন্দ্যোপাধ্যায়',
    tags: ["বাংলা", "উপন্যাস"],
    quantity: 1,
    is_lent: true,
    lent_to: "A friend",
  } as unknown as InventoryItem;
  const csv = inventoryToCsv([item]);
  assert.ok(csv.startsWith("\uFEFFtitle,author,isbn"));
  assert.match(csv, /"পথের পাঁচালী, প্রথম খণ্ড"/);
  assert.match(csv, /"বিভূতিভূষণ ""মানিক"" বন্দ্যোপাধ্যায়"/);
  assert.match(csv, /true,A friend/);
  assert.match(csv, /বাংলা; উপন্যাস/);
});

test("CSV exports neutralize spreadsheet formulas", () => {
  assert.equal(safeCsvCell("=1+1"), "'=1+1");
  assert.equal(safeCsvCell("  +SUM(1,2)"), '"\'  +SUM(1,2)"');
  const item = {
    title: "@malicious",
    author: "Safe author",
    tags: [],
  } as unknown as InventoryItem;
  assert.match(inventoryToCsv([item]), /\r\n'@malicious,Safe author/);
});

test("LitShelves backup RPC owns inventory rows and accepts legacy backups", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/0007_litshelves_backup_restore.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /when 'inventory_items' then array\['id'\]/i);
  assert.match(
    migration,
    /coalesce\(payload->'inventoryItems', '\[\]'::jsonb\)/i,
  );
  assert.match(
    migration,
    /delete from public\.inventory_items where user_id = auth\.uid\(\)/i,
  );
  assert.match(migration, /pagewise_book_id[\s\S]*outside this account/i);
});

test("unified search reuses ISBN matches and links owned copies", () => {
  const candidate: MetadataCandidate = {
    id: "candidate-1",
    title: "Test Book",
    authors: ["Test Author"],
    publicationYear: 2024,
    pageCount: 300,
    isbn: "978-0-000-00000-1",
    coverUrl: null,
    description: null,
    genres: ["Fiction"],
    language: "en",
    workKey: null,
    editionKey: null,
    providers: ["open_library"],
    score: 1,
  };
  const inventory = {
    ...candidateToInventoryInput(candidate, book.id),
    id: "inventory-1",
    user_id: "user-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  } as InventoryItem;
  assert.equal(findPagewiseMatch(candidate, [book])?.id, book.id);
  assert.equal(findInventoryMatch(candidate, [inventory])?.id, inventory.id);
  assert.equal(inventory.pagewise_book_id, book.id);
});
