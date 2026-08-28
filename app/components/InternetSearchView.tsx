"use client";

import Image from "next/image";
import {
  ArrowLeft,
  BookOpen,
  Check,
  LoaderCircle,
  Plus,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Book, BookInput } from "../lib/books";
import type {
  MetadataCandidate,
  MetadataProvider,
  MetadataSearchResponse,
} from "../lib/metadata";
import type { InventoryInput, InventoryItem } from "../lib/inventory";
import {
  candidateToBookInput,
  candidateToInventoryInput,
  findInventoryMatch,
  findPagewiseMatch,
  type UnifiedAddTarget,
} from "../lib/unified-book-actions";

export type InternetSearchRequest = {
  query: string;
  type: "all" | "title" | "author" | "isbn";
};

type Props = {
  request: InternetSearchRequest;
  books: Book[];
  inventoryItems: InventoryItem[];
  onBack: () => void;
  onAddBook: (
    input: BookInput,
  ) => Promise<{ data: unknown; error: string | null }>;
  onAddInventory: (
    input: InventoryInput,
  ) => Promise<{ data: InventoryItem | null; error: string | null }>;
  onUpdateInventory: (
    id: string,
    changes: Partial<InventoryItem>,
  ) => Promise<string | null>;
};

export function InternetSearchView({
  request,
  books,
  inventoryItems,
  onBack,
  onAddBook,
  onAddInventory,
  onUpdateInventory,
}: Props) {
  const [results, setResults] = useState<MetadataCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState("all");
  const [provider, setProvider] = useState("all");
  const [coversOnly, setCoversOnly] = useState(false);
  const [sort, setSort] = useState("relevance");
  const [visible, setVisible] = useState(20);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [activeAddMenu, setActiveAddMenu] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      setLoading(true);
      setError(null);
      setResults([]);
      setVisible(20);
      try {
        const params = new URLSearchParams({
          q: request.query,
          type: request.type,
          limit: "40",
        });
        const response = await fetch(`/api/metadata/search?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error("Internet book search is unavailable right now.");
        const payload = (await response.json()) as MetadataSearchResponse;
        setResults(payload.candidates);
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : "Search failed.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void run();
    return () => controller.abort();
  }, [request.query, request.type, retryKey]);

  useEffect(() => {
    if (!activeAddMenu) return;
    const closeMenu = (event: PointerEvent) => {
      if (
        !(event.target as Element).closest(".internet-unified-actions details")
      )
        setActiveAddMenu(null);
    };
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [activeAddMenu]);

  const filtered = useMemo(() => {
    const rows = results.filter((item) => {
      if (
        language !== "all" &&
        (language === "bn" ? item.language !== "bn" : item.language === "bn")
      )
        return false;
      if (
        provider !== "all" &&
        !item.providers.includes(provider as MetadataProvider)
      )
        return false;
      return !coversOnly || Boolean(item.coverUrl);
    });
    return rows.toSorted((a, b) =>
      sort === "year-new"
        ? (b.publicationYear ?? 0) - (a.publicationYear ?? 0)
        : sort === "year-old"
          ? (a.publicationYear ?? 9999) - (b.publicationYear ?? 9999)
          : sort === "title"
            ? a.title.localeCompare(b.title)
            : b.score - a.score,
    );
  }, [coversOnly, language, provider, results, sort]);

  async function add(candidate: MetadataCandidate, target: UnifiedAddTarget) {
    setAddingId(`${candidate.id}:${target}`);
    setError(null);
    let pagewise = findPagewiseMatch(candidate, books) ?? null;
    const inventory = findInventoryMatch(candidate, inventoryItems) ?? null;
    if ((target === "pagewise" || target === "both") && !pagewise) {
      const outcome = await onAddBook(candidateToBookInput(candidate));
      if (outcome.error || !outcome.data) {
        setAddingId(null);
        setError(outcome.error || "Could not add to Pagewise.");
        return;
      }
      pagewise = outcome.data as Book;
    }
    if (target === "inventory" || target === "both") {
      if (!inventory) {
        const outcome = await onAddInventory(
          candidateToInventoryInput(candidate, pagewise?.id ?? null),
        );
        if (outcome.error) setError(outcome.error);
      } else if (pagewise && !inventory.pagewise_book_id) {
        const outcome = await onUpdateInventory(inventory.id, {
          pagewise_book_id: pagewise.id,
        });
        if (outcome) setError(outcome);
      }
    }
    setAddingId(null);
    setActiveAddMenu(null);
  }

  return (
    <section className="internet-search-view">
      <button className="detail-back" onClick={onBack}>
        <ArrowLeft size={17} />
        Back
      </button>
      <div className="internet-search-head">
        <div>
          <p className="eyebrow">Internet book catalogue</p>
          <h1>Results for “{request.query}”</h1>
          <p className="lead">
            Search mode: {request.type} · review editions and add the right one
            to your library.
          </p>
        </div>
        <span>{filtered.length} results</span>
      </div>
      <div className="internet-search-filters">
        <label>
          Language
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            <option value="all">All languages</option>
            <option value="bn">Bengali</option>
            <option value="other">Other languages</option>
          </select>
        </label>
        <label>
          Provider
          <select
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
          >
            <option value="all">All providers</option>
            <option value="open_library">Open Library</option>
            <option value="google_books">Google Books</option>
            <option value="wikidata">Wikidata</option>
            <option value="internet_archive">Internet Archive</option>
          </select>
        </label>
        <label>
          Sort
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="relevance">Best match</option>
            <option value="year-new">Newest year</option>
            <option value="year-old">Oldest year</option>
            <option value="title">Title A–Z</option>
          </select>
        </label>
        <label className="cover-filter">
          <input
            type="checkbox"
            checked={coversOnly}
            onChange={(event) => setCoversOnly(event.target.checked)}
          />
          With cover only
        </label>
      </div>
      {error && results.length > 0 && (
        <div className="detail-error" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <div className="internet-search-state">
          <LoaderCircle className="spin" />
          <p>Searching all connected book sources…</p>
        </div>
      ) : error ? (
        <div className="internet-search-state" role="alert">
          <Search />
          <h2>Internet search couldn’t finish</h2>
          <p>{error}</p>
          <button
            className="button button-secondary"
            onClick={() => setRetryKey((key) => key + 1)}
          >
            Try again
          </button>
        </div>
      ) : filtered.length ? (
        <>
          <div className="internet-results-grid">
            {filtered.slice(0, visible).map((candidate) => {
              const inPagewise = findPagewiseMatch(candidate, books);
              const inInventory = findInventoryMatch(candidate, inventoryItems);
              return (
                <article key={candidate.id}>
                  <div className="internet-result-cover">
                    {candidate.coverUrl ? (
                      <Image
                        src={candidate.coverUrl}
                        alt={`Cover of ${candidate.title}`}
                        fill
                        sizes="110px"
                        unoptimized
                      />
                    ) : (
                      <BookOpen size={24} />
                    )}
                  </div>
                  <div className="internet-result-copy">
                    <div>
                      <h2>{candidate.title}</h2>
                      <p>{candidate.authors.join(", ") || "Unknown author"}</p>
                    </div>
                    <div className="internet-result-meta">
                      {candidate.genres[0] && (
                        <span>{candidate.genres[0]}</span>
                      )}
                      {candidate.publicationYear && (
                        <span>{candidate.publicationYear}</span>
                      )}
                      {candidate.pageCount && (
                        <span>{candidate.pageCount} pages</span>
                      )}
                      {candidate.language && (
                        <span>{candidate.language.toUpperCase()}</span>
                      )}
                    </div>
                    {candidate.isbn && <small>ISBN {candidate.isbn}</small>}
                    <small>
                      {candidate.providers
                        .map((item) => item.replaceAll("_", " "))
                        .join(" + ")}
                    </small>
                    {candidate.description && (
                      <details>
                        <summary>View description</summary>
                        <p>{candidate.description}</p>
                      </details>
                    )}
                  </div>
                  <div className="internet-unified-actions">
                    {inPagewise && (
                      <span>
                        <Check size={12} /> Pagewise
                      </span>
                    )}
                    {inInventory && (
                      <span>
                        <Check size={12} /> LitShelves
                      </span>
                    )}
                    <details
                      open={activeAddMenu === candidate.id}
                      onToggle={(event) => {
                        if (event.currentTarget.open)
                          setActiveAddMenu(candidate.id);
                        else if (activeAddMenu === candidate.id)
                          setActiveAddMenu(null);
                      }}
                    >
                      <summary>
                        <Plus size={14} /> Add
                      </summary>
                      <div>
                        {(
                          [
                            ["pagewise", "Add to Pagewise"],
                            ["inventory", "Add to LitShelves"],
                            ["both", "Add to both"],
                          ] as const
                        ).map(([target, label]) => {
                          const alreadyAdded =
                            (target === "pagewise" && Boolean(inPagewise)) ||
                            (target === "inventory" && Boolean(inInventory)) ||
                            (target === "both" &&
                              Boolean(
                                inPagewise && inInventory?.pagewise_book_id,
                              ));
                          return (
                            <button
                              key={target}
                              disabled={addingId !== null || alreadyAdded}
                              onClick={() => void add(candidate, target)}
                            >
                              {addingId === `${candidate.id}:${target}` && (
                                <LoaderCircle className="spin" size={12} />
                              )}
                              {alreadyAdded ? "Already added" : label}
                            </button>
                          );
                        })}
                      </div>
                    </details>
                  </div>
                </article>
              );
            })}
          </div>
          {visible < filtered.length && (
            <button
              className="button button-secondary load-more-results"
              onClick={() => setVisible((count) => count + 20)}
            >
              Load more results
            </button>
          )}
        </>
      ) : (
        <div className="internet-search-state">
          <Search />
          <h2>No matching editions</h2>
          <p>Try changing the language, provider, or cover filter.</p>
        </div>
      )}
    </section>
  );
}
