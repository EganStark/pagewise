"use client";
import {
  BookOpen,
  Check,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Monitor,
  Moon,
  Sun,
} from "lucide-react";
import { useState } from "react";
import type { ThemePreference } from "../hooks/useProfileSettings";
import { BackupPanel } from "./BackupPanel";

type Props = {
  userId: string | null;
  previewMode: boolean;
  email?: string | null;
  year: number;
  completed: number;
  goalTarget: number;
  timezone: string;
  theme: ThemePreference;
  working: boolean;
  error: string | null;
  onTheme: (theme: ThemePreference) => Promise<string | null>;
  onSave: (target: number, timezone: string) => Promise<string | null>;
  onSignOut?: () => void | Promise<void>;
};
export function ProfileView({
  userId,
  previewMode,
  email,
  year,
  completed,
  goalTarget,
  timezone,
  theme,
  working,
  error,
  onTheme,
  onSave,
  onSignOut,
}: Props) {
  const [target, setTarget] = useState(goalTarget);
  const [zone, setZone] = useState(timezone);
  const [message, setMessage] = useState<string | null>(null);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    const result = await onSave(target, zone);
    setMessage(result ?? "Preferences saved.");
  }
  const percentage = Math.min(
    100,
    Math.round((completed / Math.max(1, target)) * 100),
  );
  return (
    <section className="profile-view">
      <div className="library-title-row">
        <div>
          <p className="eyebrow">Your reading space</p>
          <h1>Profile</h1>
          <p className="lead">
            Goals, appearance, backup, and account preferences.
          </p>
        </div>
      </div>
      <div className="profile-grid">
        <article className="profile-panel">
          <header>
            <div>
              <BookOpen />
              <span>
                <strong>{year} reading goal</strong>
                <small>Choose a target that feels encouraging.</small>
              </span>
            </div>
          </header>
          <form className="profile-form" onSubmit={(event) => void save(event)}>
            <label>
              Target books
              <input
                type="number"
                min="1"
                max="500"
                value={target}
                onChange={(event) => setTarget(Number(event.target.value))}
              />
            </label>
            <div className="goal-preview">
              <span>
                <strong>{completed}</strong> of {target || 0} finished
              </span>
              <b>{percentage}%</b>
              <div className="progress-track">
                <i style={{ width: `${percentage}%` }} />
              </div>
            </div>
            <label>
              Timezone
              <input
                value={zone}
                onChange={(event) => setZone(event.target.value)}
                placeholder="Asia/Dhaka"
              />
              <small>Used for reading days and streak freezes.</small>
            </label>
            {(error || message) && (
              <p
                className={
                  error || message !== "Preferences saved."
                    ? "form-error"
                    : "profile-success"
                }
              >
                {error || message}
              </p>
            )}
            <button
              className="button button-primary profile-save"
              disabled={working}
            >
              {working ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Check size={16} />
              )}
              Save preferences
            </button>
          </form>
        </article>
        <article className="profile-panel">
          <header>
            <div>
              <Sun />
              <span>
                <strong>Appearance</strong>
                <small>Warm paper by day, reading room by night.</small>
              </span>
            </div>
          </header>
          <div className="theme-options">
            {(
              [
                { id: "dark", label: "Dark", icon: Moon },
                { id: "light", label: "Light", icon: Sun },
                { id: "system", label: "System", icon: Monitor },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                type="button"
                key={id}
                className={theme === id ? "active" : ""}
                onClick={() => void onTheme(id)}
              >
                <Icon size={18} />
                <span>
                  <strong>{label}</strong>
                  <small>
                    {id === "dark"
                      ? "Walnut room"
                      : id === "light"
                        ? "Warm paper"
                        : "Follow device"}
                  </small>
                </span>
                {theme === id && <Check size={15} />}
              </button>
            ))}
          </div>
        </article>
        <BackupPanel userId={userId} previewMode={previewMode} />
        <article className="profile-panel account-panel">
          <header>
            <div>
              <LockKeyhole />
              <span>
                <strong>Private account</strong>
                <small>Your library belongs only to you.</small>
              </span>
            </div>
          </header>
          <div className="account-details">
            <span>Email</span>
            <strong>{email || "Preview mode"}</strong>
            <p>
              Books, diary entries, lists, reviews, and quotes are protected by
              account ownership rules.
            </p>
            {onSignOut && (
              <button
                className="button button-quiet-danger"
                onClick={() => void onSignOut()}
              >
                <LogOut size={15} />
                Sign out
              </button>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
