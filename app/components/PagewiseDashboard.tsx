"use client";

import {
  BarChart3,
  Boxes,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Flame,
  FileUp,
  Home,
  Library,
  List,
  LogOut,
  Menu,
  Moon,
  Plus,
  Settings,
  Sparkles,
  Sun,
  Target,
  X,
} from "lucide-react";
import Image from "next/image";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useBooks } from "../hooks/useBooks";
import { useReadingLogs } from "../hooks/useReadingLogs";
import { useBookLists } from "../hooks/useBookLists";
import type { ReadingLog } from "../lib/reading-logs";
import { AddBookModal } from "./AddBookModal";
import { LibraryView } from "./LibraryView";
import { BookDetailView } from "./BookDetailView";
import { ProgressView } from "./ProgressView";
import { QuickLogModal } from "./QuickLogModal";
import { ListsView } from "./ListsView";
import { AddToListsModal } from "./AddToListsModal";
import { StatsView } from "./StatsView";
import { buildReadingStats, estimateBookFinish } from "../lib/reading-stats";
import { GlobalSearch } from "./GlobalSearch";
import { useSearchReviews } from "../hooks/useSearchReviews";
import { useCompletedAttempts } from "../hooks/useCompletedAttempts";
import { DiaryView } from "./DiaryView";
import { useStreakFreeze } from "../hooks/useStreakFreeze";
import { useProfileSettings } from "../hooks/useProfileSettings";
import { useInventory } from "../hooks/useInventory";
import { ProfileView } from "./ProfileView";
import type { InternetSearchRequest } from "./InternetSearchView";

const SmartImportModal = lazy(() =>
  import("./SmartImportModal").then((module) => ({
    default: module.SmartImportModal,
  })),
);
const InternetSearchView = lazy(() =>
  import("./InternetSearchView").then((module) => ({
    default: module.InternetSearchView,
  })),
);
const LitShelvesView = lazy(() =>
  import("./LitShelvesView").then((module) => ({
    default: module.LitShelvesView,
  })),
);
const AddInventoryModal = lazy(() =>
  import("./AddInventoryModal").then((module) => ({
    default: module.AddInventoryModal,
  })),
);
const InventoryDetailModal = lazy(() =>
  import("./InventoryDetailModal").then((module) => ({
    default: module.InventoryDetailModal,
  })),
);
const InventoryImportModal = lazy(() =>
  import("./InventoryImportModal").then((module) => ({
    default: module.InventoryImportModal,
  })),
);

function DeferredViewLoading() {
  return (
    <div className="empty-state" role="status">
      <span>Opening this section…</span>
    </div>
  );
}

const navItems = [
  { label: "Home", icon: Home },
  { label: "Library", icon: Library },
  { label: "LitShelves", icon: Boxes },
  { label: "Lists", icon: List },
  { label: "Progress", icon: BookOpen },
  { label: "Diary", icon: CalendarDays },
  { label: "Stats", icon: BarChart3 },
  { label: "Profile", icon: Settings },
];

function BookCover({
  initials,
  tone,
  compact = false,
}: {
  initials: string;
  tone: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`book-cover cover-${tone} ${compact ? "book-cover-compact" : ""}`}
      aria-hidden="true"
    >
      <span>{initials}</span>
      <i />
    </div>
  );
}

type PagewiseDashboardProps = {
  previewMode?: boolean;
  userId?: string | null;
  userEmail?: string | null;
  onSignOut?: () => void | Promise<void>;
};

