"use client";

import Image from "next/image";
import {
  Boxes,
  BookOpen,
  FileText,
  List,
  LoaderCircle,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import type { BookList } from "../lib/book-lists";
import type { Book, BookInput } from "../lib/books";
import type {
  MetadataCandidate,
  MetadataSearchResponse,
} from "../lib/metadata";
import type { ReadingAttempt } from "../lib/reading-attempts";
import type { InventoryInput, InventoryItem } from "../lib/inventory";
import {
  candidateToBookInput,
  candidateToInventoryInput,
  findInventoryMatch,
  findPagewiseMatch,
  type UnifiedAddTarget,
} from "../lib/unified-book-actions";

type Result = {
  key: string;
  type: "book" | "inventory" | "list" | "review";
  title: string;
  detail: string;
  targetId: string;
};
type SearchType = "all" | "title" | "author" | "isbn";
type Props = {
  books: Book[];
  lists: BookList[];
  reviews: ReadingAttempt[];
  inventoryItems: InventoryItem[];
  onOpenBook: (id: string) => void;
  onOpenList: (id: string) => void;
  onOpenInventory: (id: string) => void;
  onShowAll: (query: string, type: SearchType) => void;
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

export function GlobalSearch({
  books,
  lists,
  reviews,
  inventoryItems,
  onOpenBook,
  onOpenList,
  onOpenInventory,
  onShowAll,
  onAddBook,
  onAddInventory,
  onUpdateInventory,
}: Props) {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<SearchType>("all");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [internet, setInternet] = useState<MetadataCandidate[]>([]);
  const [internetLoading, setInternetLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [activeAddMenu, setActiveAddMenu] = useState<string | null>(null);
  const [internetError, setInternetError] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const matchesBook = (book: Book) => {
    const fields =
      searchType === "title"
        ? [book.title]
        : searchType === "author"
          ? [book.author]
          : searchType === "isbn"
            ? [book.isbn]
            : [book.title, book.author, book.genre, book.isbn, ...book.tags];
    return fields
      .filter(Boolean)
      .some((value) =>
        String(value).toLocaleLowerCase().includes(deferredQuery),
      );
  };
  const results: Result[] =
    deferredQuery.length < 2
      ? []
      : [
          ...books.filter(matchesBook).map((book) => ({
            key: `book-${book.id}`,
            type: "book" as const,
            title: book.title,
            detail: [
              book.author,
              book.genre,
              ...book.tags.map((tag) => `#${tag}`),
            ]
              .filter(Boolean)
              .join(" · "),
            targetId: book.id,
          })),
          ...inventoryItems
            .filter((item) => {
              const fields =
                searchType === "title"
                  ? [item.title]
                  : searchType === "author"
                    ? [item.author]
                    : searchType === "isbn"
                      ? [item.isbn]
                      : [
                          item.title,
                          item.author,
                          item.isbn,
                          item.publisher,
                          item.genre,
                          item.location,
                          item.shelf,
                          ...item.tags,
                        ];
              return fields.some((value) =>
                value?.toLocaleLowerCase().includes(deferredQuery),
              );
            })
            .map((item) => ({
              key: `inventory-${item.id}`,
              type: "inventory" as const,
              title: item.title,
              detail: [item.author, "owned copy", item.location, item.shelf]
                .filter(Boolean)
                .join(" · "),
              targetId: item.id,
            })),
          ...lists
            .filter((list) =>
              `${list.title} ${list.description ?? ""}`
                .toLocaleLowerCase()
                .includes(deferredQuery),
            )
            .map((list) => ({
              key: `list-${list.id}`,
              type: "list" as const,
              title: list.title,
              detail: list.description || "Custom list",
              targetId: list.id,
            })),
          ...reviews
            .filter((attempt) =>
              attempt.review?.toLocaleLowerCase().includes(deferredQuery),
            )
            .map((attempt) => {
              const book = books.find((item) => item.id === attempt.book_id);
              return {
                key: `review-${attempt.id}`,
                type: "review" as const,
                title: book?.title || "Book review",
                detail: attempt.review || "",
                targetId: attempt.book_id,
              };
            }),
        ].slice(0, 10);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLocaleLowerCase() === "k"
      ) {
        event.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
      if (event.key === "Escape") {
        setOpen(false);
        setActiveAddMenu(null);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  useEffect(() => {
    if (!open || !activeAddMenu) return;
    const closeMenu = (event: PointerEvent) => {
      if (!(event.target as Element).closest(".search-add-menu"))
        setActiveAddMenu(null);
    };
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [activeAddMenu, open]);

  useEffect(() => {
    if (!open) return;
    const closeSearch = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !searchRef.current?.contains(target)) {
        setOpen(false);
        setActiveAddMenu(null);
      }
    };
    document.addEventListener("pointerdown", closeSearch);
    return () => document.removeEventListener("pointerdown", closeSearch);
  }, [open]);

  useEffect(() => {
    if (deferredQuery.length < 3) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setInternetLoading(true);
      setInternetError(null);
      try {
        const detectedType = /^(?:97[89][\s-]?)?[0-9X][0-9X\s-]{8,16}$/i.test(
          deferredQuery,
        )
          ? "isbn"
          : searchType;
        const params = new URLSearchParams({
          q: deferredQuery,
          type: detectedType,
        });
        const response = await fetch(`/api/metadata/search?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Internet search unavailable");
        const payload = (await response.json()) as MetadataSearchResponse;
        setInternet(payload.candidates.slice(0, 5));
      } catch (cause) {
        if (!controller.signal.aborted) {
          setInternet([]);
          setInternetError(
            cause instanceof Error
              ? cause.message
              : "Internet search unavailable",
          );
        }
      } finally {
        if (!controller.signal.aborted) setInternetLoading(false);
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [deferredQuery, searchType]);

  function choose(result: Result) {
    if (result.type === "list") onOpenList(result.targetId);
    else if (result.type === "inventory") onOpenInventory(result.targetId);
    else onOpenBook(result.targetId);
    setQuery("");
    setOpen(false);
    setActiveAddMenu(null);
  }

  async function add(candidate: MetadataCandidate, target: UnifiedAddTarget) {
    setAddingId(`${candidate.id}:${target}`);
    setInternetError(null);
    let pagewise = findPagewiseMatch(candidate, books) ?? null;
    const inventory = findInventoryMatch(candidate, inventoryItems) ?? null;
    if ((target === "pagewise" || target === "both") && !pagewise) {
      const result = await onAddBook(candidateToBookInput(candidate));
      if (result.error || !result.data) {
        setAddingId(null);
        setInternetError(result.error || "Could not add to Pagewise.");
        return;
      }
      pagewise = result.data as Book;
    }
    if (target === "inventory" || target === "both") {
      if (!inventory) {
        const result = await onAddInventory(
          candidateToInventoryInput(candidate, pagewise?.id ?? null),
        );
        if (result.error) setInternetError(result.error);
      } else if (pagewise && !inventory.pagewise_book_id) {
        const result = await onUpdateInventory(inventory.id, {
          pagewise_book_id: pagewise.id,
        });
        if (result) setInternetError(result);
      }
    }
    setAddingId(null);
    setActiveAddMenu(null);
  }

  function keyDown(event: React.KeyboardEvent) {
    if (!open) setOpen(true);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(results.length - 1, index + 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    }
    if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      choose(results[activeIndex]);
    }
  }

  return (
    <div className="global-search" ref={searchRef}>
      <label className="search-box">
        <Search size={18} />
        <select
          value={searchType}
          onChange={(event) => {
            setSearchType(event.target.value as SearchType);
            setInternet([]);
            setInternetError(null);
            setInternetLoading(false);
          }}
          aria-label="Search by"
        >
          <option value="all">All</option>
          <option value="title">Title</option>
          <option value="author">Author</option>
          <option value="isbn">ISBN</option>
        </select>
        <span className="sr-only">
          Search your library and internet book metadata
        </span>
        <input
          ref={inputRef}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setInternet([]);
            setInternetError(null);
            setInternetLoading(false);
          }}
          onKeyDown={keyDown}
          placeholder={
            searchType === "author"
              ? "Search by author…"
              : searchType === "isbn"
                ? "Enter ISBN…"
                : searchType === "title"
                  ? "Search by title…"
                  : "Title, author, or ISBN…"
          }
          role="searchbox"
          aria-label={`Search Pagewise by ${searchType}`}
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        ) : (
          <kbd>Ctrl K</kbd>
        )}
      </label>
      {open && query && (
        <div
          className="search-results"
          id="global-results"
          role="region"
          aria-label="Pagewise and internet search results"
          aria-live="polite"
        >
          <div className="search-group-label">In Pagewise and LitShelves</div>
          {results.map((result, index) => {
            const Icon =
              result.type === "list"
                ? List
                : result.type === "inventory"
                  ? Boxes
                  : result.type === "review"
                    ? FileText
                    : BookOpen;
            return (
              <button
                key={result.key}
                className={index === activeIndex ? "active" : ""}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(result)}
              >
                <Icon size={16} />
                <span>
                  <strong>{result.title}</strong>
                  <small>
                    {result.type} · {result.detail}
                  </small>
                </span>
              </button>
            );
          })}
          {!results.length && (
            <div className="search-local-empty">No saved matches</div>
          )}
          <div className="search-group-label internet-label">
            Find on the internet{" "}
            {internetLoading && <LoaderCircle className="spin" size={12} />}
          </div>
          {internet.map((candidate) => (
            <div className="internet-book-result" key={candidate.id}>
              <span>
                {candidate.coverUrl ? (
                  <Image
                    src={candidate.coverUrl}
                    alt=""
                    fill
                    sizes="38px"
                    unoptimized
                  />
                ) : (
                  <BookOpen size={15} />
                )}
              </span>
              <div>
                <strong>{candidate.title}</strong>
                <small>
                  {candidate.authors.join(", ") || "Unknown author"} ·{" "}
                  {candidate.providers
                    .map((provider) => provider.replaceAll("_", " "))
                    .join(" + ")}
                </small>
              </div>
              <details
                className="search-add-menu"
                open={activeAddMenu === candidate.id}
                onToggle={(event) => {
                  if (event.currentTarget.open) setActiveAddMenu(candidate.id);
                  else if (activeAddMenu === candidate.id)
                    setActiveAddMenu(null);
                }}
              >
                <summary onMouseDown={(event) => event.preventDefault()}>
                  <Plus size={13} /> Add
                </summary>
                <div>
                  {(
                    [
                      ["pagewise", "Add to Pagewise"],
                      ["inventory", "Add to LitShelves"],
                      ["both", "Add to both"],
                    ] as const
                  ).map(([target, label]) => {
                    const pagewise = findPagewiseMatch(candidate, books);
                    const inventory = findInventoryMatch(
                      candidate,
                      inventoryItems,
                    );
                    const alreadyAdded =
                      (target === "pagewise" && Boolean(pagewise)) ||
                      (target === "inventory" && Boolean(inventory)) ||
                      (target === "both" &&
                        Boolean(pagewise && inventory?.pagewise_book_id));
                    return (
                      <button
                        key={target}
                        disabled={addingId !== null || alreadyAdded}
                        onMouseDown={(event) => event.preventDefault()}
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
          ))}
          {!internetLoading && deferredQuery.length < 3 && (
            <div className="search-no-results">
              <Search size={16} />
              <span>Type at least 3 characters to search internet sources</span>
            </div>
          )}
          {!internetLoading &&
            deferredQuery.length >= 3 &&
            !internet.length && (
              <div className="search-no-results">
                <Search size={16} />
                <span>
                  {internetError || `No internet matches for “${query}”`}
                </span>
              </div>
            )}
          {!internetLoading && deferredQuery.length >= 3 && (
            <button
              className="show-all-results"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onShowAll(query.trim(), searchType);
                setOpen(false);
                setActiveAddMenu(null);
              }}
            >
              Show all internet results
            </button>
          )}
          <footer>
            Local results are instant · internet results can be added directly
          </footer>
        </div>
      )}
    </div>
  );
}
