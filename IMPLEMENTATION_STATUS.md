# Pagewise Implementation Status

This file tracks work in small, reviewable packets. A packet is marked complete only after its acceptance checks pass.

## Phase 0 — Project foundation

### Packet 0.1 — Project initialization: Complete

- Application workspace initialized
- TypeScript and build tooling available
- Pagewise package identity applied
- Cross-platform development/build commands configured
- Original and refined specifications preserved

### Packet 0.2 — Architecture baseline: Complete

- Supabase client dependency added
- Public environment template added without secrets
- Supabase remains the authoritative data/auth/storage platform
- Hosting scaffold contains no alternate application database

## Phase 1 — Secure platform shell

### Packet 1.1 — Database foundation: Complete, awaiting live Supabase application

- Core V1 tables and relationships
- Constraints, indexes, and updated timestamps
- RLS policies for all user-owned tables
- Same-user validation for list membership
- Book-cover Storage bucket and owner-only mutation policies

Acceptance remaining: apply the migration to a Supabase project and run a two-user isolation test.

### Packet 1.2 — Product shell and dark theme: Complete

- Pagewise starter removed
- Editorial dark-first dashboard implemented
- Fraunces, Inter, and JetBrains Mono roles established
- Desktop sidebar and mobile bottom navigation
- Responsive Home layout with realistic Pagewise states
- Keyboard focus, reduced-motion, safe-area, and status-label foundations

### Packet 1.3 — PWA metadata foundation: Complete

- Application manifest
- Standalone display configuration
- Add Book and Quick Log shortcuts
- Mobile theme and Apple web-app metadata

Delivered in Packets 7.1 and 7.2; live-device installation remains part of production acceptance.

### Packet 1.4 — Authentication: Complete, awaiting live Supabase verification

- Magic-link sign-in and sent-email confirmation
- Auth callback/session URL detection through Supabase client
- Auth-gated application shell when Supabase is configured
- Clearly labeled preview mode when local public keys are absent
- Automatic settings creation and browser-timezone initialization
- Account menu and sign-out flow

Acceptance remaining: add the Supabase project URL/anonymous key, configure redirect URLs, and verify magic-link delivery and two-user isolation.

## Delivery phases

- Phase 2: Book CRUD, cover upload, Open Library, Library, book detail
- Phase 3: Attempts, status lifecycle, progress, ratings, reviews, rereads, diary
- Phase 4: Lists, tags, quotes, and global search
- Phase 5: Streaks, pace, goals, Home data, Stats, and Progress
- Phase 6: Versioned export/import
- Phase 7: Full PWA service worker/install flow and light-theme pass
- Phase 8: Security audit, production validation, and release

## Phase 2 — Library foundation

### Packet 2.1 — Book data and collection view: Complete

- Typed book/status model aligned with the Supabase schema
- Supabase-backed load, add, update, favorite, status, and delete operations
- Safe in-memory preview collection when Supabase is not configured
- Cover-forward responsive Library grid
- Status/favorites filters, global book-field search, and sorting
- Progress indicators and accessible cover fallbacks
- Empty, loading, and error states

### Packet 2.2 — Add Book and Open Library: Complete

- Search by title, author, or ISBN
- Select among Open Library results with edition metadata
- Cover, author, year, pages, ISBN, work key, and edition key mapping
- Complete manual-entry fallback and editable imported fields
- Status, genre, tags, cover URL, description, and validation inputs
- Add Book entry points in the app header and Library

### Packet 2.3 — Uploaded covers and duplicate detection: Complete, awaiting live Storage verification

- JPEG, PNG, WebP, and AVIF validation up to 10 MB
- Browser-side resize and WebP compression before upload
- Owner-scoped Storage paths and persisted storage-path metadata
- Orphan cleanup when a database save fails
- Safe replace/remove ordering and cleanup of previous owned files
- Preview-mode object URLs with explicit memory cleanup
- Duplicate warnings for normalized ISBN or title/author matches
- Intentional alternate editions remain allowed

Acceptance remaining: apply the updated migration to Supabase and verify upload/replace/remove against the live `book-covers` bucket.

### Packet 2.4 — Book detail and editing: Complete

- Cover-led responsive detail view with complete core metadata
- Editable title, author, status, genre, pages, year, ISBN, tags, and description
- Favorite, status, and current-page controls
- Cover replace/remove actions available from detail
- Accurate known/unknown page-progress states
- Safe destructive delete flow with related-data warning
- Library scroll position preserved when opening and closing details
- Structured empty states for reading attempts, lists, quotes, and notes
- Future-domain actions are positioned without inventing records

## Phase 2 checkpoint

