"use client";
import Image from "next/image";
import {
  BookCheck,
  Download,
  Heart,
  MessageSquareText,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { type SetStateAction, useMemo, useState } from "react";
import { STATUS_LABELS, type Book } from "../lib/books";
import { safeCsvCell } from "../lib/csv";
import type { AttemptDetails, ReadingAttempt } from "../lib/reading-attempts";
import { AttemptEditorModal } from "./AttemptEditorModal";

const DIARY_BATCH_SIZE = 30;
type DiaryNavigationMemory = {
  year: string;
  rating: string;
  genre: string;
  readType: string;
  reviewed: string;
  favorites: string;
  sort: string;
  query: string;
  pageState: { signature: string; count: number };
};
let diaryNavigationMemory: DiaryNavigationMemory = {
  year: "all",
  rating: "all",
  genre: "all",
  readType: "all",
  reviewed: "all",
  favorites: "all",
  sort: "finished-desc",
  query: "",
  pageState: { signature: "", count: DIARY_BATCH_SIZE },
};

function useRememberedDiaryState<Key extends keyof DiaryNavigationMemory>(
  key: Key,
) {
  const [value, setValue] = useState<DiaryNavigationMemory[Key]>(
    () => diaryNavigationMemory[key],
  );
  const setRememberedValue = (
    nextValue: SetStateAction<DiaryNavigationMemory[Key]>,
  ) => {
    setValue((currentValue) => {
      const resolvedValue =
        typeof nextValue === "function"
          ? (
              nextValue as (
                current: DiaryNavigationMemory[Key],
              ) => DiaryNavigationMemory[Key]
            )(currentValue)
          : nextValue;
      diaryNavigationMemory = {
        ...diaryNavigationMemory,
        [key]: resolvedValue,
      };
      return resolvedValue;
    });
  };
  return [value, setRememberedValue] as const;
}

function csvCell(value: unknown) {
  return safeCsvCell(value, true);
}

type Props = {
  books: Book[];
  attempts: ReadingAttempt[];
  loading: boolean;
  error: string | null;
  onOpenBook: (id: string) => void;
  onUpdate: (id: string, details: AttemptDetails) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onUpdateBook: (id: string, changes: Partial<Book>) => Promise<string | null>;
  onLogFinished: (book: Book, details: AttemptDetails) => Promise<boolean>;
};
export function DiaryView({
  books,
  attempts,
  loading,
  error,
  onOpenBook,
  onUpdate,
  onDelete,
  onUpdateBook,
  onLogFinished,
}: Props) {
  const [year, setYear] = useRememberedDiaryState("year");
  const [rating, setRating] = useRememberedDiaryState("rating");
  const [genre, setGenre] = useRememberedDiaryState("genre");
  const [readType, setReadType] = useRememberedDiaryState("readType");
  const [reviewed, setReviewed] = useRememberedDiaryState("reviewed");
  const [favorites, setFavorites] = useRememberedDiaryState("favorites");
  const [sort, setSort] = useRememberedDiaryState("sort");
  const [query, setQuery] = useRememberedDiaryState("query");
  const [pageState, setPageState] = useRememberedDiaryState("pageState");
  const [editing, setEditing] = useState<ReadingAttempt | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerBookId, setPickerBookId] = useState("");
  const [loggingBook, setLoggingBook] = useState<Book | null>(null);
  const [favoriteWorkingId, setFavoriteWorkingId] = useState<string | null>(
    null,
  );
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const bookById = useMemo(
    () => new Map(books.map((book) => [book.id, book])),
    [books],
  );
  const years = useMemo(
    () =>
      [
        ...new Set(
          attempts.flatMap(
            (attempt) => attempt.completed_at?.slice(0, 4) ?? [],
          ),
        ),
      ].sort((a, b) => b.localeCompare(a)),
    [attempts],
  );
  const genres = useMemo(
    () =>
      [...new Set(books.flatMap((book) => book.genre ?? []))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [books],
  );
  const diaryCandidates = useMemo(
    () => [...books].sort((a, b) => a.title.localeCompare(b.title)),
    [books],
  );
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const matches = attempts.filter((attempt) => {
      const book = bookById.get(attempt.book_id);
      return (
        (!normalizedQuery ||
          [book?.title, book?.author, book?.isbn]
            .filter(Boolean)
            .some((value) =>
              value!.toLocaleLowerCase().includes(normalizedQuery),
            )) &&
        (year === "all" || attempt.completed_at?.startsWith(year)) &&
        (rating === "all" ||
          (rating === "unrated"
            ? attempt.rating_numeric === null
            : attempt.rating_numeric !== null &&
              attempt.rating_numeric >= Number(rating))) &&
        (genre === "all" || book?.genre === genre) &&
        (readType === "all" ||
          (readType === "reread"
            ? attempt.attempt_number > 1
            : attempt.attempt_number === 1)) &&
        (reviewed === "all" ||
          (reviewed === "yes" ? Boolean(attempt.review) : !attempt.review)) &&
        (favorites === "all" ||
          (favorites === "yes" ? book?.is_favorite : !book?.is_favorite))
      );
    });
    return matches.sort((a, b) => {
      if (sort === "finished-asc")
        return (a.completed_at ?? "").localeCompare(b.completed_at ?? "");
      if (sort === "rating-desc")
        return (b.rating_numeric ?? -1) - (a.rating_numeric ?? -1);
      if (sort === "title")
        return (bookById.get(a.book_id)?.title ?? "").localeCompare(
          bookById.get(b.book_id)?.title ?? "",
        );
      return (b.completed_at ?? "").localeCompare(a.completed_at ?? "");
    });
  }, [
    attempts,
    bookById,
    favorites,
    genre,
    query,
    rating,
    readType,
    reviewed,
    sort,
    year,
  ]);
  const hasActiveFilters =
    Boolean(query.trim()) ||
    year !== "all" ||
    rating !== "all" ||
    genre !== "all" ||
    readType !== "all" ||
    reviewed !== "all" ||
    favorites !== "all";
  const resultSignature = [
    query.trim().toLocaleLowerCase(),
    year,
    rating,
    genre,
    readType,
    reviewed,
    favorites,
    sort,
  ].join("\u001f");
  const visibleLimit =
    pageState.signature === resultSignature
      ? pageState.count
      : DIARY_BATCH_SIZE;
  const displayedAttempts = filtered.slice(0, visibleLimit);
  const hasMoreAttempts = displayedAttempts.length < filtered.length;
  function clearFilters() {
    setQuery("");
    setYear("all");
    setRating("all");
    setGenre("all");
    setReadType("all");
    setReviewed("all");
    setFavorites("all");
  }
  function showMoreAttempts() {
    setPageState((current) => ({
      signature: resultSignature,
      count:
        (current.signature === resultSignature
          ? current.count
          : DIARY_BATCH_SIZE) + DIARY_BATCH_SIZE,
    }));
  }
  async function toggleFavorite(book: Book) {
    setFavoriteWorkingId(book.id);
    setFavoriteError(null);
    const updateError = await onUpdateBook(book.id, {
      is_favorite: !book.is_favorite,
    });
    setFavoriteWorkingId(null);
    if (updateError) setFavoriteError(updateError);
  }
  function exportDiaryCsv() {
    const headers = [
      "Finished date",
      "Started date",
      "Title",
      "Author",
      "ISBN",
      "Publication year",
      "Genre",
      "Total pages",
      "Read type",
      "Attempt number",
      "Rating",
      "Rating tag",
      "Review",
      "Favorite",
    ];
    const rows = filtered.flatMap((attempt) => {
      const book = bookById.get(attempt.book_id);
      if (!book) return [];
      return [
        [
          attempt.completed_at,
          attempt.started_at,
          book.title,
          book.author,
          book.isbn,
          book.publication_year,
          book.genre,
          book.total_pages,
          attempt.attempt_number > 1 ? "Reread" : "First read",
          attempt.attempt_number,
          attempt.rating_numeric,
          attempt.rating_tag,
          attempt.review,
          book.is_favorite ? "Yes" : "No",
        ],
      ];
    });
    const csv = [headers, ...rows]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `pagewise-diary-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="diary-view">
      <div className="library-title-row">
        <div>
          <p className="eyebrow">Finished-book history</p>
          <h1>Diary</h1>
          <p className="lead">
            Every completed read and reread, preserved by finish date.
          </p>
        </div>
        <div className="diary-title-actions">
          <span className="diary-count">{filtered.length} entries</span>
          <button
            className="button button-secondary"
            type="button"
            disabled={!filtered.length}
            onClick={exportDiaryCsv}
          >
            <Download size={15} /> Export CSV
          </button>
          <button
            className="button button-primary"
            type="button"
            onClick={() => {
              setPickerBookId(diaryCandidates[0]?.id ?? "");
              setPickerOpen(true);
            }}
          >
            <Plus size={15} /> Finish &amp; log a book
          </button>
        </div>
      </div>
      <div className="diary-filters">
        <label className="diary-search-filter">
          Find a finished book
          <span>
            <Search size={14} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Title, author, or ISBN"
            />
          </span>
        </label>
        <label>
          Diary year
          <select
            value={year}
            onChange={(event) => setYear(event.target.value)}
          >
            <option value="all">All years</option>
            {years.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Rating
          <select
            value={rating}
            onChange={(event) => setRating(event.target.value)}
          >
            <option value="all">Any rating</option>
            <option value="5">5 stars</option>
            <option value="4">4+ stars</option>
            <option value="3">3+ stars</option>
            <option value="unrated">Not rated</option>
          </select>
        </label>
        <label>
          Genre
          <select
            value={genre}
            onChange={(event) => setGenre(event.target.value)}
          >
            <option value="all">Any genre</option>
            {genres.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Read type
          <select
            value={readType}
            onChange={(event) => setReadType(event.target.value)}
          >
            <option value="all">First reads & rereads</option>
            <option value="first">First reads</option>
            <option value="reread">Rereads</option>
          </select>
        </label>
        <label>
          Review
          <select
            value={reviewed}
            onChange={(event) => setReviewed(event.target.value)}
          >
            <option value="all">Any</option>
            <option value="yes">Reviewed</option>
            <option value="no">Not reviewed</option>
          </select>
        </label>
        <label>
          Favorite
          <select
            value={favorites}
            onChange={(event) => setFavorites(event.target.value)}
          >
            <option value="all">Any</option>
            <option value="yes">Favorites only</option>
            <option value="no">Not favorited</option>
          </select>
        </label>
        <label>
          Sort by
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="finished-desc">Finished: newest</option>
            <option value="finished-asc">Finished: oldest</option>
            <option value="rating-desc">Rating: highest</option>
            <option value="title">Book title: A–Z</option>
          </select>
        </label>
        {hasActiveFilters ? (
          <button
            className="button button-secondary diary-clear-filters"
            type="button"
            onClick={clearFilters}
          >
            <X size={14} /> Clear
          </button>
        ) : null}
      </div>
      {error && <div className="detail-error">{error}</div>}
      {favoriteError ? (
        <div className="detail-error" role="alert">
          Favorite could not be updated: {favoriteError}
        </div>
      ) : null}
      {loading ? (
        <div className="diary-empty">
          <p>Loading finished books…</p>
        </div>
      ) : filtered.length ? (
        <>
          <div
            className="finished-diary"
            role="table"
            aria-label="Finished book diary"
          >
            <div className="finished-diary-head" role="row">
              <span>Date</span>
              <span>Book</span>
              <span>Published</span>
              <span>Rating</span>
              <span>Favorite</span>
              <span>Reread</span>
              <span>Review</span>
              <span>Edit</span>
            </div>
            {displayedAttempts.map((attempt, index) => {
              const book = bookById.get(attempt.book_id);
              if (!book || !attempt.completed_at) return null;
              const monthKey = attempt.completed_at.slice(0, 7);
              const showMonth =
                !sort.startsWith("finished") ||
                index === 0 ||
                displayedAttempts[index - 1]?.completed_at?.slice(0, 7) !==
                  monthKey;
              const date = new Date(`${attempt.completed_at}T12:00:00`);
              return (
                <div className="finished-diary-row" role="row" key={attempt.id}>
                  {showMonth ? (
                    <time dateTime={attempt.completed_at}>
                      <strong>
                        {new Intl.DateTimeFormat(undefined, {
                          month: "short",
                        }).format(date)}
                      </strong>
                      <small>{date.getFullYear()}</small>
                      <b>{date.getDate()}</b>
                    </time>
                  ) : (
                    <time dateTime={attempt.completed_at}>
                      <b>{date.getDate()}</b>
                    </time>
                  )}
                  <button
                    className="diary-book"
                    onClick={() => onOpenBook(book.id)}
                  >
                    <span>
                      {book.cover_image_url ? (
                        <Image
                          src={book.cover_image_url}
                          fill
                          sizes="45px"
                          alt=""
                          unoptimized
                        />
                      ) : (
                        book.title.slice(0, 2).toUpperCase()
                      )}
                    </span>
                    <strong>
                      {book.title}
                      <small>{book.author || "Unknown author"}</small>
                    </strong>
                  </button>
                  <span>{book.publication_year || "—"}</span>
                  <span className="diary-rating">
                    {attempt.rating_numeric
                      ? `★ ${attempt.rating_numeric}`
                      : "—"}
                  </span>
                  <button
                    className={`diary-favorite ${book.is_favorite ? "active" : ""}`}
                    type="button"
                    disabled={favoriteWorkingId === book.id}
                    aria-pressed={book.is_favorite}
                    aria-label={`${book.is_favorite ? "Remove" : "Add"} ${book.title} ${book.is_favorite ? "from" : "to"} favorites`}
                    onClick={() => void toggleFavorite(book)}
                  >
                    <Heart
                      size={15}
                      fill={book.is_favorite ? "currentColor" : "none"}
                    />
                  </button>
                  <span>
                    {attempt.attempt_number > 1 ? <RotateCcw size={15} /> : "—"}
                  </span>
                  <span>
                    {attempt.review ? <MessageSquareText size={16} /> : "—"}
                  </span>
                  <button
                    className="diary-edit"
                    onClick={() => setEditing(attempt)}
                    aria-label={`Edit ${book.title} diary entry`}
                  >
                    <Pencil size={15} />
                  </button>
                </div>
              );
            })}
          </div>
          {filtered.length > DIARY_BATCH_SIZE ? (
            <div className="library-load-more diary-load-more">
              <span>
                Showing {displayedAttempts.length} of {filtered.length} entries
              </span>
              {hasMoreAttempts ? (
                <div>
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={showMoreAttempts}
                  >
                    Load{" "}
                    {Math.min(
                      DIARY_BATCH_SIZE,
                      filtered.length - displayedAttempts.length,
                    )}{" "}
                    more
                  </button>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() =>
                      setPageState({
                        signature: resultSignature,
                        count: filtered.length,
                      })
                    }
                  >
                    Show all
                  </button>
                </div>
              ) : (
                <span>All matching entries are shown</span>
              )}
            </div>
          ) : null}
        </>
      ) : (
        <div className="diary-empty">
          <BookCheck />
          <h3>No finished books match</h3>
          <p>
            Finish a book with a completion date and it will appear here
            automatically.
          </p>
          {hasActiveFilters ? (
            <button
              className="button button-secondary"
              type="button"
              onClick={clearFilters}
            >
              <X size={14} /> Clear search and filters
            </button>
          ) : null}
        </div>
      )}
      {editing && (
        <AttemptEditorModal
          mode="edit"
          attempt={editing}
          bookTitle={bookById.get(editing.book_id)?.title || "Book"}
          onClose={() => setEditing(null)}
          onSubmit={(details) => onUpdate(editing.id, details)}
          onDelete={() => onDelete(editing.id)}
        />
      )}
      {pickerOpen && (
        <div className="modal-layer" role="presentation">
          <section
            className="book-modal diary-picker-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="diary-picker-title"
          >
            <header className="modal-header">
              <div>
                <p className="eyebrow">Goodreads-style quick finish</p>
                <h2 id="diary-picker-title">Finish &amp; log a book</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setPickerOpen(false)}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </header>
            <div className="diary-picker-body">
              {diaryCandidates.length ? (
                <label>
                  Choose any book from your Library
                  <select
                    value={pickerBookId}
                    onChange={(event) => setPickerBookId(event.target.value)}
                  >
                    {diaryCandidates.map((book) => (
                      <option value={book.id} key={book.id}>
                        {book.title}
                        {book.author ? ` — ${book.author}` : ""}
                        {` — ${
                          book.status === "completed"
                            ? "Finished (log a reread)"
                            : STATUS_LABELS[book.status]
                        }`}
                      </option>
                    ))}
                  </select>
                  <small>
                    Saving marks an unfinished book as Finished and creates its
                    dated Diary entry. A finished book creates a new reread.
                  </small>
                </label>
              ) : (
                <div className="diary-picker-empty">
                  <BookCheck size={25} />
                  <strong>Your Library is empty</strong>
                  <p>Add or import a book first, then finish it from here.</p>
                </div>
              )}
            </div>
            <footer className="modal-actions">
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setPickerOpen(false)}
              >
                Cancel
              </button>
              <button
                className="button button-primary"
                type="button"
                disabled={!pickerBookId}
                onClick={() => {
                  const selectedBook = diaryCandidates.find(
                    (book) => book.id === pickerBookId,
                  );
                  if (selectedBook) setLoggingBook(selectedBook);
                  setPickerOpen(false);
                }}
              >
                Continue
              </button>
            </footer>
          </section>
        </div>
      )}
      {loggingBook && (
        <AttemptEditorModal
          mode="finish"
          bookTitle={loggingBook.title}
          onClose={() => setLoggingBook(null)}
          onSubmit={(details) => onLogFinished(loggingBook, details)}
        />
      )}
    </section>
  );
}
