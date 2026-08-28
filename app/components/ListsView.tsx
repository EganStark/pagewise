"use client";
import Image from "next/image";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookCheck,
  BookOpen,
  Circle,
  List,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import type { BookList, ListMembership } from "../lib/book-lists";
import type { Book } from "../lib/books";
import { ListEditorModal } from "./ListEditorModal";

type Props = {
  initialListId?: string | null;
  books: Book[];
  lists: BookList[];
  memberships: ListMembership[];
  loading: boolean;
  working: boolean;
  error: string | null;
  onCreate: (
    title: string,
    description: string,
  ) => Promise<{ id: string | null; error: string | null }>;
  onUpdate: (
    id: string,
    title: string,
    description: string,
  ) => Promise<string | null>;
  onDelete: (id: string) => Promise<string | null>;
  onSetBookLists: (bookId: string, ids: string[]) => Promise<string | null>;
  onMove: (
    listId: string,
    bookId: string,
    direction: -1 | 1,
  ) => Promise<string | null>;
};
function MiniCover({ book }: { book?: Book }) {
  return (
    <div className="list-mini-cover">
      {book?.cover_image_url ? (
        <Image
          src={book.cover_image_url}
          fill
          sizes="80px"
          alt=""
          unoptimized
        />
      ) : (
        <span>
          {book?.title
            .split(/\s+/)
            .slice(0, 2)
            .map((word) => word[0])
            .join("") ?? "+"}
        </span>
      )}
    </div>
  );
}
function completion(books: Book[]) {
  const finished = books.filter((book) => book.status === "completed").length;
  return {
    finished,
    total: books.length,
    percentage: books.length ? Math.round((finished / books.length) * 100) : 0,
  };
}
function StatusMark({ book }: { book: Book }) {
  if (book.status === "completed")
    return (
      <span className="list-status status-read">
        <BookCheck size={12} />
        Read
      </span>
    );
  if (book.status === "reading")
    return (
      <span className="list-status status-reading">
        <BookOpen size={12} />
        Reading
      </span>
    );
  return (
    <span className="list-status">
      <Circle size={11} />
      Not read
    </span>
  );
}

