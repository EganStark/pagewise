"use client";

import { useCallback, useEffect, useState } from "react";
import type { Book } from "../lib/books";
import type { ReadingLog, ReadingLogInput } from "../lib/reading-logs";
import { pagesFromRange } from "../lib/reading-logs";
import { supabase } from "../lib/supabase";

const previewLogs: ReadingLog[] = [
  {
    id: "log-preview-1",
    book_id: "preview-1",
    attempt_id: "attempt-preview-1-1",
    user_id: "preview",
    log_date: "2026-08-25",
    start_page: 142,
    end_page: 174,
    pages_read: 32,
    note: "The chapter on love as a practice stayed with me.",
    created_at: "2026-08-25T20:00:00Z",
    updated_at: "2026-08-25T20:00:00Z",
  },
  {
    id: "log-preview-3",
    book_id: "preview-1",
    attempt_id: "attempt-preview-1-1",
    user_id: "preview",
    log_date: "2026-08-22",
    start_page: 111,
    end_page: 142,
    pages_read: 31,
    note: null,
    created_at: "2026-08-22T20:00:00Z",
    updated_at: "2026-08-22T20:00:00Z",
  },
  {
    id: "log-preview-2",
    book_id: "preview-2",
    attempt_id: "attempt-preview-2-1",
    user_id: "preview",
    log_date: "2026-08-24",
    start_page: 43,
    end_page: 69,
    pages_read: 26,
    note: null,
    created_at: "2026-08-24T20:00:00Z",
    updated_at: "2026-08-24T20:00:00Z",
  },
  {
    id: "log-preview-4",
    book_id: "preview-2",
    attempt_id: "attempt-preview-2-1",
    user_id: "preview",
    log_date: "2026-08-20",
    start_page: 19,
    end_page: 43,
    pages_read: 24,
    note: "The House keeps opening outward.",
    created_at: "2026-08-20T20:00:00Z",
    updated_at: "2026-08-20T20:00:00Z",
  },
];

export function useReadingLogs(
  books: Book[],
  previewMode: boolean,
  onBookChange: (id: string, changes: Partial<Book>) => void,
) {
  const [logs, setLogs] = useState<ReadingLog[]>(
    previewMode ? previewLogs : [],
  );
  const [loading, setLoading] = useState(!previewMode);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (previewMode || !supabase) return;
    const { data, error: queryError } = await supabase
      .from("reading_logs")
      .select("*")
      .order("log_date", { ascending: false })
      .order("created_at", { ascending: false });
    setLoading(false);
    if (queryError) {
      setError(queryError.message);
      return;
    }
    setError(null);
    setLogs((data ?? []) as ReadingLog[]);
  }, [previewMode]);

  useEffect(() => {
    if (previewMode || !supabase) return;
    let active = true;
    const client = supabase;
    void (async () => {
      const { data, error: queryError } = await client
        .from("reading_logs")
        .select("*")
        .order("log_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (!active) return;
      setLoading(false);
      if (queryError) setError(queryError.message);
      else setLogs((data ?? []) as ReadingLog[]);
    })();
    return () => {
      active = false;
    };
  }, [previewMode]);

  const saveLog = useCallback(
    async (input: ReadingLogInput, existingId?: string) => {
      setWorking(true);
      setError(null);
      const pagesRead = pagesFromRange(input.start_page, input.end_page);
      const book = books.find((candidate) => candidate.id === input.book_id);
      if (!book?.active_attempt_id) {
        setWorking(false);
        return "Start or resume this book before logging pages.";
      }
      if (pagesRead <= 0) {
        setWorking(false);
        return "End page must be greater than start page.";
      }
      if (
        book.total_pages &&
        input.end_page &&
        input.end_page > book.total_pages
      ) {
        setWorking(false);
        return `End page cannot exceed ${book.total_pages}.`;
      }
      if (previewMode) {
        const now = new Date().toISOString();
        const row: ReadingLog = {
          id: existingId ?? crypto.randomUUID(),
          attempt_id: book.active_attempt_id,
          user_id: "preview",
          pages_read: pagesRead,
          created_at: now,
          updated_at: now,
          ...input,
        };
        setLogs((current) =>
          existingId
            ? current.map((log) =>
                log.id === existingId
                  ? { ...log, ...row, created_at: log.created_at }
                  : log,
              )
            : [row, ...current],
        );
        if (input.end_page !== null && input.end_page > book.current_page)
          onBookChange(book.id, { current_page: input.end_page });
        setWorking(false);
        return null;
      }
      if (!supabase) {
        setWorking(false);
        return "Supabase is not configured.";
      }
      if (existingId) {
        const { error: updateError } = await supabase
          .from("reading_logs")
          .update({ ...input, pages_read: pagesRead })
          .eq("id", existingId);
        if (updateError) {
          setWorking(false);
          return updateError.message;
        }
        if (input.end_page !== null && input.end_page > book.current_page) {
          const { error: bookError } = await supabase
            .from("books")
            .update({ current_page: input.end_page })
            .eq("id", book.id);
          if (bookError) {
            setWorking(false);
            return bookError.message;
          }
          onBookChange(book.id, { current_page: input.end_page });
        }
      } else {
        const { error: rpcError } = await supabase.rpc("log_reading", {
          p_book_id: input.book_id,
          p_log_date: input.log_date,
          p_start_page: input.start_page,
          p_end_page: input.end_page,
          p_note: input.note,
        });
        if (rpcError) {
          setWorking(false);
          return rpcError.message;
        }
        if (input.end_page !== null && input.end_page > book.current_page)
          onBookChange(book.id, { current_page: input.end_page });
      }
      await refresh();
      setWorking(false);
      return null;
    },
    [books, onBookChange, previewMode, refresh],
  );

  const deleteLog = useCallback(
    async (id: string) => {
      setWorking(true);
      if (previewMode) {
        setLogs((current) => current.filter((log) => log.id !== id));
        setWorking(false);
        return null;
      }
      if (!supabase) {
        setWorking(false);
        return "Supabase is not configured.";
      }
      const { error: deleteError } = await supabase
        .from("reading_logs")
        .delete()
        .eq("id", id);
      setWorking(false);
      if (deleteError) return deleteError.message;
      setLogs((current) => current.filter((log) => log.id !== id));
      return null;
    },
    [previewMode],
  );

  return { logs, loading, working, error, saveLog, deleteLog };
}