The Library foundation is complete. Live Supabase acceptance still requires applying the migration, configuring public credentials, and testing authentication, database RLS, and Storage with two accounts.

## Phase 3 — Reading lifecycle

### Packet 3.1 — Reading attempts and status transitions: Complete, awaiting live RPC verification

- Permanent typed reading-attempt history per book
- Atomic database functions for start/resume, hold/drop, and finish
- Row locking prevents competing attempt-number/status updates
- Start Reading creates the first attempt and resets progress
- Hold and Drop preserve active attempt and current page
- Resume continues the same unfinished attempt
- Finish completes the active attempt and synchronizes page/status
- Start Reread creates the next numbered attempt without overwriting history
- Adding a book with an initial status creates the corresponding attempt lifecycle
- Loose status dropdowns removed from Library and metadata editing
- Detail history lists read number, start/finish state, and current rating summary
- Preview-mode lifecycle behaves locally without pretending to persist

Acceptance remaining: apply the migration and verify lifecycle RPC behavior under authenticated RLS with concurrent requests.

### Packet 3.2 — Ratings, tags, reviews, and attempt dates: Complete, awaiting live RPC verification

- Accessible five-star input with half-star increments
- All eight descriptive rating tags preserved independently
- Started/completed date editing with chronological validation
- Per-attempt review editor with 10,000-character guidance
- Finish flow opens a focused completion sheet
- Completed details are written atomically with the finish operation
- Every historical attempt can be edited without affecting other reads
- Rating, tag, review, and dates update immediately in preview mode

### Visual refinement — Modern reading room: Complete

- Dark walnut navigation framing with restrained grain
- Slim wooden shelf ledges beneath Library and detail covers
- Warmer charcoal surfaces and borders without reducing readability
- Existing editorial typography, whitespace, and minimal controls preserved
- No rustic ornament, skeuomorphic furniture, or heavy texture

Acceptance remaining: verify attempt updates and finish-with-rating against live Supabase RLS/RPC after migration.

### Packet 3.3 — Reading diary and synchronized progress: Complete

- Quick Log entry form and automatic pages-read calculation
- Attempt-linked reading logs
- Log-to-current-page synchronization
- Direct progress updates with optional diary creation
- Diary editing/deletion safeguards

# Packet 3.3 — Quick Log & Reading Diary

- Added a reusable Quick Log flow for active reading attempts.
- Page ranges automatically calculate pages read and move book progress forward.
- Added the Progress screen with active-book summaries and a diary timeline.
- Diary entries can be edited or deleted; deleting history never rolls progress backward.
- Added an atomic Supabase `log_reading` function to keep diary and progress changes consistent.

# Packet 3.4 — Playlist-style Custom Lists

- Added custom list creation, editing, descriptions, and safe deletion.
- Books can belong to multiple lists through an “Add to lists” picker.
- A new list can be created directly while assigning a book.
- Added persistent manual ordering and remove-from-list controls.
- Added modern wooden-shelf list artwork and responsive list detail screens.

# Packet 3.5 — Reading Statistics & Streaks

- Replaced dashboard sample totals with live book and diary calculations.
- Added current/best streak calculation with same-day and yesterday grace behavior.
- Added real seven-day activity, monthly totals, completion progress, and active books.
- Added a responsive Statistics page with annual pages, genres, reading days, and session averages.

# Packet 4.1 — Quotes & Personal Notes

- Added private per-book quote storage with optional page numbers.
- Added separate personal commentary beneath each saved passage.
- Added responsive create/edit sheets and confirmed deletion.
- Quotes load and update directly inside the book detail page.

# Packet 4.2 — Global Search

- Activated the persistent header search with Ctrl/Cmd+K focus.
- Searches titles, authors, ISBNs, genres, tags, list titles/descriptions, and review text.
- Added keyboard result navigation, clear/no-result states, and responsive presentation.
- Results deep-open matching book detail pages and custom lists.

# Packet 4.3 — Finished-Book Diary

- Added a separate Diary navigation destination while preserving Progress for page/session tracking.
- Diary entries are generated only from completed reading attempts; rereads remain separate rows.
- Added month/year grouping and compact book, publication, rating, favorite, reread, review, and edit columns.
- Added filters for year, rating, genre, first read/reread, and reviewed state.
- Completion edits and newly finished books synchronize back into the Diary.

# Packet 4.4 — List Completion & Status

- Added computed `finished / total` counts and completion percentages to every custom list.
- Added persistent visual progress bars on list cards and detail headers.
- Added clear Read, Reading, and Not read indicators to each listed book.

# Packet 5.1 — Reading Pace & Finish Estimates

