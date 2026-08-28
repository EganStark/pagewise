"use client";

import Image from "next/image";
import {
  ArrowUpDown,
  BookOpen,
  CheckSquare,
  ChevronDown,
  Heart,
  ImageOff,
  LayoutGrid,
  List,
  ListPlus,
  MoreHorizontal,
  RefreshCw,
  Search,
  Square,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  type SetStateAction,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import type { Book, BookStatus } from "../lib/books";
import { STATUS_LABELS } from "../lib/books";
import type { ReadingAttempt } from "../lib/reading-attempts";

type LibraryViewProps = {
  books: Book[];
  attempts: ReadingAttempt[];
  loading: boolean;
  error: string | null;
  onAdd: () => void;
  onRetry: () => void | Promise<void>;
  onUpdate: (id: string, changes: Partial<Book>) => Promise<string | null>;
  onDelete: (id: string) => Promise<string | null>;
  onReplaceCover: (book: Book, file: File) => Promise<string | null>;
  onRemoveCover: (book: Book) => Promise<string | null>;
  onOpen: (book: Book) => void;
  onAddToList: (book: Book) => void;
};

type LibraryLayout = "covers" | "compact" | "list";
type LibraryFilter = "all" | BookStatus;
type LibraryNavigationMemory = {
  query: string;
  filter: LibraryFilter;
  sort: string;
  advancedOpen: boolean;
  author: string;
  genre: string;
  year: string;
  tag: string;
  favoritesOnly: boolean;
  pageState: { signature: string; count: number };
};
const LIBRARY_LAYOUT_KEY = "pagewise:library-layout:v1";
const LIBRARY_LAYOUT_EVENT = "pagewise-library-layout";
const LIBRARY_BATCH_SIZE = 24;
let libraryNavigationMemory: LibraryNavigationMemory = {
  query: "",
  filter: "all",
  sort: "updated",
  advancedOpen: false,
  author: "all",
  genre: "all",
  year: "all",
  tag: "all",
  favoritesOnly: false,
  pageState: { signature: "", count: LIBRARY_BATCH_SIZE },
};

function useRememberedLibraryState<Key extends keyof LibraryNavigationMemory>(
  key: Key,
) {
  const [value, setValue] = useState<LibraryNavigationMemory[Key]>(
    () => libraryNavigationMemory[key],
  );
  const setRememberedValue = (
    nextValue: SetStateAction<LibraryNavigationMemory[Key]>,
  ) => {
    setValue((currentValue) => {
      const resolvedValue =
        typeof nextValue === "function"
          ? (
              nextValue as (
                current: LibraryNavigationMemory[Key],
              ) => LibraryNavigationMemory[Key]
            )(currentValue)
          : nextValue;
      libraryNavigationMemory = {
        ...libraryNavigationMemory,
        [key]: resolvedValue,
      };
      return resolvedValue;
    });
  };
  return [value, setRememberedValue] as const;
}

function getLibraryLayout(): LibraryLayout {
  const saved = window.localStorage.getItem(LIBRARY_LAYOUT_KEY);
  return saved === "compact" || saved === "list" ? saved : "covers";
}

function subscribeToLibraryLayout(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(LIBRARY_LAYOUT_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(LIBRARY_LAYOUT_EVENT, onStoreChange);
  };
}

const filters: Array<{
  value: LibraryFilter;
  label: string;
}> = [
  { value: "all", label: "All books" },
  { value: "want_to_read", label: "Want to Read" },
  { value: "reading", label: "Reading" },
  { value: "completed", label: "Finished" },
  { value: "on_hold", label: "On Hold" },
  { value: "dropped", label: "Dropped" },
];

function PlaceholderCover({ book }: { book: Book }) {
  const tones = ["ochre", "blue", "red", "navy", "cream", "green"];
  const tone =
    (book as Book & { previewTone?: string }).previewTone ??
    tones[book.title.length % tones.length];
  const initials = book.title
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("");
  return (
    <div className={`library-placeholder cover-${tone}`} aria-hidden="true">
      <span>{initials}</span>
      <small>{book.author}</small>
    </div>
  );
}

const SKELETON_BOOKS = Array.from({ length: 8 }, (_, index) => index);

function LibrarySkeleton({ layout }: { layout: LibraryLayout }) {
  return (
    <div
      className={`library-grid library-${layout}-view library-skeleton-grid`}
      role="status"
      aria-label="Loading your library"
    >
      <span className="sr-only">Opening your shelves…</span>
      {SKELETON_BOOKS.slice(0, layout === "list" ? 6 : 8).map((item) => (
        <article
          className="library-book library-skeleton-book"
          key={item}
          aria-hidden="true"
        >
          <div className="library-cover-wrap library-skeleton-cover" />
          <div className="library-book-copy library-skeleton-copy">
            <i />
            <i />
            <i />
          </div>
        </article>
      ))}
    </div>
  );
}

export function LibraryView({
  books,
  attempts,
  loading,
  error,
  onAdd,
  onRetry,
  onUpdate,
  onDelete,
  onReplaceCover,
  onRemoveCover,
  onOpen,
  onAddToList,
}: LibraryViewProps) {
  const [query, setQuery] = useRememberedLibraryState("query");
  const [filter, setFilter] = useRememberedLibraryState("filter");
  const [sort, setSort] = useRememberedLibraryState("sort");
  const [advancedOpen, setAdvancedOpen] =
    useRememberedLibraryState("advancedOpen");
  const [author, setAuthor] = useRememberedLibraryState("author");
  const [genre, setGenre] = useRememberedLibraryState("genre");
  const [year, setYear] = useRememberedLibraryState("year");
  const [tag, setTag] = useRememberedLibraryState("tag");
  const [favoritesOnly, setFavoritesOnly] =
    useRememberedLibraryState("favoritesOnly");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [actionError, setActionError] = useState<string | null>(null);
  const [pageState, setPageState] = useRememberedLibraryState("pageState");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkWorking, setBulkWorking] = useState(false);
  const [bulkTag, setBulkTag] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const layout = useSyncExternalStore(
    subscribeToLibraryLayout,
    getLibraryLayout,
    () => "covers" as LibraryLayout,
  );

  useEffect(() => {
    if (!openMenu) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        !target.closest(".book-menu-wrap, .book-menu")
      )
        setOpenMenu(null);
    };
    const closeOnScroll = () => setOpenMenu(null);
    document.addEventListener("pointerdown", closeOutside);
    window.addEventListener("scroll", closeOnScroll, true);
    window.addEventListener("resize", closeOnScroll);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("scroll", closeOnScroll, true);
      window.removeEventListener("resize", closeOnScroll);
    };
  }, [openMenu]);

  function toggleBookMenu(
    bookId: string,
    event: React.MouseEvent<HTMLButtonElement>,
  ) {
    if (openMenu === bookId) {
      setOpenMenu(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 178;
    const menuHeight = 225;
    const gap = 7;
    setMenuPosition({
      left: Math.min(
        window.innerWidth - menuWidth - 8,
        Math.max(8, rect.right - menuWidth),
      ),
      top:
        rect.bottom + gap + menuHeight <= window.innerHeight
          ? rect.bottom + gap
          : Math.max(8, rect.top - menuHeight - gap),
    });
    setOpenMenu(bookId);
  }

  const filterOptions = useMemo(() => {
    const strings = (values: Array<string | null | undefined>) =>
      [
        ...new Set(
          values
            .map((value) => value?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort((a, b) => a.localeCompare(b));

    return {
      authors: strings(books.map((book) => book.author)),
      genres: strings(books.map((book) => book.genre)),
      years: [
        ...new Set(
          books
            .map((book) => book.publication_year)
            .filter((value): value is number => Boolean(value)),
        ),
      ].sort((a, b) => b - a),
      tags: strings(books.flatMap((book) => book.tags)),
    };
  }, [books]);

  const latestRatings = useMemo(() => {
    const ratings = new Map<string, number>();
    const sortedAttempts = [...attempts].sort(
      (a, b) =>
        new Date(b.completed_at ?? b.updated_at).getTime() -
        new Date(a.completed_at ?? a.updated_at).getTime(),
    );
    for (const attempt of sortedAttempts) {
      if (attempt.rating_numeric !== null && !ratings.has(attempt.book_id)) {
        ratings.set(attempt.book_id, attempt.rating_numeric);
      }
    }
    return ratings;
  }, [attempts]);

  const activeFilterCount =
    Number(filter !== "all") +
    Number(author !== "all") +
    Number(genre !== "all") +
    Number(year !== "all") +
    Number(tag !== "all") +
    Number(favoritesOnly);
  const hasActiveFilters = Boolean(query.trim()) || activeFilterCount > 0;

  const visibleBooks = useMemo(() => {
    const matched = books.filter((book) => {
      const filterMatch = filter === "all" || book.status === filter;
      const advancedMatch =
        (author === "all" || book.author?.trim() === author) &&
        (genre === "all" || book.genre?.trim() === genre) &&
        (year === "all" || book.publication_year === Number(year)) &&
        (tag === "all" ||
          book.tags.some((bookTag) => bookTag.trim() === tag)) &&
        (!favoritesOnly || book.is_favorite);
      const haystack = [
        book.title,
        book.author,
        book.genre,
        book.isbn,
        ...book.tags,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        filterMatch &&
        advancedMatch &&
        (!deferredQuery || haystack.includes(deferredQuery))
      );
    });
    return [...matched].sort((a, b) => {
      let comparison = 0;
      if (sort === "added")
        comparison =
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      else if (sort === "rating") {
        const aRating = latestRatings.get(a.id);
        const bRating = latestRatings.get(b.id);
        if (aRating === undefined && bRating !== undefined) comparison = 1;
        else if (aRating !== undefined && bRating === undefined)
          comparison = -1;
        else comparison = (bRating ?? 0) - (aRating ?? 0);
      } else if (sort === "title") comparison = a.title.localeCompare(b.title);
      if (sort === "author")
        comparison = (a.author ?? "").localeCompare(b.author ?? "");
      else if (sort === "year")
        comparison = (b.publication_year ?? 0) - (a.publication_year ?? 0);
      else if (sort === "updated")
        comparison =
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      return (
        comparison || a.title.localeCompare(b.title) || a.id.localeCompare(b.id)
      );
    });
  }, [
    author,
    books,
    deferredQuery,
    favoritesOnly,
    filter,
    genre,
    latestRatings,
    sort,
    tag,
    year,
  ]);

  const resultSignature = [
    deferredQuery,
    filter,
    author,
    genre,
    year,
    tag,
    String(favoritesOnly),
    sort,
  ].join("\u001f");
  const visibleLimit =
    pageState.signature === resultSignature
      ? pageState.count
      : LIBRARY_BATCH_SIZE;
  const displayedBooks = visibleBooks.slice(0, visibleLimit);
  const hasMoreBooks = displayedBooks.length < visibleBooks.length;
  const selectedCount = selectedIds.size;
  const allDisplayedSelected =
    displayedBooks.length > 0 &&
    displayedBooks.every((book) => selectedIds.has(book.id));

  function clearFilters() {
    setQuery("");
    setFilter("all");
    setAuthor("all");
    setGenre("all");
    setYear("all");
    setTag("all");
    setFavoritesOnly(false);
  }

  function changeLayout(nextLayout: LibraryLayout) {
    window.localStorage.setItem(LIBRARY_LAYOUT_KEY, nextLayout);
    window.dispatchEvent(new Event(LIBRARY_LAYOUT_EVENT));
  }

  function showMoreBooks() {
    setPageState((current) => ({
      signature: resultSignature,
      count:
        (current.signature === resultSignature
          ? current.count
          : LIBRARY_BATCH_SIZE) + LIBRARY_BATCH_SIZE,
    }));
  }

  function showAllBooks() {
    setPageState({ signature: resultSignature, count: visibleBooks.length });
  }

  function leaveSelectionMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  function toggleSelection(bookId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(bookId)) next.delete(bookId);
      else next.add(bookId);
      return next;
    });
  }

  function toggleAllDisplayed() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allDisplayedSelected)
        displayedBooks.forEach((book) => next.delete(book.id));
      else displayedBooks.forEach((book) => next.add(book.id));
      return next;
    });
  }

  async function bulkUpdate(changes: Partial<Book>) {
    if (!selectedCount || bulkWorking) return;
    setBulkWorking(true);
    setActionError(null);
    const results = await Promise.all(
      [...selectedIds].map((id) => onUpdate(id, changes)),
    );
    const updateError = results.find(Boolean) ?? null;
    setActionError(updateError);
    setBulkWorking(false);
    if (!updateError) leaveSelectionMode();
  }

  async function bulkDelete() {
    if (!selectedCount || bulkWorking) return;
    if (
      !window.confirm(
        `Delete ${selectedCount} selected ${selectedCount === 1 ? "book" : "books"} and their reading history?`,
      )
    )
      return;
    setBulkWorking(true);
    setActionError(null);
    const results = await Promise.all(
      [...selectedIds].map((id) => onDelete(id)),
    );
    const deleteError = results.find(Boolean) ?? null;
    setActionError(deleteError);
    setBulkWorking(false);
    if (!deleteError) leaveSelectionMode();
  }

  async function bulkAddTag() {
    const nextTag = bulkTag.trim();
    if (!selectedCount || !nextTag || bulkWorking) return;
    setBulkWorking(true);
    setActionError(null);
    const selectedBooks = books.filter((book) => selectedIds.has(book.id));
    const results = await Promise.all(
      selectedBooks.map((book) =>
        onUpdate(book.id, {
          tags: book.tags.some(
            (bookTag) => bookTag.toLowerCase() === nextTag.toLowerCase(),
          )
            ? book.tags
            : [...book.tags, nextTag],
        }),
      ),
    );
    const updateError = results.find(Boolean) ?? null;
    setActionError(updateError);
    setBulkWorking(false);
    if (!updateError) {
      setBulkTag("");
      leaveSelectionMode();
    }
  }

  async function confirmDelete(book: Book) {
    if (
      !window.confirm(`Delete “${book.title}” and all of its reading history?`)
    )
      return;
    const deleteError = await onDelete(book.id);
    setActionError(deleteError);
    setOpenMenu(null);
  }

  async function replaceCover(
    book: Book,
    file: File | undefined,
    input: HTMLInputElement,
  ) {
    if (!file) return;
    const replaceError = await onReplaceCover(book, file);
    setActionError(replaceError);
    input.value = "";
    if (!replaceError) setOpenMenu(null);
  }

  async function removeCover(book: Book) {
    const removeError = await onRemoveCover(book);
    setActionError(removeError);
    if (!removeError) setOpenMenu(null);
  }

  return (
    <section className="library-view">
      <div className="library-title-row">
        <div>
          <p className="eyebrow">Your collection</p>
          <h1>Library</h1>
          <p className="lead">
            {books.length} books, collected in one quiet place.
          </p>
        </div>
        <div className="library-title-actions">
          {books.length > 0 && (
            <button
              className="button button-secondary"
              type="button"
              onClick={() =>
                selectMode ? leaveSelectionMode() : setSelectMode(true)
              }
            >
              {selectMode ? <X size={15} /> : <CheckSquare size={15} />}
              {selectMode ? "Cancel" : "Select"}
            </button>
          )}
          <button className="button button-primary library-add" onClick={onAdd}>
            Add a book
          </button>
        </div>
      </div>

      <div className="library-tools">
        <label className="library-search">
          <Search size={17} />
          <span className="sr-only">Search library</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, author, genre, ISBN, or tag"
          />
        </label>
        <label className="sort-control">
          <ArrowUpDown size={15} />
          <span className="sr-only">Sort books</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="updated">Recently updated</option>
            <option value="added">Recently added</option>
            <option value="rating">Highest rated</option>
            <option value="title">Title A–Z</option>
            <option value="author">Author A–Z</option>
            <option value="year">Publication year</option>
          </select>
          <ChevronDown size={14} />
        </label>
        <button
          className={
            advancedOpen || activeFilterCount
              ? "advanced-filter-toggle active"
              : "advanced-filter-toggle"
          }
          type="button"
          aria-expanded={advancedOpen}
          aria-controls="advanced-library-filters"
          onClick={() => setAdvancedOpen((current) => !current)}
        >
          <SlidersHorizontal size={15} />
          Filters
          {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
        </button>
      </div>

      <div className="filter-row" aria-label="Filter library">
        {filters.map((item) => (
          <button
            key={item.value}
            className={filter === item.value ? "active" : ""}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
            <span>
              {item.value === "all"
                ? books.length
                : books.filter((book) => book.status === item.value).length}
            </span>
          </button>
        ))}
      </div>

      {advancedOpen && (
        <div className="advanced-library-filters" id="advanced-library-filters">
          <label>
            <span>Author</span>
            <select
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
            >
              <option value="all">All authors</option>
              {filterOptions.authors.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Genre</span>
            <select
              value={genre}
              onChange={(event) => setGenre(event.target.value)}
            >
              <option value="all">All genres</option>
              {filterOptions.genres.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Publication year</span>
            <select
              value={year}
              onChange={(event) => setYear(event.target.value)}
            >
              <option value="all">All years</option>
              {filterOptions.years.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Tag</span>
            <select
              value={tag}
              onChange={(event) => setTag(event.target.value)}
            >
              <option value="all">All tags</option>
              {filterOptions.tags.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="favorites-filter">
            <input
              type="checkbox"
              checked={favoritesOnly}
              onChange={(event) => setFavoritesOnly(event.target.checked)}
            />
            <Heart size={15} fill={favoritesOnly ? "currentColor" : "none"} />
            Favorites only
          </label>
          <button
            className="clear-library-filters"
            type="button"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
          >
            <X size={14} /> Clear all
          </button>
        </div>
      )}

      <div className="library-filter-summary" aria-live="polite">
        <span>
          {visibleBooks.length === books.length
            ? `${books.length} books`
            : `${visibleBooks.length} of ${books.length} books`}
        </span>
        {hasActiveFilters && (
          <button type="button" onClick={clearFilters}>
            Clear filters
          </button>
        )}
        <div
          className="library-layout-switcher"
          role="group"
          aria-label="Library view"
        >
          <button
            type="button"
            className={layout === "covers" ? "active" : ""}
            aria-pressed={layout === "covers"}
            onClick={() => changeLayout("covers")}
          >
            <LayoutGrid size={14} /> <span>Covers</span>
          </button>
          <button
            type="button"
            className={layout === "compact" ? "active" : ""}
            aria-pressed={layout === "compact"}
            onClick={() => changeLayout("compact")}
          >
            <LayoutGrid size={12} /> <span>Compact</span>
          </button>
          <button
            type="button"
            className={layout === "list" ? "active" : ""}
            aria-pressed={layout === "list"}
            onClick={() => changeLayout("list")}
          >
            <List size={14} /> <span>List</span>
          </button>
        </div>
      </div>

      {selectMode && (
        <div
          className="library-bulk-bar"
          role="region"
          aria-label="Bulk book actions"
        >
          <button
            type="button"
            className="bulk-select-all"
            onClick={toggleAllDisplayed}
          >
            {allDisplayedSelected ? (
              <CheckSquare size={16} />
            ) : (
              <Square size={16} />
            )}
            {allDisplayedSelected ? "Clear displayed" : "Select displayed"}
          </button>
          <strong>{selectedCount} selected</strong>
          <form
            className="bulk-tag-form"
            onSubmit={(event) => {
              event.preventDefault();
              void bulkAddTag();
            }}
          >
            <label>
              <span className="sr-only">Tag selected books</span>
              <input
                value={bulkTag}
                onChange={(event) => setBulkTag(event.target.value)}
                placeholder="Add tag"
                maxLength={40}
                disabled={!selectedCount || bulkWorking}
              />
            </label>
            <button
              type="submit"
              disabled={!selectedCount || !bulkTag.trim() || bulkWorking}
            >
              Add tag
            </button>
          </form>
          <button
            type="button"
            disabled={!selectedCount || bulkWorking}
            onClick={() => void bulkUpdate({ is_favorite: true })}
          >
            <Heart size={15} /> Favorite
          </button>
          <button
            type="button"
            disabled={!selectedCount || bulkWorking}
            onClick={() => void bulkUpdate({ is_favorite: false })}
          >
            <Heart size={15} /> Unfavorite
          </button>
          <button
            className="bulk-delete"
            type="button"
            disabled={!selectedCount || bulkWorking}
            onClick={() => void bulkDelete()}
          >
            <Trash2 size={15} /> Delete
          </button>
        </div>
      )}

      {(actionError || (error && books.length > 0)) && (
        <div className="library-message error" role="alert">
          <span>
            {error ? `Could not refresh your library: ${error}` : actionError}
          </span>
          {error && (
            <button
              className="button button-secondary"
              type="button"
              onClick={() => void onRetry()}
            >
              <RefreshCw size={14} /> Retry
            </button>
          )}
        </div>
      )}
      {loading ? (
        <LibrarySkeleton layout={layout} />
      ) : error && books.length === 0 ? (
        <div className="empty-library library-load-error" role="alert">
          <span>
            <RefreshCw size={24} />
          </span>
          <h2>Your shelves didn’t open</h2>
          <p>{error}</p>
          <button
            className="button button-primary"
            type="button"
            onClick={() => void onRetry()}
          >
            <RefreshCw size={15} /> Try again
          </button>
        </div>
      ) : visibleBooks.length === 0 ? (
        <div className="empty-library">
          <span>
            <BookOpen size={25} />
          </span>
          <h2>No books found</h2>
          <p>
            {books.length
              ? "No books match this combination. Clear a filter or try a different search."
              : "Add your first book to begin your private reading library."}
          </p>
          {books.length > 0 && hasActiveFilters && (
            <button className="button" onClick={clearFilters}>
              Clear filters
            </button>
          )}
          {books.length === 0 && (
            <button className="button button-primary" onClick={onAdd}>
              Add your first book
            </button>
          )}
        </div>
      ) : (
        <div className={`library-grid library-${layout}-view`}>
          {displayedBooks.map((book) => (
            <article
              className={`${selectMode ? "library-book selecting" : "library-book"}${selectedIds.has(book.id) ? " selected" : ""}`}
              key={book.id}
            >
              <div className="library-cover-wrap">
                <button
                  className="book-open-target"
                  onClick={() =>
                    selectMode ? toggleSelection(book.id) : onOpen(book)
                  }
                  aria-label={
                    selectMode
                      ? `${selectedIds.has(book.id) ? "Deselect" : "Select"} ${book.title}`
                      : `Open details for ${book.title}`
                  }
                  aria-pressed={
                    selectMode ? selectedIds.has(book.id) : undefined
                  }
                />
                {book.cover_image_url ? (
                  <Image
                    className="library-cover-image"
                    src={book.cover_image_url}
                    alt={`Cover of ${book.title}`}
                    fill
                    sizes="(max-width: 700px) 45vw, 180px"
                    unoptimized
                  />
                ) : (
                  <PlaceholderCover book={book} />
                )}
                {selectMode ? (
                  <span className="book-selection-indicator" aria-hidden="true">
                    {selectedIds.has(book.id) ? (
                      <CheckSquare size={18} />
                    ) : (
                      <Square size={18} />
                    )}
                  </span>
                ) : (
                  <button
                    className={
                      book.is_favorite
                        ? "favorite-button active"
                        : "favorite-button"
                    }
                    aria-label={
                      book.is_favorite
                        ? `Remove ${book.title} from favorites`
                        : `Add ${book.title} to favorites`
                    }
                    onClick={() =>
                      void onUpdate(book.id, { is_favorite: !book.is_favorite })
                    }
                  >
                    <Heart
                      size={16}
                      fill={book.is_favorite ? "currentColor" : "none"}
                    />
                  </button>
                )}
                {!selectMode && (
                  <div className="book-menu-wrap">
                    <button
                      className="book-menu-button"
                      aria-label={`Actions for ${book.title}`}
                      aria-expanded={openMenu === book.id}
                      onClick={(event) => toggleBookMenu(book.id, event)}
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    {openMenu === book.id &&
                      createPortal(
                        <div
                          className="book-menu"
                          style={{
                            top: menuPosition.top,
                            left: menuPosition.left,
                            right: "auto",
                          }}
                        >
                          <button
                            className="open-detail-action"
                            onClick={() => {
                              setOpenMenu(null);
                              onOpen(book);
                            }}
                          >
                            <BookOpen size={14} />
                            Open details
                          </button>
                          <button
                            className="add-to-list-action"
                            onClick={() => {
                              setOpenMenu(null);
                              onAddToList(book);
                            }}
                          >
                            <ListPlus size={14} />
                            Add to lists
                          </button>
                          <label className="book-menu-upload">
                            <Upload size={14} />
                            Replace cover
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/avif"
                              onChange={(event) =>
                                void replaceCover(
                                  book,
                                  event.target.files?.[0],
                                  event.currentTarget,
                                )
                              }
                            />
                          </label>
                          {book.cover_image_url && (
                            <button
                              className="remove-cover-action"
                              onClick={() => void removeCover(book)}
                            >
                              <ImageOff size={14} />
                              Remove cover
                            </button>
                          )}
                          <button onClick={() => void confirmDelete(book)}>
                            <Trash2 size={14} />
                            Delete book
                          </button>
                        </div>,
                        document.body,
                      )}
                  </div>
                )}
              </div>
              <div className="library-book-copy">
                <span className={`status-dot status-${book.status}`}>
                  {STATUS_LABELS[book.status]}
                </span>
                <button
                  className="book-title-button"
                  onClick={() => onOpen(book)}
                >
                  <h2>{book.title}</h2>
                </button>
                <p>{book.author || "Unknown author"}</p>
                {book.status === "reading" && book.total_pages ? (
                  <div className="mini-progress">
                    <i
                      style={{
                        width: `${Math.round((book.current_page / book.total_pages) * 100)}%`,
                      }}
                    />
                  </div>
                ) : (
                  <small>
                    {[book.genre, book.publication_year]
                      .filter(Boolean)
                      .join(" · ") || "No metadata yet"}
                  </small>
                )}
                <div className="library-list-details">
                  <span>{book.genre || "Genre not set"}</span>
                  <span>{book.publication_year || "Year not set"}</span>
                  {book.total_pages ? (
                    <span>{book.total_pages} pages</span>
                  ) : null}
                  {book.isbn ? <span>ISBN {book.isbn}</span> : null}
                  {latestRatings.has(book.id) ? (
                    <span>{latestRatings.get(book.id)} / 5 rating</span>
                  ) : null}
                  {book.tags.slice(0, 3).map((bookTag) => (
                    <b key={bookTag}>{bookTag}</b>
                  ))}
                </div>
              </div>
            </article>
          ))}
          {visibleBooks.length > LIBRARY_BATCH_SIZE && (
            <div className="library-load-more">
              <span>
                Showing {displayedBooks.length} of {visibleBooks.length}
              </span>
              {hasMoreBooks ? (
                <div>
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={showMoreBooks}
                  >
                    Load{" "}
                    {Math.min(
                      LIBRARY_BATCH_SIZE,
                      visibleBooks.length - displayedBooks.length,
                    )}{" "}
                    more
                  </button>
                  <button
                    className="text-button"
                    type="button"
                    onClick={showAllBooks}
                  >
                    Show all
                  </button>
                </div>
              ) : (
                <span>All matching books are shown</span>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
