"use client";

import { useCallback, useEffect, useState } from "react";
import type { Book, BookInput } from "../lib/books";
import { PREVIEW_BOOKS } from "../lib/books";
import { compressCoverImage } from "../lib/cover-images";
import { supabase } from "../lib/supabase";
import { todayLocalDate } from "../lib/reading-attempts";

export function useBooks(userId: string | null, previewMode: boolean) {
  const [books, setBooks] = useState<Book[]>(previewMode ? PREVIEW_BOOKS : []);
  const [loading, setLoading] = useState(!previewMode);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (previewMode) {
      setBooks((current) => (current.length ? current : PREVIEW_BOOKS));
      setLoading(false);
      return;
    }
    if (!supabase || !userId) return;

    setLoading(true);
    const { data, error: queryError } = await supabase
      .from("books")
      .select("*")
      .order("updated_at", { ascending: false });
    setLoading(false);
    if (queryError) {
      setError(queryError.message);
      return;
    }
    setError(null);
    setBooks((data ?? []) as Book[]);
  }, [previewMode, userId]);

  useEffect(() => {
    if (previewMode || !supabase || !userId) return;
    const client = supabase;
    let active = true;
    const load = async () => {
      const { data, error: queryError } = await client
        .from("books")
        .select("*")
        .order("updated_at", { ascending: false });
      if (!active) return;
      setLoading(false);
      if (queryError) {
        setError(queryError.message);
        return;
      }
      setError(null);
      setBooks((data ?? []) as Book[]);
    };
    void load();
    return () => {
      active = false;
    };
  }, [previewMode, userId]);

  const addBook = useCallback(
    async (input: BookInput) => {
      if (previewMode) {
        const now = new Date().toISOString();
        const previewBook: Book = {
          id: crypto.randomUUID(),
          user_id: "preview",
          author: null,
          cover_image_url: null,
          cover_storage_path: null,
          cover_source: "placeholder",
          open_library_work_key: null,
          open_library_edition_key: null,
          genre: null,
          total_pages: null,
          publication_year: null,
          description: null,
          isbn: null,
          is_favorite: false,
          current_page: 0,
          active_attempt_id: null,
          tags: [],
          created_at: now,
          updated_at: now,
          ...input,
        };
        setBooks((current) => [previewBook, ...current]);
        return { data: previewBook, error: null };
      }
      if (!supabase || !userId)
        return { data: null, error: "Sign in is required." };
      const desiredStatus = input.status;
      const { data, error: insertError } = await supabase
        .from("books")
        .insert({ ...input, status: "want_to_read", user_id: userId })
        .select()
        .single();
      if (insertError) return { data: null, error: insertError.message };
      if (desiredStatus !== "want_to_read") {
        const localToday = todayLocalDate();
        const { error: startError } = await supabase.rpc(
          "start_reading_attempt",
          {
            p_book_id: data.id,
            p_started_at: localToday,
          },
        );
        let lifecycleError = startError;
        if (!lifecycleError && desiredStatus === "completed") {
          const result = await supabase.rpc("finish_reading_attempt", {
            p_book_id: data.id,
            p_completed_at: localToday,
          });
          lifecycleError = result.error;
        } else if (
          !lifecycleError &&
          (desiredStatus === "on_hold" || desiredStatus === "dropped")
        ) {
          const result = await supabase.rpc("pause_reading_attempt", {
            p_book_id: data.id,
            p_status: desiredStatus,
          });
          lifecycleError = result.error;
        }
        if (lifecycleError) {
          await supabase.from("books").delete().eq("id", data.id);
          return { data: null, error: lifecycleError.message };
        }
      }
      const { data: finalData, error: finalError } = await supabase
        .from("books")
        .select("*")
        .eq("id", data.id)
        .single();
      if (finalError) return { data: null, error: finalError.message };
      setBooks((current) => [finalData as Book, ...current]);
      return { data: finalData as Book, error: null };
    },
    [previewMode, userId],
  );

  const updateBook = useCallback(
    async (id: string, changes: Partial<Book>) => {
      if (previewMode) {
        setBooks((current) =>
          current.map((book) =>
            book.id === id
              ? { ...book, ...changes, updated_at: new Date().toISOString() }
              : book,
          ),
        );
        return null;
      }
      if (!supabase) return "Supabase is not configured.";
      const { error: updateError } = await supabase
        .from("books")
        .update(changes)
        .eq("id", id);
      if (updateError) return updateError.message;
      setBooks((current) =>
        current.map((book) =>
          book.id === id ? { ...book, ...changes } : book,
        ),
      );
      return null;
    },
    [previewMode],
  );

  const patchBookLocal = useCallback((id: string, changes: Partial<Book>) => {
    setBooks((current) =>
      current.map((book) =>
        book.id === id
          ? { ...book, ...changes, updated_at: new Date().toISOString() }
          : book,
      ),
    );
  }, []);

  const deleteBook = useCallback(
    async (id: string) => {
      if (previewMode) {
        setBooks((current) => {
          const deleted = current.find((book) => book.id === id);
          if (deleted?.cover_image_url?.startsWith("blob:"))
            URL.revokeObjectURL(deleted.cover_image_url);
          return current.filter((book) => book.id !== id);
        });
        return null;
      }
      if (!supabase) return "Supabase is not configured.";
      const book = books.find((candidate) => candidate.id === id);
      const { error: deleteError } = await supabase
        .from("books")
        .delete()
        .eq("id", id);
      if (deleteError) return deleteError.message;
      if (book?.cover_storage_path)
        await supabase.storage
          .from("book-covers")
          .remove([book.cover_storage_path]);
      setBooks((current) => current.filter((book) => book.id !== id));
      return null;
    },
    [books, previewMode],
  );

  const uploadCover = useCallback(
    async (file: File) => {
      try {
        const compressed = await compressCoverImage(file);
        if (previewMode)
          return {
            url: URL.createObjectURL(compressed),
            path: null,
            error: null,
          };
        if (!supabase || !userId)
          return {
            url: null,
            path: null,
            error: "Sign in is required to upload a cover.",
          };
        const path = `${userId}/${crypto.randomUUID()}.webp`;
        const { error: uploadError } = await supabase.storage
          .from("book-covers")
          .upload(path, compressed, {
            contentType: "image/webp",
            upsert: false,
          });
        if (uploadError)
          return { url: null, path: null, error: uploadError.message };
        const { data } = supabase.storage
          .from("book-covers")
          .getPublicUrl(path);
        return { url: data.publicUrl, path, error: null };
      } catch (uploadError) {
        return {
          url: null,
          path: null,
          error:
            uploadError instanceof Error
              ? uploadError.message
              : "Cover upload failed.",
        };
      }
    },
    [previewMode, userId],
  );

  const discardUploadedCover = useCallback(
    async (path: string | null, url?: string | null) => {
      if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
      if (!previewMode && path && supabase)
        await supabase.storage.from("book-covers").remove([path]);
    },
    [previewMode],
  );

  const replaceCover = useCallback(
    async (book: Book, file: File) => {
      const uploaded = await uploadCover(file);
      if (uploaded.error || !uploaded.url)
        return uploaded.error ?? "Cover upload failed.";
      const previousPath = book.cover_storage_path;
      const previousUrl = book.cover_image_url;
      const updateError = await updateBook(book.id, {
        cover_image_url: uploaded.url,
        cover_storage_path: uploaded.path,
        cover_source: "upload",
      });
      if (updateError) {
        await discardUploadedCover(uploaded.path, uploaded.url);
        return updateError;
      }
      await discardUploadedCover(previousPath, previousUrl);
      return null;
    },
    [discardUploadedCover, updateBook, uploadCover],
  );

  const removeCover = useCallback(
    async (book: Book) => {
      const updateError = await updateBook(book.id, {
        cover_image_url: null,
        cover_storage_path: null,
        cover_source: "placeholder",
      });
      if (updateError) return updateError;
      await discardUploadedCover(book.cover_storage_path, book.cover_image_url);
      return null;
    },
    [discardUploadedCover, updateBook],
  );

  return {
    books,
    loading,
    error,
    addBook,
    updateBook,
    patchBookLocal,
    deleteBook,
    uploadCover,
    discardUploadedCover,
    replaceCover,
    removeCover,
    refresh,
  };
}
