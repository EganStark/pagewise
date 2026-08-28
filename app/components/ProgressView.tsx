"use client";

import {
  BookOpen,
  CalendarDays,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { Book } from "../lib/books";
import type { ReadingLog } from "../lib/reading-logs";
import { estimateBookFinish } from "../lib/reading-stats";

type Props = {
  books: Book[];
  logs: ReadingLog[];
  loading: boolean;
  error: string | null;
  working: boolean;
  onAdd: () => void;
  onEdit: (log: ReadingLog) => void;
  onDelete: (id: string) => Promise<string | null>;
};

export function ProgressView({
  books,
  logs,
  loading,
  error,
  working,
  onAdd,
  onEdit,
  onDelete,
}: Props) {
  const bookMap = new Map(books.map((book) => [book.id, book]));
  const activeBooks = books.filter((book) => book.status === "reading");
  const pagesThisMonth = logs
    .filter(
      (log) =>
        log.log_date.slice(0, 7) === new Date().toISOString().slice(0, 7),
    )
    .reduce((sum, log) => sum + log.pages_read, 0);
  async function remove(log: ReadingLog) {
    if (
      !window.confirm(
        "Delete this diary entry? Your book progress will stay where it is.",
      )
    )
      return;
    await onDelete(log.id);
  }
  return (
    <section className="progress-view">
      <div className="library-title-row">
        <div>
          <p className="eyebrow">Reading diary</p>
          <h1>Your progress</h1>
          <p className="lead">Every reading day, kept in one quiet timeline.</p>
        </div>
        <button className="button button-primary progress-add" onClick={onAdd}>
          <Plus size={17} />
          Quick log
        </button>
      </div>
      <div className="progress-summary">
        <article>
          <span>This month</span>
          <strong>{pagesThisMonth}</strong>
          <small>pages logged</small>
        </article>
        <article>
          <span>Active books</span>
          <strong>{activeBooks.length}</strong>
          <small>currently reading</small>
        </article>
        <article>
          <span>Reading days</span>
          <strong>{new Set(logs.map((log) => log.log_date)).size}</strong>
          <small>in your diary</small>
        </article>
      </div>
      {activeBooks.length > 0 && (
        <div className="active-progress-strip">
          {activeBooks.map((book) => {
            const percentage = book.total_pages
              ? Math.round((book.current_page / book.total_pages) * 100)
              : null;
            const pace = estimateBookFinish(book, logs);
            return (
              <article key={book.id}>
                <div>
                  <span>Currently reading</span>
                  <strong>{book.title}</strong>
                  <small>
                    {book.current_page}
                    {book.total_pages
                      ? ` of ${book.total_pages} pages`
                      : " pages"}
                  </small>
                  {pace ? (
                    <em>
                      Est. finish{" "}
                      {new Intl.DateTimeFormat(undefined, {
                        month: "short",
                        day: "numeric",
                      }).format(pace.estimatedDate)}{" "}
                      · {Math.round(pace.averagePagesPerDay)} pages/day
                    </em>
                  ) : (
                    <em>Log 2 recent sessions for an estimate</em>
                  )}
                </div>
                {percentage !== null && (
                  <>
                    <b>{percentage}%</b>
                    <div className="progress-track">
                      <i style={{ width: `${percentage}%` }} />
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
      <div className="diary-heading">
        <div>
          <p className="eyebrow">Timeline</p>
          <h2>Recent reading</h2>
        </div>
      </div>
      {error && (
        <div className="detail-error" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <div className="diary-empty">
          <LoaderCircle className="spin" />
          <p>Loading your diary…</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="diary-empty">
          <CalendarDays />
          <h3>Your diary is ready</h3>
          <p>Log your next reading session to begin the timeline.</p>
          <button className="button button-secondary" onClick={onAdd}>
            Create first log
          </button>
        </div>
      ) : (
        <div className="diary-list">
          {logs.map((log) => {
            const book = bookMap.get(log.book_id);
            return (
              <article key={log.id}>
                <time dateTime={log.log_date}>
                  {new Intl.DateTimeFormat(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  }).format(new Date(`${log.log_date}T12:00:00`))}
                </time>
                <div className="diary-marker">
                  <BookOpen size={15} />
                </div>
                <div className="diary-card">
                  <div className="diary-card-head">
                    <div>
                      <span>{book?.author || "Unknown author"}</span>
                      <h3>{book?.title || "Removed book"}</h3>
                    </div>
                    <strong>+{log.pages_read} pages</strong>
                  </div>
                  <p className="diary-range">
                    Pages {log.start_page}–{log.end_page}
                  </p>
                  {log.note && <blockquote>{log.note}</blockquote>}
                  <div className="diary-actions">
                    <button onClick={() => onEdit(log)}>
                      <Pencil size={13} />
                      Edit
                    </button>
                    <button disabled={working} onClick={() => void remove(log)}>
                      <Trash2 size={13} />
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
