"use client";
import { useCallback, useEffect, useState } from "react";
import type { AttemptDetails, ReadingAttempt } from "../lib/reading-attempts";
import { todayLocalDate } from "../lib/reading-attempts";
import type { Book } from "../lib/books";
import { supabase } from "../lib/supabase";

const previewAttempts: ReadingAttempt[] = [
  {
    id: "diary-preview-1",
    book_id: "preview-3",
    user_id: "preview",
    attempt_number: 1,
    started_at: "2026-08-12",
    completed_at: "2026-08-24",
    rating_numeric: 5,
    rating_tag: "Excellent",
    review: "A quiet and devastating story about courage and complicity.",
    created_at: "2026-08-24",
    updated_at: "2026-08-24",
  },
  {
    id: "diary-preview-2",
    book_id: "preview-4",
    user_id: "preview",
    attempt_number: 1,
    started_at: "2026-07-21",
    completed_at: "2026-08-16",
    rating_numeric: 4.5,
    rating_tag: "Very Good",
    review: null,
    created_at: "2026-08-16",
    updated_at: "2026-08-16",
  },
  {
    id: "diary-preview-3",
    book_id: "preview-5",
    user_id: "preview",
    attempt_number: 2,
    started_at: "2026-06-03",
    completed_at: "2026-07-02",
    rating_numeric: 4,
    rating_tag: "Very Good",
    review: "Even more unsettling on a second read.",
    created_at: "2026-07-02",
    updated_at: "2026-07-02",
  },
];

export function useCompletedAttempts(previewMode: boolean) {
  const [attempts, setAttempts] = useState<ReadingAttempt[]>(
    previewMode ? previewAttempts : [],
  );
  const [loading, setLoading] = useState(!previewMode);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (previewMode || !supabase) return;
    const result = await supabase
      .from("reading_attempts")
      .select("*")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false });
    setLoading(false);
    if (result.error) setError(result.error.message);
    else {
      setError(null);
      setAttempts((result.data ?? []) as ReadingAttempt[]);
    }
  }, [previewMode]);
  useEffect(() => {
    if (previewMode || !supabase) return;
    const client = supabase;
    let active = true;
    void (async () => {
      const result = await client
        .from("reading_attempts")
        .select("*")
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false });
      if (!active) return;
      setLoading(false);
      if (result.error) setError(result.error.message);
      else setAttempts((result.data ?? []) as ReadingAttempt[]);
    })();
    return () => {
      active = false;
    };
  }, [previewMode]);
  const updateAttempt = useCallback(
    async (id: string, details: AttemptDetails) => {
      setWorking(true);
      if (previewMode) {
        setAttempts((current) =>
          current.map((attempt) =>
            attempt.id === id
              ? { ...attempt, ...details, updated_at: new Date().toISOString() }
              : attempt,
          ),
        );
        setWorking(false);
        return true;
      }
      if (!supabase) {
        setError("Supabase is not configured.");
        setWorking(false);
        return false;
      }
      const result = await supabase
        .from("reading_attempts")
        .update(details)
        .eq("id", id)
        .select()
        .single();
      setWorking(false);
      if (result.error) {
        setError(result.error.message);
        return false;
      }
      setAttempts((current) =>
        current
          .map((attempt) =>
            attempt.id === id ? (result.data as ReadingAttempt) : attempt,
          )
          .filter((attempt) => attempt.completed_at),
      );
      return true;
    },
    [previewMode],
  );
  const recordAttempt = useCallback((attempt: ReadingAttempt) => {
    if (!attempt.completed_at) return;
    setAttempts((current) =>
      current.some((item) => item.id === attempt.id)
        ? current.map((item) => (item.id === attempt.id ? attempt : item))
        : [attempt, ...current],
    );
  }, []);
  const deleteAttempt = useCallback(
    async (id: string) => {
      setWorking(true);
      setError(null);
      if (previewMode) {
        setAttempts((current) =>
          current.filter((attempt) => attempt.id !== id),
        );
        setWorking(false);
        return true;
      }
      if (!supabase) {
        setError("Supabase is not configured.");
        setWorking(false);
        return false;
      }
      const result = await supabase
        .from("reading_attempts")
        .delete()
        .eq("id", id);
      setWorking(false);
      if (result.error) {
        setError(result.error.message);
        return false;
      }
      setAttempts((current) => current.filter((attempt) => attempt.id !== id));
      return true;
    },
    [previewMode],
  );
  const logFinishedBook = useCallback(
    async (book: Book, details: AttemptDetails) => {
      setWorking(true);
      setError(null);
      const completedAt = details.completed_at ?? todayLocalDate();
      if (previewMode) {
        const now = new Date().toISOString();
        const nextNumber =
          Math.max(
            0,
            ...attempts
              .filter((attempt) => attempt.book_id === book.id)
              .map((attempt) => attempt.attempt_number),
          ) + 1;
        setAttempts((current) => [
          {
            id: crypto.randomUUID(),
            book_id: book.id,
            user_id: book.user_id,
            attempt_number: nextNumber,
            started_at: details.started_at ?? completedAt,
            completed_at: completedAt,
            rating_numeric: details.rating_numeric,
            rating_tag: details.rating_tag,
            review: details.review,
            created_at: now,
            updated_at: now,
          },
          ...current,
        ]);
        setWorking(false);
        return true;
      }
      if (!supabase) {
        setError("Supabase is not configured.");
        setWorking(false);
        return false;
      }
      const result = await supabase.rpc("finish_reading_attempt", {
        p_book_id: book.id,
        p_started_at: details.started_at,
        p_completed_at: completedAt,
        p_rating_numeric: details.rating_numeric,
        p_rating_tag: details.rating_tag,
        p_review: details.review,
      });
      setWorking(false);
      if (result.error) {
        setError(result.error.message);
        return false;
      }
      await refresh();
      return true;
    },
    [attempts, previewMode, refresh],
  );
  return {
    attempts,
    loading,
    working,
    error,
    updateAttempt,
    refresh,
    recordAttempt,
    deleteAttempt,
    logFinishedBook,
  };
}
