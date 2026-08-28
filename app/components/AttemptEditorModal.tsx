"use client";

import { BookOpen, LoaderCircle, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import type { AttemptDetails, ReadingAttempt } from "../lib/reading-attempts";
import { todayLocalDate } from "../lib/reading-attempts";

export const RATING_TAGS = [
  "Masterpiece",
  "Excellent",
  "Very Good",
  "Good",
  "Average",
  "Below Average",
  "Bad",
  "Very Bad",
] as const;

type AttemptEditorModalProps = {
  attempt?: ReadingAttempt | null;
  mode: "finish" | "edit";
  bookTitle: string;
  onClose: () => void;
  onSubmit: (details: AttemptDetails) => Promise<boolean>;
  onDelete?: () => Promise<boolean>;
};

function StarRating({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (rating: number | null) => void;
}) {
  return (
    <div className="rating-input-wrap">
      <div
        className="star-rating"
        role="radiogroup"
        aria-label="Numeric rating"
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const fill =
            Math.max(0, Math.min(1, (value ?? 0) - (star - 1))) * 100;
          return (
            <span
              className="rating-star"
              key={star}
              style={{ "--star-fill": `${fill}%` } as React.CSSProperties}
            >
              <i aria-hidden="true">★</i>
              <button
                type="button"
                role="radio"
                aria-checked={value === star - 0.5}
                aria-label={`${star - 0.5} stars`}
                onClick={() => onChange(star - 0.5)}
              />
              <button
                type="button"
                role="radio"
                aria-checked={value === star}
                aria-label={`${star} stars`}
                onClick={() => onChange(star)}
              />
            </span>
          );
        })}
      </div>
      <span>{value ? `${value} / 5` : "Not rated"}</span>
      {value && (
        <button type="button" onClick={() => onChange(null)}>
          Clear
        </button>
      )}
    </div>
  );
}

export function AttemptEditorModal({
  attempt,
  mode,
  bookTitle,
  onClose,
  onSubmit,
  onDelete,
}: AttemptEditorModalProps) {
  const [startedAt, setStartedAt] = useState(
    attempt?.started_at ?? todayLocalDate(),
  );
  const [completedAt, setCompletedAt] = useState(
    mode === "finish" ? todayLocalDate() : (attempt?.completed_at ?? ""),
  );
  const [rating, setRating] = useState<number | null>(
    attempt?.rating_numeric ?? null,
  );
  const [ratingTag, setRatingTag] = useState(attempt?.rating_tag ?? "");
  const [review, setReview] = useState(attempt?.review ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (startedAt && completedAt && completedAt < startedAt) {
      setError("The finish date cannot be earlier than the start date.");
      return;
    }
    setSaving(true);
    setError(null);
    const success = await onSubmit({
      started_at: startedAt || null,
      completed_at: completedAt || null,
      rating_numeric: rating,
      rating_tag: ratingTag || null,
      review: review.trim() || null,
    });
    setSaving(false);
    if (success) onClose();
    else setError("Your reading entry could not be saved. Please try again.");
  }

  async function remove() {
    if (
      !onDelete ||
      !window.confirm(
        "Delete this Diary entry? Your book progress and Library status will stay unchanged.",
      )
    )
      return;
    setSaving(true);
    setError(null);
    const success = await onDelete();
    setSaving(false);
    if (success) onClose();
    else setError("Your Diary entry could not be deleted. Please try again.");
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
        className="book-modal attempt-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="attempt-editor-title"
      >
        <header className="modal-header">
          <div>
            <p className="eyebrow">
              {mode === "finish"
                ? "Complete this read"
                : `Read ${attempt?.attempt_number}`}
            </p>
            <h2 id="attempt-editor-title">
              {mode === "finish" ? "How was the book?" : "Edit reading entry"}
            </h2>
            <span className="modal-book-title">
              <BookOpen size={14} />
              {bookTitle}
            </span>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close reading entry dialog"
          >
            <X size={20} />
          </button>
        </header>
        <form className="attempt-form" onSubmit={submit}>
          <div className="date-pair">
            <label>
              Started
              <input
                type="date"
                value={startedAt}
                onChange={(event) => setStartedAt(event.target.value)}
              />
            </label>
            <label>
              {mode === "finish" ? "Finished" : "Completed"}
              <input
                type="date"
                value={completedAt}
                onChange={(event) => setCompletedAt(event.target.value)}
                required={mode === "finish" || Boolean(attempt?.completed_at)}
              />
            </label>
          </div>
          <fieldset>
            <legend>Your rating</legend>
            <StarRating value={rating} onChange={setRating} />
          </fieldset>
          <fieldset>
            <legend>Rating tag</legend>
            <div className="rating-tags">
              {RATING_TAGS.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  className={ratingTag === tag ? "active" : ""}
                  aria-pressed={ratingTag === tag}
                  onClick={() =>
                    setRatingTag((current) => (current === tag ? "" : tag))
                  }
                >
                  {tag}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="review-field">
            Review <small>Keep a separate reflection for every read.</small>
            <textarea
              rows={6}
              maxLength={10000}
              value={review}
              onChange={(event) => setReview(event.target.value)}
              placeholder="What stayed with you?"
            />
            <span>{review.length.toLocaleString()} / 10,000</span>
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <footer className="modal-actions">
            {mode === "edit" && onDelete ? (
              <button
                type="button"
                className="button button-quiet-danger"
                disabled={saving}
                onClick={() => void remove()}
              >
                <Trash2 size={16} />
                Delete entry
              </button>
            ) : null}
            <button
              type="button"
              className="button button-secondary"
              disabled={saving}
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
                  <LoaderCircle size={17} className="spin" />
                  Working…
                </>
              ) : mode === "finish" ? (
                "Finish this read"
              ) : (
                "Save reading entry"
              )}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