- Added trailing 14-day per-book pace calculations based on calendar reading rhythm.
- Added estimated finish dates and average pages/day to Home and Progress.
- Estimates require at least two recent sessions and clearly explain insufficient data.
- Unknown page counts and already-finished books never show misleading estimates.

# Packet 5.2 — Streak Freeze Protection

- Added one automatic grace day that preserves a streak after a single missed day.
- Added monthly freeze availability reset and an owner-scoped freeze history.
- Streak calculations now count protected dates while reading-day statistics remain honest.
- Added ready/used status on Home and freeze context in Statistics.

# Packet 5.3 — Profile, Reading Goal & Theme Controls

- Added a functional Profile destination for annual reading-goal, timezone, appearance, and account controls.
- Reading goals now load and save per year, and the Home dashboard uses the saved target instead of a fixed value.
- Added Dark, Light, and System theme preferences with a persistent Supabase setting and an instant top-bar toggle.
- Added a clean warm-paper light theme while preserving the modern walnut bookshelf character.
- Added timezone validation so invalid values cannot break day, streak, or freeze calculations.

# Packet 6.1 — Versioned JSON Backup Export

- Added a one-click Profile backup that exports every private Pagewise record collection in parallel.
- Backups use the documented `pagewise-backup` format, schema version, export timestamp, and app version.
- Added a post-export record summary and actionable per-collection errors.
- Preserved cover URLs while clearly documenting that uploaded image binaries are not embedded in V1 backups.

# Packet 6.2 — Safe Import Validation & Preview

- Added local JSON inspection that never changes existing library data.
- Validates backup identity, schema version, timestamps, required collections, record limits, IDs, duplicates, and parent-child relationships.
- Added a clear error report for damaged, incompatible, oversized, or unrelated files.
- Added record-count preview and Merge/Replace mode selection ahead of the atomic restore step.

# Packet 6.3 — Atomic Merge & Replace Restore

- Added a single transactional Supabase restore function so partial imports roll back automatically.
- Merge upserts matching stable IDs while preserving unrelated records; Replace clears only the signed-in user's library before restoration.
- Backup `user_id` values are ignored and every restored row is reassigned to the authenticated account.
- Added cross-account ID collision protection, ordered parent/child restoration, and active-attempt repair.
- Added final confirmation UI, including typed `REPLACE` confirmation for destructive restores and post-restore refresh.

# Packet 7.1 — PWA App Shell & Service Worker

- Added standard 192px, 512px, maskable, Apple touch, and favicon PNG assets using the Pagewise walnut-and-paper identity.
- Completed the standalone manifest with scope, app identity, categories, and Add Book/Quick Log shortcuts.
- Added a versioned service worker that caches only safe static assets, limits Open Library cover caching, and bypasses Supabase traffic.
- Added a friendly offline screen that never implies private data or pending writes were saved.
- Added connection status and a controlled update-ready prompt instead of silently replacing the running app.

# Packet 7.2 — Installation UX & App Shortcuts

- Added Chromium install-prompt capture with a quiet, dismissible in-app installation card.
- Added iPhone/iPad Safari instructions for Share → Add to Home Screen.
- Detects standalone mode and hides installation prompts after Pagewise is installed.
- Added successful-install handling and a versioned device-local dismissal preference.
- Connected manifest shortcuts so Add Book and Quick Log open their intended Pagewise actions.

# Packet 7.3 — Smart List Import Foundation

- Added multiline paste import for titles, title/author pairs, numbered lists, bullets, and ISBNs.
- Normalizes input, removes duplicate lines, and matches up to 25 books against Open Library at its public rate limit.
- Added confidence states for strong matches, review-needed matches, duplicates already in the Library, and unmatched entries.
- Added cover and metadata review with per-book selection before anything is saved.
- Selected matches can be added to the private Library as a controlled batch.

# Packet 7.4 — Multi-Provider Metadata Pipeline

- Added a unified server-side metadata search used by both Add Book and Smart Import.
- Open Library remains primary; Google Books supplements descriptions, editions, page counts, and Bengali results when its optional key is configured.
- Wikidata adds multilingual/Bengali title enrichment, while Internet Archive adds digitized-edition candidates and cover thumbnails.
- Providers run independently in parallel, so one missing credential or outage does not block the others.
- Candidates are normalized, scored, deduplicated, and enriched across sources before review.

# Packet 7.5 — Fast Matching & Manual Fallback

- Unmatched and failed-search lines now remain selected as placeholder books for later manual editing.
- Smart Import processes three entries concurrently with short, provider-friendly pauses between batches.
- Slow Internet Archive requests have a strict fast-fail timeout and never hold up primary metadata results.
- Bengali Google Books searches prefer `bn` results while simultaneously retaining unrestricted Bengali/English fallback editions.

