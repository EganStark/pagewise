"use client";

import Image from "next/image";
import {
  AlertTriangle,
  BookOpen,
  Check,
  LoaderCircle,
  Search,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import type { Book, BookInput } from "../lib/books";
import {
  normalizeBookText,
  normalizeIsbn,
  validateCoverFile,
} from "../lib/cover-images";
import type {
  InventoryCondition,
  InventoryInput,
  InventoryItem,
} from "../lib/inventory";
import type {
  MetadataCandidate,
  MetadataSearchResponse,
} from "../lib/metadata";
import type { AiMetadataSuggestion } from "../lib/ai-metadata";
import { supabase } from "../lib/supabase";

type Props = {
  open: boolean;
  books: Book[];
  items: InventoryItem[];
  onClose: () => void;
  onSave: (
    input: InventoryInput,
  ) => Promise<{ data: InventoryItem | null; error: string | null }>;
  onCreatePagewiseBook: (
    input: BookInput,
  ) => Promise<{ data: unknown; error: string | null }>;
  onUploadCover: (file: File) => Promise<{
    url: string | null;
    path: string | null;
    error: string | null;
  }>;
  onDiscardCover: (path: string | null, url?: string | null) => Promise<void>;
};

const initialForm = {
  title: "",
  author: "",
  isbn: "",
  publisher: "",
  publication_year: "",
  edition: "",
  language: "",
  genre: "",
  format: "Paperback",
  condition: "good" as InventoryCondition,
  location: "",
  shelf: "",
  quantity: "1",
  acquisition_date: "",
  purchase_price: "",
  currency: "BDT",
  notes: "",
  tags: "",
  cover_image_url: "",
};

export function AddInventoryModal(props: Props) {
  const {
    open,
    books,
    items,
    onClose,
    onSave,
    onCreatePagewiseBook,
    onUploadCover,
    onDiscardCover,
  } = props;
  const [form, setForm] = useState(initialForm);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MetadataCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<
    "inventory" | "existing" | "create"
  >("inventory");
  const [linkedBookId, setLinkedBookId] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [aiWorking, setAiWorking] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AiMetadataSuggestion | null>(
    null,
  );

  const duplicates = useMemo(() => {
    const isbn = normalizeIsbn(form.isbn);
    const title = normalizeBookText(form.title);
    return items.filter(
      (item) =>
        (isbn && normalizeIsbn(item.isbn) === isbn) ||
        (title &&
          normalizeBookText(item.title) === title &&
          normalizeBookText(item.author) === normalizeBookText(form.author)),
    );
  }, [form.author, form.isbn, form.title, items]);

  if (!open) return null;

  function close() {
    if (saving) return;
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setForm(initialForm);
    setQuery("");
    setResults([]);
    setError(null);
    setCoverFile(null);
    setCoverPreview(null);
    setAiSuggestion(null);
    setConnection("inventory");
    setLinkedBookId("");
    onClose();
  }

  async function searchMetadata() {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/metadata/search?q=${encodeURIComponent(query.trim())}`,
      );
      if (!response.ok) throw new Error("Metadata search is unavailable.");
      const payload = (await response.json()) as MetadataSearchResponse;
      setResults(payload.candidates.slice(0, 6));
      if (!payload.candidates.length)
        setError("No match found. You can still enter this copy manually.");
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

  function chooseCandidate(candidate: MetadataCandidate) {
    setForm((current) => ({
      ...current,
      title: candidate.title,
      author: candidate.authors.join(", "),
      isbn: candidate.isbn ?? current.isbn,
      publication_year:
        candidate.publicationYear?.toString() ?? current.publication_year,
      language: candidate.language ?? current.language,
      genre: candidate.genres[0] ?? current.genre,
      cover_image_url: candidate.coverUrl ?? current.cover_image_url,
    }));
    setResults([]);
    setError(null);
  }

  function chooseCover(file?: File) {
    if (!file) return;
    const validation = validateCoverFile(file);
    if (validation) {
      setError(validation);
      return;
    }
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setError(null);
  }

  async function askAi() {
    setAiWorking(true);
    setError(null);
    setAiSuggestion(null);
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
          providerCandidates: results.slice(0, 6),
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

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    let pagewiseBookId =
      connection === "existing" ? linkedBookId || null : null;
    if (connection === "create") {
      const created = await onCreatePagewiseBook({
        title: form.title,
        author: form.author || null,
        status: "want_to_read",
        isbn: form.isbn || null,
        genre: form.genre || null,
        publication_year: form.publication_year
          ? Number(form.publication_year)
          : null,
        cover_image_url: form.cover_image_url || null,
        cover_source: form.cover_image_url ? "url" : "placeholder",
        tags: [],
      });
      if (created.error || !created.data) {
        setSaving(false);
        setError(created.error || "Could not create the Pagewise record.");
        return;
      }
      pagewiseBookId = (created.data as Book).id;
    }
    let uploaded: {
      url: string | null;
      path: string | null;
      error: string | null;
    } | null = null;
    if (coverFile) {
      uploaded = await onUploadCover(coverFile);
      if (uploaded.error || !uploaded.url) {
        setSaving(false);
        setError(uploaded.error || "Cover upload failed.");
        return;
      }
    }
    const result = await onSave({
      pagewise_book_id: pagewiseBookId,
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
      condition: form.condition,
      location: form.location.trim() || null,
      shelf: form.shelf.trim() || null,
      quantity: Number(form.quantity),
      acquisition_date: form.acquisition_date || null,
      purchase_price: form.purchase_price ? Number(form.purchase_price) : null,
      currency: form.currency.trim().toUpperCase() || null,
      is_lent: false,
      lent_to: null,
      lent_at: null,
      due_date: null,
      notes: form.notes.trim() || null,
      cover_image_url: uploaded?.url || form.cover_image_url.trim() || null,
      cover_storage_path: uploaded?.path || null,
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    });
    setSaving(false);
    if (result.error) {
      if (uploaded) await onDiscardCover(uploaded.path, uploaded.url);
      setError(result.error);
      return;
    }
    close();
  }

  return (
    <div
      className="modal-layer"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        className="book-modal inventory-add-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-add-title"
      >
        <header className="modal-header">
          <div>
            <p className="eyebrow">LitShelves</p>
            <h2 id="inventory-add-title">Add an owned book</h2>
          </div>
          <button
            className="icon-button"
            onClick={close}
            aria-label="Close inventory form"
          >
            <X size={20} />
          </button>
        </header>
        <form className="book-details-form" onSubmit={submit}>
          <div className="inventory-metadata-search">
            <label>Find metadata</label>
            <div>
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Title, author, or ISBN"
              />
              <button
                type="button"
                disabled={searching || !query.trim()}
                onClick={() => void searchMetadata()}
              >
                {searching ? (
                  <LoaderCircle className="spin" size={15} />
                ) : (
                  "Search"
                )}
              </button>
            </div>
          </div>
          {results.length > 0 && (
            <div className="inventory-search-results">
              {results.map((result) => (
                <button
                  type="button"
                  key={result.id}
                  onClick={() => chooseCandidate(result)}
                >
                  <BookOpen size={15} />
                  <span>
                    <strong>{result.title}</strong>
                    <small>
                      {result.authors.join(", ") || "Unknown author"}
                    </small>
                  </span>
                  <Check size={14} />
                </button>
              ))}
            </div>
          )}
          <div className="inventory-ai-row">
            <span>
              <Sparkles size={15} />
              <span>
                <strong>AI review</strong>
                <small>Optional; applies nothing until you approve.</small>
              </span>
            </span>
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
              Review
            </button>
          </div>
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
          {duplicates.length > 0 && (
            <div className="duplicate-warning">
              <AlertTriangle size={18} />
              <div>
                <strong>Possible owned copy already exists</strong>
                <p>{duplicates.map((item) => item.title).join(", ")}</p>
                <small>
                  You can continue when this is another edition or copy.
                </small>
              </div>
            </div>
          )}
          {(coverPreview || form.cover_image_url) && (
            <div className="inventory-cover-preview">
              <Image
                src={coverPreview || form.cover_image_url}
                alt="Selected cover"
                fill
                sizes="52px"
                unoptimized
              />
            </div>
          )}
          <div className="cover-upload-control">
            <div>
              <Upload size={18} />
              <span>
                <strong>Upload this edition’s cover</strong>
                <small>JPEG, PNG, WebP, or AVIF · up to 10 MB</small>
              </span>
            </div>
            <label>
              Choose image
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={(event) => chooseCover(event.target.files?.[0])}
              />
            </label>
          </div>
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
                onChange={(e) => setForm({ ...form, edition: e.target.value })}
              />
            </label>
            <label>
              Language
              <input
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
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
              <select
                value={form.format}
                onChange={(e) => setForm({ ...form, format: e.target.value })}
              >
                <option>Paperback</option>
                <option>Hardcover</option>
                <option>Mass-market paperback</option>
                <option>Collector edition</option>
                <option>Other</option>
              </select>
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
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Study"
              />
            </label>
            <label>
              Shelf
              <input
                value={form.shelf}
                onChange={(e) => setForm({ ...form, shelf: e.target.value })}
                placeholder="Shelf A"
              />
            </label>
            <label>
              Quantity
              <input
                required
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
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
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              />
            </label>
            <label className="wide">
              Tags
              <input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="signed, classic, gift"
              />
            </label>
            <label className="wide">
              Inventory notes
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
          </div>
          <fieldset className="inventory-connection">
            <legend>Pagewise connection</legend>
            <label>
              <input
                type="radio"
                checked={connection === "inventory"}
                onChange={() => setConnection("inventory")}
              />{" "}
              Inventory only
            </label>
            <label>
              <input
                type="radio"
                checked={connection === "existing"}
                onChange={() => setConnection("existing")}
              />{" "}
              Link an existing Pagewise book
            </label>
            <label>
              <input
                type="radio"
                checked={connection === "create"}
                onChange={() => setConnection("create")}
              />{" "}
              Create a Want to Read record
            </label>
            {connection === "existing" && (
              <select
                required
                value={linkedBookId}
                onChange={(e) => setLinkedBookId(e.target.value)}
              >
                <option value="">Choose a Pagewise book</option>
                {books.map((book) => (
                  <option value={book.id} key={book.id}>
                    {book.title}
                    {book.author ? ` — ${book.author}` : ""}
                  </option>
                ))}
              </select>
            )}
          </fieldset>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <footer className="modal-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={close}
            >
              Cancel
            </button>
            <button className="button button-primary" disabled={saving}>
              {saving ? (
                <>
                  <LoaderCircle className="spin" size={16} /> Saving…
                </>
              ) : (
                "Add to LitShelves"
              )}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
