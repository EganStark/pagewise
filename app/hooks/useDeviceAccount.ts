"use client";

import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { uploadDeviceLibrary } from "../lib/device-sync";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

export function useDeviceAccount(enabled: boolean) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(enabled && isSupabaseConfigured);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
    setMessage("Account connected. Your phone library has not been uploaded yet.");
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
      setMessage("Account disconnected. Local data remains on this phone.");
    }
  }, []);

  const upload = useCallback(async () => {
    if (!session?.user.id) return "Connect an account first.";
    setWorking(true);
    setError(null);
    try {
      const count = await uploadDeviceLibrary(session.user.id);
      setMessage(`${count} local records merged into your cloud account.`);
      return null;
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "Cloud upload failed.";
      setError(text);
      return text;
    } finally {
      setWorking(false);
    }
  }, [session]);

  return {
    configured: isSupabaseConfigured,
    session,
    email: session?.user.email ?? null,
    loading,
    working,
    error,
    message,
    signIn,
    signOut,
    upload,
  };
}
