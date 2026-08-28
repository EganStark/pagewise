"use client";

import { useEffect, useState } from "react";
import {
  PREVIEW_INVENTORY,
  type InventoryInput,
  type InventoryItem,
} from "../lib/inventory";
import { supabase } from "../lib/supabase";

export function useInventory(userId: string | null, previewMode: boolean) {
  const [items, setItems] = useState<InventoryItem[]>(
    previewMode ? PREVIEW_INVENTORY : [],
  );
  const [loading, setLoading] = useState(!previewMode);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (previewMode || !supabase || !userId) return;
    const client = supabase;
    let active = true;
    const load = async () => {
      const { data, error: queryError } = await client
        .from("inventory_items")
        .select("*")
        .order("updated_at", { ascending: false });
      if (!active) return;
      setLoading(false);
      if (queryError) {
        setError(queryError.message);
        return;
      }
      setError(null);
      setItems((data ?? []) as InventoryItem[]);
    };
    void load();
    return () => {
      active = false;
    };
  }, [previewMode, userId]);

  async function addItem(input: InventoryInput) {
    if (previewMode) {
      const now = new Date().toISOString();
      const item: InventoryItem = {
        ...input,
        id: crypto.randomUUID(),
        user_id: "preview",
        created_at: now,
        updated_at: now,
      };
      setItems((current) => [item, ...current]);
      return { data: item, error: null };
    }
    if (!supabase || !userId)
      return { data: null, error: "Sign in is required." };
    const { data, error: insertError } = await supabase
      .from("inventory_items")
      .insert({ ...input, user_id: userId })
      .select()
      .single();
    if (insertError) return { data: null, error: insertError.message };
    const item = data as InventoryItem;
    setItems((current) => [item, ...current]);
    return { data: item, error: null };
  }

  async function updateItem(id: string, changes: Partial<InventoryItem>) {
    if (previewMode) {
      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, ...changes, updated_at: new Date().toISOString() }
            : item,
        ),
      );
      return null;
    }
    if (!supabase) return "Supabase is not configured.";
    const { error: updateError } = await supabase
      .from("inventory_items")
      .update(changes)
      .eq("id", id);
    if (updateError) return updateError.message;
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
    return null;
  }

  async function deleteItem(id: string) {
    const item = items.find((candidate) => candidate.id === id);
    if (previewMode) {
      setItems((current) => current.filter((candidate) => candidate.id !== id));
      if (item?.cover_image_url?.startsWith("blob:"))
        URL.revokeObjectURL(item.cover_image_url);
      return null;
    }
    if (!supabase) return "Supabase is not configured.";
    const { error: deleteError } = await supabase
      .from("inventory_items")
      .delete()
      .eq("id", id);
    if (deleteError) return deleteError.message;
    if (item?.cover_storage_path)
      await supabase.storage
        .from("book-covers")
        .remove([item.cover_storage_path]);
    setItems((current) => current.filter((candidate) => candidate.id !== id));
    return null;
  }

  return { items, loading, error, addItem, updateItem, deleteItem };
}
