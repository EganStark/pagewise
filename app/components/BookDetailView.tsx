"use client";

import Image from "next/image";
import {
  ArrowLeft,
  BookMarked,
  BookOpen,
  CalendarDays,
  CalendarClock,
  Check,
  Heart,
  ImageOff,
  Library,
  List,
  LoaderCircle,
  MessageSquareQuote,
  NotebookPen,
  Pause,
  Pencil,
  Plus,
  RotateCcw,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { Book } from "../lib/books";
import { STATUS_LABELS } from "../lib/books";
import { useReadingAttempts } from "../hooks/useReadingAttempts";
import { EditBookModal } from "./EditBookModal";
import { AttemptEditorModal } from "./AttemptEditorModal";
import type { ReadingAttempt } from "../lib/reading-attempts";
import type { BookList, ListMembership } from "../lib/book-lists";
import type { BookQuote } from "../lib/quotes";
import { useBookQuotes } from "../hooks/useBookQuotes";
import { QuoteEditorModal } from "./QuoteEditorModal";
import type { ReadingLog } from "../lib/reading-logs";
import { estimateBookFinish } from "../lib/reading-stats";

type BookDetailViewProps = {
  book: Book;
  onBack: () => void;
  onUpdate: (id: string, changes: Partial<Book>) => Promise<string | null>;
  onDelete: (id: string) => Promise<string | null>;
  onReplaceCover: (book: Book, file: File) => Promise<string | null>;
  onRemoveCover: (book: Book) => Promise<string | null>;
  previewMode: boolean;
  onLifecycleBookChange: (changes: Partial<Book>) => void;
  onQuickLog: () => void;
  onAddToList: () => void;
  lists: BookList[];
  memberships: ListMembership[];
  userId: string | null;
  onAttemptChange: (attempt: ReadingAttempt) => void | Promise<void>;
  readingLogs: ReadingLog[];
};

function DetailCover({ book }: { book: Book }) {
  if (book.cover_image_url)
    return (
      <Image
        src={book.cover_image_url}
        alt={`Cover of ${book.title}`}
        fill
        sizes="(max-width: 700px) 54vw, 240px"
        unoptimized
      />
    );
  const initials = book.title
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("");
  const tones = ["ochre", "blue", "red", "navy", "cream", "green"];
  return (
    <div
      className={`detail-placeholder cover-${tones[book.title.length % tones.length]}`}
    >
      <span>{initials}</span>
      <small>{book.author}</small>
    </div>
  );
}

export function BookDetailView({
  book,
  onBack,
  onUpdate,
  onDelete,
  onReplaceCover,
  onRemoveCover,
  previewMode,
  onLifecycleBookChange,
  onQuickLog,
  onAddToList,
  lists,
  memberships,
  userId,
  onAttemptChange,
  readingLogs,
}: BookDetailViewProps) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [editingAttempt, setEditingAttempt] = useState<ReadingAttempt | null>(
    null,
  );
  const [draftPage, setDraftPage] = useState(book.current_page);
  const [progressSaving, setProgressSaving] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [coverWorking, setCoverWorking] = useState<"replace" | "remove" | null>(
    null,
  );
  const [coverMessage, setCoverMessage] = useState<string | null>(null);
  const [quoteEditorOpen, setQuoteEditorOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<BookQuote | null>(null);
  const normalizedDraftPage = book.total_pages
    ? Math.min(book.total_pages, Math.max(0, draftPage))
    : draftPage;
  const progress = book.total_pages
    ? Math.round((normalizedDraftPage / book.total_pages) * 100)
    : null;
  const reading = useReadingAttempts({
    book,
    previewMode,
    onBookChange: onLifecycleBookChange,
  });
  const quoteStore = useBookQuotes(book.id, userId, previewMode);
  const highlightedAttempt =
    reading.attempts.find((attempt) => !attempt.completed_at) ??
    reading.attempts[0];
  const recentBookLogs = useMemo(
    () =>
      readingLogs
        .filter((log) => log.book_id === book.id)
        .sort(
          (a, b) =>
            b.log_date.localeCompare(a.log_date) ||
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice(0, 5),
    [book.id, readingLogs],
  );
  const pace = useMemo(
    () =>
      estimateBookFinish(
        { ...book, current_page: normalizedDraftPage },
        readingLogs,
      ),
    [book, normalizedDraftPage, readingLogs],
  );

  async function update(changes: Partial<Book>) {
    const updateError = await onUpdate(book.id, changes);
    setError(updateError);
    return updateError;
  }

  async function saveProgress() {
    if (!book.total_pages || progressSaving) return;
    const nextPage = Math.min(
      book.total_pages,
      Math.max(0, Math.round(draftPage)),
    );
    setDraftPage(nextPage);
    setProgressSaving(true);
    setProgressMessage(null);
    const updateError = await update({ current_page: nextPage });
    setProgressSaving(false);
    if (updateError) {
      setDraftPage(book.current_page);
      return;
    }
    setProgressMessage(`Progress saved at page ${nextPage}.`);
  }

  async function deleteBook() {
    if (
      !window.confirm(
        `Delete “${book.title}” and all related reading history? This cannot be undone.`,
      )
    )
      return;
    const deleteError = await onDelete(book.id);
    if (deleteError) {
      setError(deleteError);
      return;
    }
    onBack();
  }

  async function replaceCover(file: File | undefined, input: HTMLInputElement) {
    if (!file || coverWorking) return;
    setCoverWorking("replace");
    setCoverMessage(null);
    setError(null);
    const replaceError = await onReplaceCover(book, file);
    input.value = "";
    setError(replaceError);
    setCoverWorking(null);
    if (!replaceError) setCoverMessage("Cover replaced successfully.");
  }

  async function removeCover() {
    if (coverWorking || !book.cover_image_url) return;
    if (!window.confirm(`Remove the current cover from “${book.title}”?`))
      return;
    setCoverWorking("remove");
    setCoverMessage(null);
    setError(null);
    const removeError = await onRemoveCover(book);
    setError(removeError);
    setCoverWorking(null);
    if (!removeError)
      setCoverMessage("Cover removed. Pagewise is using a placeholder.");
  }
  async function finishAttempt(
    details: import("../lib/reading-attempts").AttemptDetails,
  ) {
    const activeAttempt = reading.attempts.find(
      (attempt) => !attempt.completed_at,
    );
    const success = await reading.finish(details);
    if (success) {
      const now = new Date().toISOString();
      await onAttemptChange({
        id: activeAttempt?.id ?? crypto.randomUUID(),
        book_id: book.id,
        user_id: book.user_id,
        attempt_number:
          activeAttempt?.attempt_number ?? reading.attempts.length + 1,
        started_at: details.started_at,
        completed_at: details.completed_at,
        rating_numeric: details.rating_numeric,
        rating_tag: details.rating_tag,
        review: details.review,
        created_at: activeAttempt?.created_at ?? now,
        updated_at: now,
      });
    }
    return success;
  }
  async function editAttempt(
    id: string,
    details: import("../lib/reading-attempts").AttemptDetails,
  ) {
    const success = await reading.updateAttempt(id, details);
    const attempt = reading.attempts.find((item) => item.id === id);
    if (success && attempt)
      await onAttemptChange({
        ...attempt,
        ...details,
        updated_at: new Date().toISOString(),
      });
    return success;
  }

  return (
    <section className="book-detail-view">
      <button className="detail-back" onClick={onBack}>
        <ArrowLeft size={17} />
        Back to Library
      </button>
      {error && (
        <div className="detail-error" role="alert">
          {error}
        </div>
      )}
      <div className="detail-hero">
        <div className="detail-cover-column">
          <div className="detail-cover">
            <DetailCover book={book} />
          </div>
          <div className="cover-actions">
            <label className={coverWorking ? "disabled" : ""}>
              {coverWorking === "replace" ? (
                <LoaderCircle size={14} className="spin" />
              ) : (
                <Upload size={14} />
              )}
              {coverWorking === "replace" ? "Replacing" : "Replace"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                disabled={Boolean(coverWorking)}
                onChange={(event) =>
                  void replaceCover(
                    event.target.files?.[0],
                    event.currentTarget,
                  )
                }
              />
            </label>
            {book.cover_image_url && (
              <button
                disabled={Boolean(coverWorking)}
                onClick={() => void removeCover()}
              >
                {coverWorking === "remove" ? (
                  <LoaderCircle size={14} className="spin" />
                ) : (
                  <ImageOff size={14} />
                )}
                {coverWorking === "remove" ? "Removing" : "Remove"}
              </button>
            )}
          </div>
          <span
            className="cover-action-status"
            role="status"
            aria-live="polite"
          >
            {coverMessage}
          </span>
        </div>
        <div className="detail-main">
          <div className="detail-heading-actions">
            <span className={`detail-status status-${book.status}`}>
              {STATUS_LABELS[book.status]}
            </span>
            <div>
              <button
                className={book.is_favorite ? "active" : ""}
                onClick={() => void update({ is_favorite: !book.is_favorite })}
                aria-label={
                  book.is_favorite
                    ? "Remove from favorites"
                    : "Add to favorites"
                }
              >
                <Heart
                  size={18}
                  fill={book.is_favorite ? "currentColor" : "none"}
                />
              </button>
              <button onClick={() => setEditing(true)}>
                <Pencil size={17} />
                Edit
              </button>
            </div>
          </div>
          <h1>{book.title}</h1>
          <p className="detail-author">{book.author || "Unknown author"}</p>
          <div className="detail-metadata">
            {book.genre && <span>{book.genre}</span>}
            {book.publication_year && <span>{book.publication_year}</span>}
            {book.total_pages && <span>{book.total_pages} pages</span>}
            {book.isbn && <span>ISBN {book.isbn}</span>}
          </div>
          <div className="reading-actions" aria-label="Reading status actions">
            {book.status === "want_to_read" && (
              <button
                className="button button-primary"
                disabled={reading.working}
                onClick={() => void reading.startOrResume()}
              >
                {reading.working ? (
                  <LoaderCircle size={17} className="spin" />
                ) : (
                  <BookOpen size={17} />
                )}
                Start reading
              </button>
            )}
            {book.status === "reading" && (
              <>
                <button className="button button-primary" onClick={onQuickLog}>
                  <Plus size={15} />
                  Log reading
                </button>
                <button
                  className="button button-secondary"
                  disabled={reading.working}
                  onClick={() => setFinishing(true)}
                >
                  <Square size={15} />
                  Finish book
                </button>
                <button
                  className="button button-secondary"
                  disabled={reading.working}
                  onClick={() => void reading.pauseOrDrop("on_hold")}
                >
                  <Pause size={15} />
                  Put on hold
                </button>
                <button
                  className="button button-quiet-danger"
                  disabled={reading.working}
                  onClick={() => void reading.pauseOrDrop("dropped")}
                >
                  Drop book
                </button>
              </>
            )}
            {(book.status === "on_hold" || book.status === "dropped") && (
              <button
                className="button button-primary"
                disabled={reading.working}
                onClick={() => void reading.startOrResume()}
              >
                <BookOpen size={17} />
                Resume reading
              </button>
            )}
            {book.status === "completed" && (
              <button
                className="button button-primary"
                disabled={reading.working}
                onClick={() => void reading.startOrResume()}
              >
                <RotateCcw size={16} />
                Start reread
              </button>
            )}
          </div>
          {reading.error && (
            <p className="lifecycle-error" role="alert">
              {reading.error}
            </p>
          )}
          {!reading.loading && highlightedAttempt && (
            <section
              className="detail-attempt-summary"
              aria-label="Current or latest reading attempt"
            >
              <header>
                <span>
                  {highlightedAttempt.completed_at
                    ? "Latest read"
                    : "Current read"}
                  <small>Attempt {highlightedAttempt.attempt_number}</small>
                </span>
                <button
                  type="button"
                  onClick={() => setEditingAttempt(highlightedAttempt)}
                >
                  <Pencil size={13} /> Edit
                </button>
              </header>
              <dl>
                <div>
                  <dt>Started</dt>
                  <dd>{highlightedAttempt.started_at || "Not recorded"}</dd>
                </div>
                <div>
                  <dt>
                    {highlightedAttempt.completed_at ? "Finished" : "Status"}
                  </dt>
                  <dd>
                    {highlightedAttempt.completed_at ||
                      STATUS_LABELS[book.status]}
                  </dd>
                </div>
                <div>
                  <dt>Rating</dt>
                  <dd>
                    {highlightedAttempt.rating_numeric
                      ? `${highlightedAttempt.rating_numeric} / 5`
                      : "Not rated"}
                  </dd>
                </div>
              </dl>
              {highlightedAttempt.rating_tag && (
                <strong>{highlightedAttempt.rating_tag}</strong>
              )}
              {highlightedAttempt.review && <p>{highlightedAttempt.review}</p>}
            </section>
          )}
          {book.total_pages ? (
            <div className="detail-progress">
              <div>
                <span>Reading progress</span>
                <strong>
                  {draftPage} / {book.total_pages} pages · {progress}%
                </strong>
              </div>
              <input
                type="range"
                min="0"
                max={book.total_pages}
                value={draftPage}
                disabled={progressSaving}
                onChange={(event) => {
                  setDraftPage(Number(event.target.value));
                  setProgressMessage(null);
                }}
                aria-label="Current page"
                aria-describedby="progress-save-status"
              />
              <div className="detail-progress-bar">
                <i style={{ width: `${progress}%` }} />
              </div>
              <form
                className="detail-progress-controls"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveProgress();
                }}
              >
                <label>
                  Exact page
                  <input
                    type="number"
                    min="0"
                    max={book.total_pages}
                    step="1"
                    value={draftPage}
                    disabled={progressSaving}
                    onChange={(event) => {
                      setDraftPage(Number(event.target.value));
                      setProgressMessage(null);
                    }}
                    aria-describedby="progress-save-status"
                  />
                </label>
                <button
                  className="button button-secondary"
                  disabled={progressSaving || draftPage === book.current_page}
                >
                  {progressSaving ? (
                    <LoaderCircle size={14} className="spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  {progressSaving ? "Saving" : "Save progress"}
                </button>
                <span
                  id="progress-save-status"
                  role="status"
                  aria-live="polite"
                >
                  {progressMessage}
                </span>
              </form>
              {book.status === "reading" && (
                <div className={pace ? "detail-pace available" : "detail-pace"}>
                  <CalendarClock size={15} />
                  {pace ? (
                    <span>
                      At{" "}
                      <strong>
                        {pace.averagePagesPerDay.toFixed(1)} pages/day
                      </strong>
                      , you may finish in {pace.daysRemaining}{" "}
                      {pace.daysRemaining === 1 ? "day" : "days"}—around{" "}
                      <time
                        dateTime={pace.estimatedDate.toISOString().slice(0, 10)}
                      >
                        {new Intl.DateTimeFormat(undefined, {
                          month: "short",
                          day: "numeric",
                        }).format(pace.estimatedDate)}
                      </time>
                      .
                    </span>
                  ) : (
                    <span>
                      Log at least two recent reading sessions to calculate your
                      pace.
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="detail-progress unknown">
              <BookOpen size={18} />
              <span>
                Add a page count to track percentage and estimated finish date.
              </span>
            </div>
          )}
          {book.description ? (
            <p className="detail-description">{book.description}</p>
          ) : (
            <button
              className="add-description"
              onClick={() => setEditing(true)}
            >
              <Plus size={15} />
              Add description or personal notes
            </button>
          )}
          <div className="detail-tags">
            {book.tags.map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
            {book.tags.length === 0 && (
              <button onClick={() => setEditing(true)}>
                <Plus size={13} />
                Add tags
              </button>
            )}
          </div>
        </div>
      </div>

      <nav className="detail-section-nav" aria-label="Book detail sections">
        <span>Jump to</span>
        <a href="#book-lists">Lists</a>
        <a href="#book-quotes">Quotes & notes</a>
        <a href="#book-logs">Reading logs</a>
        <a href="#book-history">Reading history</a>
      </nav>
      <div className="detail-sections">
        <article className="detail-section reading-log-preview" id="book-logs">
          <header>
            <div>
              <NotebookPen size={18} />
              <span>
                <strong>Recent reading logs</strong>
                <small>Your latest page-by-page sessions</small>
              </span>
            </div>
            <button className="text-button" onClick={onQuickLog}>
              <Plus size={14} /> Quick Log
            </button>
          </header>
          {recentBookLogs.length ? (
            <div className="book-log-preview-list">
              {recentBookLogs.map((log) => (
                <article key={log.id}>
                  <time dateTime={log.log_date}>
                    {new Intl.DateTimeFormat(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }).format(new Date(`${log.log_date}T00:00:00`))}
                  </time>
                  <div>
                    <strong>{log.pages_read} pages</strong>
                    <span>
                      {log.start_page !== null && log.end_page !== null
                        ? `Page ${log.start_page} → ${log.end_page}`
                        : "Page range unavailable"}
                    </span>
                    {log.note && <p>{log.note}</p>}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="detail-empty compact">
              <NotebookPen size={20} />
              <p>No reading sessions logged for this book yet.</p>
              <button className="text-button" onClick={onQuickLog}>
                Log the first session
              </button>
            </div>
          )}
        </article>
        <article className="detail-section reading-history" id="book-history">
          <header>
            <div>
              <BookMarked size={18} />
              <span>
                <strong>Reading history</strong>
                <small>Every read and reread stays separate</small>
              </span>
            </div>
            {book.status === "completed" && (
              <button
                className="text-button"
                disabled={reading.working}
                onClick={() => void reading.startOrResume()}
              >
                <Plus size={14} />
                Start reread
              </button>
            )}
          </header>
          {reading.loading ? (
            <div className="detail-empty">
              <LoaderCircle size={20} className="spin" />
              <p>Loading reading history…</p>
            </div>
          ) : reading.attempts.length ? (
            <div className="attempt-list">
              {reading.attempts.map((attempt) => (
                <article key={attempt.id}>
                  <div className="attempt-number">{attempt.attempt_number}</div>
                  <div className="attempt-copy">
                    <strong>
                      {attempt.attempt_number === 1
                        ? "First read"
                        : `Read ${attempt.attempt_number}`}
                    </strong>
                    <span>
                      {attempt.started_at
                        ? `Started ${attempt.started_at}`
                        : "Start date unknown"}
                      {attempt.completed_at
                        ? ` · Finished ${attempt.completed_at}`
                        : " · In progress"}
                    </span>
                    {attempt.review && <p>{attempt.review}</p>}
                  </div>
                  <div className="attempt-rating">
                    {attempt.rating_numeric
                      ? `★ ${attempt.rating_numeric}`
                      : "Not rated"}
                    {attempt.rating_tag && <small>{attempt.rating_tag}</small>}
                    <button
                      onClick={() => setEditingAttempt(attempt)}
                      aria-label={`Edit reading attempt ${attempt.attempt_number}`}
                    >
                      <Pencil size={13} />
                      Edit
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="detail-empty">
              <CalendarDays size={20} />
              <p>No reading attempts recorded yet.</p>
              <span>
                Starting or finishing a book will create its first history
                entry.
              </span>
            </div>
          )}
        </article>
        <article className="detail-section detail-lists" id="book-lists">
          <header>
            <div>
              <List size={18} />
              <span>
                <strong>Lists</strong>
                <small>Custom collections containing this book</small>
              </span>
            </div>
            <button className="text-button" onClick={onAddToList}>
              <Plus size={14} />
              Add to list
            </button>
          </header>
          {memberships.some((item) => item.book_id === book.id) ? (
            <div className="book-list-chips">
              {memberships
                .filter((item) => item.book_id === book.id)
                .map((item) => (
                  <span key={item.list_id}>
                    {lists.find((list) => list.id === item.list_id)?.title}
                  </span>
                ))}
            </div>
          ) : (
            <div className="detail-empty compact">
              <Library size={20} />
              <p>This book is not in a custom list yet.</p>
            </div>
          )}
        </article>
        <article className="detail-section detail-quotes" id="book-quotes">
          <header>
            <div>
              <MessageSquareQuote size={18} />
              <span>
                <strong>Quotes & notes</strong>
                <small>Lines worth returning to</small>
              </span>
            </div>
            <button
              className="text-button"
              onClick={() => {
                setEditingQuote(null);
                setQuoteEditorOpen(true);
              }}
            >
              <Plus size={14} />
              Save a quote
            </button>
          </header>
          {quoteStore.error && (
            <p className="lifecycle-error">{quoteStore.error}</p>
          )}
          {quoteStore.loading ? (
            <div className="detail-empty compact">
              <LoaderCircle size={20} className="spin" />
              <p>Loading quotes…</p>
            </div>
          ) : quoteStore.quotes.length ? (
            <div className="saved-quotes">
              {quoteStore.quotes.map((quote) => (
                <article key={quote.id}>
                  <MessageSquareQuote size={16} />
                  <div>
                    <blockquote>{quote.quote_text}</blockquote>
                    {quote.page_number !== null && (
                      <span>Page {quote.page_number}</span>
                    )}
                    {quote.note && <p>{quote.note}</p>}
                    <div>
                      <button
                        onClick={() => {
                          setEditingQuote(quote);
                          setQuoteEditorOpen(true);
                        }}
                      >
                        <Pencil size={12} />
                        Edit
                      </button>
                      <button
                        disabled={quoteStore.working}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Delete this quote and its personal note?",
                            )
                          )
                            void quoteStore.deleteQuote(quote.id);
                        }}
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="detail-empty compact">
              <MessageSquareQuote size={20} />
              <p>No saved quotes for this book yet.</p>
            </div>
          )}
        </article>
      </div>

      <div className="danger-zone">
        <div>
          <strong>Delete this book</strong>
          <span>
            Reading attempts, logs, quotes, and list memberships will also be
            removed.
          </span>
        </div>
        <button onClick={() => void deleteBook()}>
          <Trash2 size={15} />
          Delete book
        </button>
      </div>
      {editing && (
        <EditBookModal
          book={book}
          onClose={() => setEditing(false)}
          onSave={update}
        />
      )}
      {finishing && (
        <AttemptEditorModal
          mode="finish"
          bookTitle={book.title}
          attempt={reading.attempts.find((attempt) => !attempt.completed_at)}
          onClose={() => setFinishing(false)}
          onSubmit={finishAttempt}
        />
      )}
      {editingAttempt && (
        <AttemptEditorModal
          mode="edit"
          bookTitle={book.title}
          attempt={editingAttempt}
          onClose={() => setEditingAttempt(null)}
          onSubmit={(details) => editAttempt(editingAttempt.id, details)}
        />
      )}
      {quoteEditorOpen && (
        <QuoteEditorModal
          bookTitle={book.title}
          quote={editingQuote}
          totalPages={book.total_pages}
          working={quoteStore.working}
          onClose={() => {
            setQuoteEditorOpen(false);
            setEditingQuote(null);
          }}
          onSave={quoteStore.saveQuote}
        />
      )}
    </section>
  );
}
