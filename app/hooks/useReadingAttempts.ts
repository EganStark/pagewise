"use client";

import { useCallback, useEffect, useState } from "react";
import type { Book, BookStatus } from "../lib/books";
import type { AttemptDetails, ReadingAttempt } from "../lib/reading-attempts";
import { todayLocalDate } from "../lib/reading-attempts";
import { supabase } from "../lib/supabase";

type UseReadingAttemptsOptions = {
  book: Book;
  previewMode: boolean;
  onBookChange: (changes: Partial<Book>) => void;
};

function previewAttemptFor(book: Book): ReadingAttempt[] {
  if (book.status === "want_to_read") return [];
  const completed = book.status === "completed";
  return [
    {
      id: `attempt-${book.id}-1`,
      book_id: book.id,
      user_id: "preview",
      attempt_number: 1,
      started_at: "2026-08-14",
      completed_at: completed ? "2026-08-24" : null,
      rating_numeric: completed ? 4.5 : null,
      rating_tag: completed ? "Excellent" : null,
      review: null,
      created_at: "2026-08-14T00:00:00.000Z",
      updated_at: "2026-08-24T00:00:00.000Z",
    },
  ];
}

export function useReadingAttempts({
  book,
  previewMode,
  onBookChange,
}: UseReadingAttemptsOptions) {
  const [attempts, setAttempts] = useState<ReadingAttempt[]>(() =>
    previewMode ? previewAttemptFor(book) : [],
  );
  const [loading, setLoading] = useState(!previewMode);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (previewMode || !supabase) return;
    const { data, error: queryError } = await supabase
      .from("reading_attempts")
      .select("*")
      .eq("book_id", book.id)
      .order("attempt_number", { ascending: false });
    setLoading(false);
    if (queryError) {
      setError(queryError.message);
      return;
    }
    setError(null);
    setAttempts((data ?? []) as ReadingAttempt[]);
  }, [book.id, previewMode]);

  useEffect(() => {
    if (previewMode || !supabase) return;
    let active = true;
    const client = supabase;
    const load = async () => {
      const { data, error: queryError } = await client
        .from("reading_attempts")
        .select("*")
        .eq("book_id", book.id)
        .order("attempt_number", { ascending: false });
      if (!active) return;
      setLoading(false);
      if (queryError) {
        setError(queryError.message);
        return;
      }
      setAttempts((data ?? []) as ReadingAttempt[]);
    };
    void load();
    return () => {
      active = false;
    };
  }, [book.id, previewMode]);

  const startOrResume = useCallback(async () => {
    setWorking(true);
    setError(null);
    if (previewMode) {
      const activeAttempt = attempts.find((attempt) => !attempt.completed_at);
      if (!activeAttempt) {
        const nextNumber =
          Math.max(0, ...attempts.map((attempt) => attempt.attempt_number)) + 1;
        const now = new Date().toISOString();
        const attemptId = crypto.randomUUID();
        setAttempts((current) => [
          {
            id: attemptId,
            book_id: book.id,
            user_id: "preview",
            attempt_number: nextNumber,
            started_at: todayLocalDate(),
            completed_at: null,
            rating_numeric: null,
            rating_tag: null,
            review: null,
            created_at: now,
            updated_at: now,
          },
          ...current,
        ]);
        onBookChange({
          status: "reading",
          current_page: 0,
          active_attempt_id: attemptId,
        });
      } else
        onBookChange({
          status: "reading",
          active_attempt_id: activeAttempt.id,
        });
      setWorking(false);
      return true;
    }
    if (!supabase) {
      setError("Supabase is not configured.");
      setWorking(false);
      return false;
    }
    const { data: attemptId, error: rpcError } = await supabase.rpc(
      "start_reading_attempt",
      { p_book_id: book.id, p_started_at: todayLocalDate() },
    );
    setWorking(false);
    if (rpcError) {
      setError(rpcError.message);
      return false;
    }
    onBookChange({
      status: "reading",
      active_attempt_id: attemptId as string,
      ...(book.active_attempt_id ? {} : { current_page: 0 }),
    });
    await refresh();
    return true;
  }, [
    attempts,
    book.active_attempt_id,
    book.id,
    onBookChange,
    previewMode,
    refresh,
  ]);

  const pauseOrDrop = useCallback(
    async (status: Extract<BookStatus, "on_hold" | "dropped">) => {
      setWorking(true);
      setError(null);
      if (previewMode) {
        onBookChange({ status });
        setWorking(false);
        return true;
      }
      if (!supabase) {
        setError("Supabase is not configured.");
        setWorking(false);
        return false;
      }
      const { error: rpcError } = await supabase.rpc("pause_reading_attempt", {
        p_book_id: book.id,
        p_status: status,
      });
      setWorking(false);
      if (rpcError) {
        setError(rpcError.message);
        return false;
      }
      onBookChange({ status });
      return true;
    },
    [book.id, onBookChange, previewMode],
  );

  const finish = useCallback(
    async (details: AttemptDetails) => {
      setWorking(true);
      setError(null);
      const completedAt = details.completed_at ?? todayLocalDate();
      if (previewMode) {
        let nextAttempts = attempts;
        const activeAttempt = attempts.find((attempt) => !attempt.completed_at);
        if (activeAttempt)
          nextAttempts = attempts.map((attempt) =>
            attempt.id === activeAttempt.id
              ? { ...attempt, ...details, completed_at: completedAt }
              : attempt,
          );
        else {
          const now = new Date().toISOString();
          const nextNumber =
            Math.max(0, ...attempts.map((attempt) => attempt.attempt_number)) +
            1;
          nextAttempts = [
            {
              id: crypto.randomUUID(),
              book_id: book.id,
              user_id: "preview",
              attempt_number: nextNumber,
              started_at: details.started_at ?? completedAt,
              completed_at: completedAt,
              rating_numeric: details.rating_numeric,
              rating_tag: details.rating_tag,
              review: details.review,
              created_at: now,
              updated_at: now,
            },
            ...attempts,
          ];
        }
        setAttempts(nextAttempts);
        onBookChange({
          status: "completed",
          active_attempt_id: null,
          ...(book.total_pages ? { current_page: book.total_pages } : {}),
        });
        setWorking(false);
        return true;
      }
      if (!supabase) {
        setError("Supabase is not configured.");
        setWorking(false);
        return false;
      }
      const { error: rpcError } = await supabase.rpc("finish_reading_attempt", {
        p_book_id: book.id,
        p_started_at: details.started_at,
        p_completed_at: completedAt,
        p_rating_numeric: details.rating_numeric,
        p_rating_tag: details.rating_tag,
        p_review: details.review,
      });
      setWorking(false);
      if (rpcError) {
        setError(rpcError.message);
        return false;
      }
      onBookChange({
        status: "completed",
        active_attempt_id: null,
        ...(book.total_pages ? { current_page: book.total_pages } : {}),
      });
      await refresh();
      return true;
    },
    [attempts, book.id, book.total_pages, onBookChange, previewMode, refresh],
  );

  const updateAttempt = useCallback(
    async (attemptId: string, details: AttemptDetails) => {
      setWorking(true);
      setError(null);
      if (previewMode) {
        setAttempts((current) =>
          current.map((attempt) =>
            attempt.id === attemptId
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
      const { data, error: updateError } = await supabase
        .from("reading_attempts")
        .update(details)
        .eq("id", attemptId)
        .eq("book_id", book.id)
        .select()
        .single();
      setWorking(false);
      if (updateError) {
        setError(updateError.message);
        return false;
      }
      setAttempts((current) =>
        current.map((attempt) =>
          attempt.id === attemptId ? (data as ReadingAttempt) : attempt,
        ),
      );
      return true;
    },
    [book.id, previewMode],
  );

  return {
    attempts,
    loading,
    working,
    error,
    startOrResume,
    pauseOrDrop,
    finish,
    updateAttempt,
    refresh,
  };
}
