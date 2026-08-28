"use client";

import Image from "next/image";
import {
  AlertTriangle,
  BookOpen,
  Boxes,
  Check,
  ImageOff,
  LoaderCircle,
  Search,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Book, BookInput, BookStatus } from "../lib/books";
import type {
  AiMetadataFields,
  AiMetadataSuggestion,
} from "../lib/ai-metadata";
import { STATUS_LABELS } from "../lib/books";
import {
  normalizeBookText,
  normalizeIsbn,
  validateCoverFile,
} from "../lib/cover-images";
import type {
  MetadataCandidate,
  MetadataSearchResponse,
} from "../lib/metadata";
import { supabase } from "../lib/supabase";
import type { InventoryItem } from "../lib/inventory";

type AddBookModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (
    input: BookInput,
  ) => Promise<{ data: unknown; error: string | null }>;
  books: Book[];
  inventoryItems: InventoryItem[];
  onUpdateInventory: (
    id: string,
    changes: Partial<InventoryItem>,
  ) => Promise<string | null>;
  onUploadCover: (file: File) => Promise<{
    url: string | null;
    path: string | null;
    error: string | null;
  }>;
  onDiscardCover: (path: string | null, url?: string | null) => Promise<void>;
};

const emptyForm: BookInput = {
  title: "",
  author: null,
  status: "want_to_read",
  cover_image_url: null,
  cover_source: "placeholder",
  genre: null,
  total_pages: null,
  publication_year: null,
  description: null,
  isbn: null,
  tags: [],
};

