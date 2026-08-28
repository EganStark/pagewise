export type ReadingLog = {
  id: string;
  book_id: string;
  attempt_id: string | null;
  user_id: string;
  log_date: string;
  start_page: number | null;
  end_page: number | null;
  pages_read: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type ReadingLogInput = Pick<
  ReadingLog,
  "book_id" | "log_date" | "start_page" | "end_page" | "note"
>;

export function pagesFromRange(
  startPage: number | null,
  endPage: number | null,
) {
  return startPage === null || endPage === null
    ? 0
    : Math.max(0, endPage - startPage);
}
