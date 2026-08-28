"use client";

import {
  Archive,
  Check,
  Download,
  FileCheck2,
  FileUp,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { useRef, useState } from "react";
import {
  countBackupRecords,
  createPagewiseBackup,
  downloadBackup,
  restorePagewiseBackup,
  validatePagewiseBackup,
  type BackupCounts,
  type BackupValidation,
  type ImportMode,
} from "../lib/backup";

type Props = { userId: string | null; previewMode: boolean };

export function BackupPanel({ userId, previewMode }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<BackupCounts | null>(null);
  const [validation, setValidation] = useState<BackupValidation | null>(null);
  const [fileName, setFileName] = useState("");
  const [mode, setMode] = useState<ImportMode>("merge");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restored, setRestored] = useState<number | null>(null);

  async function exportBackup() {
    setWorking(true);
    setError(null);
    try {
      const backup = await createPagewiseBackup(userId, previewMode);
      downloadBackup(backup);
      setCounts(countBackupRecords(backup.data));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The backup could not be created.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function inspectFile(file: File) {
    setFileName(file.name);
    if (file.size > 20 * 1024 * 1024) {
      setValidation({
        valid: false,
        errors: ["The backup is larger than the 20 MB safety limit."],
      });
      return;
    }
    try {
      setValidation(
        validatePagewiseBackup(JSON.parse(await file.text()) as unknown),
      );
    } catch {
      setValidation({
        valid: false,
        errors: ["The selected file is not valid JSON."],
      });
    }
  }

  async function restore() {
    if (
      !validation?.valid ||
      (mode === "replace" && confirmation !== "REPLACE")
    )
      return;
    setRestoring(true);
    setRestoreError(null);
    try {
      const result = await restorePagewiseBackup(
        validation.backup,
        mode,
        previewMode,
      );
      setRestored(result.records);
      setConfirmOpen(false);
      if (!previewMode) window.setTimeout(() => window.location.reload(), 900);
    } catch (cause) {
      setRestoreError(
        cause instanceof Error
          ? cause.message
          : "The backup could not be restored.",
      );
    } finally {
      setRestoring(false);
    }
  }

  const exportTotal = counts
    ? Object.values(counts).reduce((sum, count) => sum + count, 0)
    : 0;
  const importTotal = validation?.valid
    ? Object.values(validation.counts).reduce((sum, count) => sum + count, 0)
    : 0;

  return (
    <article className="profile-panel backup-panel">
      <header>
        <div>
          <Archive />
          <span>
            <strong>Backup and restore</strong>
            <small>Keep a portable copy of your Pagewise library.</small>
          </span>
        </div>
      </header>
      <div className="backup-content">
        <section className="backup-section">
          <div className="backup-section-title">
            <Download size={16} />
            <div>
              <strong>Export your data</strong>
              <small>
                Books, history, lists, quotes, goals, freezes, and preferences.
              </small>
            </div>
          </div>
          <div className="backup-note">
            <strong>Cover note</strong>
            <span>
              Cover URLs are preserved, but uploaded image files are not
              embedded in V1.
            </span>
          </div>
          {error && <p className="form-error">{error}</p>}
          {counts && (
            <div className="backup-success">
              <Check size={15} />
              <span>
                <strong>{exportTotal} records exported</strong>
                <small>
                  {counts.books} books · {counts.readingLogs} logs ·{" "}
                  {counts.quotes} quotes · {counts.lists} lists
                </small>
              </span>
            </div>
          )}
          <button
            className="button button-secondary backup-download"
            disabled={working}
            onClick={() => void exportBackup()}
          >
            {working ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Download size={16} />
            )}
            {working ? "Preparing backup…" : "Download JSON backup"}
          </button>
          {previewMode && (
            <small className="preview-backup-note">
              Preview mode downloads an empty sample. Sign in to export your
              real library.
            </small>
          )}
        </section>
        <section className="backup-section import-section">
          <div className="backup-section-title">
            <FileUp size={16} />
            <div>
              <strong>Inspect a backup</strong>
              <small>Validation never changes your current library.</small>
            </div>
          </div>
          <input
            ref={fileInput}
            className="sr-only"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void inspectFile(file);
            }}
          />
          <button
            className="backup-file-picker"
            onClick={() => fileInput.current?.click()}
          >
            <FileCheck2 size={19} />
            <span>
              <strong>{fileName || "Choose Pagewise backup"}</strong>
              <small>JSON only · maximum 20 MB</small>
            </span>
          </button>
          {validation && !validation.valid && (
            <div className="backup-errors" role="alert">
              <strong>Backup cannot be imported</strong>
              <ul>
                {validation.errors.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {validation?.valid && (
            <div className="import-preview">
              <div className="import-ready">
                <ShieldCheck size={18} />
                <span>
                  <strong>Backup is valid</strong>
                  <small>
                    {importTotal} records · exported{" "}
                    {new Intl.DateTimeFormat(undefined, {
                      dateStyle: "medium",
                    }).format(new Date(validation.backup.exportedAt))}
                  </small>
                </span>
              </div>
              <div className="import-counts">
                <span>
                  <strong>{validation.counts.books}</strong>Books
                </span>
                <span>
                  <strong>{validation.counts.readingAttempts}</strong>Attempts
                </span>
                <span>
                  <strong>{validation.counts.readingLogs}</strong>Logs
                </span>
                <span>
                  <strong>{validation.counts.lists}</strong>Lists
                </span>
                <span>
                  <strong>{validation.counts.quotes}</strong>Quotes
                </span>
                <span>
                  <strong>{validation.counts.inventoryItems}</strong>Owned books
                </span>
              </div>
              <fieldset className="import-modes">
                <legend>Restore method</legend>
                <label className={mode === "merge" ? "active" : ""}>
                  <input
                    type="radio"
                    name="import-mode"
                    checked={mode === "merge"}
                    onChange={() => {
                      setMode("merge");
                      setConfirmOpen(false);
                    }}
                  />
                  <span>
                    <strong>Merge</strong>
                    <small>
                      Add and update matching records while preserving the rest.
                    </small>
                  </span>
                </label>
                <label className={mode === "replace" ? "active danger" : ""}>
                  <input
                    type="radio"
                    name="import-mode"
                    checked={mode === "replace"}
                    onChange={() => {
                      setMode("replace");
                      setConfirmOpen(false);
                    }}
                  />
                  <span>
                    <strong>Replace</strong>
                    <small>
                      Erase the current library and rebuild it from this backup.
                    </small>
                  </span>
                </label>
              </fieldset>
              {restored !== null ? (
                <div className="backup-success">
                  <Check size={15} />
                  <span>
                    <strong>Restore complete</strong>
                    <small>{restored} records processed successfully.</small>
                  </span>
                </div>
              ) : (
                <button
                  className={`button import-continue ${mode === "replace" ? "button-quiet-danger" : "button-primary"}`}
                  onClick={() => setConfirmOpen(true)}
                >
                  Continue with {mode}
                </button>
              )}
              {restoreError && <p className="form-error">{restoreError}</p>}
              {confirmOpen && (
                <div
                  className={`restore-confirm ${mode === "replace" ? "danger" : ""}`}
                >
                  <strong>
                    {mode === "replace"
                      ? "Replace your entire library?"
                      : "Merge this backup?"}
                  </strong>
                  <p>
                    {mode === "replace"
                      ? "This permanently removes current records that are not in the backup. Type REPLACE to confirm."
                      : "Matching records will update and new records will be added. Your other records remain untouched."}
                  </p>
                  {mode === "replace" && (
                    <input
                      value={confirmation}
                      onChange={(event) => setConfirmation(event.target.value)}
                      placeholder="Type REPLACE"
                      autoComplete="off"
                    />
                  )}
                  <div>
                    <button
                      className="button button-secondary"
                      onClick={() => {
                        setConfirmOpen(false);
                        setConfirmation("");
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className={`button ${mode === "replace" ? "button-quiet-danger" : "button-primary"}`}
                      disabled={
                        restoring ||
                        (mode === "replace" && confirmation !== "REPLACE")
                      }
                      onClick={() => void restore()}
                    >
                      {restoring ? (
                        <LoaderCircle className="spin" size={16} />
                      ) : (
                        <ShieldCheck size={16} />
                      )}
                      {restoring ? "Restoring…" : `Confirm ${mode}`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </article>
  );
}
