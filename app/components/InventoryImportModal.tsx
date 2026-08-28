"use client";

import {
  AlertTriangle,
  Check,
  FileUp,
  LoaderCircle,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { ChangeEvent, useState } from "react";
import type { InventoryInput, InventoryItem } from "../lib/inventory";
import {
  parseInventoryImport,
  type InventoryImportRow,
} from "../lib/inventory-import";
import type { MetadataSearchResponse } from "../lib/metadata";
import type { AiMetadataSuggestion } from "../lib/ai-metadata";
import { normalizeBookText, normalizeIsbn } from "../lib/cover-images";
import { supabase } from "../lib/supabase";

type MatchedRow = InventoryImportRow & {
  selected: boolean;
  status: "ready" | "review" | "duplicate";
  note: string;
  input: InventoryInput;
};
type Props = {
  open: boolean;
  items: InventoryItem[];
  onClose: () => void;
  onSave: (
    input: InventoryInput,
  ) => Promise<{ data: InventoryItem | null; error: string | null }>;
};

const toInput = (row: InventoryImportRow): InventoryInput => ({
  pagewise_book_id: null,
  title: row.title,
  author: row.author,
  isbn: row.isbn,
  publisher: row.publisher,
  publication_year: null,
  edition: null,
  language: row.language,
  genre: row.genre,
  format: row.format,
  condition: "good",
  location: row.location,
  shelf: row.shelf,
  quantity: row.quantity,
  acquisition_date: null,
  purchase_price: null,
  currency: "BDT",
  is_lent: false,
  lent_to: null,
  lent_at: null,
  due_date: null,
  notes: null,
  cover_image_url: null,
  cover_storage_path: null,
  tags: [],
});

export function InventoryImportModal({ open, items, onClose, onSave }: Props) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<MatchedRow[]>([]);
  const [working, setWorking] = useState(false);
  const [aiRowId, setAiRowId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  if (!open) return null;

  function clearImport() {
    setText("");
    setRows([]);
    setMessage(null);
    setWorking(false);
    setAiRowId(null);
  }

  function close() {
    clearImport();
    onClose();
  }

  async function loadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 1_000_000) {
      setMessage("Import files must be 1 MB or smaller.");
      return;
    }
    setText(await file.text());
    setRows([]);
    setMessage(null);
  }

  async function matchRows() {
    const parsed = parseInventoryImport(text);
    if (!parsed.length) {
      setMessage("Paste a list or CSV with a title column.");
      return;
    }
    setWorking(true);
    setRows([]);
    setMessage(null);
    const next: MatchedRow[] = [];
    for (let index = 0; index < parsed.length; index += 4) {
      const batch = await Promise.all(
        parsed.slice(index, index + 4).map(async (row) => {
          const duplicate = items.some(
            (item) =>
              (row.isbn &&
                normalizeIsbn(item.isbn) === normalizeIsbn(row.isbn)) ||
              (normalizeBookText(item.title) === normalizeBookText(row.title) &&
                normalizeBookText(item.author) ===
                  normalizeBookText(row.author)),
          );
          if (duplicate)
            return {
              ...row,
              selected: false,
              status: "duplicate" as const,
              note: "Already in LitShelves",
              input: toInput(row),
            };
          try {
            const params = new URLSearchParams({ q: row.title });
            if (row.author) params.set("author", row.author);
            if (row.isbn) params.set("isbn", row.isbn);
            const response = await fetch(`/api/metadata/search?${params}`);
            const payload = response.ok
              ? ((await response.json()) as MetadataSearchResponse)
              : { candidates: [] };
            const match = payload.candidates[0];
            if (!match)
              return {
                ...row,
                selected: true,
                status: "review" as const,
                note: "Manual details kept",
                input: toInput(row),
              };
            return {
              ...row,
              selected: true,
              status: "ready" as const,
              note: match.providers
                .map((value) => value.replaceAll("_", " "))
                .join(" + "),
              input: {
                ...toInput(row),
                title: match.title,
                author: match.authors.join(", ") || row.author,
                isbn: match.isbn || row.isbn,
                publication_year: match.publicationYear,
                language: match.language || row.language,
                genre: match.genres[0] || row.genre,
                cover_image_url: match.coverUrl,
                notes: match.description,
              },
            };
          } catch {
            return {
              ...row,
              selected: true,
              status: "review" as const,
              note: "Search failed · manual details kept",
              input: toInput(row),
            };
          }
        }),
      );
      next.push(...batch);
      setRows([...next]);
    }
    setWorking(false);
  }

  async function improve(row: MatchedRow) {
    setAiRowId(row.id);
    setMessage(null);
    try {
      if (!supabase)
        throw new Error(
          "Sign in and configure Supabase before using AI assistance.",
        );
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token)
        throw new Error("Sign in before using AI assistance.");
      const response = await fetch("/api/metadata/assist", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fields: {
            title: row.input.title,
            author: row.input.author,
            genre: row.input.genre,
            publication_year: row.input.publication_year,
            isbn: row.input.isbn,
            total_pages: null,
            description: row.input.notes,
            tags: row.input.tags,
          },
          providerCandidates: [],
        }),
      });
      const payload = (await response.json()) as {
        suggestion?: AiMetadataSuggestion;
        error?: string;
      };
      if (!response.ok || !payload.suggestion)
        throw new Error(payload.error || "AI review failed.");
      const fields = payload.suggestion.fields;
      setRows((current) =>
        current.map((item) =>
          item.id === row.id
            ? {
                ...item,
                status: "ready",
                note: `AI reviewed · ${payload.suggestion!.confidence}`,
                input: {
                  ...item.input,
                  title: fields.title || item.input.title,
                  author: fields.author || item.input.author,
                  genre: fields.genre || item.input.genre,
                  publication_year:
                    fields.publication_year ?? item.input.publication_year,
                  isbn: fields.isbn || item.input.isbn,
                  notes: fields.description || item.input.notes,
                  tags: fields.tags.length ? fields.tags : item.input.tags,
                },
              }
            : item,
        ),
      );
    } catch (requestError) {
      setMessage(
        requestError instanceof Error
          ? requestError.message
          : "AI review failed.",
      );
    } finally {
      setAiRowId(null);
    }
  }

  async function importSelected() {
    setWorking(true);
    setMessage(null);
    let imported = 0;
    const importedIds = new Set<string>();
    for (const row of rows.filter((item) => item.selected)) {
      const result = await onSave(row.input);
      if (result.error) {
        setRows((current) =>
          current.map((item) =>
            importedIds.has(item.id)
              ? {
                  ...item,
                  selected: false,
                  status: "duplicate",
                  note: "Added to LitShelves",
                }
              : item,
          ),
        );
        setMessage(
          `${imported} imported. Stopped at ${row.title}: ${result.error}`,
        );
        setWorking(false);
        return;
      }
      imported += 1;
      importedIds.add(row.id);
    }
    setWorking(false);
    setRows((current) =>
      current.map((item) =>
        importedIds.has(item.id)
          ? {
              ...item,
              selected: false,
              status: "duplicate",
              note: "Added to LitShelves",
            }
          : item,
      ),
    );
    setMessage(`${imported} owned books added to LitShelves.`);
  }

  return (
    <div className="modal-layer" role="presentation">
      <section
        className="book-modal inventory-import-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-import-title"
      >
        <header className="modal-header">
          <div>
            <p className="eyebrow">LitShelves import</p>
            <h2 id="inventory-import-title">Import owned books</h2>
            <p>Paste up to 100 books or upload a UTF-8 CSV.</p>
          </div>
          <button
            className="icon-button"
            onClick={close}
            aria-label="Close inventory import"
          >
            <X size={20} />
          </button>
        </header>
        <div className="smart-import-body">
          <label className="smart-paste">
            Book list or CSV
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={
                "Pather Panchali — Bibhutibhushan Bandyopadhyay\nThe Hobbit by J.R.R. Tolkien\n\nor CSV:\ntitle,author,isbn,publisher,language,genre,format,location,shelf,quantity"
              }
            />
            <small>
              CSV columns may include title, author, ISBN, publisher, language,
              genre, format, location, shelf, and quantity.
            </small>
          </label>
          <div className="inventory-import-actions">
            <label className="button button-secondary">
              <FileUp size={15} /> Upload CSV
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={(event) => void loadFile(event)}
              />
            </label>
            <button
              className="button button-secondary"
              disabled={working || !text.trim()}
              onClick={() => void matchRows()}
            >
              {working && !rows.length ? (
                <LoaderCircle className="spin" size={15} />
              ) : (
                <Search size={15} />
              )}{" "}
              Match metadata
            </button>
            {(text || rows.length > 0) && (
              <button className="text-button" onClick={clearImport}>
                Clear import
              </button>
            )}
          </div>
          {rows.length > 0 && (
            <div className="smart-results">
              <div className="smart-results-head">
                <span>{rows.length} parsed books</span>
                <button
                  className="text-button"
                  onClick={() =>
                    setRows((current) =>
                      current.map((row) => ({
                        ...row,
                        selected: row.status !== "duplicate",
                      })),
                    )
                  }
                >
                  Select ready
                </button>
              </div>
              {rows.map((row) => (
                <article className={`smart-result ${row.status}`} key={row.id}>
                  <input
                    type="checkbox"
                    checked={row.selected}
                    disabled={row.status === "duplicate"}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((item) =>
                          item.id === row.id
                            ? { ...item, selected: event.target.checked }
                            : item,
                        ),
                      )
                    }
                    aria-label={`Import ${row.title}`}
                  />
                  <span className="smart-result-cover">
                    <FileUp size={15} />
                  </span>
                  <div>
                    <strong>{row.input.title}</strong>
                    <small>
                      {row.input.author || row.isbn || "Manual metadata"}
                    </small>
                  </div>
                  <span className="smart-result-status">
                    <b>
                      {row.status === "ready" ? (
                        <Check size={12} />
                      ) : (
                        <AlertTriangle size={12} />
                      )}
                      {row.note}
                    </b>
                    {row.status === "review" && (
                      <button
                        disabled={aiRowId !== null}
                        onClick={() => void improve(row)}
                      >
                        {aiRowId === row.id ? (
                          <LoaderCircle className="spin" size={12} />
                        ) : (
                          <Sparkles size={12} />
                        )}{" "}
                        AI improve
                      </button>
                    )}
                  </span>
                </article>
              ))}
            </div>
          )}
          {message && (
            <p
              className={
                message.includes("added") ? "profile-success" : "form-error"
              }
            >
              {message}
            </p>
          )}
        </div>
        <footer className="picker-actions">
          <button className="button button-secondary" onClick={close}>
            Cancel
          </button>
          <button
            className="button button-primary"
            disabled={working || !rows.some((row) => row.selected)}
            onClick={() => void importSelected()}
          >
            {working ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <Check size={15} />
            )}{" "}
            Add {rows.filter((row) => row.selected).length} to LitShelves
          </button>
        </footer>
      </section>
    </div>
  );
}
