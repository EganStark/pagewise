"use client";

import Image from "next/image";
import {
  AlertTriangle,
  Check,
  FileText,
  LoaderCircle,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useState } from "react";
import type { Book, BookInput } from "../lib/books";
import { normalizeBookText, normalizeIsbn } from "../lib/cover-images";
import {
  parseBookList,
  type ParsedBookLine,
  type SmartImportMatch,
} from "../lib/smart-import";
import type {
  MetadataCandidate,
  MetadataSearchResponse,
} from "../lib/metadata";
import type { AiMetadataSuggestion } from "../lib/ai-metadata";
import { supabase } from "../lib/supabase";

type Props = {
  open: boolean;
  books: Book[];
  onClose: () => void;
  onSave: (
    input: BookInput,
  ) => Promise<{ data: unknown; error: string | null }>;
};

const delay = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

export function SmartImportModal({ open, books, onClose, onSave }: Props) {
  const [text, setText] = useState("");
  const [matches, setMatches] = useState<SmartImportMatch[]>([]);
  const [matching, setMatching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [aiReviewingId, setAiReviewingId] = useState<string | null>(null);

  if (!open) return null;

  function clearImport() {
    setText("");
    setMatches([]);
    setMessage(null);
    setMatching(false);
    setSaving(false);
    setAiReviewingId(null);
  }

  function close() {
    clearImport();
    onClose();
  }

  function isDuplicate(item: ParsedBookLine, result: MetadataCandidate) {
    const isbn = normalizeIsbn(result.isbn ?? item.isbn);
    const title = normalizeBookText(result.title ?? item.title);
    const author = normalizeBookText(result.authors[0] ?? item.author);
    return books.some(
      (book) =>
        (isbn && normalizeIsbn(book.isbn) === isbn) ||
        (title &&
          author &&
          normalizeBookText(book.title) === title &&
          normalizeBookText(book.author) === author),
    );
  }

  async function matchBooks() {
    const parsed = parseBookList(text).slice(0, 25);
    if (!parsed.length) {
      setMessage("Paste at least one title, title and author, or ISBN.");
      return;
    }
    setMatching(true);
    setMessage(null);
    setMatches([]);
    const manualMatch = (
      item: ParsedBookLine,
      confidence = "Manual entry",
    ): SmartImportMatch => ({
      ...item,
      status: "review",
      confidence,
      selected: true,
      book: {
        title: item.isbn ? `ISBN ${item.isbn}` : item.title,
        author: item.author,
        isbn: item.isbn,
        status: "want_to_read",
        cover_image_url: null,
        cover_source: "placeholder",
        genre: null,
        total_pages: null,
        publication_year: null,
        description: null,
        tags: [],
      },
    });
    const matchOne = async (
      item: ParsedBookLine,
    ): Promise<SmartImportMatch> => {
      try {
        const query = item.isbn
          ? `isbn:${item.isbn}`
          : [item.title, item.author].filter(Boolean).join(" ");
        const params = new URLSearchParams({
          q: item.isbn ? query : item.title,
        });
        if (item.author) params.set("author", item.author);
        const response = await fetch(`/api/metadata/search?${params}`);
        const payload = response.ok
          ? ((await response.json()) as MetadataSearchResponse)
          : { candidates: [], providers: [] };
        const result = payload.candidates[0];
        if (!result?.title) return manualMatch(item);
        else {
          const exactTitle =
            normalizeBookText(result.title) === normalizeBookText(item.title);
          const authorMatch =
            !item.author ||
            result.authors.some((author) =>
              normalizeBookText(author).includes(
                normalizeBookText(item.author),
              ),
            );
          const duplicate = isDuplicate(item, result);
          const fromOpenLibrary = result.providers.includes("open_library");
          const book: BookInput = {
            title: result.title,
            author: result.authors.join(", ") || item.author,
            status: "want_to_read",
            cover_image_url: result.coverUrl,
            cover_source: result.coverUrl
              ? fromOpenLibrary
                ? "open_library"
                : "url"
              : "placeholder",
            open_library_work_key: fromOpenLibrary ? result.workKey : null,
            open_library_edition_key: fromOpenLibrary
              ? result.editionKey
              : null,
            publication_year: result.publicationYear,
            total_pages: result.pageCount,
            isbn: result.isbn ?? item.isbn,
            genre: null,
            description: result.description,
            tags: [],
          };
          const sources = result.providers
            .map((source) =>
              source === "open_library"
                ? "Open Library"
                : source === "google_books"
                  ? "Google Books"
                  : source === "wikidata"
                    ? "Wikidata"
                    : "Internet Archive",
            )
            .join(" + ");
          return {
            ...item,
            status: duplicate
              ? "duplicate"
              : item.isbn || (exactTitle && authorMatch)
                ? "ready"
                : "review",
            confidence: duplicate ? "Already in library" : sources,
            selected: !duplicate,
            book,
          };
        }
      } catch {
        return manualMatch(item, "Search failed · manual");
      }
    };
    const next: SmartImportMatch[] = [];
    for (let index = 0; index < parsed.length; index += 3) {
      next.push(
        ...(await Promise.all(parsed.slice(index, index + 3).map(matchOne))),
      );
      setMatches([...next]);
      if (index + 3 < parsed.length) await delay(700);
    }
    setMatching(false);
  }

  async function importSelected() {
    const selected = matches.filter((item) => item.selected && item.book);
    setSaving(true);
    setMessage(null);
    let imported = 0;
    const importedIds = new Set<string>();
    for (const item of selected) {
      const result = await onSave(item.book!);
      if (result.error) {
        setMatches((current) =>
          current.map((row) =>
            importedIds.has(row.id)
              ? {
                  ...row,
                  selected: false,
                  status: "duplicate",
                  confidence: "Added to Library",
                }
              : row,
          ),
        );
        setMessage(
          `${imported} imported. Stopped at “${item.raw}”: ${result.error}`,
        );
        setSaving(false);
        return;
      }
      imported += 1;
      importedIds.add(item.id);
    }
    setSaving(false);
    setMatches((current) =>
      current.map((row) =>
        importedIds.has(row.id)
          ? {
              ...row,
              selected: false,
              status: "duplicate",
              confidence: "Added to Library",
            }
          : row,
      ),
    );
    setMessage(`${imported} books added to your Library.`);
  }

  async function improveWithAi(item: SmartImportMatch) {
    if (!item.book) return;
    setAiReviewingId(item.id);
    setMessage(null);
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
            title: item.book.title,
            author: item.book.author,
            genre: item.book.genre,
            total_pages: item.book.total_pages,
            publication_year: item.book.publication_year,
            isbn: item.book.isbn,
            description: item.book.description,
            tags: item.book.tags,
          },
          providerCandidates:
            item.confidence === "Manual entry" ||
            item.confidence.includes("manual")
              ? []
              : [item.book],
        }),
      });
      const payload = (await response.json()) as {
        suggestion?: AiMetadataSuggestion;
        error?: string;
      };
      if (!response.ok || !payload.suggestion)
        throw new Error(payload.error || "AI metadata review failed.");
      const suggestion = payload.suggestion;
      setMatches((current) =>
        current.map((row) => {
          if (row.id !== item.id || !row.book) return row;
          const fields = suggestion.fields;
          return {
            ...row,
            selected: true,
            confidence: `AI reviewed · ${suggestion.confidence}`,
            book: {
              ...row.book,
              title: fields.title || row.book.title,
              author: fields.author || row.book.author,
              genre: fields.genre || row.book.genre,
              total_pages: fields.total_pages ?? row.book.total_pages,
              publication_year:
                fields.publication_year ?? row.book.publication_year,
              isbn: fields.isbn || row.book.isbn,
              description: fields.description || row.book.description,
              tags: fields.tags.length ? fields.tags : row.book.tags,
            },
          };
        }),
      );
    } catch (requestError) {
      setMessage(
        requestError instanceof Error
          ? requestError.message
          : "AI metadata review failed.",
      );
    } finally {
      setAiReviewingId(null);
    }
  }

  return (
    <div
      className="modal-layer smart-import-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="smart-import-title"
    >
      <section className="book-modal smart-import-modal">
        <header className="modal-header">
          <div>
            <p className="eyebrow">Smart Import</p>
            <h2 id="smart-import-title">Turn a text list into books</h2>
            <p>
              Paste up to 25 lines. Pagewise will compare connected metadata
              sources and keep unmatched books available for manual editing.
            </p>
          </div>
          <button
            className="icon-button"
            onClick={close}
            aria-label="Close Smart Import"
          >
            <X size={20} />
          </button>
        </header>
        <div className="smart-import-body">
          <label className="smart-paste">
            Book list
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={
                "Pather Panchali — Bibhutibhushan Bandyopadhyay\nপথের পাঁচালী — বিভূতিভূষণ বন্দ্যোপাধ্যায়\n9780143127741\nThe Hobbit by J.R.R. Tolkien"
              }
            />
            <small>
              Accepted: title, title — author, title by author, or ISBN.
              Duplicate lines are removed.
            </small>
          </label>
          <button
            className="button button-secondary smart-match"
            disabled={matching || !text.trim()}
            onClick={() => void matchBooks()}
          >
            {matching ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Search size={16} />
            )}
            {matching ? `Matching ${matches.length + 1}…` : "Find metadata"}
          </button>
          {(text || matches.length > 0) && (
            <button
              className="text-button smart-import-clear"
              onClick={clearImport}
            >
              Clear import
            </button>
          )}
          {matches.length > 0 && (
            <div className="smart-results">
              <div className="smart-results-head">
                <span>{matches.length} parsed books</span>
                <button
                  className="text-button"
                  onClick={() =>
                    setMatches((current) =>
                      current.map((item) => ({
                        ...item,
                        selected:
                          Boolean(item.book) && item.status !== "duplicate",
                      })),
                    )
                  }
                >
                  Select ready
                </button>
              </div>
              {matches.map((item) => (
                <article
                  key={item.id}
                  className={`smart-result ${item.status}`}
                >
                  <input
                    type="checkbox"
                    aria-label={`Import ${item.raw}`}
                    checked={item.selected}
                    disabled={!item.book || item.status === "duplicate"}
                    onChange={(event) =>
                      setMatches((current) =>
                        current.map((row) =>
                          row.id === item.id
                            ? { ...row, selected: event.target.checked }
                            : row,
                        ),
                      )
                    }
                  />
                  <span className="smart-result-cover">
                    {item.book?.cover_image_url ? (
                      <Image
                        src={item.book.cover_image_url}
                        alt=""
                        fill
                        sizes="42px"
                        unoptimized
                      />
                    ) : (
                      <FileText size={17} />
                    )}
                  </span>
                  <div>
                    <strong>{item.book?.title ?? item.title}</strong>
                    <small>
                      {item.book?.author ?? item.author ?? item.raw}
                    </small>
                  </div>
                  <span className="smart-result-status">
                    <b>
                      {item.status === "ready" ? (
                        <Check size={13} />
                      ) : (
                        <AlertTriangle size={13} />
                      )}
                      {item.confidence}
                    </b>
                    {item.status === "review" && item.book && (
                      <button
                        type="button"
                        disabled={aiReviewingId !== null}
                        onClick={() => void improveWithAi(item)}
                        aria-label={`Ask AI to improve ${item.book.title}`}
                      >
                        {aiReviewingId === item.id ? (
                          <LoaderCircle className="spin" size={12} />
                        ) : (
                          <Sparkles size={12} />
                        )}
                        {aiReviewingId === item.id
                          ? "Reviewing…"
                          : "AI improve"}
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
            disabled={saving || !matches.some((item) => item.selected)}
            onClick={() => void importSelected()}
          >
            {saving ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Check size={16} />
            )}
            {saving
              ? "Adding books…"
              : `Add ${matches.filter((item) => item.selected).length} to Library`}
          </button>
        </footer>
      </section>
    </div>
  );
}