export default function PagewiseDashboard({
  previewMode = false,
  userId = null,
  userEmail,
  onSignOut,
}: PagewiseDashboardProps) {
  const [active, setActive] = useState("Home");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [addBookOpen, setAddBookOpen] = useState(false);
  const [smartImportOpen, setSmartImportOpen] = useState(false);
  const [addInventoryOpen, setAddInventoryOpen] = useState(false);
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | null>(
    null,
  );
  const [inventoryImportOpen, setInventoryImportOpen] = useState(false);
  const [quickLogBookId, setQuickLogBookId] = useState<string | null>(null);
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<ReadingLog | null>(null);
  const [listBookId, setListBookId] = useState<string | null>(null);
  const [searchedListId, setSearchedListId] = useState<string | null>(null);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [libraryScrollPosition, setLibraryScrollPosition] = useState(0);
  const [bookReturnSection, setBookReturnSection] = useState("Library");
  const [internetSearch, setInternetSearch] =
    useState<InternetSearchRequest | null>(null);
  const [searchReturnActive, setSearchReturnActive] = useState("Home");
  const bookStore = useBooks(userId, previewMode);
  const inventory = useInventory(userId, previewMode);
  const readingLogs = useReadingLogs(
    bookStore.books,
    previewMode,
    bookStore.patchBookLocal,
  );
  const bookLists = useBookLists(userId, previewMode);
  const searchableReviews = useSearchReviews(previewMode);
  const completedAttempts = useCompletedAttempts(previewMode);
  const streakFreeze = useStreakFreeze(previewMode, userId);
  const stats = useMemo(
    () =>
      buildReadingStats(
        bookStore.books,
        readingLogs.logs,
        new Date(),
        streakFreeze.freezeDates,
      ),
    [bookStore.books, readingLogs.logs, streakFreeze.freezeDates],
  );
  const profile = useProfileSettings(userId, previewMode, stats.year);
  const currentBooks = useMemo(
    () =>
      bookStore.books.filter((book) => book.status === "reading").slice(0, 2),
    [bookStore.books],
  );
  const recentBooks = useMemo(
    () =>
      bookStore.books.filter((book) => book.status === "completed").slice(0, 3),
    [bookStore.books],
  );
  const weekMax = Math.max(1, ...stats.week.map((day) => day.pages));
  const selectedBook = useMemo(
    () =>
      selectedBookId
        ? (bookStore.books.find((book) => book.id === selectedBookId) ?? null)
        : null,
    [bookStore.books, selectedBookId],
  );
  const listBook = useMemo(
    () =>
      listBookId
        ? (bookStore.books.find((book) => book.id === listBookId) ?? null)
        : null,
    [bookStore.books, listBookId],
  );
  const accountName = profile.displayName || (userEmail
    ? userEmail
        .split("@")[0]
        .split(/[._-]+/)
        .filter(Boolean)
        .map((part) => part[0]?.toLocaleUpperCase() + part.slice(1))
        .join(" ")
    : "Reader");
  const accountInitials = accountName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase();
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12
      ? "Good morning"
      : currentHour < 18
        ? "Good afternoon"
        : "Good evening";

  useEffect(() => {
    const handleShortcut = (event: Event) => {
      const action = (event as CustomEvent<string>).detail;
      if (action === "add-book") setAddBookOpen(true);
      if (action === "quick-log") {
        setEditingLog(null);
        setQuickLogBookId(null);
        setQuickLogOpen(true);
      }
    };
    window.addEventListener("pagewise-shortcut", handleShortcut);
    return () =>
      window.removeEventListener("pagewise-shortcut", handleShortcut);
  }, []);

  function openBook(bookId: string, returnSection = "Library") {
    setLibraryScrollPosition(window.scrollY);
    setBookReturnSection(returnSection);
    setSelectedBookId(bookId);
    setActive("Library");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openBookFromSearch(bookId: string) {
    setActive("Library");
    openBook(bookId);
  }
  function openListFromSearch(listId: string) {
    setSearchedListId(listId);
    setActive("Lists");
  }

  function closeBook() {
    setSelectedBookId(null);
    setActive(bookReturnSection);
    window.requestAnimationFrame(() =>
      window.scrollTo({ top: libraryScrollPosition, behavior: "auto" }),
    );
  }

  function openQuickLog(bookId?: string) {
    setEditingLog(null);
    setQuickLogBookId(bookId ?? null);
    setQuickLogOpen(true);
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <button
            className="brand-home"
            onClick={() => {
              setActive("Home");
              setSelectedBookId(null);
              setMobileMenu(false);
            }}
            aria-label="Go to Pagewise Home"
          >
            <span className="brand-mark" aria-hidden="true" />
            <span className="brand-name">Pagewise</span>
          </button>
          <button
            className="icon-button mobile-close"
            onClick={() => setMobileMenu(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="primary-nav" aria-label="Primary navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={active === label ? "nav-item active" : "nav-item"}
              aria-current={active === label ? "page" : undefined}
              onClick={() => {
                setActive(label);
                setAccountOpen(false);
                if (label === "Lists") setSearchedListId(null);
                setMobileMenu(false);
              }}
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <Sparkles size={17} />
          <div>
            <strong>Your library, privately yours.</strong>
            <span>Synced across every device.</span>
          </div>
        </div>
      </aside>

      {mobileMenu && (
        <button
          className="scrim"
          aria-label="Close navigation"
          onClick={() => setMobileMenu(false)}
        />
      )}

      <main className="main-area">
        <header className="topbar">
          <button
            className="icon-button menu-button"
            onClick={() => setMobileMenu(true)}
            aria-label="Open navigation"
          >
            <Menu size={21} />
          </button>
          <GlobalSearch
            books={bookStore.books}
            inventoryItems={inventory.items}
            lists={bookLists.lists}
            reviews={searchableReviews}
            onOpenBook={openBookFromSearch}
            onOpenList={openListFromSearch}
            onOpenInventory={(id) => {
              setSelectedInventoryId(id);
              setActive("LitShelves");
            }}
            onAddBook={bookStore.addBook}
            onAddInventory={inventory.addItem}
            onUpdateInventory={inventory.updateItem}
            onShowAll={(query, type) => {
              setSearchReturnActive(active);
              setInternetSearch({ query, type });
              setActive("Search");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
          <button
            className="button button-secondary smart-import-trigger"
            onClick={() => setSmartImportOpen(true)}
          >
            <FileUp size={17} />
            <span>Import</span>
          </button>
          <button
            className="button button-primary"
            onClick={() => setAddBookOpen(true)}
          >
            <Plus size={18} /> Add book
          </button>
          <button
            className="theme-quick-toggle"
            onClick={() =>
              void profile.saveTheme(
                profile.theme === "light" ? "dark" : "light",
              )
            }
            aria-label={`Switch to ${profile.theme === "light" ? "dark" : "light"} theme`}
            title={`Switch to ${profile.theme === "light" ? "dark" : "light"} theme`}
          >
            {profile.theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <div className="account-wrap">
            <button
              className="avatar"
              aria-label="Open account menu"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen((open) => !open)}
            >
              {profile.avatarUrl ? <Image src={profile.avatarUrl} alt="" width={38} height={38} unoptimized /> : accountInitials || "R"}
            </button>
            {accountOpen && (
              <div className="account-menu">
                <span>{previewMode ? "Preview mode" : "Signed in"}</span>
                <strong>{profile.displayName || userEmail || "Local preview account"}</strong>
                {profile.displayName && userEmail && <small>{userEmail}</small>}
                {onSignOut && (
                  <button onClick={() => void onSignOut()}>
                    <LogOut size={16} /> Sign out
                  </button>
                )}
              </div>
            )}
          </div>
        </header>

        <div className="page-content" id="main-content" tabIndex={-1}>
          {previewMode && (
            <div className="preview-banner">
              <span>Preview mode</span>You’re exploring Pagewise with sample
              data. Changes remain on this device for this session.
            </div>
          )}
          {active === "Search" && internetSearch ? (
            <InternetSearchView
              request={internetSearch}
              books={bookStore.books}
              inventoryItems={inventory.items}
              onBack={() => setActive(searchReturnActive)}
              onAddBook={bookStore.addBook}
              onAddInventory={inventory.addItem}
              onUpdateInventory={inventory.updateItem}
            />
          ) : active === "Library" ? (
            selectedBook ? (
              <BookDetailView
                book={selectedBook}
                userId={userId}
                previewMode={previewMode}
                lists={bookLists.lists}
                memberships={bookLists.memberships}
                onAttemptChange={(attempt) => {
                  completedAttempts.recordAttempt(attempt);
                  if (!previewMode) void completedAttempts.refresh();
                }}
                readingLogs={readingLogs.logs}
                onBack={closeBook}
                onQuickLog={() => openQuickLog(selectedBook.id)}
                onAddToList={() => setListBookId(selectedBook.id)}
                onUpdate={bookStore.updateBook}
                onLifecycleBookChange={(changes) =>
                  bookStore.patchBookLocal(selectedBook.id, changes)
                }
                onDelete={bookStore.deleteBook}
                onReplaceCover={bookStore.replaceCover}
                onRemoveCover={bookStore.removeCover}
              />
            ) : (
              <LibraryView
                books={bookStore.books}
                attempts={completedAttempts.attempts}
                loading={bookStore.loading}
                error={bookStore.error}
                onAdd={() => setAddBookOpen(true)}
                onRetry={bookStore.refresh}
                onUpdate={bookStore.updateBook}
                onDelete={bookStore.deleteBook}
                onReplaceCover={bookStore.replaceCover}
                onRemoveCover={bookStore.removeCover}
                onOpen={(book) => openBook(book.id)}
                onAddToList={(book) => setListBookId(book.id)}
              />
            )
          ) : active === "LitShelves" ? (
            <Suspense fallback={<DeferredViewLoading />}>
              <LitShelvesView
                {...inventory}
                books={bookStore.books}
                onAdd={() => setAddInventoryOpen(true)}
                onImport={() => setInventoryImportOpen(true)}
                onOpen={(item) => setSelectedInventoryId(item.id)}
              />
            </Suspense>
          ) : active === "Lists" ? (
            <ListsView
              key={searchedListId ?? "all-lists"}
              initialListId={searchedListId}
              books={bookStore.books}
              {...bookLists}
              onCreate={bookLists.createList}
              onUpdate={bookLists.updateList}
              onDelete={bookLists.deleteList}
              onSetBookLists={bookLists.setBookLists}
              onMove={bookLists.moveBook}
            />
          ) : active === "Progress" ? (
            <ProgressView
              books={bookStore.books}
              logs={readingLogs.logs}
              loading={readingLogs.loading}
              error={readingLogs.error}
              working={readingLogs.working}
              onAdd={() => openQuickLog()}
              onEdit={(log) => {
                setEditingLog(log);
                setQuickLogOpen(true);
              }}
              onDelete={readingLogs.deleteLog}
            />
          ) : active === "Diary" ? (
            <DiaryView
              books={bookStore.books}
              attempts={completedAttempts.attempts}
              loading={completedAttempts.loading}
              error={completedAttempts.error}
              onOpenBook={(bookId) => openBook(bookId, "Diary")}
              onUpdate={completedAttempts.updateAttempt}
              onDelete={completedAttempts.deleteAttempt}
              onUpdateBook={bookStore.updateBook}
              onLogFinished={async (book, details) => {
                const saved = await completedAttempts.logFinishedBook(
                  book,
                  details,
                );
                if (saved) {
                  bookStore.patchBookLocal(book.id, {
                    status: "completed",
                    active_attempt_id: null,
                    ...(book.total_pages
                      ? { current_page: book.total_pages }
                      : {}),
                  });
                }
                return saved;
              }}
            />
          ) : active === "Stats" ? (
            <StatsView
              books={bookStore.books}
              logs={readingLogs.logs}
              attempts={completedAttempts.attempts}
              freezeDates={streakFreeze.freezeDates}
              freezeAvailable={streakFreeze.available}
            />
          ) : active === "Profile" ? (
            <ProfileView
              key={`${profile.goalTarget}-${profile.timezone}`}
              userId={userId}
              previewMode={previewMode}
              email={userEmail}
              year={stats.year}
              completed={stats.completed}
              goalTarget={profile.goalTarget}
              timezone={profile.timezone}
              theme={profile.theme}
              working={profile.working}
              error={profile.error}
              displayName={profile.displayName}
              birthYear={profile.birthYear}
              bio={profile.bio}
              avatarUrl={profile.avatarUrl}
              onTheme={profile.saveTheme}
              onSave={profile.saveProfile}
              onSavePersonal={profile.savePersonalProfile}
              onUploadAvatar={profile.uploadAvatar}
              onRemoveAvatar={profile.removeAvatar}
              onSignOut={onSignOut}
            />
          ) : (
            <div className="dashboard-home">
              <section className="welcome-row">
                <div>
                  <p className="eyebrow">
                    {new Intl.DateTimeFormat(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    }).format(new Date())}
                  </p>
                  <h1>
                    {greeting}, {accountName}.
                  </h1>
                  <p className="lead">
                    A quiet place for every book and every reading day.
                  </p>
                </div>
                <button
                  className="button button-secondary"
                  onClick={() => openQuickLog()}
                >
                  <BookOpen size={18} /> Quick log
                </button>
              </section>

              <section className="metric-grid" aria-label="Reading overview">
                <article className="metric-card accent-card">
                  <div className="metric-icon">
                    <Flame size={20} />
                  </div>
                  <div>
                    <span>Current streak</span>
                    <strong>
                      {stats.streak.current} <small>days</small>
                    </strong>
                    <p>Personal best: {stats.streak.best} days</p>
                  </div>
                  <div
                    className={`freeze-pill ${streakFreeze.available ? "" : "used"}`}
                  >
                    {streakFreeze.available
                      ? "1 freeze ready"
                      : streakFreeze.freezeDates[0]
                        ? "Freeze used"
                        : "No freeze ready"}
                  </div>
                </article>
                <article className="metric-card">
                  <div className="metric-icon muted-icon">
                    <Target size={20} />
                  </div>
                  <div className="metric-grow">
                    <span>{`${stats.year} reading goal`}</span>
                    <strong>
                      {stats.completed}{" "}
                      <small>of {profile.goalTarget} books</small>
                    </strong>
                    <div className="progress-track">
                      <i
                        style={{
                          width: `${Math.min(100, (stats.completed / profile.goalTarget) * 100)}%`,
                        }}
                      />
                    </div>
                    <p>
                      {Math.round((stats.completed / profile.goalTarget) * 100)}
                      % complete ·{" "}
                      {Math.max(0, profile.goalTarget - stats.completed)} to go
                    </p>
                  </div>
                </article>
                <article className="metric-card">
                  <div className="metric-icon muted-icon">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <span>Pages logged</span>
                    <strong>{stats.totalPages.toLocaleString()}</strong>
                    <p>{stats.monthPages.toLocaleString()} pages this month</p>
                  </div>
                </article>
              </section>

              <section className="content-section">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">In progress</p>
                    <h2>Currently reading</h2>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setActive("Progress")}
                  >
                    View progress <ChevronRight size={16} />
                  </button>
                </div>
                <div className="reading-grid">
                  {currentBooks.map((book, index) => {
                    const progress = book.total_pages
                      ? Math.round((book.current_page / book.total_pages) * 100)
                      : 0;
                    const pace = estimateBookFinish(book, readingLogs.logs);
                    return (
                      <article className="reading-card" key={book.title}>
                        <BookCover
                          initials={book.title
                            .split(/\s+/)
                            .slice(0, 2)
                            .map((word) => word[0])
                            .join("")}
                          tone={["ochre", "blue"][index]}
                        />
                        <div className="reading-info">
                          <div>
                            <p className="book-status">Currently reading</p>
                            <h3>{book.title}</h3>
                            <p className="author">{book.author}</p>
                          </div>
                          <div>
                            <div className="progress-label">
                              <span>
                                {book.current_page}
                                {book.total_pages
                                  ? ` of ${book.total_pages} pages`
                                  : " pages"}
                              </span>
                              <strong>
                                {book.total_pages ? `${progress}%` : "—"}
                              </strong>
                            </div>
                            <div className="progress-track large">
                              <i style={{ width: `${progress}%` }} />
                            </div>
                            <div className="reading-footer">
                              <span>
                                {pace
                                  ? `Est. ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(pace.estimatedDate)} · ${Math.round(pace.averagePagesPerDay)} ppd`
                                  : "Log 2 sessions for estimate"}
                              </span>
                              <button onClick={() => openQuickLog(book.id)}>
                                Log reading
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                  {currentBooks.length === 0 && (
                    <div className="home-empty-card">
                      <BookOpen size={20} />
                      <span>
                        Start a book from your Library to see it here.
                      </span>
                    </div>
                  )}
                </div>
              </section>

              <div className="lower-grid">
                <section className="content-section recent-section">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">Your year</p>
                      <h2>Recently finished</h2>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setActive("Library")}
                    >
                      See all <ChevronRight size={16} />
                    </button>
                  </div>
                  <div className="recent-list">
                    {recentBooks.map((book, index) => (
                      <article className="recent-book" key={book.title}>
                        <BookCover
                          initials={book.title
                            .split(/\s+/)
                            .slice(0, 2)
                            .map((word) => word[0])
                            .join("")}
                          tone={["red", "navy", "cream"][index]}
                          compact
                        />
                        <div>
                          <h3>{book.title}</h3>
                          <p>{book.author}</p>
                          <span>Finished</span>
                        </div>
                      </article>
                    ))}
                    {recentBooks.length === 0 && (
                      <p className="home-empty-copy">
                        Finished books will appear here.
                      </p>
                    )}
                  </div>
                </section>

                <section className="content-section activity-section">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">This week</p>
                      <h2>Reading activity</h2>
                    </div>
                  </div>
                  <div
                    className="week-chart"
                    aria-label={`Pages read this week: ${stats.week.reduce((sum, day) => sum + day.pages, 0)} total`}
                  >
                    {stats.week.map((day) => (
                      <div key={day.key}>
                        <i
                          style={{ height: `${(day.pages / weekMax) * 100}%` }}
                        />
                        <span>{day.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="activity-total">
                    <strong>
                      {stats.week.reduce((sum, day) => sum + day.pages, 0)}
                    </strong>
                    <span>
                      pages across{" "}
                      {stats.week.filter((day) => day.pages > 0).length} reading
                      days
                    </span>
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      </main>

      <nav className="bottom-nav" aria-label="Mobile navigation">
        {navItems
          .filter(({ label }) =>
            ["Home", "Library", "LitShelves", "Progress", "Diary"].includes(
              label,
            ),
          )
          .map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={active === label ? "active" : ""}
              aria-current={active === label ? "page" : undefined}
              onClick={() => {
                setActive(label);
                setAccountOpen(false);
              }}
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          ))}
      </nav>
      <AddBookModal
        open={addBookOpen}
        onClose={() => setAddBookOpen(false)}
        onSave={bookStore.addBook}
        books={bookStore.books}
        inventoryItems={inventory.items}
        onUpdateInventory={inventory.updateItem}
        onUploadCover={bookStore.uploadCover}
        onDiscardCover={bookStore.discardUploadedCover}
      />
      {smartImportOpen && (
        <Suspense fallback={null}>
          <SmartImportModal
            open
            books={bookStore.books}
            onClose={() => setSmartImportOpen(false)}
            onSave={bookStore.addBook}
          />
        </Suspense>
      )}
      {addInventoryOpen && (
        <Suspense fallback={null}>
          <AddInventoryModal
            open
            books={bookStore.books}
            items={inventory.items}
            onClose={() => setAddInventoryOpen(false)}
            onSave={inventory.addItem}
            onCreatePagewiseBook={bookStore.addBook}
            onUploadCover={bookStore.uploadCover}
            onDiscardCover={bookStore.discardUploadedCover}
          />
        </Suspense>
      )}
      {inventoryImportOpen && (
        <Suspense fallback={null}>
          <InventoryImportModal
            open
            items={inventory.items}
            onClose={() => setInventoryImportOpen(false)}
            onSave={inventory.addItem}
          />
        </Suspense>
      )}
      {selectedInventoryId &&
        inventory.items.find((item) => item.id === selectedInventoryId) && (
          <Suspense fallback={null}>
            <InventoryDetailModal
              item={inventory.items.find(
                (item) => item.id === selectedInventoryId,
              )!}
              books={bookStore.books}
              onClose={() => setSelectedInventoryId(null)}
              onUpdate={inventory.updateItem}
              onDelete={inventory.deleteItem}
            />
          </Suspense>
        )}
      {quickLogOpen && (
        <QuickLogModal
          books={bookStore.books}
          initialBookId={quickLogBookId}
          log={editingLog}
          working={readingLogs.working}
          onClose={() => {
            setQuickLogOpen(false);
            setEditingLog(null);
          }}
          onSave={readingLogs.saveLog}
        />
      )}
      {listBook && (
        <AddToListsModal
          book={listBook}
          lists={bookLists.lists}
          memberships={bookLists.memberships}
          working={bookLists.working}
          onClose={() => setListBookId(null)}
          onCreate={bookLists.createList}
          onSave={(ids) => bookLists.setBookLists(listBook.id, ids)}
        />
      )}
    </div>
  );
}
