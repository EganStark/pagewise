"use client";

import { BookOpen, LoaderCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Book } from "../lib/books";
import type { ReadingLog, ReadingLogInput } from "../lib/reading-logs";
import { pagesFromRange } from "../lib/reading-logs";
import { todayLocalDate } from "../lib/reading-attempts";

type Props = {
  books: Book[];
  initialBookId?: string | null;
  log?: ReadingLog | null;
  working: boolean;
  onClose: () => void;
  onSave: (input: ReadingLogInput, id?: string) => Promise<string | null>;
};

export function QuickLogModal({
  books,
  initialBookId,
  log,
  working,
  onClose,
  onSave,
}: Props) {
  const readingBooks = books.filter(
    (book) => book.status === "reading" && book.active_attempt_id,
  );
  const firstBook =
    readingBooks.find((book) => book.id === (log?.book_id ?? initialBookId)) ??
    readingBooks[0];
  const [bookId, setBookId] = useState(firstBook?.id ?? "");
  const [date, setDate] = useState(log?.log_date ?? todayLocalDate());
  const [startPage, setStartPage] = useState(
    log?.start_page ?? firstBook?.current_page ?? 0,
  );
  const [endPage, setEndPage] = useState(
    log?.end_page ?? (firstBook?.current_page ?? 0) + 1,
  );
  const [note, setNote] = useState(log?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const pages = pagesFromRange(startPage, endPage);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !working) onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", keydown);
    };
  }, [onClose, working]);

  function changeBook(nextId: string) {
    const next = readingBooks.find((book) => book.id === nextId);
    setBookId(nextId);
    setStartPage(next?.current_page ?? 0);
    setEndPage((next?.current_page ?? 0) + 1);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const saveError = await onSave(
      {
        book_id: bookId,
        log_date: date,
        start_page: startPage,
        end_page: endPage,
        note: note.trim() || null,
      },
      log?.id,
    );
    if (saveError) setError(saveError);
    else onClose();
  }

  return (
    <div
      className="modal-layer"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !working) onClose();
      }}
    >
      <section
        className="book-modal quick-log-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-log-title"
      >
        <header className="modal-header">
          <div>
            <p className="eyebrow">Reading diary</p>
            <h2 id="quick-log-title">
              {log ? "Edit reading log" : "Quick log"}
            </h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={19} />
          </button>
        </header>
        {readingBooks.length === 0 ? (
          <div className="quick-log-empty">
            <BookOpen size={24} />
            <h3>No active book yet</h3>
            <p>
              Start or resume a book from your Library, then come back to log
              pages.
            </p>
            <button className="button button-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <form
            className="quick-log-form"
            onSubmit={(event) => void submit(event)}
          >
            <div className="form-grid">
              <label className="wide">
                Book
                <select
                  value={bookId}
                  disabled={Boolean(log)}
                  onChange={(event) => changeBook(event.target.value)}
                >
                  {readingBooks.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Date
                <input
                  type="date"
                  value={date}
                  max={todayLocalDate()}
                  onChange={(event) => setDate(event.target.value)}
                  required
                />
              </label>
              <label>
                Pages read
                <div className="pages-calculated">
                  {pages}
                  <small>calculated</small>
                </div>
              </label>
              <label>
                Start page
                <input
                  type="number"
                  min="0"
                  value={startPage}
                  onChange={(event) => setStartPage(Number(event.target.value))}
                  required
                />
              </label>
              <label>
                End page
                <input
                  type="number"
                  min="1"
                  value={endPage}
                  onChange={(event) => setEndPage(Number(event.target.value))}
                  required
                />
              </label>
              <label className="wide">
                Note <small>Optional</small>
                <textarea
                  rows={4}
                  maxLength={1000}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="A thought, feeling, or line to remember…"
                />
              </label>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="button button-primary log-submit"
                disabled={working || pages <= 0}
              >
                {working ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <BookOpen size={16} />
                )}
                {log ? "Save changes" : `Log ${pages} pages`}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