# Packet 7.6 — Combined Local & Internet Search

# Packet 7.7 — Metadata-assisted Book Editing

- Editing a library book now searches internet metadata as its title or author changes.
- Suggestions are debounced, cancellable, and show edition details plus provider provenance.
- Applying a suggestion updates bibliographic fields and cover metadata while preserving reading state, tags, and existing notes.

# Packet 7.8 — Multi-field Metadata Matching

- Edit suggestions now react to title, author, ISBN, publication year, and genre changes.
- Provider searches use structured title/author/ISBN/subject signals and rank editions by all available fields.
- Genre metadata is collected, shown in results, and can be applied with the selected edition.

# Packet 7.9 — Search Modes

- Global local and internet search now supports All, Title, Author, and ISBN modes.
- Pasted ISBN-10 and ISBN-13 values are detected automatically.
- Internet provider queries use field-specific title, author, and ISBN syntax for more relevant matches.

# Packet 7.10 — Full Internet Search Results

- The compact header search now links to a dedicated full-results view.
- Expanded searches request up to 40 merged metadata candidates and initially display 20 with Load More.
- Full results support language, provider, cover availability, and sorting filters.
- Each edition can be reviewed and added directly, with existing-library detection.

# Packet 8.1 — Interface Audit: Complete

- Removed the hard-coded user greeting and derived a time-aware greeting from the signed-in account.
- Replaced technical preview setup copy with clear product-facing session behavior.
- Updated outdated multi-provider and metadata-assistant descriptions.
- Full-search Back navigation now returns to the screen where the search began.

# Packet 8.2 — Responsive Design Audit: Complete

- Restored full-width primary actions inside mobile sheets instead of collapsing every primary button to an icon width.
- Made the global search results panel viewport-safe on narrow screens.
- Simplified the smallest top bar while retaining search and Add Book access.
- Improved narrow-screen metadata suggestions, backup counts, preview messaging, and modal actions.

# Packet 8.3 — Theme Audit: Complete

- Added a pre-render theme bootstrap so saved Dark, Light, and System preferences apply before the interface paints.
- Prevented the initial settings effect from overwriting a stored device preference with Dark.
- Improved light-theme contrast for cover controls, Diary headers/actions, and used streak-freeze states.
- Kept intentionally dark wooden navigation and authentication artwork readable in light mode.

# Packet 8.4 — Accessibility Audit: Complete

- Added a keyboard-visible Skip to main content link and focusable content landmark.
- Added current-page announcements to desktop and mobile navigation.
- Replaced invalid mixed combobox semantics with an announced search-results region.
- Added accessible tab semantics and Escape dismissal to Add Book.
- Extended visible keyboard focus treatment to selects, textareas, summaries, and programmatic focus targets.

# Packet 8.5 — Application States: Complete

- Short global-search queries now explain the three-character internet-search threshold instead of reporting false no-results.
- Metadata-assisted editing now distinguishes a completed search with no confident suggestions from a blank or loading state.
- Full internet search failures have a dedicated retry action and never leave stale results visible.
- Offline and restored-connection banners clearly communicate when synced changes become available again.

- The persistent header search now clearly separates saved Pagewise results from live internet metadata matches.
- Local books, lists, tags, ISBNs, and reviews remain instant while provider search runs after a short debounce.
- Internet candidates show cover, author, and provider provenance with a direct Add to Library action.
- Added cancellation for stale searches, loading/error states, duplicate ISBN filtering, and safe preview-mode behavior.

# Packet 9.1 — Advanced Library Filters: Complete

- Added combinable filters for reading status, author, genre, publication year, tags, and favorites.
- Built filter choices directly from the current library so only useful options appear.
- Added an active-filter count, live result total, one-click clearing, and a dedicated no-match recovery action.
- Made the advanced filter panel responsive and accessible across desktop and mobile layouts.

# Packet 9.2 — Library Views: Complete

- Added cover shelf, compact shelf, and detailed list layouts to the Library.
- Remembered the selected layout locally so the Library reopens in the preferred view.
- Added richer list rows with genre, publication year, page count, ISBN, and tags.
- Preserved book opening, favorites, cover management, filters, and responsive behavior in every layout.

# Packet 9.3 — Large Library Loading: Complete

- Limited the initial Library render to 24 matching books for faster large-collection browsing.
- Added Load More and Show All controls with accurate visible-result counts.
- Reset the visible batch automatically whenever search, filtering, or sorting changes.
- Added deferred off-screen card rendering and responsive loading controls without affecting full filter totals.

# Packet 9.4 — Bulk Library Management: Complete