export function AddBookModal({
  open,
  onClose,
  onSave,
  books,
  inventoryItems,
  onUpdateInventory,
  onUploadCover,
  onDiscardCover,
}: AddBookModalProps) {
  const [mode, setMode] = useState<"search" | "inventory" | "details">(
    "search",
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MetadataCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<BookInput>(emptyForm);
  const [tags, setTags] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [aiWorking, setAiWorking] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AiMetadataSuggestion | null>(
    null,
  );
  const [aiError, setAiError] = useState<string | null>(null);
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [inventoryStatus, setInventoryStatus] =
    useState<BookStatus>("want_to_read");
  const [inventorySavingId, setInventorySavingId] = useState<string | null>(
    null,
  );

  const duplicates = useMemo(() => {
    const isbn = normalizeIsbn(form.isbn);
    const title = normalizeBookText(form.title);
    const author = normalizeBookText(form.author);
    if (!isbn && !title) return [];
    return books.filter((book) => {
      const isbnMatch = Boolean(isbn && normalizeIsbn(book.isbn) === isbn);
      const titleAuthorMatch = Boolean(
        title &&
        author &&
        normalizeBookText(book.title) === title &&
        normalizeBookText(book.author) === author,
      );
      return isbnMatch || titleAuthorMatch;
    });
  }, [books, form.author, form.isbn, form.title]);

  const filteredInventory = useMemo(() => {
    const normalized = inventoryQuery.trim().toLocaleLowerCase();
    if (!normalized) return inventoryItems;
    return inventoryItems.filter((item) =>
      [item.title, item.author, item.isbn, item.genre, ...item.tags].some(
        (value) => value?.toLocaleLowerCase().includes(normalized),
      ),
    );
  }, [inventoryItems, inventoryQuery]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || saving) return;
      if (coverPreview) URL.revokeObjectURL(coverPreview);
      setCoverFile(null);
      setCoverPreview(null);
      setError(null);
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [coverPreview, onClose, open, saving]);

  if (!open) return null;

  async function searchOpenLibrary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/metadata/search?q=${encodeURIComponent(query.trim())}`,
      );
      if (!response.ok)
        throw new Error("Book metadata providers are unavailable right now.");
      const payload = (await response.json()) as MetadataSearchResponse;
      setResults(payload.candidates);
      if (!payload.candidates.length)
        setError(
          "No matching books found. Try another title, author, or ISBN.",
        );
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Book search failed.",
      );
    } finally {
      setSearching(false);
    }
  }

  function chooseResult(result: MetadataCandidate) {
    setForm({
      ...emptyForm,
      title: result.title,
      author: result.authors.join(", ") || null,
      publication_year: result.publicationYear,
      total_pages: result.pageCount,
      isbn: result.isbn,
      description: result.description,
      cover_image_url: result.coverUrl,
      cover_source: result.coverUrl
        ? result.providers.includes("open_library")
          ? "open_library"
          : "url"
        : "placeholder",
      open_library_work_key: result.providers.includes("open_library")
        ? result.workKey
        : null,
      open_library_edition_key: result.providers.includes("open_library")
        ? result.editionKey
        : null,
    });
    setMode("details");
    setError(null);
  }

  function matchingPagewiseBook(item: InventoryItem) {
    const isbn = normalizeIsbn(item.isbn);
    const title = normalizeBookText(item.title);
    const author = normalizeBookText(item.author);
    return books.find(
      (book) =>
        Boolean(isbn && normalizeIsbn(book.isbn) === isbn) ||
        Boolean(
          title &&
          normalizeBookText(book.title) === title &&
          normalizeBookText(book.author) === author,
        ),
    );
  }

  async function addFromInventory(item: InventoryItem) {
    if (item.pagewise_book_id || saving) return;
    setSaving(true);
    setInventorySavingId(item.id);
    setError(null);
    const existing = matchingPagewiseBook(item);
    let pagewiseId = existing?.id ?? null;
    if (!pagewiseId) {
      const result = await onSave({
        ...emptyForm,
        title: item.title,
        author: item.author,
        status: inventoryStatus,
        genre: item.genre,
        publication_year: item.publication_year,
        isbn: item.isbn,
        tags: item.tags,
        cover_image_url: item.cover_image_url,
        // LitShelves remains the owner of its uploaded file. Pagewise may use
        // the public URL, but must not delete the inventory copy's storage path.
        cover_storage_path: null,
        cover_source: item.cover_image_url ? "url" : "placeholder",
      });
      if (result.error || !result.data) {
        setSaving(false);
        setInventorySavingId(null);
        setError(result.error || "Could not add this book to Pagewise.");
        return;
      }
      pagewiseId = (result.data as Book).id;
    }
    const linkError = await onUpdateInventory(item.id, {
      pagewise_book_id: pagewiseId,
    });
    setSaving(false);
    setInventorySavingId(null);
    if (linkError) {
      setError(
        `The Pagewise book was saved, but the LitShelves link failed: ${linkError}`,
      );
      return;
    }
    setInventoryQuery("");
    setInventoryStatus("want_to_read");
    setMode("search");
    onClose();
  }

  async function saveBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    setError(null);
    let uploaded: {
      url: string | null;
      path: string | null;
      error: string | null;
    } | null = null;
    if (coverFile) {
      uploaded = await onUploadCover(coverFile);
      if (uploaded.error || !uploaded.url) {
        setSaving(false);
        setError(uploaded.error ?? "Cover upload failed.");
        return;
      }
    }
    const result = await onSave({
      ...form,
      title: form.title.trim(),
      author: form.author?.trim() || null,
      tags: tags
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
      ...(uploaded?.url
        ? {
            cover_image_url: uploaded.url,
            cover_storage_path: uploaded.path,
            cover_source: "upload" as const,
          }
        : {}),
    });
    setSaving(false);
    if (result.error) {
      if (uploaded) await onDiscardCover(uploaded.path, uploaded.url);
      setError(result.error);
      return;
    }
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setForm(emptyForm);
    setTags("");
    setCoverFile(null);
    setCoverPreview(null);
    setQuery("");
    setResults([]);
    setAiSuggestion(null);
    setAiError(null);
    setMode("search");
    onClose();
  }

  function close() {
    if (saving) return;
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(null);
    setCoverPreview(null);
    setError(null);
    setAiSuggestion(null);
    setAiError(null);
    onClose();
  }

  function chooseCoverFile(file: File | undefined) {
    if (!file) return;
    const validationError = validateCoverFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setError(null);
  }

  function removeSelectedCover() {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(null);
    setCoverPreview(null);
    setForm((current) => ({
      ...current,
      cover_image_url: null,
      cover_storage_path: null,
      cover_source: "placeholder",
    }));
  }

  function applyAiFields(fields: Partial<AiMetadataFields>) {
    setForm((current) => ({
      ...current,
      ...(fields.title ? { title: fields.title } : {}),
      ...(fields.author ? { author: fields.author } : {}),
      ...(fields.genre ? { genre: fields.genre } : {}),
      ...(fields.total_pages !== null && fields.total_pages !== undefined
        ? { total_pages: fields.total_pages }
        : {}),
      ...(fields.publication_year !== null &&
      fields.publication_year !== undefined
        ? { publication_year: fields.publication_year }
        : {}),
      ...(fields.isbn ? { isbn: fields.isbn } : {}),
      ...(fields.description ? { description: fields.description } : {}),
    }));
    if (fields.tags?.length) setTags(fields.tags.join(", "));
  }

  async function askAi() {
    setAiWorking(true);
    setAiError(null);
    setAiSuggestion(null);
    try {
      if (!supabase)
        throw new Error(
          "Sign in and configure Supabase before using AI assistance.",
        );
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sign in before using AI assistance.");
      const response = await fetch("/api/metadata/assist", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fields: {
            title: form.title.trim() || null,
            author: form.author?.trim() || null,
            genre: form.genre?.trim() || null,
            total_pages: form.total_pages,
            publication_year: form.publication_year,
            isbn: form.isbn?.trim() || null,
            description: form.description?.trim() || null,
            tags: tags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean),
          },
          providerCandidates: results.slice(0, 6).map((candidate) => ({
            title: candidate.title,
            authors: candidate.authors,
            genres: candidate.genres,
            publicationYear: candidate.publicationYear,
            pageCount: candidate.pageCount,
            isbn: candidate.isbn,
            description: candidate.description,
            providers: candidate.providers,
          })),
        }),
      });
      const payload = (await response.json()) as {
        suggestion?: AiMetadataSuggestion;
        error?: string;
      };
      if (!response.ok || !payload.suggestion)
        throw new Error(payload.error || "AI metadata review failed.");
      setAiSuggestion(payload.suggestion);
    } catch (requestError) {
      setAiError(
        requestError instanceof Error
          ? requestError.message
          : "AI metadata review failed.",
      );
    } finally {
      setAiWorking(false);
    }
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
        className="book-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-book-title"
      >
        <header className="modal-header">
          <div>
            <p className="eyebrow">Build your library</p>
            <h2 id="add-book-title">Add a book</h2>
          </div>
          <button
            className="icon-button"
            onClick={close}
            aria-label="Close add book dialog"
          >
            <X size={20} />
          </button>
        </header>
        <div className="modal-tabs" role="tablist" aria-label="Add book method">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "search"}
            aria-controls="add-book-search-panel"
            className={mode === "search" ? "active" : ""}
            onClick={() => setMode("search")}
          >
            Find a book
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "details"}
            aria-controls="add-book-details-panel"
            className={mode === "details" ? "active" : ""}
            onClick={() => setMode("details")}
          >
            Enter details
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "inventory"}
            aria-controls="add-book-inventory-panel"
            className={mode === "inventory" ? "active" : ""}
            onClick={() => setMode("inventory")}
          >
            From LitShelves
          </button>
        </div>

        {mode === "search" ? (
          <div
            className="book-search-pane"
            id="add-book-search-panel"
            role="tabpanel"
          >
            <form className="openlibrary-search" onSubmit={searchOpenLibrary}>
              <label htmlFor="book-query">Title, author, or ISBN</label>
              <div>
                <Search size={18} />
                <input
                  id="book-query"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Try ‘Piranesi’ or an ISBN"
                  autoFocus
                />
                <button disabled={searching}>
                  {searching ? (
                    <LoaderCircle size={18} className="spin" />
                  ) : (
                    "Search"
                  )}
                </button>
              </div>
            </form>
            <p className="source-note">
              Pagewise combines Open Library, Google Books, Wikidata, and
              Internet Archive. You can edit every field before saving.
            </p>
            {error && (
              <p className="form-error modal-error" role="alert">
                {error}
              </p>
            )}
            {results.length ? (
              <div className="search-results">
                {results.map((result, index) => (
                  <button
                    key={`${result.id}-${index}`}
                    onClick={() => chooseResult(result)}
                  >
                    <span className="result-cover">
                      {result.coverUrl ? (
                        <Image
                          src={result.coverUrl}
                          alt=""
                          fill
                          sizes="48px"
                          unoptimized
                        />
                      ) : (
                        <BookOpen size={19} />
                      )}
                    </span>
                    <span className="result-copy">
                      <strong>{result.title || "Untitled"}</strong>
                      <small>
                        {result.authors.slice(0, 2).join(", ") ||
                          "Unknown author"}
                      </small>
                      <i>
                        {[
                          result.publicationYear,
                          result.pageCount ? `${result.pageCount} pages` : null,
                          result.providers
                            .map((provider) => provider.replaceAll("_", " "))
                            .join(" + "),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </i>
                    </span>
                    <Check size={17} />
                  </button>
                ))}
              </div>
            ) : (
              !searching && (
                <div className="search-prompt">
                  <span>
                    <Search size={22} />
                  </span>
                  <h3>Find reliable book details</h3>
                  <p>
                    Search across multiple book sources, select the best
                    edition, then review everything before saving.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => setMode("details")}
                  >
                    Or enter a book manually
                  </button>
                </div>
              )
            )}
          </div>
        ) : mode === "inventory" ? (
          <div
            className="inventory-to-pagewise-pane"
            id="add-book-inventory-panel"
            role="tabpanel"
          >
            <div className="inventory-to-pagewise-controls">
              <label>
                Find an owned book
                <span>
                  <Search size={17} />
                  <input
                    value={inventoryQuery}
                    onChange={(event) => setInventoryQuery(event.target.value)}
                    placeholder="Title, author, ISBN, or genre"
                    autoFocus
                  />
                </span>
              </label>
              <label>
                Starting status
                <select
                  value={inventoryStatus}
                  onChange={(event) =>
                    setInventoryStatus(event.target.value as BookStatus)
                  }
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="source-note">
              Pagewise will reuse the owned copy’s metadata and link both
              records. Reading progress stays in Pagewise.
            </p>
            {error && (
              <p className="form-error modal-error" role="alert">
                {error}
              </p>
            )}
            {filteredInventory.length ? (
              <div className="inventory-to-pagewise-list">
                {filteredInventory.map((item) => {
                  const existing = matchingPagewiseBook(item);
                  const linked = Boolean(item.pagewise_book_id);
                  return (
                    <article key={item.id}>
                      <span className="result-cover">
                        {item.cover_image_url ? (
                          <Image
                            src={item.cover_image_url}
                            alt=""
                            fill
                            sizes="48px"
                            unoptimized
                          />
                        ) : (
                          <Boxes size={18} />
                        )}
                      </span>
                      <span className="result-copy">
                        <strong>{item.title}</strong>
                        <small>{item.author || "Unknown author"}</small>
                        <i>
                          {[item.genre, item.location, item.shelf]
                            .filter(Boolean)
                            .join(" · ") || "Owned copy"}
                        </i>
                      </span>
                      <button
                        type="button"
                        disabled={saving || linked}
                        onClick={() => void addFromInventory(item)}
                      >
                        {inventorySavingId === item.id ? (
                          <LoaderCircle size={14} className="spin" />
                        ) : linked ? (
                          <Check size={14} />
                        ) : (
                          <BookOpen size={14} />
                        )}
                        {linked
                          ? "In Pagewise"
                          : existing
                            ? "Link existing"
                            : "Add to Pagewise"}
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="search-prompt">
                <span>
                  <Boxes size={22} />
                </span>
                <h3>No owned books found</h3>
                <p>
                  Add books to LitShelves first, or try another search term.
                </p>
              </div>
            )}
          </div>
        ) : (
          <form
            className="book-details-form"
            id="add-book-details-panel"
            role="tabpanel"
            onSubmit={saveBook}
          >
            <div
              className="metadata-assist add-book-ai-assist"
              aria-live="polite"
            >
              <div className="ai-metadata-review">
                <div>
                  <span>
                    <Sparkles size={14} />
                    <strong>AI metadata review</strong>
                  </span>
                  <small>
                    Optional. AI compares these details with available provider
                    matches and applies nothing without your approval.
                  </small>
                </div>
                <button
                  type="button"
                  onClick={askAi}
                  disabled={aiWorking || !form.title.trim()}
                  title={
                    form.title.trim()
                      ? undefined
                      : "Enter a title before requesting an AI review"
                  }
                >
                  {aiWorking ? (
                    <LoaderCircle size={14} className="spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  {aiWorking ? "Reviewing…" : "Ask AI to review"}
                </button>
              </div>
              {aiError && (
                <small className="metadata-assist-error">{aiError}</small>
              )}
              {aiSuggestion && (
                <div className="ai-metadata-result">
                  <div>
                    <span>{aiSuggestion.confidence} confidence</span>
                    <p>{aiSuggestion.explanation}</p>
                  </div>
                  <div className="ai-metadata-actions">
                    {(
                      Object.entries(aiSuggestion.fields) as Array<
                        [
                          keyof AiMetadataFields,
                          AiMetadataFields[keyof AiMetadataFields],
                        ]
                      >
                    ).map(([key, value]) => {
                      if (value === null || value === "") return null;
                      if (Array.isArray(value) && value.length === 0)
                        return null;
                      return (
                        <button
                          type="button"
                          key={key}
                          onClick={() => applyAiFields({ [key]: value })}
                        >
                          Apply {key.replaceAll("_", " ")}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    className="ai-apply-all"
                    type="button"
                    onClick={() => applyAiFields(aiSuggestion.fields)}
                  >
                    <Check size={14} /> Apply all suggestions
                  </button>
                </div>
              )}
            </div>
            {(coverPreview || form.cover_image_url) && (
              <div className="selected-metadata">
                <div>
                  <Image
                    src={coverPreview || form.cover_image_url!}
                    alt="Selected book cover"
                    fill
                    sizes="64px"
                    unoptimized
                  />
                </div>
                <span>
                  {coverFile
                    ? "Custom cover ready"
                    : "Internet metadata selected"}
                  <small>
                    {coverFile
                      ? "It will be compressed before upload."
                      : "Review and change any field below."}
                  </small>
                </span>
                <button
                  type="button"
                  className="remove-selected-cover"
                  onClick={removeSelectedCover}
                  aria-label="Remove selected cover"
                >
                  <ImageOff size={16} />
                </button>
              </div>
            )}
            <div className="cover-upload-control">
              <div>
                <Upload size={18} />
                <span>
                  <strong>Upload a cover</strong>
                  <small>JPEG, PNG, WebP, or AVIF · up to 10 MB</small>
                </span>
              </div>
              <label>
                Choose image
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  onChange={(event) => chooseCoverFile(event.target.files?.[0])}
                />
              </label>
            </div>
            {duplicates.length > 0 && (
              <div className="duplicate-warning" role="status">
                <AlertTriangle size={18} />
                <div>
                  <strong>Possible duplicate</strong>
                  <p>
                    {duplicates
                      .map(
                        (book) =>
                          `${book.title}${book.author ? ` by ${book.author}` : ""}`,
                      )
                      .join(", ")}{" "}
                    already {duplicates.length === 1 ? "exists" : "exist"} in
                    your library.
                  </p>
                  <small>
                    You can still save this book if it is another edition.
                  </small>
                </div>
              </div>
            )}
            <div className="form-grid">
              <label className="wide">
                Title *
                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  required
                  autoFocus
                />
              </label>
              <label className="wide">
                Author
                <input
                  value={form.author ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      author: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Status
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value as BookStatus,
                    }))
                  }
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Genre
                <input
                  value={form.genre ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      genre: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Total pages
                <input
                  type="number"
                  min="1"
                  value={form.total_pages ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      total_pages: event.target.value
                        ? Number(event.target.value)
                        : null,
                    }))
                  }
                />
              </label>
              <label>
                Publication year
                <input
                  type="number"
                  min="1000"
                  max="2200"
                  value={form.publication_year ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      publication_year: event.target.value
                        ? Number(event.target.value)
                        : null,
                    }))
                  }
                />
              </label>
              <label className="wide">
                ISBN
                <input
                  value={form.isbn ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isbn: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="wide">
                Cover image URL
                <input
                  type="url"
                  value={form.cover_image_url ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      cover_image_url: event.target.value || null,
                      cover_source: event.target.value ? "url" : "placeholder",
                    }))
                  }
                />
              </label>
              <label className="wide">
                Tags <small>Separate with commas</small>
                <input
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="literary, slow-burn, favorite prose"
                />
              </label>
              <label className="wide">
                Description or notes
                <textarea
                  rows={4}
                  value={form.description ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
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
                onClick={close}
              >
                Cancel
              </button>
              <button
                className="button button-primary save-book"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <LoaderCircle size={18} className="spin" />
                    Saving…
                  </>
                ) : (
                  "Save to library"
                )}
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}
