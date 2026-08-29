"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type ThemePreference = "dark" | "light" | "system";
export type PersonalProfile = {
  displayName: string;
  birthYear: number | null;
  bio: string;
  avatarPath: string | null;
  avatarUrl: string | null;
};
type Settings = { theme: ThemePreference; timezone: string } & PersonalProfile;
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
    displayName: "",
    birthYear: null,
    bio: "",
    avatarPath: null,
    avatarUrl: null,
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
          .select("theme,timezone,display_name,birth_year,bio,avatar_path")
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
        const row = settingsResult.data!;
        let avatarUrl: string | null = null;
        if (row.avatar_path) {
          const signed = await client.storage
            .from("profile-images")
            .createSignedUrl(row.avatar_path, 60 * 60);
          avatarUrl = signed.data?.signedUrl ?? null;
        }
        if (!active) return;
        setSettings({
          theme: row.theme,
          timezone: row.timezone,
          displayName: row.display_name ?? "",
          birthYear: row.birth_year ?? null,
          bio: row.bio ?? "",
          avatarPath: row.avatar_path ?? null,
          avatarUrl,
        });
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
  const savePersonalProfile = useCallback(
    async (displayName: string, birthYear: number | null, bio: string) => {
      const cleanName = displayName.trim();
      const cleanBio = bio.trim();
      const currentYear = new Date().getFullYear();
      if (!cleanName) return "Display name is required.";
      if (cleanName.length > 80) return "Display name must be 80 characters or less.";
      if (cleanBio.length > 280) return "About me must be 280 characters or less.";
      if (birthYear !== null && (birthYear < 1900 || birthYear > currentYear))
        return `Birth year must be between 1900 and ${currentYear}.`;
      setWorking(true);
      setError(null);
      if (previewMode) {
        setSettings((current) => ({ ...current, displayName: cleanName, birthYear, bio: cleanBio }));
        setWorking(false);
        return null;
      }
      if (!supabase || !userId) {
        setWorking(false);
        return "Sign in is required.";
      }
      const result = await supabase
        .from("user_settings")
        .update({ display_name: cleanName, birth_year: birthYear, bio: cleanBio })
        .eq("user_id", userId);
      setWorking(false);
      if (result.error) return result.error.message;
      setSettings((current) => ({ ...current, displayName: cleanName, birthYear, bio: cleanBio }));
      return null;
    },
    [previewMode, userId],
  );
  const uploadAvatar = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return "Choose an image file.";
      if (file.size > 5 * 1024 * 1024) return "Profile photos must be 5 MB or smaller.";
      if (previewMode) {
        setSettings((current) => ({ ...current, avatarUrl: URL.createObjectURL(file) }));
        return null;
      }
      if (!supabase || !userId) return "Sign in is required.";
      setWorking(true);
      const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${userId}/avatar-${Date.now()}.${extension}`;
      const upload = await supabase.storage.from("profile-images").upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
      });
      if (upload.error) {
        setWorking(false);
        return upload.error.message;
      }
      const previousPath = settings.avatarPath;
      const saved = await supabase
        .from("user_settings")
        .update({ avatar_path: path })
        .eq("user_id", userId);
      if (saved.error) {
        await supabase.storage.from("profile-images").remove([path]);
        setWorking(false);
        return saved.error.message;
      }
      const signed = await supabase.storage.from("profile-images").createSignedUrl(path, 60 * 60);
      if (previousPath) await supabase.storage.from("profile-images").remove([previousPath]);
      setSettings((current) => ({ ...current, avatarPath: path, avatarUrl: signed.data?.signedUrl ?? null }));
      setWorking(false);
      return signed.error?.message ?? null;
    },
    [previewMode, settings.avatarPath, userId],
  );
  const removeAvatar = useCallback(async () => {
    if (previewMode) {
      setSettings((current) => ({ ...current, avatarPath: null, avatarUrl: null }));
      return null;
    }
    if (!supabase || !userId) return "Sign in is required.";
    setWorking(true);
    const path = settings.avatarPath;
    const result = await supabase.from("user_settings").update({ avatar_path: null }).eq("user_id", userId);
    if (!result.error && path) await supabase.storage.from("profile-images").remove([path]);
    setWorking(false);
    if (result.error) return result.error.message;
    setSettings((current) => ({ ...current, avatarPath: null, avatarUrl: null }));
    return null;
  }, [previewMode, settings.avatarPath, userId]);
  return {
    ...settings,
    goalTarget,
    loading,
    working,
    error,
    saveTheme,
    saveProfile,
    savePersonalProfile,
    uploadAvatar,
    removeAvatar,
  };
}