- Added a dedicated selection mode with individual and Select Displayed controls across every Library layout.
- Added bulk tag, favorite, unfavorite, and confirmed deletion actions.
- Preserved reading-lifecycle integrity by keeping status transitions inside individual book workflows.
- Added disabled, working, error, responsive, keyboard, and screen-reader states for bulk operations.

# Packet 9.5 — Library Navigation Memory: Complete

- Preserved Library search, sorting, status, author, genre, year, tag, favorites, and advanced-panel state while navigating.
- Preserved the incrementally loaded book count so returning from a detail page does not collapse the shelf.
- Integrated with the existing Library scroll restoration when opening a book and returning.
- Kept selection mode temporary so potentially destructive bulk selections are never restored unexpectedly.

# Packet 9.6 — Complete Library Sorting: Complete

- Added Recently Added and Highest Rated sorting required by the master plan.
- Used the latest rated completed attempt for each book and placed unrated books after rated books.
- Added stable title and ID tie-breaking so book order does not jump between renders.
- Displayed the latest rating in detailed list view while retaining remembered sorting state.

# Packet 9.7 — Library Loading & Recovery: Complete

- Replaced the plain Library loading message with responsive skeleton books matching cover, compact, and list layouts.
- Added a dedicated first-load failure screen with an actionable Retry control.
- Kept existing books visible after refresh failures and added a compact retryable warning instead of replacing the shelf.
- Added accessible loading/error announcements and reduced-motion-compatible skeleton animation.

# Packet 10.1 — Book Reading Log Preview: Complete

- Added the five most recent reading sessions directly to each Book Detail page.
- Displayed session date, pages read, page range, and personal note without mixing logs with reread history.
- Added Quick Log and first-session actions from the preview section.
- Added responsive, semantic date markup and a clear no-logs state.

# Packet 10.2 — Current & Latest Read Summary: Complete

- Added a focused attempt summary beneath each book’s reading actions.
- Displayed the active or latest attempt number, start date, finish/status value, numeric rating, descriptive rating, and review.
- Added direct editing from the summary while preserving full reread history below.
- Added responsive and accessible presentation for narrow screens.

# Packet 10.3 — Book Reading Pace: Complete

- Added a finish estimate directly beneath active Book Detail progress.
- Displayed recent pages-per-day pace, remaining days, and an estimated calendar finish date.
- Recalculated the estimate against the currently selected page value.
- Added a clear two-session requirement when there is not enough recent data for a trustworthy estimate.

# Packet 10.4 — Safe Progress Editing: Complete

- Replaced silent range-release updates with an explicit Save Progress workflow.
- Added an exact-page number field synchronized with the progress slider.
- Added page clamping, pending state, success announcement, and rollback after a failed save.
- Kept pace and percentage previews bounded and responsive while a new page is being selected.

# Packet 10.5 — Reliable Cover Management: Complete

- Added visible replacing and removing states to Book Detail cover actions.
- Prevented duplicate cover mutations while an upload or removal is in progress.
- Added removal confirmation plus accessible success and error feedback.
- Preserved the current cover when replacement fails and used a clear placeholder after successful removal.

# Packet 10.6 — Book Detail Information Order: Complete

- Aligned the lower Book Detail hierarchy to Lists, Quotes & Notes, recent Reading Logs, then full Reading History.
- Added a compact section navigator for quickly jumping through long book records.
- Added anchored section targets with safe sticky-header spacing and visible keyboard focus support.
- Preserved the two-column desktop composition and single-column mobile flow.

# Packet 11.1 — Log a Finished Book to Diary: Complete

- Kept automatic Diary creation when a reading attempt is finished.
- Added a manual Log a Finished Book action for older or previously untracked reads.
- Restricted the picker to books already marked Finished so unfinished books cannot enter the Diary.
- Created a separate dated reread entry with start/finish dates, rating, descriptive rating, and review while preserving earlier entries.

# Packet 11.2 — Finish & Log from Diary: Complete

- Expanded the Diary picker to every book in the Library, including books with only a few logged pages.
- Saving an unfinished selection now marks it Finished, fills its final page when a page count is known, and creates the dated Diary entry in one flow.
- Kept already-finished books available as an explicit reread action.
- Synchronized the changed book status back into the Library immediately after a successful save.

# Packet 11.3 — Safe Diary Entry Deletion: Complete

- Added a Delete Entry action to the Diary edit sheet with explicit confirmation.
- Kept the book's current page progress and Library status unchanged when historical Diary entries are removed.
- Removed deleted entries from the Diary immediately after a successful operation.
- Added preview-mode support and clear working/failure feedback.

# Packet 11.4 — Diary Sorting & Large-History Efficiency: Complete

