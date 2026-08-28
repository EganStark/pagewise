"use client";
import { useEffect, useState } from "react";
import type { ReadingAttempt } from "../lib/reading-attempts";
import { supabase } from "../lib/supabase";

export function useSearchReviews(previewMode: boolean) {
  const [reviews, setReviews] = useState<ReadingAttempt[]>(
    previewMode
      ? [
          {
            id: "search-review-1",
            book_id: "preview-3",
            user_id: "preview",
            attempt_number: 1,
            started_at: "2026-08-01",
            completed_at: "2026-08-20",
            rating_numeric: 5,
            rating_tag: "Excellent",
            review:
              "A quiet and devastating story about courage and complicity.",
            created_at: "2026-08-20",
            updated_at: "2026-08-20",
          },
        ]
      : [],
  );
  useEffect(() => {
    if (previewMode || !supabase) return;
    const client = supabase;
    let active = true;
    void (async () => {
      const result = await client
        .from("reading_attempts")
        .select("*")
        .not("review", "is", null)
        .order("updated_at", { ascending: false });
      if (active && !result.error)
        setReviews((result.data ?? []) as ReadingAttempt[]);
    })();
    return () => {
      active = false;
    };
  }, [previewMode]);
  return reviews;
}
