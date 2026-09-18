"use client";
import {
  BookOpen,
  Camera,
  Check,
  Cloud,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Monitor,
  Moon,
  Sun,
  Trash2,
  UploadCloud,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import type { ThemePreference } from "../hooks/useProfileSettings";
import { BackupPanel } from "./BackupPanel";

type Props = {
  userId: string | null;
  previewMode: boolean;
  deviceMode?: boolean;
  email?: string | null;
  year: number;
  completed: number;
  goalTarget: number;
  timezone: string;
  theme: ThemePreference;
  working: boolean;
  error: string | null;
  displayName: string;
  birthYear: number | null;
  bio: string;
  avatarUrl: string | null;
  onTheme: (theme: ThemePreference) => Promise<string | null>;
  onSave: (target: number, timezone: string) => Promise<string | null>;
  onSavePersonal: (displayName: string, birthYear: number | null, bio: string) => Promise<string | null>;
  onUploadAvatar: (file: File) => Promise<string | null>;
  onRemoveAvatar: () => Promise<string | null>;
  onSignOut?: () => void | Promise<void>;
  deviceAccount?: {
    configured: boolean;
    email: string | null;
    loading: boolean;
    working: boolean;
    error: string | null;
    message: string | null;
    linked: boolean;
    pendingCount: number;
    lastSyncedAt: string | null;
    signIn: (email: string, password: string) => Promise<string | null>;
    signInWithGoogle: () => Promise<string | null>;
    signOut: () => Promise<void>;
    upload: () => Promise<string | null>;
    sync: () => Promise<string | null>;
  };
};
export function ProfileView({
  userId,
  previewMode,
  deviceMode = false,
  email,
  year,
  completed,
  goalTarget,
  timezone,
  theme,
  working,
  error,
  displayName,
  birthYear,
  bio,
  avatarUrl,
  onTheme,
  onSave,
  onSavePersonal,
  onUploadAvatar,
  onRemoveAvatar,
  onSignOut,
  deviceAccount,
}: Props) {
  const [target, setTarget] = useState(goalTarget);
  const [zone, setZone] = useState(timezone);
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState(displayName);
  const [born, setBorn] = useState(birthYear?.toString() ?? "");
  const [about, setAbout] = useState(bio);
  const [personalMessage, setPersonalMessage] = useState<string | null>(null);
  const [syncEmail, setSyncEmail] = useState("");
  const [syncPassword, setSyncPassword] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    const result = await onSave(target, zone);
    setMessage(result ?? "Preferences saved.");
  }
  async function savePersonal(event: React.FormEvent) {
    event.preventDefault();
    setPersonalMessage(null);
    const result = await onSavePersonal(name, born ? Number(born) : null, about);
    setPersonalMessage(result ?? "Profile saved.");
  }
  async function changeAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPersonalMessage(null);
    const result = await onUploadAvatar(file);
    setPersonalMessage(result ?? "Profile photo updated.");
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
        <article className="profile-panel personal-profile-panel">
          <header>
            <div>
              <UserRound />
              <span>
                <strong>About you</strong>
                <small>A small, private reader profile.</small>
              </span>
            </div>
          </header>
          <form className="personal-profile-form" onSubmit={(event) => void savePersonal(event)}>
            <div className="profile-avatar-editor">
              <div className="profile-avatar-preview" aria-label="Profile photo">
                {avatarUrl ? <Image src={avatarUrl} alt="" width={88} height={88} unoptimized /> : <UserRound aria-hidden="true" />}
              </div>
              <div>
                <strong>Profile photo</strong>
                <small>JPEG, PNG, or WebP. Up to 5 MB.</small>
                <div className="profile-avatar-actions">
                  <label className="button button-secondary profile-photo-button">
                    <Camera size={15} /> {avatarUrl ? "Change photo" : "Add photo"}
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void changeAvatar(event)} />
                  </label>
                  {avatarUrl && (
                    <button type="button" className="button button-quiet-danger" onClick={async () => setPersonalMessage((await onRemoveAvatar()) ?? "Profile photo removed.")}>
                      <Trash2 size={15} /> Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="personal-profile-fields">
              <label>
                Display name
                <input maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="How Pagewise should greet you" />
              </label>
              <label>
                Birth year <span>(optional)</span>
                <input type="number" min="1900" max={new Date().getFullYear()} value={born} onChange={(event) => setBorn(event.target.value)} placeholder="1998" />
              </label>
              <label className="personal-profile-email">
                Email
                <input value={email || (deviceMode ? "Local profile" : "Preview mode")} readOnly />
                <small>{deviceMode ? "Connect an account later to enable sync." : "Your sign-in email cannot be edited here."}</small>
              </label>
              <label className="personal-profile-bio">
                About me <span>{about.length}/280</span>
                <textarea maxLength={280} rows={3} value={about} onChange={(event) => setAbout(event.target.value)} placeholder="A short note about you and the books you enjoy." />
              </label>
            </div>
            {personalMessage && <p className={personalMessage === "Profile saved." || personalMessage.includes("photo") ? "profile-success" : "form-error"}>{personalMessage}</p>}
            <button className="button button-primary profile-save" disabled={working}>
              {working ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />} Save profile
            </button>
          </form>
        </article>
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
        <BackupPanel userId={userId} previewMode={previewMode} deviceMode={deviceMode} />
        <article className="profile-panel account-panel">
          <header>
            <div>
              <LockKeyhole />
              <span>
                <strong>{deviceMode ? "Backup & sync account" : "Private account"}</strong>
                <small>{deviceMode ? "Optional—local mode keeps working without it." : "Your library belongs only to you."}</small>
              </span>
            </div>
          </header>
          <div className="account-details">
            <span>{deviceMode ? "Status" : "Email"}</span>
            <strong>{deviceAccount?.email || email || (deviceMode ? "Stored only on this device" : "Preview mode")}</strong>
            <p>
              {deviceMode
                ? "Books, diary entries, lists, reviews, and quotes stay in this app until you connect sync or restore a backup."
                : "Books, diary entries, lists, reviews, and quotes are protected by account ownership rules."}
            </p>
            {deviceMode && deviceAccount && !deviceAccount.email && (
              <form
                className="profile-form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const result = await deviceAccount.signIn(syncEmail, syncPassword);
                  if (!result) setSyncPassword("");
                }}
              >
                <button type="button" className="button button-secondary" disabled={deviceAccount.working || deviceAccount.loading} onClick={() => void deviceAccount.signInWithGoogle()}>
                  <Cloud size={16} /> Continue with Google
                </button>
                <div className="auth-divider" role="separator"><span>or use email</span></div>
                <label>
                  Email
                  <input type="email" autoComplete="email" required value={syncEmail} onChange={(event) => setSyncEmail(event.target.value)} />
                </label>
                <label>
                  Password
                  <input type="password" autoComplete="current-password" required value={syncPassword} onChange={(event) => setSyncPassword(event.target.value)} />
                </label>
                <button className="button button-primary" disabled={deviceAccount.working || deviceAccount.loading}>
                  {deviceAccount.working ? <LoaderCircle className="spin" size={16} /> : <Cloud size={16} />}
                  Connect existing account
                </button>
              </form>
            )}
            {deviceMode && deviceAccount?.email && (
              <div className="profile-form">
                {deviceAccount.linked ? (
                  <>
                    <p>
                      Automatic sync is on. {deviceAccount.pendingCount ? `${deviceAccount.pendingCount} change${deviceAccount.pendingCount === 1 ? "" : "s"} waiting.` : "No changes are waiting."}
                      {deviceAccount.lastSyncedAt ? ` Last synced ${new Date(deviceAccount.lastSyncedAt).toLocaleString()}.` : ""}
                    </p>
                    <button type="button" className="button button-primary" disabled={deviceAccount.working} onClick={() => void deviceAccount.sync()}>
                      {deviceAccount.working ? <LoaderCircle className="spin" size={16} /> : <Cloud size={16} />}
                      Sync now
                    </button>
                  </>
                ) : (
                  <>
                    <p>Your phone remains the primary copy. Cloud data is merged only when you confirm.</p>
                    <button
                      type="button"
                      className="button button-primary"
                      disabled={deviceAccount.working}
                      onClick={() => {
                        if (window.confirm("Merge all local Pagewise records into this cloud account? Existing cloud records will be preserved.")) void deviceAccount.upload();
                      }}
                    >
                      {deviceAccount.working ? <LoaderCircle className="spin" size={16} /> : <UploadCloud size={16} />}
                      Merge local library to cloud
                    </button>
                  </>
                )}
                <button type="button" className="button button-secondary" disabled={deviceAccount.working} onClick={() => void deviceAccount.signOut()}>
                  <LogOut size={15} /> Disconnect account
                </button>
              </div>
            )}
            {deviceAccount?.error && <p className="form-error">{deviceAccount.error}</p>}
            {deviceAccount?.message && <p className="profile-success">{deviceAccount.message}</p>}
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
