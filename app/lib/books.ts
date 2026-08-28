export const BOOK_STATUSES = [
  "want_to_read",
  "reading",
  "completed",
  "on_hold",
  "dropped",
] as const;

export type BookStatus = (typeof BOOK_STATUSES)[number];

export type Book = {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  cover_image_url: string | null;
  cover_storage_path: string | null;
  cover_source: "upload" | "url" | "open_library" | "placeholder" | null;
  open_library_work_key: string | null;
  open_library_edition_key: string | null;
  genre: string | null;
  total_pages: number | null;
  publication_year: number | null;
  description: string | null;
  isbn: string | null;
  status: BookStatus;
  is_favorite: boolean;
  current_page: number;
  active_attempt_id: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type BookInput = Pick<Book, "title" | "status"> &
  Partial<
    Pick<
      Book,
      | "author"
      | "cover_image_url"
      | "cover_storage_path"
      | "cover_source"
      | "open_library_work_key"
      | "open_library_edition_key"
      | "genre"
      | "total_pages"
      | "publication_year"
      | "description"
      | "isbn"
      | "tags"
    >
  >;

export const STATUS_LABELS: Record<BookStatus, string> = {
  want_to_read: "Want to Read",
  reading: "Reading",
  completed: "Finished",
  on_hold: "On Hold",
  dropped: "Dropped",
};

const previewRows = [
  [
    "The Will to Change",
    "bell hooks",
    "Self-development",
    280,
    "reading",
    174,
    "ochre",
  ],
  ["Piranesi", "Susanna Clarke", "Fantasy", 245, "reading", 69, "blue"],
  [
    "Small Things Like These",
    "Claire Keegan",
    "Literary Fiction",
    128,
    "completed",
    128,
    "red",
  ],
  [
    "Sea of Tranquility",
    "Emily St. John Mandel",
    "Science Fiction",
    255,
    "completed",
    255,
    "navy",
  ],
  [
    "The Memory Police",
    "Yōko Ogawa",
    "Dystopian",
    288,
    "completed",
    288,
    "cream",
  ],
  [
    "The Left Hand of Darkness",
    "Ursula K. Le Guin",
    "Science Fiction",
    304,
    "want_to_read",
    0,
    "blue",
  ],
  [
    "The Book of Disquiet",
    "Fernando Pessoa",
    "Classics",
    544,
    "on_hold",
    112,
    "ochre",
  ],
  [
    "Braiding Sweetgrass",
    "Robin Wall Kimmerer",
    "Nature",
    408,
    "want_to_read",
    0,
    "green",
  ],
] as const;

export const PREVIEW_BOOKS: Book[] = previewRows.map(
  (row, index) =>
    ({
      id: `preview-${index + 1}`,
      user_id: "preview",
      title: row[0],
      author: row[1],
      genre: row[2],
      total_pages: row[3],
      status: row[4] as BookStatus,
      current_page: row[5],
      active_attempt_id:
        row[4] === "reading" || row[4] === "on_hold"
          ? `attempt-preview-${index + 1}-1`
          : null,
      cover_image_url: null,
      cover_storage_path: null,
      cover_source: "placeholder",
      open_library_work_key: null,
      open_library_edition_key: null,
      publication_year: 2018 + (index % 6),
      description: null,
      isbn: null,
      is_favorite: index === 1 || index === 4,
      tags: index % 2 ? ["thoughtful"] : ["literary"],
      created_at: new Date(2026, 7, 20 - index).toISOString(),
      updated_at: new Date(2026, 7, 25 - index).toISOString(),
      previewTone: row[6],
    }) as Book & { previewTone: string },
);
