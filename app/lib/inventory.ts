export const INVENTORY_CONDITIONS = [
  "new",
  "like_new",
  "good",
  "fair",
  "poor",
] as const;

export type InventoryCondition = (typeof INVENTORY_CONDITIONS)[number];

export type InventoryItem = {
  id: string;
  user_id: string;
  pagewise_book_id: string | null;
  title: string;
  author: string | null;
  isbn: string | null;
  publisher: string | null;
  publication_year: number | null;
  edition: string | null;
  language: string | null;
  genre: string | null;
  format: string | null;
  condition: InventoryCondition | null;
  location: string | null;
  shelf: string | null;
  quantity: number;
  acquisition_date: string | null;
  purchase_price: number | null;
  currency: string | null;
  is_lent: boolean;
  lent_to: string | null;
  lent_at: string | null;
  due_date: string | null;
  notes: string | null;
  cover_image_url: string | null;
  cover_storage_path: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type InventoryInput = Omit<
  InventoryItem,
  "id" | "user_id" | "created_at" | "updated_at"
>;

export const PREVIEW_INVENTORY: InventoryItem[] = [
  {
    id: "inventory-preview-1",
    user_id: "preview",
    pagewise_book_id: "preview-2",
    title: "Piranesi",
    author: "Susanna Clarke",
    isbn: "9781526622433",
    publisher: "Bloomsbury",
    publication_year: 2021,
    edition: "Paperback",
    language: "English",
    genre: "Fantasy",
    format: "Paperback",
    condition: "good",
    location: "Study",
    shelf: "Shelf A",
    quantity: 1,
    acquisition_date: "2025-11-04",
    purchase_price: null,
    currency: "BDT",
    is_lent: false,
    lent_to: null,
    lent_at: null,
    due_date: null,
    notes: null,
    cover_image_url: null,
    cover_storage_path: null,
    tags: ["personal"],
    created_at: "2025-11-04T00:00:00Z",
    updated_at: "2026-08-20T00:00:00Z",
  },
  {
    id: "inventory-preview-2",
    user_id: "preview",
    pagewise_book_id: null,
    title: "পথের পাঁচালী",
    author: "বিভূতিভূষণ বন্দ্যোপাধ্যায়",
    isbn: null,
    publisher: "সিগনেট প্রেস",
    publication_year: null,
    edition: "বাংলা সংস্করণ",
    language: "বাংলা",
    genre: "উপন্যাস",
    format: "Hardcover",
    condition: "fair",
    location: "Living room",
    shelf: "Bangla 1",
    quantity: 1,
    acquisition_date: null,
    purchase_price: null,
    currency: "BDT",
    is_lent: false,
    lent_to: null,
    lent_at: null,
    due_date: null,
    notes: "Family copy",
    cover_image_url: null,
    cover_storage_path: null,
    tags: ["বাংলা", "classic"],
    created_at: "2026-01-10T00:00:00Z",
    updated_at: "2026-08-18T00:00:00Z",
  },
  {
    id: "inventory-preview-3",
    user_id: "preview",
    pagewise_book_id: "preview-6",
    title: "The Left Hand of Darkness",
    author: "Ursula K. Le Guin",
    isbn: null,
    publisher: "Ace",
    publication_year: 2019,
    edition: null,
    language: "English",
    genre: "Science Fiction",
    format: "Paperback",
    condition: "like_new",
    location: "Study",
    shelf: "Shelf B",
    quantity: 1,
    acquisition_date: "2026-03-12",
    purchase_price: null,
    currency: "BDT",
    is_lent: true,
    lent_to: "A friend",
    lent_at: "2026-08-10",
    due_date: "2026-09-10",
    notes: null,
    cover_image_url: null,
    cover_storage_path: null,
    tags: ["personal"],
    created_at: "2026-03-12T00:00:00Z",
    updated_at: "2026-08-22T00:00:00Z",
  },
];
