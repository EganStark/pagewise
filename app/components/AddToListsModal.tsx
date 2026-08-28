"use client";
import { Check, ListPlus, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { BookList, ListMembership } from "../lib/book-lists";
import type { Book } from "../lib/books";

type Props = {
  book: Book;
  lists: BookList[];
  memberships: ListMembership[];
  working: boolean;
  onClose: () => void;
  onCreate: (
    title: string,
    description: string,
  ) => Promise<{ id: string | null; error: string | null }>;
  onSave: (ids: string[]) => Promise<string | null>;
};
export function AddToListsModal({
  book,
  lists,
  memberships,
  working,
  onClose,
  onCreate,
  onSave,
}: Props) {
  const [selected, setSelected] = useState(() =>
    memberships
      .filter((item) => item.book_id === book.id)
      .map((item) => item.list_id),
  );
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
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
  async function create() {
    const result = await onCreate(newTitle, "");
    if (result.error) setError(result.error);
    else if (result.id) {
      setSelected((current) => [...current, result.id!]);
      setNewTitle("");
      setCreating(false);
    }
  }
  async function save() {
    const result = await onSave(selected);
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
        className="book-modal add-lists-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-list-title"
      >
        <header className="modal-header">
          <div>
            <p className="eyebrow">{book.title}</p>
            <h2 id="add-list-title">Add to lists</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={19} />
          </button>
        </header>
        <div className="list-picker">
          {lists.length ? (
            lists.map((list) => {
              const checked = selected.includes(list.id);
              return (
                <button
                  key={list.id}
                  className={checked ? "selected" : ""}
                  onClick={() =>
                    setSelected((current) =>
                      checked
                        ? current.filter((id) => id !== list.id)
                        : [...current, list.id],
                    )
                  }
                >
                  <span>
                    <ListPlus size={17} />
                    <span>
                      <strong>{list.title}</strong>
                      <small>
                        {
                          memberships.filter((item) => item.list_id === list.id)
                            .length
                        }{" "}
                        books
                      </small>
                    </span>
                  </span>
                  <i>{checked && <Check size={14} />}</i>
                </button>
              );
            })
          ) : (
            <p className="picker-empty">
              You have no custom lists yet. Create the first one below.
            </p>
          )}
          {creating ? (
            <div className="inline-list-create">
              <input
                autoFocus
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="New list name"
              />
              <button
                disabled={!newTitle.trim() || working}
                onClick={() => void create()}
              >
                Create
              </button>
              <button
                aria-label="Cancel creation"
                onClick={() => setCreating(false)}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button className="create-inline" onClick={() => setCreating(true)}>
              <Plus size={15} />
              Create new list
            </button>
          )}
          {error && <p className="form-error">{error}</p>}
        </div>
        <div className="picker-actions">
          <button className="button button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button button-primary list-save"
            disabled={working}
            onClick={() => void save()}
          >
            Save lists
          </button>
        </div>
      </section>
    </div>
  );
}
