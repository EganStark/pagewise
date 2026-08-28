"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type UserSettings = {
  streak_freeze_available: boolean;
  streak_freeze_last_reset: string | null;
};
export function useStreakFreeze(previewMode: boolean, userId: string | null) {
  const [settings, setSettings] = useState<UserSettings>({
    streak_freeze_available: true,
    streak_freeze_last_reset: "2026-08-01",
  });
  const [freezeDates, setFreezeDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(!previewMode);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (previewMode || !supabase || !userId) return;
    const client = supabase;
    let active = true;
    void (async () => {
      const maintenance = await client.rpc("maintain_streak_freeze");
      const [settingsResult, freezesResult] = await Promise.all([
        client
          .from("user_settings")
          .select("streak_freeze_available,streak_freeze_last_reset")
          .eq("user_id", userId)
          .single(),
        client
          .from("streak_freezes")
          .select("frozen_date")
          .order("frozen_date", { ascending: false }),
      ]);
      if (!active) return;
      setLoading(false);
      const queryError =
        maintenance.error ?? settingsResult.error ?? freezesResult.error;
      if (queryError) {
        setError(queryError.message);
        return;
      }
      setError(null);
      setSettings(settingsResult.data as UserSettings);
      setFreezeDates(
        (freezesResult.data ?? []).map((row) => row.frozen_date as string),
      );
    })();
    return () => {
      active = false;
    };
  }, [previewMode, userId]);
  return {
    available: settings.streak_freeze_available,
    lastReset: settings.streak_freeze_last_reset,
    freezeDates,
    loading,
    error,
  };
}