- Added sorting by newest or oldest finish date, highest rating, and book title.
- Preserved every existing Diary filter while sorting only the matched entries.
- Kept date grouping clear when chronological sorting is active.
- Replaced repeated book lookups with a memoized index for smoother large Diary histories.

# Packet 11.5 — Diary Search & Filter Recovery: Complete

- Added instant Diary search across book titles, authors, and ISBNs.
- Combined search cleanly with year, rating, genre, read type, review, and sorting controls.
- Added one-click clearing in both the filter bar and no-results state.
- Kept the search controls compact, accessible, and horizontally scrollable on mobile.

# Packet 11.6 — Large Diary Incremental Loading: Complete

- Limited the first Diary render to 30 matching entries for faster long-history browsing.
- Added Load More and Show All controls with an accurate visible-entry count.
- Reset the visible batch automatically whenever search, filters, or sorting changes.
- Preserved date grouping and all Diary actions across incrementally displayed entries.

# Packet 11.7 — Diary Return Navigation Memory: Complete

- Book Detail now remembers whether it was opened from Library or Diary.
- Closing a Diary-opened book returns directly to Diary at the previous scroll position instead of dropping the reader in Library.
- Preserved Diary search, filters, sorting, and loaded-entry count across the detail-page round trip.
- Kept temporary edit and finish dialogs intentionally excluded from navigation memory.

# Packet 11.8 — Diary Favorite Controls: Complete

- Turned the Diary heart column into a direct favorite/unfavorite control.
- Added immediate saved-state synchronization with the Library book record.
- Added accessible pressed labels, duplicate-click protection, and visible failure feedback.
- Kept both Favorite and Edit actions available in the compact mobile Diary row.

# Packet 11.9 — Diary Favorites Filter: Complete

- Added All, Favorites Only, and Not Favorited filtering to the Diary.
- Combined favorite filtering with every existing search, filter, sort, and incremental-loading control.
- Included favorite filtering in remembered Diary navigation state and one-click filter clearing.

# Packet 11.10 — Filtered Diary CSV Export: Complete

- Added one-click CSV export for the complete currently matched Diary result set, not only visible rows.
- Included dates, title, author, ISBN, publication details, pages, read type, attempt number, rating, review, and favorite status.
- Preserved the active Diary sorting order and added UTF-8 support for Bengali and other non-Latin metadata.
- Escaped spreadsheet formulas and CSV punctuation to keep exported files safe and structurally valid.

# Packet 12.1 — Complete V1 Reading Statistics: Complete

- Added books finished this year and this month using dated reading-attempt history.
- Added average rating, most-read author, most-read completed genre, and average completed-book length.
- Added a half-star rating distribution chart covering 0.5 through 5 stars.
- Kept rereads represented in reading-pattern metrics while unique finished books remain the primary collection total.

# Packet 12.2 — Historical Statistics Year Selector: Complete

- Added a year selector generated from dated reading logs and completed attempts.
- Recalculated monthly pages, finished reads, ratings, authors, genres, and reading days for the selected year.
- Preserved the current year as an option even before the first log is created.

# Packet 12.3 — Year-over-Year Comparison: Complete

- Added page and completed-read comparisons against the immediately previous year.
- Displayed clear positive, negative, and unchanged results directly in the primary metric cards.
- Kept all-time unique finished-book context alongside the selected-year count.

# Packet 12.4 — Personal Reading Records: Complete

- Added best reading day based on all sessions combined for that date.
- Added the highest-page month and longest completed book for the selected year.
- Added clean no-data states for years without enough activity.

# Packet 12.5 — Expanded Author & Genre Rankings: Complete

- Added ranked top-five author and genre panels based on completed reads and rereads in the selected year.
- Kept deterministic ranking for tied counts and retained the visual genre breakdown chart.
- Excluded unfinished books from completed-reading preference rankings.

# Packet 12.6 — Statistics CSV Report: Complete

- Added a downloadable report for the selected year.
- Included headline metrics, personal records, every monthly page total, and top author/genre counts.
- Added UTF-8 CSV output for Bengali and other multilingual book metadata.

# Packet 13.1 — Core Automated Test Coverage: Complete

- Added domain tests for page ranges, streak freezes, pace estimates, selected-year statistics, smart-list parsing, and backup relationships.
- Added PWA manifest/service-worker privacy assertions and metadata API validation coverage.
- Integrated unit, production-build, and rendered-worker tests into the main test command.

# Packet 13.2 — Application Recovery Boundaries: Complete

- Added route-level, root-level, and not-found recovery screens.
- Clearly state that saved library data is unchanged when rendering fails.
- Added retry/reload actions and accessible alert semantics.

# Packet 13.3 — Production Performance Audit: Complete

