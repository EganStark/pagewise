"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type ThemePreference = "dark" | "light" | "system";
type Settings = { theme: ThemePreference; timezone: string };
const isThemePreference = (value: string | null): value is ThemePreference =>
  value === "dark" || value === "light" || value === "system";
export function useProfileSettings(
  userId: string | null,
  previewMode: boolean,
  year: number,
) {
  const [settings, setSettings] = useState<Settings>({
    theme: "dark",
    timezone: "Asia/Dhaka",
  });
  const [goalTarget, setGoalTarget] = useState(30);
  const [loading, setLoading] = useState(!previewMode);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [themeInitialized, setThemeInitialized] = useState(false);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      let storedTheme: string | null = null;
      try {
        storedTheme = localStorage.getItem("pagewise-theme");
      } catch {
        // Keep the default theme when browser storage is unavailable.
      }
      if (isThemePreference(storedTheme)) {
        setSettings((current) => ({ ...current, theme: storedTheme }));
      }
      setThemeInitialized(true);
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (previewMode || !supabase || !userId) return;
    const client = supabase;
    let active = true;
    void (async () => {
      const [settingsResult, goalResult] = await Promise.all([
        client
          .from("user_settings")
          .select("theme,timezone")
          .eq("user_id", userId)
          .single(),
        client
          .from("reading_goals")
          .select("target_books")
          .eq("user_id", userId)
          .eq("year", year)
          .maybeSingle(),
      ]);
      if (!active) return;
      setLoading(false);
      const queryError = settingsResult.error ?? goalResult.error;
      if (queryError) setError(queryError.message);
      else {
        setSettings(settingsResult.data as Settings);
        setGoalTarget(goalResult.data?.target_books ?? 30);
      }
    })();
    return () => {
      active = false;
    };
  }, [previewMode, userId, year]);
  useEffect(() => {
    if (!themeInitialized) return;
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => {
      const resolved =
        settings.theme === "system"
          ? media.matches
            ? "light"
            : "dark"
          : settings.theme;
      root.dataset.theme = resolved;
      root.style.colorScheme = resolved;
    };
    apply();
    media.addEventListener("change", apply);
    try {
      localStorage.setItem("pagewise-theme", settings.theme);
    } catch {
      // Applying the theme still works for this session without persistence.
    }
    return () => media.removeEventListener("change", apply);
  }, [settings.theme, themeInitialized]);
  const saveTheme = useCallback(
    async (theme: ThemePreference) => {
      const previous = settings.theme;
      setSettings((current) => ({ ...current, theme }));
      if (previewMode) return null;
      if (!supabase || !userId) return "Sign in is required.";
      const result = await supabase
        .from("user_settings")
        .update({ theme })
        .eq("user_id", userId);
      if (result.error) {
        setSettings((current) => ({ ...current, theme: previous }));
        return result.error.message;
      }
      return null;
    },
    [previewMode, settings.theme, userId],
  );
  const saveProfile = useCallback(
    async (target: number, timezone: string) => {
      setWorking(true);
      setError(null);
      const cleanTimezone = timezone.trim();
      if (target < 1 || target > 500) {
        setWorking(false);
        return "Reading goal must be between 1 and 500 books.";
      }
      try {
        new Intl.DateTimeFormat(undefined, {
          timeZone: cleanTimezone,
        }).format();
      } catch {
        setWorking(false);
        return "Enter a valid timezone such as Asia/Dhaka.";
      }
      if (previewMode) {
        setGoalTarget(target);
        setSettings((current) => ({ ...current, timezone: cleanTimezone }));
        setWorking(false);
        return null;
      }
      if (!supabase || !userId) {
        setWorking(false);
        return "Sign in is required.";
      }
      const [settingsResult, goalResult] = await Promise.all([
        supabase
          .from("user_settings")
          .update({ timezone: cleanTimezone })
          .eq("user_id", userId),
        supabase
          .from("reading_goals")
          .upsert(
            { user_id: userId, year, target_books: target },
            { onConflict: "user_id,year" },
          ),
      ]);
      setWorking(false);
      const saveError = settingsResult.error ?? goalResult.error;
      if (saveError) return saveError.message;
      setGoalTarget(target);
      setSettings((current) => ({ ...current, timezone: cleanTimezone }));
      return null;
    },
    [previewMode, userId, year],
  );
  return {
    ...settings,
    goalTarget,
    loading,
    working,
    error,
    saveTheme,
    saveProfile,
  };
}
