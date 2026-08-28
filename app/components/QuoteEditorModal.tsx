"use client";
import { LoaderCircle, MessageSquareQuote, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { BookQuote, QuoteInput } from "../lib/quotes";

export function QuoteEditorModal({
  bookTitle,
  quote,
  totalPages,
  working,
  onClose,
  onSave,
}: {
  bookTitle: string;
  quote?: BookQuote | null;
  totalPages: number | null;
  working: boolean;
  onClose: () => void;
  onSave: (input: QuoteInput, id?: string) => Promise<string | null>;
}) {
  const [text, setText] = useState(quote?.quote_text ?? "");
  const [page, setPage] = useState(quote?.page_number?.toString() ?? "");
  const [note, setNote] = useState(quote?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [onClose]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const pageNumber = page ? Number(page) : null;
    if (pageNumber !== null && totalPages && pageNumber > totalPages) {
      setError(`Page cannot exceed ${totalPages}.`);
      return;
    }
    const result = await onSave(
      { quote_text: text, page_number: pageNumber, note: note || null },
      quote?.id,
    );
    if (result) setError(result);
    else onClose();
  }
  return (
    <div
      className="modal-layer"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="book-modal quote-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quote-title"
      >
        <header className="modal-header">
          <div>
            <p className="eyebrow">{bookTitle}</p>
            <h2 id="quote-title">{quote ? "Edit quote" : "Save a quote"}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={19} />
          </button>
        </header>
        <form className="quote-form" onSubmit={(event) => void submit(event)}>
          <label>
            Quote text
            <textarea
              autoFocus
              rows={6}
              maxLength={5000}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Type or paste the passage…"
              required
            />
          </label>
          <label className="quote-page">
            Page <small>Optional</small>
            <input
              type="number"
              min="0"
              max={totalPages ?? undefined}
              value={page}
              onChange={(event) => setPage(event.target.value)}
              placeholder="Page number"
            />
          </label>
          <label>
            Personal note <small>Optional</small>
            <textarea
              rows={4}
              maxLength={2000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Why do you want to remember this?"
            />
          </label>
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
              className="button button-primary quote-save"
              disabled={working || !text.trim()}
            >
              {working ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <MessageSquareQuote size={16} />
              )}
              {quote ? "Save changes" : "Save quote"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