- Memoized expensive dashboard statistics and repeated book-derived collections.
- Confirmed bounded incremental rendering for Library and Diary histories.
- Confirmed parallel metadata providers, request cancellation, provider timeouts, and shared response caching.

# Packet 13.4 — PWA & Responsive Readiness Audit: Complete

- Added automated manifest, maskable-icon, shortcut, offline-fallback, safe-method, and Supabase-bypass checks.
- Added explicit service-worker registration failure recovery and immediate update checking.
- Advanced the service-worker cache version and retained mobile safe-area/responsive behavior.

# Packet 13.5 — Security Hardening Audit: Complete

- Updated patched framework, React server, Vite, Cloudflare, and Wrangler dependencies where compatible.
- Added metadata-search rate limiting, control-character normalization, bounded fields, year validation, and no-store throttling responses.
- Added clickjacking, MIME sniffing, referrer, browser-permission, and opener isolation response headers.
- Reconfirmed authenticated-only backup restore, owner reassignment, cross-account collision protection, upload constraints, and RLS migration coverage.
- Confirmed zero known vulnerabilities in production dependencies after compatible security updates; remaining audit findings are build-only transitive dependencies awaiting safe upstream upgrades.

# Packet 13.6 — Documentation Reconciliation: Complete

- Replaced starter documentation with Pagewise setup, commands, provider, PWA, backup, and production guidance.
- Corrected the stale Packet 3.3 status and documented all production-readiness packets.
- Kept live Supabase, multi-account isolation, Storage/RPC verification, device PWA testing, and deployment clearly marked as external acceptance work.

# Packet 13.7 — Repeatable Release Gate: Complete

- Added a single release command covering types, lint, domain tests, production build, rendered routes, and production dependency security.
- Added static verification for exact PWA icon dimensions, offline assets, Supabase cache bypass, and ordered database migrations.
- Added a stricter production gate that refuses release when the Supabase public environment is absent or malformed.
- Added an explicit Supabase, multi-account, backup, device-installation, and release-decision checklist without performing external deployment.

# Packet 14.1 — Optional AI Metadata Review: Complete

- Added a manual AI review inside Edit Book for title, author, genre, pages, publication year, ISBN, description, and tags.
- Kept every suggestion behind individual Apply controls or an explicit Apply all action; AI never changes saved data automatically.
- Added authenticated, rate-limited server-side OpenAI access with structured output validation, no response storage, Bengali-aware instructions, and provider-first grounding.
- Kept the feature optional: normal metadata search and manual editing continue to work without an OpenAI key.

# Packet 14.2 — AI-Assisted Book Entry: Complete

- Added the same optional metadata review to Add Book after the user enters or selects initial details.
- Grounded AI review with up to six results from the existing free metadata providers.
- Added individual field controls and an explicit Apply all action before the normal duplicate check and save flow.
- Disabled empty requests and preserved manual entry, uploaded covers, provider selection, and saving when AI is not configured.

# Packet 14.3 — AI-Assisted Smart Import Recovery: Complete

- Added an optional AI Improve action to uncertain and unmatched Smart Import rows.
- Preserved the parsed title and any provider metadata as grounding, while retaining existing values whenever AI returns an unknown field.
- Kept AI review one book at a time to control cost and required the normal selection plus final Add to Library confirmation.
- Preserved the fully manual fallback when Supabase or OpenAI is not configured.

# Packet 14.4 — AI Safety & Release Readiness: Complete

- Added strict request normalization and limits for metadata fields, tags, provider candidates, years, and page counts.
- Added safe handling for unsupported content types, malformed JSON, invalid requests, upstream failures, and timeouts.
- Added automated request/output boundary tests plus a rendered endpoint test for the optional-unconfigured state.
- Extended the release gate and manual checklist without making OpenAI mandatory for Pagewise.

# Packet 15.1 — LitShelves Inventory Foundation: Complete

- Added LitShelves as a separate owned-book inventory area in the primary navigation.
- Added an owner-isolated inventory schema for editions, copies, condition, language, format, location, shelf, acquisition, value, lending, and notes.
- Allowed an inventory copy to link optionally to a Pagewise reading record without sharing progress or Diary state.
- Added a responsive inventory overview with collection totals, physical locations, lending status, and realistic English/Bengali preview records.

# Packet 15.2 — Add Inventory Book: Complete

- Added owned-book entry with free metadata search by title, author, or ISBN and an optional confirmed AI review.
- Added edition, publisher, language, format, condition, quantity, acquisition, value, location, shelf, tags, notes, and cover upload fields.
- Added duplicate-copy warnings based on ISBN or normalized title and author while allowing intentional alternate editions.
- Added explicit Inventory only, link existing Pagewise book, and create Want to Read record choices.
- Added durable preview and Supabase insert flows with uploaded-cover cleanup when inventory saving fails.

