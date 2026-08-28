"use client";

import type { Session, User } from "@supabase/supabase-js";
import {
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  Mail,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import PagewiseDashboard from "./PagewiseDashboard";

type AuthView = "loading" | "signed-out" | "email-sent" | "signed-in";

async function ensureUserSettings(user: User) {
  if (!supabase) return;

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const { error } = await supabase
    .from("user_settings")
    .upsert(
      { user_id: user.id, timezone },
      { onConflict: "user_id", ignoreDuplicates: true },
    );

  if (error)
    console.error("[auth] Could not initialize user settings", error.message);
}

export function AuthGate() {
  const [view, setView] = useState<AuthView>(
    isSupabaseConfigured ? "loading" : "signed-in",
  );
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    let active = true;
    const clearAuthParameters = () => {
      const cleanUrl = new URL(window.location.href);
      ["code", "error", "error_code", "error_description", "sb_flow_id"].forEach(
        (key) => cleanUrl.searchParams.delete(key),
      );
      cleanUrl.hash = "";
      window.history.replaceState(
        {},
        document.title,
        `${cleanUrl.pathname}${cleanUrl.search}` || "/",
      );
    };
    const readSession = async () => {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
      const callbackError =
        url.searchParams.get("error_description") ||
        hash.get("error_description") ||
        url.searchParams.get("error") ||
        hash.get("error");

      if (callbackError) {
        clearAuthParameters();
        if (!active) return;
        setError(
          callbackError.replace(/\+/g, " ") ||
            "This sign-in link is invalid or has expired. Request a new link.",
        );
        setView("signed-out");
        return;
      }

      const code = url.searchParams.get("code");
      if (code) {
        const flowId = url.searchParams.get("sb_flow_id");
        const { data, error: exchangeError } =
          await client.auth.exchangeCodeForSession(
            code,
            flowId ? { flowId } : undefined,
          );
        clearAuthParameters();
        if (!active) return;
        if (exchangeError || !data.session) {
          setError(
            exchangeError?.message ||
              "This sign-in link is invalid or has expired. Request a new link.",
          );
          setView("signed-out");
          return;
        }
        setSession(data.session);
        setView("signed-in");
        void ensureUserSettings(data.session.user);
        return;
      }

      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (accessToken && refreshToken) {
        const { data, error: tokenError } = await client.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        clearAuthParameters();
        if (!active) return;
        if (tokenError || !data.session) {
          setError(
            tokenError?.message ||
              "This sign-in link is invalid or has expired. Request a new link.",
          );
          setView("signed-out");
          return;
        }
        setSession(data.session);
        setView("signed-in");
        void ensureUserSettings(data.session.user);
        return;
      }

      const { data, error: sessionError } = await client.auth.getSession();
      if (!active) return;
      if (sessionError)
        setError("We could not restore your session. Please sign in again.");
      setSession(data.session);
      setView(data.session ? "signed-in" : "signed-out");
      if (data.session) void ensureUserSettings(data.session.user);
    };

    const { data: listener } = client.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!active) return;
        setSession(nextSession);
        setView(nextSession ? "signed-in" : "signed-out");
        if (nextSession)
          window.setTimeout(() => void ensureUserSettings(nextSession.user), 0);
      },
    );
    void readSession();

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function sendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !email.trim()) return;

    setSubmitting(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    setSubmitting(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }
    setView("email-sent");
  }

  async function signOut() {
    if (!supabase) return;
    setView("loading");
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      setView("signed-in");
    }
  }

  if (view === "signed-in") {
    return (
      <PagewiseDashboard
        previewMode={!isSupabaseConfigured}
        userId={session?.user.id ?? null}
        userEmail={session?.user.email ?? null}
        onSignOut={isSupabaseConfigured ? signOut : undefined}
      />
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="About Pagewise">
        <div className="auth-brand">
          <span aria-hidden="true" />
          Pagewise
        </div>
        <div className="auth-copy">
          <p className="eyebrow">Your reading life, kept well</p>
          <h1>A quiet home for every book you carry with you.</h1>
          <p>
            Track pages, preserve rereads, collect the lines that stay with you,
            and watch your reading life unfold.
          </p>
        </div>
        <div className="auth-privacy">
          <LockKeyhole size={16} />
          <span>
            <strong>Private by design</strong>Your library belongs only to you.
          </span>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-form-wrap">
          {view === "loading" && (
            <div className="auth-loading" role="status">
              <LoaderCircle size={28} className="spin" />
              <span>Opening your library…</span>
            </div>
          )}

          {view === "signed-out" && (
            <>
              <p className="eyebrow">Welcome to Pagewise</p>
              <h2>Sign in to your library</h2>
              <p className="auth-intro">
                We’ll email you a secure sign-in link. No password to remember.
              </p>
              <form onSubmit={sendMagicLink} className="auth-form">
                <label htmlFor="email">Email address</label>
                <div className="email-field">
                  <Mail size={18} />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <button
                  className="button button-primary auth-submit"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <LoaderCircle size={18} className="spin" /> Sending link…
                    </>
                  ) : (
                    "Email me a sign-in link"
                  )}
                </button>
              </form>
              <p className="auth-footnote">
                <LockKeyhole size={13} /> Your records are protected and
                synchronized securely.
              </p>
            </>
          )}

          {view === "email-sent" && (
            <div className="email-sent" role="status">
              <span className="success-mark">
                <CheckCircle2 size={27} />
              </span>
              <p className="eyebrow">Link sent</p>
              <h2>Check your inbox</h2>
              <p>
                We sent a sign-in link to <strong>{email}</strong>. Open it on
                this device to enter your library.
              </p>
              <button
                className="text-button auth-back"
                onClick={() => {
                  setView("signed-out");
                  setError(null);
                }}
              >
                Use a different email
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
