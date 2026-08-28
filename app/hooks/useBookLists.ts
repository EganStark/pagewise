"use client";

import { useCallback, useEffect, useState } from "react";
import type { BookList, ListMembership } from "../lib/book-lists";
import { supabase } from "../lib/supabase";

const now = "2026-08-25T12:00:00Z";
const previewLists: BookList[] = [
  {
    id: "list-preview-1",
    user_id: "preview",
    title: "Quiet, Strange Worlds",
    description: "Dreamlike books that reward slow reading.",
    created_at: now,
    updated_at: now,
  },
  {
    id: "list-preview-2",
    user_id: "preview",
    title: "Books to Revisit",
    description: "Favorites worth another journey.",
    created_at: now,
    updated_at: now,
  },
];
const previewMemberships: ListMembership[] = [
  {
    list_id: "list-preview-1",
    book_id: "preview-2",
    user_id: "preview",
    position: 0,
    added_at: now,
  },
  {
    list_id: "list-preview-1",
    book_id: "preview-5",
    user_id: "preview",
    position: 1,
    added_at: now,
  },
  {
    list_id: "list-preview-2",
    book_id: "preview-3",
    user_id: "preview",
    position: 0,
    added_at: now,
  },
];

export function useBookLists(userId: string | null, previewMode: boolean) {
  const [lists, setLists] = useState<BookList[]>(
    previewMode ? previewLists : [],
  );
  const [memberships, setMemberships] = useState<ListMembership[]>(
    previewMode ? previewMemberships : [],
  );
  const [loading, setLoading] = useState(!previewMode);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (previewMode || !supabase || !userId) return;
    const [listResult, membershipResult] = await Promise.all([
      supabase
        .from("lists")
        .select("*")
        .order("updated_at", { ascending: false }),
      supabase.from("list_books").select("*").order("position"),
    ]);
    setLoading(false);
    const queryError = listResult.error ?? membershipResult.error;
    if (queryError) {
      setError(queryError.message);
      return;
    }
    setError(null);
    setLists((listResult.data ?? []) as BookList[]);
    setMemberships((membershipResult.data ?? []) as ListMembership[]);
  }, [previewMode, userId]);

  useEffect(() => {
    if (previewMode || !supabase || !userId) return;
    const client = supabase;
    let active = true;
    void (async () => {
      const [listResult, membershipResult] = await Promise.all([
        client
          .from("lists")
          .select("*")
          .order("updated_at", { ascending: false }),
        client.from("list_books").select("*").order("position"),
      ]);
      if (!active) return;
      setLoading(false);
      const queryError = listResult.error ?? membershipResult.error;
      if (queryError) setError(queryError.message);
      else {
        setLists((listResult.data ?? []) as BookList[]);
        setMemberships((membershipResult.data ?? []) as ListMembership[]);
      }
    })();
    return () => {
      active = false;
    };
  }, [previewMode, userId]);

  const createList = useCallback(
    async (title: string, description: string) => {
      setWorking(true);
      setError(null);
      if (previewMode) {
        const row: BookList = {
          id: crypto.randomUUID(),
          user_id: "preview",
          title: title.trim(),
          description: description.trim() || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setLists((current) => [row, ...current]);
        setWorking(false);
        return { id: row.id, error: null };
      }
      if (!supabase || !userId) {
        setWorking(false);
        return { id: null, error: "Sign in is required." };
      }
      const result = await supabase
        .from("lists")
        .insert({
          user_id: userId,
          title: title.trim(),
          description: description.trim() || null,
        })
        .select()
        .single();
      setWorking(false);
      if (result.error) return { id: null, error: result.error.message };
      setLists((current) => [result.data as BookList, ...current]);
      return { id: result.data.id as string, error: null };
    },
    [previewMode, userId],
  );

  const updateList = useCallback(
    async (id: string, title: string, description: string) => {
      setWorking(true);
      const changes = {
        title: title.trim(),
        description: description.trim() || null,
      };
      if (previewMode) {
        setLists((current) =>
          current.map((list) =>
            list.id === id ? { ...list, ...changes } : list,
          ),
        );
        setWorking(false);
        return null;
      }
      if (!supabase) {
        setWorking(false);
        return "Supabase is not configured.";
      }
      const result = await supabase.from("lists").update(changes).eq("id", id);
      setWorking(false);
      if (result.error) return result.error.message;
      setLists((current) =>
        current.map((list) =>
          list.id === id ? { ...list, ...changes } : list,
        ),
      );
      return null;
    },
    [previewMode],
  );

  const deleteList = useCallback(
    async (id: string) => {
      setWorking(true);
      if (previewMode) {
        setLists((current) => current.filter((list) => list.id !== id));
        setMemberships((current) =>
          current.filter((item) => item.list_id !== id),
        );
        setWorking(false);
        return null;
      }
      if (!supabase) {
        setWorking(false);
        return "Supabase is not configured.";
      }
      const result = await supabase.from("lists").delete().eq("id", id);
      setWorking(false);
      if (result.error) return result.error.message;
      setLists((current) => current.filter((list) => list.id !== id));
      setMemberships((current) =>
        current.filter((item) => item.list_id !== id),
      );
      return null;
    },
    [previewMode],
  );

  const setBookLists = useCallback(
    async (bookId: string, selectedIds: string[]) => {
      setWorking(true);
      const currentIds = memberships
        .filter((item) => item.book_id === bookId)
        .map((item) => item.list_id);
      const addIds = selectedIds.filter((id) => !currentIds.includes(id));
      const removeIds = currentIds.filter((id) => !selectedIds.includes(id));
      if (previewMode) {
        setMemberships((current) => [
          ...current.filter(
            (item) =>
              item.book_id !== bookId || !removeIds.includes(item.list_id),
          ),
          ...addIds.map((listId) => ({
            list_id: listId,
            book_id: bookId,
            user_id: "preview",
            position: current.filter((item) => item.list_id === listId).length,
            added_at: new Date().toISOString(),
          })),
        ]);
        setWorking(false);
        return null;
      }
      if (!supabase || !userId) {
        setWorking(false);
        return "Sign in is required.";
      }
      if (removeIds.length) {
        const removal = await supabase
          .from("list_books")
          .delete()
          .eq("book_id", bookId)
          .in("list_id", removeIds);
        if (removal.error) {
          setWorking(false);
          return removal.error.message;
        }
      }
      if (addIds.length) {
        const rows = addIds.map((listId) => ({
          list_id: listId,
          book_id: bookId,
          user_id: userId,
          position: memberships.filter((item) => item.list_id === listId)
            .length,
        }));
        const addition = await supabase.from("list_books").insert(rows);
        if (addition.error) {
          await refresh();
          setWorking(false);
          return addition.error.message;
        }
      }
      await refresh();
      setWorking(false);
      return null;
    },
    [memberships, previewMode, refresh, userId],
  );

  const moveBook = useCallback(
    async (listId: string, bookId: string, direction: -1 | 1) => {
      const ordered = memberships
        .filter((item) => item.list_id === listId)
        .sort((a, b) => a.position - b.position);
      const from = ordered.findIndex((item) => item.book_id === bookId);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= ordered.length) return null;
      [ordered[from], ordered[to]] = [ordered[to], ordered[from]];
      const next = ordered.map((item, position) => ({ ...item, position }));
      setMemberships((current) => [
        ...current.filter((item) => item.list_id !== listId),
        ...next,
      ]);
      if (previewMode) return null;
      if (!supabase) return "Supabase is not configured.";
      const results = await Promise.all(
        next.map((item) =>
          supabase!
            .from("list_books")
            .update({ position: item.position })
            .eq("list_id", listId)
            .eq("book_id", item.book_id),
        ),
      );
      const moveError = results.find((result) => result.error)?.error;
      if (moveError) {
        setMemberships(memberships);
        return moveError.message;
      }
      return null;
    },
    [memberships, previewMode],
  );

  return {
    lists,
    memberships,
    loading,
    working,
    error,
    createList,
    updateList,
    deleteList,
    setBookLists,
    moveBook,
  };
}