# Packet 15.3 — Inventory Details & Editing: Complete

- Made every LitShelves card open a complete owned-copy record with edition, storage, acquisition, value, Pagewise, lending, tags, and notes context.
- Added editing for all inventory metadata plus linking, unlinking, quantity, location, shelf, and collection-value fields.
- Added free-provider metadata suggestions and optional confirmed AI review during editing.
- Added an explicit two-step delete confirmation with uploaded-cover cleanup and owner-scoped persistence.

# Packet 15.4 — Inventory Discovery & Shelf Views: Complete

- Added instant search across titles, authors, ISBNs, publishers, genres, languages, tags, locations, and shelves.
- Added location and condition filters plus title, author, acquisition, and updated-date sorting.
- Added responsive card and compact shelf-list layouts with clear empty-filter recovery.

# Packet 15.5 — Lending & Returns: Complete

- Added borrower, lent date, optional due date, current-loan status, and one-action return handling.
- Kept lending independent from Pagewise reading progress and cleared private borrower fields when a copy returns.
- Added database constraints preventing impossible due-date and returned-loan states.

# Packet 15.6 — Bulk Inventory Import: Complete

- Added pasted title/author/ISBN lists and UTF-8 CSV uploads for up to 100 owned books.
- Added CSV support for publisher, language, genre, format, location, shelf, and quantity.
- Added duplicate detection, multi-provider matching, manual fallback, selectable review, and optional one-row AI improvement.

# Packet 15.7 — Collection Group Views: Complete

- Added browsable author, publisher, genre, language, and physical-location collections.
- Added copy/title totals and visual book-stack previews for each group.
- Made every group a shortcut back to a filtered inventory view.

# Packet 15.8 — Inventory Statistics & Collection Value: Complete

- Added purchase-value totals weighted by copy quantity with clear priced-copy coverage.
- Added condition and language distributions plus Pagewise-link, ISBN, acquisition-date, and lending completeness metrics.
- Kept value reporting separate from reading statistics and avoided estimates for missing purchase prices.

# Packet 15.9 — Unified Pagewise & LitShelves Search: Complete

- Unified saved Pagewise books, LitShelves copies, lists, reviews, and internet metadata in the global search.
- Added Add to Pagewise, Add to LitShelves, and Add to both actions to compact and full internet results.
- Reused existing records, linked inventory-only copies when adding to both, and clearly disabled duplicate actions.
- Kept reading status/progress separate from owned-copy condition, location, value, and lending data.

# Packet 15.10 — LitShelves Data Protection & Release Audit: Complete

- Extended the versioned Pagewise JSON backup with all LitShelves inventory, lending, value, cover-reference, and optional Pagewise-link fields.
- Kept older version 1 backups valid by treating their missing inventory collection as empty.
- Added owner-checked merge and replace restoration through migration `0007_litshelves_backup_restore.sql`.
- Added a UTF-8 CSV export for the complete owned-book catalogue, including Bengali text and escaped spreadsheet values.
- Added automated backup-link, legacy compatibility, CSV integrity, and migration security checks.

# Packet 15.11 — Add to Pagewise from LitShelves: Complete

- Added a dedicated From LitShelves method to the Library’s Add Book dialog.
- Reused owned-copy title, author, ISBN, genre, publication year, tags, and cover metadata when creating the reading record.
- Added a selectable starting reading status and automatically linked the owned copy to the new Pagewise book.
- Linked an existing matching Pagewise record instead of creating a duplicate, and clearly marked inventory copies already in Pagewise.

# Packet 15.12 — Pre-release Application Audit: Complete

- Audited the Pagewise, Diary, Lists, metadata, Smart Import, LitShelves, export, PWA, profile, and authentication code paths.
- Fixed stale search results, unsafe list-modal lookups, modal dismissal and scroll-lock glitches, partial list-update rollback, local-date handling, and restricted-storage resilience.
- Preserved Bengali metadata during normalization and duplicate matching, bounded imported quantities, and protected CSV exports from spreadsheet-formula injection.
- Prevented Pagewise records created from LitShelves from claiming ownership of an inventory-uploaded cover file.
- Passed TypeScript, ESLint, 20 automated tests, the production build, dependency audit, and all eight release-readiness checks.

# Packet 15.13 — Click-through QA Fixes: Complete

- Replaced inventory metadata value keys with stable field-identity keys, preventing duplicate React key warnings when values such as edition and format match.
- Closed the account menu during desktop-sidebar and mobile-bottom navigation.
- Deferred LitShelves, inventory dialogs, Smart Import, and full internet search until first use, removing the production client chunk-size warning.
