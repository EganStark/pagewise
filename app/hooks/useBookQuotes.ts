"use client";
import { useCallback, useEffect, useState } from "react";
import type { BookQuote, QuoteInput } from "../lib/quotes";
import { supabase } from "../lib/supabase";

function previewQuotes(bookId: string): BookQuote[] {
  if (bookId !== "preview-2") return [];
  return [
    {
      id: "quote-preview-1",
      book_id: bookId,
      user_id: "preview",
      page_number: 67,
      quote_text:
        "The beauty of the House is immeasurable; its Kindness infinite.",
      note: "This captures the book's strange tenderness.",
      created_at: "2026-08-24T12:00:00Z",
      updated_at: "2026-08-24T12:00:00Z",
    },
  ];
}

export function useBookQuotes(
  bookId: string,
  userId: string | null,
  previewMode: boolean,
) {
  const [quotes, setQuotes] = useState<BookQuote[]>(() =>
    previewMode ? previewQuotes(bookId) : [],
  );
  const [loading, setLoading] = useState(!previewMode);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (previewMode || !supabase) return;
    const client = supabase;
    let active = true;
    void (async () => {
      const result = await client
        .from("quotes")
        .select("*")
        .eq("book_id", bookId)
        .order("page_number", { ascending: true, nullsFirst: false })
        .order("created_at");
      if (!active) return;
      setLoading(false);
      if (result.error) setError(result.error.message);
      else setQuotes((result.data ?? []) as BookQuote[]);
    })();
    return () => {
      active = false;
    };
  }, [bookId, previewMode]);
  const saveQuote = useCallback(
    async (input: QuoteInput, id?: string) => {
      setWorking(true);
      setError(null);
      const clean = {
        ...input,
        quote_text: input.quote_text.trim(),
        note: input.note?.trim() || null,
      };
      if (!clean.quote_text) {
        setWorking(false);
        return "Quote text is required.";
      }
      if (previewMode) {
        const now = new Date().toISOString();
        setQuotes((current) =>
          id
            ? current.map((quote) =>
                quote.id === id
                  ? { ...quote, ...clean, updated_at: now }
                  : quote,
              )
            : [
                ...current,
                {
                  id: crypto.randomUUID(),
                  book_id: bookId,
                  user_id: "preview",
                  ...clean,
                  created_at: now,
                  updated_at: now,
                },
              ],
        );
        setWorking(false);
        return null;
      }
      if (!supabase || !userId) {
        setWorking(false);
        return "Sign in is required.";
      }
      const result = id
        ? await supabase
            .from("quotes")
            .update(clean)
            .eq("id", id)
            .eq("book_id", bookId)
            .select()
            .single()
        : await supabase
            .from("quotes")
            .insert({ book_id: bookId, user_id: userId, ...clean })
            .select()
            .single();
      setWorking(false);
      if (result.error) return result.error.message;
      setQuotes((current) =>
        id
          ? current.map((quote) =>
              quote.id === id ? (result.data as BookQuote) : quote,
            )
          : [...current, result.data as BookQuote],
      );
      return null;
    },
    [bookId, previewMode, userId],
  );
  const deleteQuote = useCallback(
    async (id: string) => {
      setWorking(true);
      if (previewMode) {
        setQuotes((current) => current.filter((quote) => quote.id !== id));
        setWorking(false);
        return null;
      }
      if (!supabase) {
        setWorking(false);
        return "Supabase is not configured.";
      }
      const result = await supabase
        .from("quotes")
        .delete()
        .eq("id", id)
        .eq("book_id", bookId);
      setWorking(false);
      if (result.error) return result.error.message;
      setQuotes((current) => current.filter((quote) => quote.id !== id));
      return null;
    },
    [bookId, previewMode],
  );
  return { quotes, loading, working, error, saveQuote, deleteQuote };
}
