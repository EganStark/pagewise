"use client";

import Image from "next/image";
import {
  BookOpen,
  Check,
  LoaderCircle,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { FormEvent, useDeferredValue, useEffect, useState } from "react";
import type { Book } from "../lib/books";
import type {
  AiMetadataFields,
  AiMetadataSuggestion,
} from "../lib/ai-metadata";
import type {
  MetadataCandidate,
  MetadataSearchResponse,
} from "../lib/metadata";
import { supabase } from "../lib/supabase";

type EditBookModalProps = {
  book: Book;
  onClose: () => void;
  onSave: (changes: Partial<Book>) => Promise<string | null>;
};

export function EditBookModal({ book, onClose, onSave }: EditBookModalProps) {
  const [form, setForm] = useState(() => ({
    title: book.title,
    author: book.author ?? "",
    genre: book.genre ?? "",
    total_pages: book.total_pages?.toString() ?? "",
    publication_year: book.publication_year?.toString() ?? "",
    isbn: book.isbn ?? "",
    tags: book.tags.join(", "),
    description: book.description ?? "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<MetadataCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [metadataSearched, setMetadataSearched] = useState(false);
  const [metadataChanges, setMetadataChanges] = useState<Partial<Book>>({});
  const [aiWorking, setAiWorking] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AiMetadataSuggestion | null>(
    null,
  );
  const [aiError, setAiError] = useState<string | null>(null);
  const metadataQuery = useDeferredValue(
    [form.title, form.author, form.genre, form.publication_year, form.isbn]
      .map((value) => value.trim())
      .join("|"),
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, saving]);

  useEffect(() => {
    if (metadataQuery.length < 3) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setMetadataSearched(false);
      setSuggestionError(null);
      try {
        const params = new URLSearchParams({
          q: form.title.trim() || metadataQuery,
          type: "title",
        });
        if (form.author.trim()) params.set("author", form.author.trim());
        if (form.genre.trim()) params.set("genre", form.genre.trim());
        if (form.publication_year.trim())
          params.set("year", form.publication_year.trim());
        if (form.isbn.trim()) params.set("isbn", form.isbn.trim());
        const response = await fetch(`/api/metadata/search?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error("Metadata search is unavailable right now.");
        const payload = (await response.json()) as MetadataSearchResponse;
        setSuggestions(payload.candidates.slice(0, 4));
        setMetadataSearched(true);
      } catch (searchError) {
        if (
          searchError instanceof DOMException &&
          searchError.name === "AbortError"
        )
          return;
        setSuggestions([]);
        setMetadataSearched(true);
        setSuggestionError(
          searchError instanceof Error
            ? searchError.message
            : "Metadata search failed.",
        );
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 550);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    form.author,
    form.genre,
    form.isbn,
    form.publication_year,
    form.title,
    metadataQuery,
  ]);

  function applySuggestion(suggestion: MetadataCandidate) {
    setForm((current) => ({
      ...current,
      title: suggestion.title || current.title,
      author: suggestion.authors.join(", ") || current.author,
      genre: suggestion.genres[0] || current.genre,
      total_pages: suggestion.pageCount?.toString() ?? current.total_pages,
      publication_year:
        suggestion.publicationYear?.toString() ?? current.publication_year,
      isbn: suggestion.isbn ?? current.isbn,
      description: current.description || suggestion.description || "",
    }));
    const fromOpenLibrary = suggestion.providers.includes("open_library");
    setMetadataChanges({
      ...(suggestion.coverUrl
        ? {
            cover_image_url: suggestion.coverUrl,
            cover_storage_path: null,
            cover_source: fromOpenLibrary ? "open_library" : "url",
          }
        : {}),
      open_library_work_key: fromOpenLibrary
        ? suggestion.workKey
        : book.open_library_work_key,
      open_library_edition_key: fromOpenLibrary
        ? suggestion.editionKey
        : book.open_library_edition_key,
    });
    setSuggestions([]);
    setSuggestionError(null);
  }

  function applyAiFields(fields: Partial<AiMetadataFields>) {
    setForm((current) => ({
      ...current,
      ...(fields.title ? { title: fields.title } : {}),
      ...(fields.author ? { author: fields.author } : {}),
      ...(fields.genre ? { genre: fields.genre } : {}),
      ...(fields.total_pages !== null && fields.total_pages !== undefined
        ? { total_pages: String(fields.total_pages) }
        : {}),
      ...(fields.publication_year !== null &&
      fields.publication_year !== undefined
        ? { publication_year: String(fields.publication_year) }
        : {}),
      ...(fields.isbn ? { isbn: fields.isbn } : {}),
      ...(fields.description ? { description: fields.description } : {}),
      ...(fields.tags?.length ? { tags: fields.tags.join(", ") } : {}),
    }));
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
            author: form.author.trim() || null,
            genre: form.genre.trim() || null,
            total_pages: form.total_pages ? Number(form.total_pages) : null,
            publication_year: form.publication_year
              ? Number(form.publication_year)
              : null,
            isbn: form.isbn.trim() || null,
            description: form.description.trim() || null,
            tags: form.tags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean),
          },
          providerCandidates: suggestions.map((candidate) => ({
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const totalPages = form.total_pages ? Number(form.total_pages) : null;
    const saveError = await onSave({
      title: form.title.trim(),
      author: form.author.trim() || null,
      genre: form.genre.trim() || null,
      total_pages: totalPages,
      publication_year: form.publication_year
        ? Number(form.publication_year)
        : null,
      isbn: form.isbn.trim() || null,
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
      description: form.description.trim() || null,
      ...metadataChanges,
      ...(totalPages !== null && book.current_page > totalPages
        ? { current_page: totalPages }
        : {}),
    });
    setSaving(false);
    if (saveError) {
      setError(saveError);
      return;
    }
    onClose();
  }

  return (
    <div
      className="modal-layer"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        className="book-modal edit-book-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-book-title"
      >
        <header className="modal-header">
          <div>
            <p className="eyebrow">Library record</p>
            <h2 id="edit-book-title">Edit book</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close edit book dialog"
          >
            <X size={20} />
          </button>
        </header>
        <form className="book-details-form" onSubmit={submit}>
          <div className="metadata-assist" aria-live="polite">
            <div className="metadata-assist-heading">
              <span>
                <Search size={16} />
                <strong>Metadata assistant</strong>
              </span>
              {metadataQuery.length >= 3 && searching && (
                <span>
                  <LoaderCircle size={15} className="spin" />
                  Searching the internet…
                </span>
              )}
            </div>
            <p>
              Edit the title, author, genre, publication year, or ISBN and
              Pagewise will suggest matching editions. Nothing changes until you
              apply one.
            </p>
            {metadataQuery.length >= 3 && suggestionError && (
              <small className="metadata-assist-error">{suggestionError}</small>
            )}
            {metadataQuery.length >= 3 &&
              metadataSearched &&
              !searching &&
              !suggestionError &&
              suggestions.length === 0 && (
                <small className="metadata-assist-empty">
                  No confident edition suggestions yet. Keep your manual details
                  or try adding an ISBN.
                </small>
              )}
            {metadataQuery.length >= 3 &&
              !searching &&
              suggestions.length > 0 && (
                <div className="metadata-suggestions">
                  {suggestions.map((suggestion, index) => (
                    <article key={`${suggestion.id}-${index}`}>
                      <span className="metadata-suggestion-cover">
                        {suggestion.coverUrl ? (
                          <Image
                            src={suggestion.coverUrl}
                            alt=""
                            fill
                            sizes="38px"
                            unoptimized
                          />
                        ) : (
                          <BookOpen size={17} />
                        )}
                      </span>
                      <span>
                        <strong>{suggestion.title}</strong>
                        <small>
                          {suggestion.authors.join(", ") || "Unknown author"}
                        </small>
                        <i>
                          {[
                            suggestion.genres[0],
                            suggestion.publicationYear,
                            suggestion.pageCount
                              ? `${suggestion.pageCount} pages`
                              : null,
                            suggestion.providers
                              .map((provider) => provider.replaceAll("_", " "))
                              .join(" + "),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </i>
                      </span>
                      <button
                        type="button"
                        onClick={() => applySuggestion(suggestion)}
                      >
                        <Check size={14} />
                        Apply
                      </button>
                    </article>
                  ))}
                </div>
              )}
            <div className="ai-metadata-review">
              <div>
                <span>
                  <Sparkles size={14} />
                  <strong>AI review</strong>
                </span>
                <small>
                  Optional and uses your configured API credits. Suggestions are
                  never applied automatically.
                </small>
              </div>
              <button type="button" onClick={askAi} disabled={aiWorking}>
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
                    if (Array.isArray(value) && value.length === 0) return null;
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
                value={form.author}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    author: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Genre
              <input
                value={form.genre}
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
                value={form.total_pages}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    total_pages: event.target.value,
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
                value={form.publication_year}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    publication_year: event.target.value,
                  }))
                }
              />
            </label>
            <label className="wide">
              ISBN
              <input
                value={form.isbn}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    isbn: event.target.value,
                  }))
                }
              />
            </label>
            <label className="wide">
              Tags <small>Separate with commas</small>
              <input
                value={form.tags}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    tags: event.target.value,
                  }))
                }
              />
            </label>
            <label className="wide">
              Description or notes
              <textarea
                rows={5}
                value={form.description}
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
              onClick={onClose}
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
                "Save changes"
              )}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
