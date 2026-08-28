export type BookQuote = {
  id: string;
  book_id: string;
  user_id: string;
  page_number: number | null;
  quote_text: string;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type QuoteInput = Pick<BookQuote, "page_number" | "quote_text" | "note">;
