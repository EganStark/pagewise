"use client";

import Image from "next/image";
import {
  Check,
  LoaderCircle,
  Pencil,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useState } from "react";
import type { Book } from "../lib/books";
import type { AiMetadataSuggestion } from "../lib/ai-metadata";
import type { InventoryCondition, InventoryItem } from "../lib/inventory";
import type {
  MetadataCandidate,
  MetadataSearchResponse,
} from "../lib/metadata";
import { supabase } from "../lib/supabase";
import { todayLocalDate } from "../lib/reading-attempts";

type Props = {
  item: InventoryItem;
  books: Book[];
  onClose: () => void;
  onUpdate: (
    id: string,
    changes: Partial<InventoryItem>,
  ) => Promise<string | null>;
  onDelete: (id: string) => Promise<string | null>;
};

export function InventoryDetailModal({
  item,
  books,
  onClose,
  onUpdate,
  onDelete,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => ({
    title: item.title,
    author: item.author ?? "",
    isbn: item.isbn ?? "",
    publisher: item.publisher ?? "",
    publication_year: item.publication_year?.toString() ?? "",
    edition: item.edition ?? "",
    language: item.language ?? "",
    genre: item.genre ?? "",
    format: item.format ?? "",
    condition: item.condition ?? "good",
    location: item.location ?? "",
    shelf: item.shelf ?? "",
    quantity: item.quantity.toString(),
    acquisition_date: item.acquisition_date ?? "",
    purchase_price: item.purchase_price?.toString() ?? "",
    currency: item.currency ?? "BDT",
    tags: item.tags.join(", "),
    notes: item.notes ?? "",
    pagewise_book_id: item.pagewise_book_id ?? "",
  }));
  const [suggestions, setSuggestions] = useState<MetadataCandidate[]>([]);
  const [working, setWorking] = useState(false);
  const [searching, setSearching] = useState(false);
  const [aiWorking, setAiWorking] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AiMetadataSuggestion | null>(
    null,
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [lending, setLending] = useState(false);
  const [lentTo, setLentTo] = useState(item.lent_to ?? "");
  const [dueDate, setDueDate] = useState(item.due_date ?? "");
  const [error, setError] = useState<string | null>(null);

  async function findMetadata() {
    setSearching(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        q: form.title.trim(),
        type: "title",
      });
      if (form.author.trim()) params.set("author", form.author.trim());
      if (form.isbn.trim()) params.set("isbn", form.isbn.trim());
      if (form.publication_year) params.set("year", form.publication_year);
      const response = await fetch(`/api/metadata/search?${params}`);
      if (!response.ok) throw new Error("Metadata search is unavailable.");
      const payload = (await response.json()) as MetadataSearchResponse;
      setSuggestions(payload.candidates.slice(0, 4));
      if (!payload.candidates.length)
        setError(
          "No confident edition match found. Your current details are unchanged.",
        );
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Metadata search failed.",
      );
    } finally {
      setSearching(false);
    }
  }

  function applyCandidate(candidate: MetadataCandidate) {
    setForm((current) => ({
      ...current,
      title: candidate.title || current.title,
      author: candidate.authors.join(", ") || current.author,
      isbn: candidate.isbn || current.isbn,
      publication_year:
        candidate.publicationYear?.toString() ?? current.publication_year,
      language: candidate.language || current.language,
      genre: candidate.genres[0] || current.genre,
    }));
    setSuggestions([]);
  }

  async function askAi() {
    setAiWorking(true);
    setAiSuggestion(null);
    setError(null);
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
            title: form.title,
            author: form.author || null,
            genre: form.genre || null,
            publication_year: form.publication_year
              ? Number(form.publication_year)
              : null,
            isbn: form.isbn || null,
            total_pages: null,
            description: form.notes || null,
            tags: form.tags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean),
          },
          providerCandidates: suggestions,
        }),
      });
      const payload = (await response.json()) as {
        suggestion?: AiMetadataSuggestion;
        error?: string;
      };
      if (!response.ok || !payload.suggestion)
        throw new Error(payload.error || "AI review failed.");
      setAiSuggestion(payload.suggestion);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "AI review failed.",
      );
    } finally {
      setAiWorking(false);
    }
  }

  function applyAi() {
    if (!aiSuggestion) return;
    const fields = aiSuggestion.fields;
    setForm((current) => ({
      ...current,
      title: fields.title || current.title,
      author: fields.author || current.author,
      genre: fields.genre || current.genre,
      publication_year:
        fields.publication_year?.toString() ?? current.publication_year,
      isbn: fields.isbn || current.isbn,
      notes: fields.description || current.notes,
      tags: fields.tags.length ? fields.tags.join(", ") : current.tags,
    }));
    setAiSuggestion(null);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError(null);
    const saveError = await onUpdate(item.id, {
      title: form.title.trim(),
      author: form.author.trim() || null,
      isbn: form.isbn.trim() || null,
      publisher: form.publisher.trim() || null,
      publication_year: form.publication_year
        ? Number(form.publication_year)
        : null,
      edition: form.edition.trim() || null,
      language: form.language.trim() || null,
      genre: form.genre.trim() || null,
      format: form.format.trim() || null,
      condition: form.condition as InventoryCondition,
      location: form.location.trim() || null,
      shelf: form.shelf.trim() || null,
      quantity: Number(form.quantity),
      acquisition_date: form.acquisition_date || null,
      purchase_price: form.purchase_price ? Number(form.purchase_price) : null,
      currency: form.currency.trim().toUpperCase() || null,
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
      notes: form.notes.trim() || null,
      pagewise_book_id: form.pagewise_book_id || null,
    });
    setWorking(false);
    if (saveError) {
      setError(saveError);
      return;
    }
    setEditing(false);
  }

  async function remove() {
    setWorking(true);
    const deleteError = await onDelete(item.id);
    setWorking(false);
    if (deleteError) {
      setError(deleteError);
      return;
    }
    onClose();
  }

  async function saveLoan() {
    if (!lentTo.trim()) return;
    setWorking(true);
    const loanError = await onUpdate(item.id, {
      is_lent: true,
      lent_to: lentTo.trim(),
      lent_at: todayLocalDate(),
      due_date: dueDate || null,
    });
    setWorking(false);
    if (loanError) {
      setError(loanError);
      return;
    }
    setLending(false);
  }

  async function returnLoan() {
    setWorking(true);
    const returnError = await onUpdate(item.id, {
      is_lent: false,
      lent_to: null,
      lent_at: null,
      due_date: null,
    });
    setWorking(false);
    if (returnError) setError(returnError);
  }

  const facts = [
    { key: "publisher", value: item.publisher },
    { key: "edition", value: item.edition },
    { key: "publication-year", value: item.publication_year },
    { key: "language", value: item.language },
    { key: "format", value: item.format },
    { key: "condition", value: item.condition?.replaceAll("_", " ") },
    { key: "isbn", value: item.isbn ? `ISBN ${item.isbn}` : null },
  ].filter((fact) => fact.value !== null && fact.value !== undefined);

  return (
    <div
      className="modal-layer"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !working) onClose();
      }}
    >
      <section
        className="book-modal inventory-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-detail-title"
      >
        <header className="modal-header">
          <div>
            <p className="eyebrow">LitShelves copy</p>
            <h2 id="inventory-detail-title">{item.title}</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close inventory details"
          >
            <X size={20} />
          </button>
        </header>
        {!editing ? (
          <div className="inventory-detail-body">
            <div className="inventory-detail-lead">
              {item.cover_image_url ? (
                <span className="inventory-detail-cover">
                  <Image
                    src={item.cover_image_url}
                    alt=""
                    fill
                    sizes="90px"
                    unoptimized
                  />
                </span>
              ) : (
                <span className="inventory-detail-spine">
                  {item.title.slice(0, 2).toUpperCase()}
                </span>
              )}
              <div>
                <h3>{item.title}</h3>
                <p>{item.author || "Unknown author"}</p>
                {item.is_lent && (
                  <span className="inventory-borrower detail-borrower">
                    Lent to
                    <strong>
                      {item.lent_to?.trim() || "Unknown borrower"}
                    </strong>
                  </span>
                )}
                <div>
                  {facts.map((fact) => (
                    <span key={fact.key}>{fact.value}</span>
                  ))}
                </div>
              </div>
            </div>
            <dl className="inventory-detail-list">
              <div>
                <dt>Stored at</dt>
                <dd>
                  {[item.location, item.shelf].filter(Boolean).join(" · ") ||
                    "Not set"}
                </dd>
              </div>
              <div>
                <dt>Copies</dt>
                <dd>{item.quantity}</dd>
              </div>
              <div>
                <dt>Acquired</dt>
                <dd>{item.acquisition_date || "Not recorded"}</dd>
              </div>
              <div>
                <dt>Value</dt>
                <dd>
                  {item.purchase_price !== null
                    ? `${item.currency || ""} ${item.purchase_price}`.trim()
                    : "Not recorded"}
                </dd>
              </div>
              <div>
                <dt>Pagewise</dt>
                <dd>
                  {item.pagewise_book_id
                    ? books.find((book) => book.id === item.pagewise_book_id)
                        ?.title || "Connected record"
                    : "Inventory only"}
                </dd>
              </div>
              <div>
                <dt>Lending</dt>
                <dd>
                  {item.is_lent
                    ? `Lent to ${item.lent_to || "someone"}${item.due_date ? ` · due ${item.due_date}` : ""}`
                    : "On your shelf"}
                </dd>
              </div>
            </dl>
            {item.tags.length > 0 && (
              <div className="inventory-detail-tags">
                {item.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            )}
            {item.notes && (
              <div className="inventory-detail-notes">
                <strong>Notes</strong>
                <p>{item.notes}</p>
              </div>
            )}
            <div className="inventory-loan-panel">
              {item.is_lent ? (
                <>
                  <span>
                    <strong>Currently away</strong>
                    <small>
                      {item.lent_at
                        ? `Lent ${item.lent_at}`
                        : "Loan date not recorded"}
                      {item.due_date ? ` · due ${item.due_date}` : ""}
                    </small>
                  </span>
                  <button
                    className="button button-secondary"
                    disabled={working}
                    onClick={() => void returnLoan()}
                  >
                    Mark returned
                  </button>
                </>
              ) : lending ? (
                <>
                  <label>
                    Borrower
                    <input
                      autoFocus
                      value={lentTo}
                      onChange={(event) => setLentTo(event.target.value)}
                      placeholder="Name or note"
                    />
                  </label>
                  <label>
                    Due date
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(event) => setDueDate(event.target.value)}
                    />
                  </label>
                  <button
                    className="button button-primary"
                    disabled={working || !lentTo.trim()}
                    onClick={() => void saveLoan()}
                  >
                    Save loan
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setLending(false)}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span>
                    <strong>On your shelf</strong>
                    <small>Track who borrows this copy and its due date.</small>
                  </span>
                  <button
                    className="button button-secondary"
                    onClick={() => setLending(true)}
                  >
                    Lend this copy
                  </button>
                </>
              )}
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <footer className="modal-actions inventory-detail-actions">
              <div>
                {confirmingDelete ? (
                  <>
                    <span>Remove this owned-copy record?</span>
                    <button
                      className="button inventory-delete-confirm"
                      disabled={working}
                      onClick={() => void remove()}
                    >
                      Confirm delete
                    </button>
                    <button
                      className="text-button"
                      onClick={() => setConfirmingDelete(false)}
                    >
                      Keep it
                    </button>
                  </>
                ) : (
                  <button
                    className="text-button inventory-delete"
                    onClick={() => setConfirmingDelete(true)}
                  >
                    <Trash2 size={15} /> Delete
                  </button>
                )}
              </div>
              <button
                className="button button-primary"
                onClick={() => setEditing(true)}
              >
                <Pencil size={15} /> Edit copy
              </button>
            </footer>
          </div>
        ) : (
          <form className="book-details-form" onSubmit={save}>
            <div className="inventory-edit-tools">
              <button
                type="button"
                disabled={searching || !form.title.trim()}
                onClick={() => void findMetadata()}
              >
                {searching ? (
                  <LoaderCircle className="spin" size={14} />
                ) : (
                  <Search size={14} />
                )}{" "}
                Find metadata
              </button>
              <button
                type="button"
                disabled={aiWorking || !form.title.trim()}
                onClick={() => void askAi()}
              >
                {aiWorking ? (
                  <LoaderCircle className="spin" size={14} />
                ) : (
                  <Sparkles size={14} />
                )}{" "}
                AI review
              </button>
            </div>
            {suggestions.length > 0 && (
              <div className="inventory-edit-suggestions">
                {suggestions.map((candidate) => (
                  <button
                    type="button"
                    key={candidate.id}
                    onClick={() => applyCandidate(candidate)}
                  >
                    <span>
                      <strong>{candidate.title}</strong>
                      <small>
                        {candidate.authors.join(", ") || "Unknown author"}
                      </small>
                    </span>
                    <Check size={14} />
                  </button>
                ))}
              </div>
            )}
            {aiSuggestion && (
              <div className="inventory-ai-suggestion">
                <span>
                  {aiSuggestion.confidence} confidence ·{" "}
                  {aiSuggestion.explanation}
                </span>
                <button type="button" onClick={applyAi}>
                  Apply suggestion
                </button>
              </div>
            )}
            <div className="form-grid inventory-form-grid">
              <label className="wide">
                Title *
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>
              <label className="wide">
                Author
                <input
                  value={form.author}
                  onChange={(e) => setForm({ ...form, author: e.target.value })}
                />
              </label>
              <label>
                ISBN
                <input
                  value={form.isbn}
                  onChange={(e) => setForm({ ...form, isbn: e.target.value })}
                />
              </label>
              <label>
                Publisher
                <input
                  value={form.publisher}
                  onChange={(e) =>
                    setForm({ ...form, publisher: e.target.value })
                  }
                />
              </label>
              <label>
                Publication year
                <input
                  type="number"
                  min="1"
                  max="2200"
                  value={form.publication_year}
                  onChange={(e) =>
                    setForm({ ...form, publication_year: e.target.value })
                  }
                />
              </label>
              <label>
                Edition
                <input
                  value={form.edition}
                  onChange={(e) =>
                    setForm({ ...form, edition: e.target.value })
                  }
                />
              </label>
              <label>
                Language
                <input
                  value={form.language}
                  onChange={(e) =>
                    setForm({ ...form, language: e.target.value })
                  }
                />
              </label>
              <label>
                Genre
                <input
                  value={form.genre}
                  onChange={(e) => setForm({ ...form, genre: e.target.value })}
                />
              </label>
              <label>
                Format
                <input
                  value={form.format}
                  onChange={(e) => setForm({ ...form, format: e.target.value })}
                />
              </label>
              <label>
                Condition
                <select
                  value={form.condition}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      condition: e.target.value as InventoryCondition,
                    })
                  }
                >
                  <option value="new">New</option>
                  <option value="like_new">Like new</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                </select>
              </label>
              <label>
                Location
                <input
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                />
              </label>
              <label>
                Shelf
                <input
                  value={form.shelf}
                  onChange={(e) => setForm({ ...form, shelf: e.target.value })}
                />
              </label>
              <label>
                Quantity
                <input
                  required
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm({ ...form, quantity: e.target.value })
                  }
                />
              </label>
              <label>
                Acquired on
                <input
                  type="date"
                  value={form.acquisition_date}
                  onChange={(e) =>
                    setForm({ ...form, acquisition_date: e.target.value })
                  }
                />
              </label>
              <label>
                Purchase price
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.purchase_price}
                  onChange={(e) =>
                    setForm({ ...form, purchase_price: e.target.value })
                  }
                />
              </label>
              <label>
                Currency
                <input
                  maxLength={3}
                  value={form.currency}
                  onChange={(e) =>
                    setForm({ ...form, currency: e.target.value })
                  }
                />
              </label>
              <label className="wide">
                Pagewise record
                <select
                  value={form.pagewise_book_id}
                  onChange={(e) =>
                    setForm({ ...form, pagewise_book_id: e.target.value })
                  }
                >
                  <option value="">Inventory only</option>
                  {books.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.title}
                      {book.author ? ` — ${book.author}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="wide">
                Tags
                <input
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                />
              </label>
              <label className="wide">
                Notes
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <footer className="modal-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setEditing(false)}
              >
                Cancel editing
              </button>
              <button className="button button-primary" disabled={working}>
                {working ? (
                  <>
                    <LoaderCircle className="spin" size={15} /> Saving…
                  </>
                ) : (
                  "Save copy"
                )}
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}
