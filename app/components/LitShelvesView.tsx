"use client";

import Image from "next/image";
import {
  Archive,
  BarChart3,
  BookCopy,
  FileUp,
  Download,
  Grid3X3,
  LayoutList,
  Link2,
  MapPin,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { InventoryItem } from "../lib/inventory";
import type { Book } from "../lib/books";
import { downloadInventoryCsv } from "../lib/inventory-export";

type Props = {
  items: InventoryItem[];
  books: Book[];
  loading: boolean;
  error: string | null;
  onAdd: () => void;
  onImport: () => void;
  onOpen: (item: InventoryItem) => void;
};
type CollectionField =
  "author" | "publisher" | "genre" | "language" | "location";

export function LitShelvesView({
  items,
  books,
  loading,
  error,
  onAdd,
  onImport,
  onOpen,
}: Props) {
  const [tab, setTab] = useState<"inventory" | "collections" | "stats">(
    "inventory",
  );
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("all");
  const [condition, setCondition] = useState("all");
  const [sort, setSort] = useState("updated");
  const [view, setView] = useState<"cards" | "shelf">("cards");
  const [collectionField, setCollectionField] =
    useState<CollectionField>("author");
  const copyCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const linkedCount = items.filter((item) => item.pagewise_book_id).length;
  const lentCount = items.filter((item) => item.is_lent).length;
  const borrowerNames = items
    .filter((item) => item.is_lent)
    .map((item) => item.lent_to?.trim() || "Unknown borrower");
  const linkedCovers = useMemo(
    () =>
      new Map(
        books
          .filter((book) => book.cover_image_url)
          .map((book) => [book.id, book.cover_image_url!]),
      ),
    [books],
  );
  const locations = useMemo(
    () =>
      [
        ...new Set(
          items
            .map((item) => item.location)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    [items],
  );
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return items
      .filter(
        (item) =>
          !normalized ||
          [
            item.title,
            item.author,
            item.isbn,
            item.publisher,
            item.genre,
            item.language,
            item.location,
            item.shelf,
            ...item.tags,
          ].some((value) => value?.toLocaleLowerCase().includes(normalized)),
      )
      .filter((item) => location === "all" || item.location === location)
      .filter((item) => condition === "all" || item.condition === condition)
      .toSorted((a, b) =>
        sort === "title"
          ? a.title.localeCompare(b.title)
          : sort === "author"
            ? (a.author || "").localeCompare(b.author || "")
            : sort === "acquired"
              ? (b.acquisition_date || "").localeCompare(
                  a.acquisition_date || "",
                )
              : b.updated_at.localeCompare(a.updated_at),
      );
  }, [condition, items, location, query, sort]);
  const groups = useMemo(() => {
    const map = new Map<string, InventoryItem[]>();
    for (const item of items) {
      const value = item[collectionField] || `Unknown ${collectionField}`;
      map.set(value, [...(map.get(value) ?? []), item]);
    }
    return [...map.entries()].toSorted(
      (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
    );
  }, [collectionField, items]);
  const totalValue = items.reduce(
    (sum, item) => sum + (item.purchase_price ?? 0) * item.quantity,
    0,
  );
  const valuedCopies = items.reduce(
    (sum, item) => sum + (item.purchase_price !== null ? item.quantity : 0),
    0,
  );
  const conditionCounts = ["new", "like_new", "good", "fair", "poor"].map(
    (value) => ({
      value,
      count: items
        .filter((item) => item.condition === value)
        .reduce((sum, item) => sum + item.quantity, 0),
    }),
  );
  const languageCounts = [
    ...new Set(items.map((item) => item.language).filter(Boolean)),
  ]
    .map((value) => ({
      value: value!,
      count: items
        .filter((item) => item.language === value)
        .reduce((sum, item) => sum + item.quantity, 0),
    }))
    .toSorted((a, b) => b.count - a.count);

  return (
    <div className="litshelves-view">
      <section className="litshelves-hero">
        <div>
          <p className="eyebrow">Personal book inventory</p>
          <h1>LitShelves</h1>
          <p>
            Catalogue the books you physically own—editions, condition,
            location, and lending—without turning every copy into a reading
            record.
          </p>
        </div>
        <div className="litshelves-hero-actions">
          <button
            className="button button-secondary"
            disabled={!items.length}
            onClick={() => downloadInventoryCsv(items)}
          >
            <Download size={17} /> Export CSV
          </button>
          <button className="button button-secondary" onClick={onImport}>
            <FileUp size={17} /> Import
          </button>
          <button className="button button-primary" onClick={onAdd}>
            <Plus size={17} /> Add owned book
          </button>
        </div>
      </section>
      <section className="inventory-metrics" aria-label="Inventory overview">
        <article>
          <BookCopy size={18} />
          <span>
            Owned copies<strong>{copyCount}</strong>
          </span>
        </article>
        <article>
          <Archive size={18} />
          <span>
            Titles<strong>{items.length}</strong>
          </span>
        </article>
        <article>
          <MapPin size={18} />
          <span>
            Locations<strong>{locations.length}</strong>
          </span>
        </article>
        <article>
          <Users size={18} />
          <span>
            Currently lent<strong>{lentCount}</strong>
            {borrowerNames.length > 0 && (
              <small title={borrowerNames.join(", ")}>
                {borrowerNames.slice(0, 2).join(", ")}
                {borrowerNames.length > 2
                  ? ` +${borrowerNames.length - 2}`
                  : ""}
              </small>
            )}
          </span>
        </article>
      </section>
      <nav className="inventory-tabs" aria-label="LitShelves sections">
        <button
          className={tab === "inventory" ? "active" : ""}
          onClick={() => setTab("inventory")}
        >
          <BookCopy size={15} /> Inventory
        </button>
        <button
          className={tab === "collections" ? "active" : ""}
          onClick={() => setTab("collections")}
        >
          <Grid3X3 size={15} /> Collections
        </button>
        <button
          className={tab === "stats" ? "active" : ""}
          onClick={() => setTab("stats")}
        >
          <BarChart3 size={15} /> Statistics
        </button>
      </nav>
      {loading ? (
        <div className="inventory-state">Loading your shelves…</div>
      ) : error ? (
        <div className="inventory-state error" role="alert">
          {error}
        </div>
      ) : tab === "inventory" ? (
        <>
          <div className="inventory-toolbar">
            <label className="inventory-search">
              <Search size={15} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title, author, ISBN, publisher, tag, or shelf"
              />
            </label>
            <select
              aria-label="Filter inventory location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            >
              <option value="all">All locations</option>
              {locations.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <select
              aria-label="Filter inventory condition"
              value={condition}
              onChange={(event) => setCondition(event.target.value)}
            >
              <option value="all">All conditions</option>
              <option value="new">New</option>
              <option value="like_new">Like new</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
            </select>
            <select
              aria-label="Sort inventory"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="updated">Recently updated</option>
              <option value="title">Title A–Z</option>
              <option value="author">Author A–Z</option>
              <option value="acquired">Recently acquired</option>
            </select>
            <span className="inventory-view-toggle">
              <button
                className={view === "cards" ? "active" : ""}
                onClick={() => setView("cards")}
                aria-label="Card view"
              >
                <Grid3X3 size={15} />
              </button>
              <button
                className={view === "shelf" ? "active" : ""}
                onClick={() => setView("shelf")}
                aria-label="Shelf list view"
              >
                <LayoutList size={15} />
              </button>
            </span>
          </div>
          <div className="inventory-heading">
            <div>
              <p className="eyebrow">Your collection</p>
              <h2>{filtered.length} owned titles</h2>
            </div>
            <span>
              <Link2 size={14} /> {linkedCount} connected to Pagewise
            </span>
          </div>
          {filtered.length === 0 ? (
            <div className="inventory-state">
              No owned books match these filters.
            </div>
          ) : (
            <section
              className={
                view === "cards" ? "inventory-grid" : "inventory-shelf-list"
              }
            >
              {filtered.map((item, index) => {
                const coverUrl =
                  item.cover_image_url ||
                  (item.pagewise_book_id
                    ? linkedCovers.get(item.pagewise_book_id)
                    : null) ||
                  null;
                return (
                  <button
                    className="inventory-card"
                    key={item.id}
                    onClick={() => onOpen(item)}
                    aria-label={`Open inventory details for ${item.title}`}
                  >
                    {coverUrl ? (
                      <span className="inventory-book-cover">
                        <Image
                          src={coverUrl}
                          alt={`Cover of ${item.title}`}
                          fill
                          sizes={view === "cards" ? "88px" : "44px"}
                          unoptimized
                        />
                      </span>
                    ) : (
                      <span
                        className={`inventory-spine spine-${(index % 3) + 1}`}
                        aria-hidden="true"
                      >
                        <span>
                          {item.title.slice(0, 2).toLocaleUpperCase()}
                        </span>
                      </span>
                    )}
                    <div>
                      <span className="inventory-location">
                        <MapPin size={12} />{" "}
                        {[item.location, item.shelf]
                          .filter(Boolean)
                          .join(" · ") || "Location not set"}
                      </span>
                      <h3>{item.title}</h3>
                      <p>{item.author || "Unknown author"}</p>
                      {item.is_lent && (
                        <span className="inventory-borrower">
                          <Users size={12} /> Lent to
                          <strong>
                            {item.lent_to?.trim() || "Unknown borrower"}
                          </strong>
                        </span>
                      )}
                      <div className="inventory-facts">
                        {item.language && <span>{item.language}</span>}
                        {item.format && <span>{item.format}</span>}
                        {item.condition && (
                          <span>{item.condition.replaceAll("_", " ")}</span>
                        )}
                      </div>
                      <footer>
                        {item.pagewise_book_id ? (
                          <span>
                            <Link2 size={12} /> In Pagewise
                          </span>
                        ) : (
                          <span>Inventory only</span>
                        )}
                        {item.is_lent && item.due_date && (
                          <b>Due {item.due_date}</b>
                        )}
                      </footer>
                    </div>
                  </button>
                );
              })}
            </section>
          )}
        </>
      ) : tab === "collections" ? (
        <>
          <div className="collection-field-tabs">
            {(
              [
                "author",
                "publisher",
                "genre",
                "language",
                "location",
              ] as CollectionField[]
            ).map((field) => (
              <button
                key={field}
                className={collectionField === field ? "active" : ""}
                onClick={() => setCollectionField(field)}
              >
                {field}
              </button>
            ))}
          </div>
          <section className="inventory-collection-grid">
            {groups.map(([name, groupItems]) => (
              <button
                key={name}
                onClick={() => {
                  setTab("inventory");
                  setQuery(name.startsWith("Unknown ") ? "" : name);
                }}
              >
                <span>{collectionField}</span>
                <h3>{name}</h3>
                <p>
                  {groupItems.reduce((sum, item) => sum + item.quantity, 0)}{" "}
                  copies · {groupItems.length} titles
                </p>
                <div>
                  {groupItems.slice(0, 4).map((item) => (
                    <i key={item.id}>{item.title.slice(0, 1)}</i>
                  ))}
                </div>
              </button>
            ))}
          </section>
        </>
      ) : (
        <section className="inventory-stats-view">
          <div className="inventory-value-card">
            <span>Recorded collection value</span>
            <strong>
              BDT{" "}
              {totalValue.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
            </strong>
            <p>
              Based on {valuedCopies} of {copyCount} copies with purchase
              prices.
            </p>
          </div>
          <div className="inventory-stat-panels">
            <article>
              <h3>Condition</h3>
              {conditionCounts.map((row) => (
                <div key={row.value}>
                  <span>{row.value.replaceAll("_", " ")}</span>
                  <i>
                    <b
                      style={{
                        width: `${copyCount ? (row.count / copyCount) * 100 : 0}%`,
                      }}
                    />
                  </i>
                  <strong>{row.count}</strong>
                </div>
              ))}
            </article>
            <article>
              <h3>Languages</h3>
              {languageCounts.length ? (
                languageCounts.slice(0, 8).map((row) => (
                  <div key={row.value}>
                    <span>{row.value}</span>
                    <i>
                      <b
                        style={{
                          width: `${copyCount ? (row.count / copyCount) * 100 : 0}%`,
                        }}
                      />
                    </i>
                    <strong>{row.count}</strong>
                  </div>
                ))
              ) : (
                <p>No language data yet.</p>
              )}
            </article>
          </div>
          <div className="inventory-stat-summary">
            <article>
              <strong>{linkedCount}</strong>
              <span>Pagewise-linked titles</span>
            </article>
            <article>
              <strong>{items.filter((item) => item.isbn).length}</strong>
              <span>ISBN-identified titles</span>
            </article>
            <article>
              <strong>
                {items.filter((item) => item.acquisition_date).length}
              </strong>
              <span>Acquisitions dated</span>
            </article>
            <article>
              <strong>{lentCount}</strong>
              <span>Copies away from shelf</span>
            </article>
          </div>
        </section>
      )}
    </div>
  );
}