export function ListsView(props: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(
    props.initialListId ?? null,
  );
  const [editor, setEditor] = useState<"new" | "edit" | null>(null);
  const selected = props.lists.find((list) => list.id === selectedId);
  const selectedMemberships = props.memberships
    .filter((item) => item.list_id === selectedId)
    .sort((a, b) => a.position - b.position);
  const selectedBooks = selectedMemberships
    .map((membership) =>
      props.books.find((book) => book.id === membership.book_id),
    )
    .filter((book): book is Book => Boolean(book));
  const selectedCompletion = completion(selectedBooks);
  async function removeBook(bookId: string) {
    const current = props.memberships
      .filter((item) => item.book_id === bookId)
      .map((item) => item.list_id);
    await props.onSetBookLists(
      bookId,
      current.filter((id) => id !== selectedId),
    );
  }
  async function removeList() {
    if (
      !selected ||
      !window.confirm(
        `Delete “${selected.title}”? The books will remain in your library.`,
      )
    )
      return;
    const error = await props.onDelete(selected.id);
    if (!error) setSelectedId(null);
  }
  if (selected)
    return (
      <section className="lists-view list-detail">
        <button className="detail-back" onClick={() => setSelectedId(null)}>
          <ArrowLeft size={17} />
          All lists
        </button>
        <div className="list-detail-head">
          <div>
            <p className="eyebrow">Custom list</p>
            <h1>{selected.title}</h1>
            <p className="lead">
              {selected.description || "A personal shelf from your library."}
            </p>
            <div className="list-completion-head">
              <span>
                {selectedCompletion.finished} / {selectedCompletion.total} books
                read
              </span>
              <strong>{selectedCompletion.percentage}%</strong>
            </div>
            <div className="list-completion-bar">
              <i style={{ width: `${selectedCompletion.percentage}%` }} />
            </div>
          </div>
          <div>
            <button
              className="button button-secondary"
              onClick={() => setEditor("edit")}
            >
              <Pencil size={15} />
              Edit
            </button>
            <button
              className="button button-quiet-danger"
              onClick={() => void removeList()}
            >
              <Trash2 size={15} />
              Delete
            </button>
          </div>
        </div>
        {selectedMemberships.length ? (
          <div className="list-book-rows">
            {selectedMemberships.map((membership, index) => {
              const book = props.books.find(
                (item) => item.id === membership.book_id,
              );
              if (!book) return null;
              return (
                <article key={book.id}>
                  <b>{index + 1}</b>
                  <MiniCover book={book} />
                  <div>
                    <h3>{book.title}</h3>
                    <p>{book.author || "Unknown author"}</p>
                    <StatusMark book={book} />
                  </div>
                  <div className="row-order">
                    <button
                      disabled={index === 0 || props.working}
                      onClick={() =>
                        void props.onMove(selected.id, book.id, -1)
                      }
                      aria-label="Move up"
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      disabled={
                        index === selectedMemberships.length - 1 ||
                        props.working
                      }
                      onClick={() => void props.onMove(selected.id, book.id, 1)}
                      aria-label="Move down"
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      onClick={() => void removeBook(book.id)}
                      aria-label="Remove from list"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="diary-empty">
            <BookOpen />
            <h3>This list is waiting for books</h3>
            <p>Open a book in your Library and choose “Add to list.”</p>
          </div>
        )}
        {editor === "edit" && (
          <ListEditorModal
            list={selected}
            working={props.working}
            onClose={() => setEditor(null)}
            onSave={(title, description) =>
              props.onUpdate(selected.id, title, description)
            }
          />
        )}
      </section>
    );
  return (
    <section className="lists-view">
      <div className="library-title-row">
        <div>
          <p className="eyebrow">Your collections</p>
          <h1>Lists</h1>
          <p className="lead">
            Build personal shelves like playlists—one book can live in many.
          </p>
        </div>
        <button
          className="button button-primary list-new"
          onClick={() => setEditor("new")}
        >
          <Plus size={17} />
          New list
        </button>
      </div>
      {props.error && <div className="detail-error">{props.error}</div>}
      {props.loading ? (
        <div className="diary-empty">
          <p>Loading lists…</p>
        </div>
      ) : props.lists.length ? (
        <div className="list-grid">
          {props.lists.map((list) => {
            const members = props.memberships
              .filter((item) => item.list_id === list.id)
              .sort((a, b) => a.position - b.position);
            const memberBooks = members
              .map((member) =>
                props.books.find((book) => book.id === member.book_id),
              )
              .filter((book): book is Book => Boolean(book));
            const progress = completion(memberBooks);
            return (
              <button key={list.id} onClick={() => setSelectedId(list.id)}>
                <div className="list-cover-collage">
                  {[0, 1, 2, 3].map((slot) => (
                    <MiniCover key={slot} book={memberBooks[slot]} />
                  ))}
                </div>
                <span>
                  <strong>{list.title}</strong>
                  <div className="list-card-progress">
                    <small>
                      {progress.finished} / {progress.total} read
                    </small>
                    <b>{progress.percentage}%</b>
                  </div>
                  <div className="list-completion-bar">
                    <i style={{ width: `${progress.percentage}%` }} />
                  </div>
                  <p>
                    {list.description || "A custom shelf from your library."}
                  </p>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="diary-empty list-empty">
          <List />
          <h3>Create your first list</h3>
          <p>
            Collect books by mood, genre, priority, or anything that matters to
            you.
          </p>
          <button
            className="button button-secondary"
            onClick={() => setEditor("new")}
          >
            Create a list
          </button>
        </div>
      )}
      {editor === "new" && (
        <ListEditorModal
          working={props.working}
          onClose={() => setEditor(null)}
          onSave={async (title, description) =>
            (await props.onCreate(title, description)).error
          }
        />
      )}
    </section>
  );
}
