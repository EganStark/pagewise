"use client";
import { LoaderCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { BookList } from "../lib/book-lists";

export function ListEditorModal({
  list,
  working,
  onClose,
  onSave,
}: {
  list?: BookList | null;
  working: boolean;
  onClose: () => void;
  onSave: (title: string, description: string) => Promise<string | null>;
}) {
  const [title, setTitle] = useState(list?.title ?? "");
  const [description, setDescription] = useState(list?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !working) onClose();
    };
    window.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", keydown);
    };
  }, [onClose, working]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const result = await onSave(title, description);
    if (result) setError(result);
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
        className="book-modal list-editor-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="list-editor-title"
      >
        <header className="modal-header">
          <div>
            <p className="eyebrow">Custom collection</p>
            <h2 id="list-editor-title">
              {list ? "Edit list" : "Create a list"}
            </h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={19} />
          </button>
        </header>
        <form
          className="quick-log-form"
          onSubmit={(event) => void submit(event)}
        >
          <div className="form-grid">
            <label className="wide">
              List name
              <input
                autoFocus
                maxLength={80}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Rainy day mysteries"
                required
              />
            </label>
            <label className="wide">
              Description <small>Optional</small>
              <textarea
                rows={4}
                maxLength={400}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What belongs on this shelf?"
              />
            </label>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="button button-primary list-save"
              disabled={working || !title.trim()}
            >
              {working && <LoaderCircle className="spin" size={16} />}
              {list ? "Save changes" : "Create list"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
