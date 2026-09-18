"use client";

import type { Session } from "@supabase/supabase-js";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEVICE_CHANGE_EVENT } from "../lib/device-outbox";
import { getDeviceSyncState, synchronizeDeviceLibrary, uploadDeviceLibrary } from "../lib/device-sync";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

const ANDROID_AUTH_CALLBACK = "com.eganstark.pagewise://auth/callback";

export function useDeviceAccount(enabled: boolean) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(enabled && isSupabaseConfigured);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [linked, setLinked] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const syncingRef = useRef(false);

  const refreshSyncState = useCallback(async (userId?: string) => {
    const state = await getDeviceSyncState();
    setLinked(Boolean(userId && state.linkedUserId === userId));
    setPendingCount(state.pendingCount);
    setLastSyncedAt(state.lastSyncedAt);
    return state;
  }, []);

  useEffect(() => {
    if (!enabled || !supabase) {
      return;
    }
    const client = supabase;
    let active = true;
    void client.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      setSession(data.session);
      setError(sessionError?.message ?? null);
      setLoading(false);
    });
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      if (active) setSession(next);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !supabase) return;
    const client = supabase;
    let active = true;
    let removeListener: (() => Promise<void>) | null = null;
    let removeBrowserListener: (() => Promise<void>) | null = null;
    const handleAuthUrl = async (value?: string) => {
      if (!value?.startsWith(ANDROID_AUTH_CALLBACK)) return;
      const url = new URL(value);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
      const oauthError = url.searchParams.get("error_description") ?? hash.get("error_description");
      if (oauthError) {
        if (active) {
          setError(decodeURIComponent(oauthError.replaceAll("+", " ")));
          setWorking(false);
        }
        return;
      }
      const code = url.searchParams.get("code");
      if (!code) {
        if (active) {
          setError("Google sign-in returned without an authorization code.");
          setWorking(false);
        }
        return;
      }
      const result = await client.auth.exchangeCodeForSession(code);
      await Browser.close().catch(() => undefined);
      if (!active) return;
      setWorking(false);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setSession(result.data.session);
      const state = await refreshSyncState(result.data.session.user.id);
      setMessage(state.linkedUserId === result.data.session.user.id
        ? "Google account connected. Automatic sync is active."
        : "Google account connected. Confirm the first cloud merge to enable sync.");
    };
    void App.addListener("appUrlOpen", ({ url }) => void handleAuthUrl(url)).then((handle) => {
      if (active) removeListener = () => handle.remove();
      else void handle.remove();
    });
    void Browser.addListener("browserFinished", () => {
      if (active) setWorking(false);
    }).then((handle) => {
      if (active) removeBrowserListener = () => handle.remove();
      else void handle.remove();
    });
    void App.getLaunchUrl().then((launch) => void handleAuthUrl(launch?.url));
    return () => {
      active = false;
      if (removeListener) void removeListener();
      if (removeBrowserListener) void removeBrowserListener();
    };
  }, [enabled, refreshSyncState]);

  const sync = useCallback(async (quiet = false) => {
    if (!session?.user.id || syncingRef.current) return null;
    const state = await refreshSyncState(session.user.id);
    if (state.linkedUserId !== session.user.id) return null;
    syncingRef.current = true;
    setWorking(true);
    if (!quiet) { setError(null); setMessage(null); }
    try {
      const result = await synchronizeDeviceLibrary(session.user.id);
      setPendingCount(result.pendingCount);
      setLastSyncedAt(result.syncedAt);
      if (!quiet) setMessage(result.pushed ? `${result.pushed} pending changes synced.` : "Your phone and cloud library are up to date.");
      return null;
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "Cloud sync failed.";
      setError(text);
      return text;
    } finally {
      syncingRef.current = false;
      setWorking(false);
    }
  }, [refreshSyncState, session]);

  useEffect(() => {
    if (!enabled || !session?.user.id) return;
    const userId = session.user.id;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const requestSync = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void sync(true), 1200);
    };
    timer = setTimeout(() => {
      void refreshSyncState(userId).then((state) => {
        if (state.linkedUserId === userId) requestSync();
      });
    }, 0);
    window.addEventListener("online", requestSync);
    window.addEventListener(DEVICE_CHANGE_EVENT, requestSync);
    const interval = window.setInterval(requestSync, 60_000);
    return () => {
      if (timer) clearTimeout(timer);
      window.clearInterval(interval);
      window.removeEventListener("online", requestSync);
      window.removeEventListener(DEVICE_CHANGE_EVENT, requestSync);
    };
  }, [enabled, refreshSyncState, session?.user.id, sync]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return "Cloud accounts are not configured in this build.";
    setWorking(true);
    setError(null);
    setMessage(null);
    const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setWorking(false);
    if (result.error) {
      setError(result.error.message);
      return result.error.message;
    }
    setSession(result.data.session);
    await refreshSyncState(result.data.session?.user.id);
    setMessage("Account connected. Your phone library has not been uploaded yet.");
    return null;
  }, [refreshSyncState]);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return "Cloud accounts are not configured in this build.";
    setWorking(true);
    setError(null);
    setMessage(null);
    const result = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: ANDROID_AUTH_CALLBACK, skipBrowserRedirect: true },
    });
    if (result.error || !result.data.url) {
      const text = result.error?.message ?? "Google sign-in could not be started.";
      setError(text);
      setWorking(false);
      return text;
    }
    await Browser.open({ url: result.data.url, presentationStyle: "fullscreen", toolbarColor: "#1c1917" });
    return null;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    setWorking(true);
    const result = await supabase.auth.signOut();
    setWorking(false);
    if (result.error) setError(result.error.message);
    else {
      setSession(null);
      setLinked(false);
      setMessage("Account disconnected. Local data remains on this phone.");
    }
  }, []);

  const upload = useCallback(async () => {
    if (!session?.user.id) return "Connect an account first.";
    setWorking(true);
    setError(null);
    try {
      const count = await uploadDeviceLibrary(session.user.id);
      await refreshSyncState(session.user.id);
      setLinked(true);
      setMessage(`${count} local records merged. Automatic sync is now on.`);
      return null;
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "Cloud upload failed.";
      setError(text);
      return text;
    } finally {
      setWorking(false);
    }
  }, [refreshSyncState, session]);

  return {
    configured: isSupabaseConfigured,
    session,
    email: session?.user.email ?? null,
    loading,
    working,
    error,
    message,
    linked,
    pendingCount,
    lastSyncedAt,
    signIn,
    signInWithGoogle,
    signOut,
    upload,
    sync,
  };
}
