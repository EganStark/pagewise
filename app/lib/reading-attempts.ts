export type ReadingAttempt = {
  id: string;
  book_id: string;
  user_id: string;
  attempt_number: number;
  started_at: string | null;
  completed_at: string | null;
  rating_numeric: number | null;
  rating_tag: string | null;
  review: string | null;
  created_at: string;
  updated_at: string;
};

export type AttemptDetails = Pick<
  ReadingAttempt,
  "started_at" | "completed_at" | "rating_numeric" | "rating_tag" | "review"
>;

export function todayLocalDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}
