# Pagewise — Production Master Plan

**Document status:** Implementation-ready V1 specification  
**Product:** Pagewise  
**Product type:** Private, single-user-per-account personal reading tracker  
**Primary platforms:** Responsive web, installable PWA on mobile and desktop  
**Default theme:** Dark, with a fully accessible light theme  

---

## 1. Product Vision

Pagewise is a durable personal reading database, journal, and statistics tool. It combines the useful library and progress features of Goodreads with the flexible lists and visual polish of Letterboxd, without social features.

The product should feel calm, editorial, private, and fast. Book covers and reading activity are the visual focus. The application is designed for years of personal use and must prioritize data correctness, backup, cross-device synchronization, accessibility, and maintainability.

### Product principles

1. **Private by default:** every account can access only its own records.
2. **One source of truth:** website and installed PWA use the same Supabase data.
3. **Data belongs to the user:** complete versioned JSON export and safe import are V1 features.
4. **Fast daily logging:** common reading actions require very few taps.
5. **History is never overwritten:** rereads, reviews, ratings, and completion dates remain attached to individual reading attempts.
6. **Graceful metadata:** Open Library helps populate records, but users can edit every field.
7. **No unnecessary social or AI features in V1.**

---

## 2. V1 Success Criteria

V1 is complete when an authenticated user can:

- Install Pagewise from a supported browser or follow clear iOS installation instructions.
- Use the same synchronized library on phone and desktop.
- Add, edit, search, filter, and delete books.
- Fetch book metadata from Open Library or enter it manually.
- Upload, paste, fetch, replace, or remove a cover image.
- Track reading status and current page/percentage.
- Log daily reading and see consistent progress updates.
- Finish books, rate/review individual reads, and start rereads without losing history.
- Create custom lists and see their completion progress.
- Save tags, quotes, notes, yearly goals, favorites, and reading dates.
- See accurate streaks, pace estimates, and statistics.
- Export all personal data and safely merge or replace it through import.
- Use the complete application in dark and light modes with keyboard and screen-reader support.

V1 does not promise full offline editing. The application shell can load offline, but authenticated library data and writes require a network connection. An offline mutation queue is a future enhancement.

---

## 3. Technical Architecture

### Client

- React with Vite and TypeScript
- React Router for navigation
- Tailwind CSS using semantic design tokens
- TanStack Query for Supabase server-state caching and invalidation
- React Hook Form plus Zod for form and import validation
- Recharts or an equivalently lightweight accessible chart library for rating distribution
- `vite-plugin-pwa` using Workbox for manifest and service-worker generation

Use strict TypeScript. Generate database types from the Supabase schema. Do not duplicate server records in a separate global state store.

### Backend

- Supabase PostgreSQL
- Supabase Auth with email magic links
- Supabase Storage for user-uploaded book covers
- PostgreSQL functions only where atomic server-side behavior is important, especially imports and complex ownership validation
- Row Level Security enabled and forced on every user-owned table

### External metadata

- Open Library Search API for title, author, year, ISBN, edition/work identifiers, page count, description when available, and cover ID
- Open Library cover service for fetched covers
- The user must select a search result before metadata is applied
- All fetched fields remain editable
- Metadata failures must never block manual book entry

### Hosting

- Vercel static frontend deployment
- Supabase remains the backend; no continuously running custom server
- SPA rewrites must route unknown application paths to `index.html`
- Separate local, preview, and production environment configuration

### Required environment variables

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

The Supabase service-role key must never be exposed to the browser or committed to the repository.

---

## 4. Authentication and Security

### Authentication flow

1. User enters an email address.
2. Supabase sends a magic link.
3. The callback exchanges the token and establishes a session.
4. The user returns to the originally requested route when possible.
5. Session refresh and sign-out are handled explicitly.

Configure local, Vercel preview, and production redirect URLs in Supabase.

### Authorization rules

- Every user-owned row includes `user_id uuid not null references auth.users(id) on delete cascade`.
- Every table has SELECT, INSERT, UPDATE, and DELETE policies based on `auth.uid() = user_id`.
- INSERT policies use `with check`; UPDATE policies use both `using` and `with check`.
- Client inserts derive `user_id` from the authenticated session, never from an arbitrary form value.
- Junction-table policies verify that both parent records belong to the same authenticated user.
- Storage objects use a path beginning with the user's UUID and matching storage RLS policies.

Although Pagewise has no sharing features, it supports more than one isolated account correctly. “Single-user” means each account is private, not that security can assume only one global database user.

---

## 5. Database Model

All timestamps are stored as `timestamptz`; calendar reading dates are stored as `date`. Add `created_at` and `updated_at` to mutable records. Maintain `updated_at` with a database trigger.

### `books`

```sql
id uuid primary key default gen_random_uuid()
user_id uuid not null references auth.users(id) on delete cascade
title text not null
author text
cover_image_url text
cover_source text check (cover_source in ('upload','url','open_library','placeholder'))
open_library_work_key text
open_library_edition_key text
genre text
total_pages integer check (total_pages is null or total_pages > 0)
publication_year integer check (publication_year is null or publication_year between 1000 and 2200)
description text
isbn text
status text not null default 'want_to_read'
  check (status in ('want_to_read','reading','completed','on_hold','dropped'))
is_favorite boolean not null default false
current_page integer not null default 0 check (current_page >= 0)
active_attempt_id uuid null
tags text[] not null default '{}'
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

`current_page` must not exceed `total_pages` when the total is known. Add the `active_attempt_id` foreign key after `reading_attempts` is created to avoid circular migration ordering.

Do not enforce unique title or ISBN: users may intentionally track multiple editions. Show duplicate warnings instead.

### `reading_attempts`

```sql
id uuid primary key default gen_random_uuid()
book_id uuid not null references books(id) on delete cascade
user_id uuid not null references auth.users(id) on delete cascade
attempt_number integer not null check (attempt_number > 0)
started_at date
completed_at date
rating_numeric numeric(2,1)
rating_tag text
review text
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
unique (book_id, attempt_number)
check (completed_at is null or started_at is null or completed_at >= started_at)
check (rating_numeric is null or rating_numeric in (0.5,1,1.5,2,2.5,3,3.5,4,4.5,5))
check (rating_tag is null or rating_tag in
  ('Masterpiece','Excellent','Very Good','Good','Average','Below Average','Bad','Very Bad'))
```

The descriptive system has **eight tiers**. Numeric and descriptive ratings are independent and both optional.

### `lists`

```sql
id uuid primary key default gen_random_uuid()
user_id uuid not null references auth.users(id) on delete cascade
title text not null
description text
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

### `list_books`

```sql
list_id uuid not null references lists(id) on delete cascade
book_id uuid not null references books(id) on delete cascade
user_id uuid not null references auth.users(id) on delete cascade
added_at timestamptz not null default now()
primary key (list_id, book_id)
```

Database validation must prevent linking a list and book owned by different users.

### `reading_logs`

```sql
id uuid primary key default gen_random_uuid()
book_id uuid not null references books(id) on delete cascade
attempt_id uuid references reading_attempts(id) on delete set null
user_id uuid not null references auth.users(id) on delete cascade
log_date date not null
start_page integer check (start_page is null or start_page >= 0)
end_page integer check (end_page is null or end_page >= 0)
pages_read integer not null check (pages_read >= 0)
note text
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
check (start_page is null or end_page is null or end_page >= start_page)
```

The application defines `pages_read = end_page - start_page`. Example: progressing from page 40 to page 55 means 15 pages read. If pages are logged without page positions, the user may enter `pages_read` directly.

### `quotes`

```sql
id uuid primary key default gen_random_uuid()
book_id uuid not null references books(id) on delete cascade
user_id uuid not null references auth.users(id) on delete cascade
page_number integer check (page_number is null or page_number >= 0)
quote_text text not null
note text
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

### `reading_goals`

```sql
id uuid primary key default gen_random_uuid()
user_id uuid not null references auth.users(id) on delete cascade
year integer not null check (year between 2000 and 2200)
target_books integer not null check (target_books > 0)
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
unique (user_id, year)
```

### `user_settings`

```sql
user_id uuid primary key references auth.users(id) on delete cascade
theme text not null default 'dark' check (theme in ('dark','light','system'))
timezone text not null default 'UTC'
streak_freeze_available boolean not null default true
streak_freeze_last_reset date
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Create settings automatically after the first authenticated session. Detect the browser timezone as the suggested value, and let the user change it.

### `streak_freezes`

```sql
id uuid primary key default gen_random_uuid()
user_id uuid not null references auth.users(id) on delete cascade
frozen_date date not null
created_at timestamptz not null default now()
unique (user_id, frozen_date)
```

This table makes freeze usage auditable and ensures longest-streak calculations remain reproducible.

### Required indexes

- Every foreign-key column
- `books (user_id, status)`
- `books (user_id, updated_at desc)`
- GIN index on `books.tags`
- `reading_attempts (user_id, completed_at)`
- `reading_logs (user_id, log_date)`
- `reading_logs (book_id, log_date)`
- `quotes (book_id, created_at)`
- `list_books (user_id, book_id)`

---

## 6. Core Domain Rules

### Status and attempt lifecycle

- Adding a book defaults to Want to Read with no active attempt.
- Starting a book creates the next numbered attempt, sets `started_at`, assigns `active_attempt_id`, and changes status to Currently Reading.
- On Hold retains current page and active attempt.
- Resuming returns the same active attempt to Currently Reading.
- Dropped retains page progress and history. The unfinished attempt remains identifiable but has no completion date.
- Finishing sets the active attempt's `completed_at`, changes status to Finished, and sets current page to total pages when known.
- Starting a reread creates a new attempt, resets current page to zero, and changes status to Currently Reading.
- Previous attempts, ratings, and reviews are never overwritten by a reread.
- Deleting a book deletes its attempts, logs, quotes, cover membership, and list memberships only after explicit confirmation.

### Progress synchronization

- If total pages are known, current page and percentage are two views of the same value.
- Percentage is derived, not stored: `current_page / total_pages * 100`.
- Editing percentage converts it to a page using a documented rounding rule, then stores the page.
- Saving a reading log with an ending page updates `books.current_page` when the ending page is ahead of current progress.
- Editing or deleting an older log never silently moves current progress backward.
- Direct progress edits do not fabricate a diary entry. Offer an explicit “also add to diary” option.
- Books without a known page total can still use status, dates, reviews, and manually entered pages read, but do not show percentage or an estimated finish date.

### Reading streak

- A reading day is a local calendar date with at least one reading log whose `pages_read > 0`.
- Date boundaries use `user_settings.timezone`.
- Current streak may end today or yesterday if today has no log yet.
- A freeze can protect one missed date at a time.
- A freeze auto-consumes only for the most recent single missed day between reading days; it cannot bridge two consecutive missed days.
- One freeze becomes available on the first local day of each month.
- Resetting in a new month does not retroactively repair a missed day from the previous month.
- Consuming a freeze creates a `streak_freezes` record and sets availability to false.
- The UI shows the frozen date and “Streak saved — freeze used.”
- Longest streak counts valid reading days plus recorded frozen dates.

Implement streak calculation as a pure, tested domain function or database view with fixed test cases for timezones, month boundaries, duplicate logs, and freeze use.

### Pace estimate

- Use positive pages from the currently active attempt over the trailing 14 calendar days.
- Require at least two logged reading days before showing an estimate.
- Average pace is total pages logged divided by elapsed active reading days in the sample, excluding future dates.
- Estimated days remaining is `ceil((total_pages - current_page) / average_pages_per_day)`.
- Label the result “Estimated finish” and show “Not enough recent activity” when it cannot be calculated reliably.

### Goals

- A completed book counts once for every completed reading attempt in the goal year, so rereads count as completed reads.
- Goal progress is based on `completed_at`, not book status.
- Show count, target, and percentage. Do not cap the displayed count at 100%.

### List completion

- Completion is based on current book status `completed`.
- Empty lists display `0 / 0` and 0%, not a division error.
- List ordering defaults to most recently updated; books within a list default to most recently added.

---

## 7. Navigation and Information Architecture

Use six primary destinations in this order:

1. **Home** — daily dashboard and quick actions
2. **Library** — complete book collection
3. **Lists** — custom collections
4. **Progress** — diary, active progress, and reading history
5. **Stats** — personal reading analytics
6. **Profile** — preferences, goals, backup, and account

Mobile uses a fixed bottom navigation bar with safe-area support. Desktop and tablet use a left sidebar. The main content has a readable maximum width while cover grids use available space.

### Global actions

- Global search is available from the app header and keyboard accessible.
- “Add Book” is prominent on Library and available globally.
- “Quick Log” is the primary daily action on Home.
- Back navigation preserves Library filters, sort, and scroll position.

---

## 8. Page Requirements

### Authentication

- Calm branded landing/sign-in screen
- Email magic-link form with loading, success, error, and resend states
- Clear explanation that the library is private and synchronized
- Callback handling and expired-link recovery

### Home

- Greeting or neutral page title; no social feed language
- Quick Log action
- Currently Reading cards with cover, page/percentage progress, last activity, and finish estimate
- Current streak, freeze availability, and yearly goal progress
- Recently finished books
- Recent reviews
- Helpful empty state for a new user

### Library

- Cover-forward responsive grid
- Search title, author, genre, ISBN, and tags
- Filters: Want to Read, Reading, Finished, On Hold, Dropped, Favorites, tags, genre
- Sort: recently updated, recently added, title, author, publication year, rating
- Visible active filters and one-click reset
- Skeleton, empty, error, and retry states
- Duplicate warning during add, without blocking intentional duplicates

### Add/Edit Book

- Search Open Library by title, author, or ISBN
- Display multiple results with cover, edition/year, author, and ISBN when available
- Apply selected metadata and allow full editing
- Cover choices: upload, URL, Open Library, or placeholder
- Validate URLs, image type/size, total pages, year, and ISBN length/format lightly
- Never discard typed form data after metadata or upload failure

### Book Detail

Top-to-bottom structure:

1. Cover, title, author, favorite action, and edit action
2. Genre, publication year, page total, ISBN, and status
3. Active progress and primary action appropriate to status
4. Active/latest attempt dates, numeric rating, descriptive tag, and review
5. List membership chips
6. Tags
7. Quotes and notes
8. Reading log preview
9. Full attempt/reread history
10. Destructive actions separated at the bottom

### Lists

- Cover collage or tasteful placeholders on list cards
- Title, description, `X / Y read`, and percentage
- Create, edit, delete, and manage membership
- Book status indicators must use icons/text as well as color
- Adding a book to multiple lists is allowed

### Progress

- Currently Reading summary cards
- Quick Log form: book, date, starting page, ending page or pages read, optional note
- Reverse-chronological diary timeline grouped by date
- Full reading-attempt history
- Edit/delete logs with confirmation where progress could become confusing

### Stats

Use clean cards and accessible charts, not raw tables:

- Completed reading attempts: all time, this year, and this month
- Pages logged: all time, this year, and this month
- Average numeric rating
- Current and longest streak
- Most-read author
- Most-read genre
- Average length of completed books with known page totals
- Numeric rating distribution in half-star buckets
- Descriptive rating-tag distribution if space permits

Every metric requires an empty state and an information tooltip describing its calculation.

### Profile

- Theme: dark, light, or system
- Timezone
- Yearly goals
- Export all data
- Import with Merge or Replace mode
- Install Pagewise section
- Account email and sign out
- Clear explanation and confirmation for destructive operations

---

## 9. Global Search

Search across:

- Book titles, authors, genres, ISBNs, and tags
- List titles and descriptions
- Review text
- Quote text and personal quote notes

For a personal-library scale, debounced client-side search is acceptable after the relevant authorized data has loaded. Organize results by type and highlight the matching field. Do not expose another user's data through search queries or cached results.

If performance becomes poor with large libraries, move search to an RLS-protected PostgreSQL full-text function without changing the UI contract.

---

## 10. Backup and Import

### Export format

Export a single UTF-8 JSON file:

```json
{
  "format": "pagewise-backup",
  "version": 1,
  "exportedAt": "2026-08-25T12:00:00Z",
  "appVersion": "1.0.0",
  "data": {
    "books": [],
    "readingAttempts": [],
    "lists": [],
    "listBooks": [],
    "readingLogs": [],
    "quotes": [],
    "readingGoals": [],
    "streakFreezes": [],
    "userSettings": {}
  }
}
```

Uploaded cover binaries are not embedded in V1. Preserve their URLs and clearly state this limitation. A future portable archive can include binary assets.

### Import modes

- **Merge:** preserve existing rows and add/update backup rows using stable IDs after ownership is rewritten to the current user.
- **Replace:** validate the complete backup, show a count summary, require explicit confirmation, then replace the current user's data.

Requirements:

- Validate format, version, fields, relationships, and record counts before changing data.
- Never trust `user_id` from the backup; assign the authenticated user.
- Perform the mutation atomically through an RLS-safe database function or transaction-capable backend operation.
- Restore parent rows before child rows.
- Show a final summary and actionable errors.
- Test round-trip export → replace import → equivalent dataset.

---

## 11. PWA and Installation

PWA support is a primary V1 capability, not a later wrapper. Pagewise remains a website and can also be installed as an app-like shortcut using the same URL and data.

### Manifest

Provide:

- Name: `Pagewise`
- Short name: `Pagewise`
- `display: standalone`
- Appropriate `start_url` and app scope
- Dark theme/background colors matching the launch experience
- Maskable and standard icons at required sizes, including 192×192 and 512×512
- Apple touch icon and relevant iOS metadata
- Shortcuts for Add Book and Quick Log where browser support exists

### Service worker

- Precache versioned app-shell and static build assets.
- Use cache-first for fonts, icons, and immutable local assets.
- Use stale-while-revalidate for non-sensitive Open Library cover images with limits and expiration.
- Do not persistently service-worker-cache authenticated Supabase API responses in V1.
- Provide a controlled “Update available” prompt; activate the new version after user confirmation or at a safe reload.
- Provide a friendly offline screen explaining that live library data and updates require connectivity.

### Installation UX

- On Chromium browsers, capture `beforeinstallprompt` and show an in-app Install Pagewise button only when eligible.
- Do not repeatedly interrupt users with automatic prompts.
- On iPhone/iPad Safari, show concise instructions: Share → Add to Home Screen.
- On unsupported browsers, explain available bookmark/shortcut options without claiming native installation.
- Detect standalone mode and hide installation calls to action once installed.
- Test browser tab and installed standalone behavior independently.

### PWA acceptance matrix

- Chrome Android: eligible install, standalone launch, correct icon, authenticated sync
- Chrome/Edge desktop: install button, standalone window, update flow
- Safari iOS/iPadOS: manual Add to Home Screen guidance, safe-area layout, standalone launch
- Safari macOS: supported installation/bookmark behavior documented
- Offline: app shell/friendly offline state loads; no false claim that writes succeeded
- Reconnection: live queries and invalidated data refresh normally

---

## 12. Design System

### Direction

Minimal, modern, editorial, book-cover-forward, and calm. The interface should feel like a crafted private library, not an admin dashboard or social feed.

### Colors

Use semantic CSS variables and the approved palette.

#### Dark theme

| Token | Value | Role |
|---|---:|---|
| `bg` | `#14161A` | App canvas |
| `surface` | `#1E2126` | Cards and panels |
| `surface-hover` | `#262A31` | Interactive hover |
| `border` | `#2C3038` | Restrained dividers |
| `text-primary` | `#EDEDED` | Primary text |
| `text-secondary` | `#9B9FA6` | Supporting text |
| `text-muted` | `#6B6F76` | Nonessential metadata; verify contrast by context |
| `accent` | `#E0995E` | Active state and progress |
| `accent-hover` | `#EDA96F` | Accent hover |
| `success` | `#6FAE8C` | Completed state |
| `danger` | `#C97066` | Destructive/dropped state |

#### Light theme

| Token | Value | Role |
|---|---:|---|
| `bg` | `#FAF8F5` | App canvas |
| `surface` | `#FFFFFF` | Cards and panels |
| `surface-hover` | `#F3F0EB` | Interactive hover |
| `border` | `#E4E0D9` | Dividers |
| `text-primary` | `#1A1A1A` | Primary text |
| `text-secondary` | `#6B6E76` | Supporting text |
| `text-muted` | `#73767D` | Muted text with improved readability |
| `accent` | `#C1703B` | Active state and progress |
| `accent-hover` | `#A85E2E` | Accent hover |
| `success` | `#4F8F6B` | Completed state |
| `danger` | `#B85248` | Destructive/dropped state |

The original visual character is preserved. The light muted text is slightly strengthened for accessibility. Validate actual foreground/background combinations with WCAG tooling; never rely on token names alone.

### Typography

- Fraunces for display headings and book titles
- Inter for controls, body, navigation, and metadata
- JetBrains Mono with tabular figures for statistical values
- Use locally bundled or carefully cached font files to avoid a blank or shifting installed-app experience

### Shape, spacing, and motion

- Use an 8-point spacing system with 4-point subdivisions where necessary.
- Cards should use moderate radii; avoid excessive pill-shaped containers.
- Covers retain their natural book/poster emphasis with a consistent aspect-ratio frame.
- Dark mode uses surface contrast for depth; light mode may use restrained shadows.
- Motion should be brief and functional, approximately 150–250 ms.
- Respect `prefers-reduced-motion`.

### Accessibility

- Meet WCAG 2.2 AA for core flows.
- All interactive elements are keyboard reachable with a visible focus style.
- Touch targets are at least 44×44 CSS pixels where practical.
- Star rating exposes a labeled radio-style input, not clickable icons alone.
- Status never relies only on color.
- Modals trap focus, close safely, and restore focus to their trigger.
- Charts include textual summaries.
- Cover images use useful alt text; decorative placeholders use empty alt text.
- Mobile navigation accounts for device safe-area insets.

---

## 13. Reliability, Performance, and Error Handling

- Use optimistic updates only when rollback is clear and safe.
- Show explicit pending, success, failure, and retry states for mutations.
- Prevent double submission.
- Paginate or incrementally load large cover grids.
- Lazy-load covers and provide stable placeholders to avoid layout shift.
- Compress uploaded covers and enforce a documented maximum size.
- Cancel or ignore stale Open Library searches.
- Debounce search inputs.
- Log application errors without storing private review, quote, or reading-note content in third-party telemetry.
- Never report a save as successful until Supabase confirms it.

---

## 14. Testing and Acceptance

### Unit tests

- Progress/page conversion and rounding
- Attempt numbering and state transitions
- Streaks, freezes, month boundaries, and timezones
- Pace estimates and insufficient-data behavior
- Goal and list percentages
- Stats calculations
- Backup schema validation and relationship ordering

### Integration tests

- Auth callback and session restoration
- RLS isolation between two test users
- Book → attempt → log → completion → reread lifecycle
- Cover upload authorization
- List ownership validation
- Merge and Replace import transaction behavior
- Export/import round trip

### End-to-end tests

- Magic-link development/test flow
- Add a manual book and an Open Library book
- Start, log, hold/resume, finish, rate, review, and reread
- Create a list and verify completion
- Add/edit/delete a quote
- Set a yearly goal and verify Home/Stats
- Switch theme and persist preference
- Installability audit and standalone layout

### Quality gates

- No high-severity accessibility failures in primary flows
- No RLS table or Storage bucket accessible across accounts
- No service-worker caching of authenticated Supabase payloads
- Responsive checks at representative phone, tablet, laptop, and wide-desktop sizes
- Lighthouse PWA checks where supported, interpreted alongside manual browser testing

---

## 15. Implementation Plan

### Phase 0 — Decisions and foundation

- Confirm this specification as the implementation contract.
- Create repository conventions, environment examples, linting, formatting, and tests.
- Create Supabase projects/environments and migrations.

### Phase 1 — Secure platform shell

- Schema, constraints, indexes, triggers, RLS, and Storage policies
- Magic-link authentication and callbacks
- Responsive route shell and navigation
- Semantic theme tokens, typography, dark theme, and base components
- Error boundaries, notifications, loading, and empty-state patterns

**Exit condition:** two test users are fully isolated and can authenticate on phone and desktop.

### Phase 2 — Library foundation

- Book CRUD
- Cover upload/URL/placeholder support
- Open Library search and metadata selection
- Library grid, filters, sorting, search, and preserved navigation state
- Book detail foundation

**Exit condition:** a user can build and manage a synchronized library reliably.

### Phase 3 — Reading lifecycle

- Reading attempts and exact status transitions
- Page/percentage progress
- Ratings, descriptive tags, and reviews
- Reread lifecycle and history
- Quick Log and diary

**Exit condition:** the full first-read and reread journeys work without overwriting history.

### Phase 4 — Organization and personal records

- Custom lists and completion
- Tags and Library tag filters
- Quotes and notes
- Cross-entity global search

**Exit condition:** all organization and recall features work across a realistic library.

### Phase 5 — Insights

- Timezone-aware streak calculation and freeze records
- Pace estimate
- Yearly goals
- Home dashboard assembly
- Stats calculations and accessible chart
- Progress timeline and history

**Exit condition:** calculated values match fixtures and edge-case tests.

### Phase 6 — Ownership and resilience

- Versioned export
- Validated Merge and Replace imports
- Round-trip and transaction failure tests
- User-facing backup guidance

**Exit condition:** exported data can recreate an equivalent library without partial imports.

### Phase 7 — PWA and light theme

- Manifest, icons, app shortcuts, and service worker
- Install UI and iOS instructions
- Offline shell and safe update flow
- Complete light-theme refinement
- Accessibility and responsive pass

**Exit condition:** the PWA acceptance matrix passes on available target devices/browsers.

### Phase 8 — Production release

- Vercel configuration and Supabase production redirect URLs
- Production environment and database migration
- Security/RLS audit
- Performance and accessibility checks
- Smoke test web and installed PWA
- Document deployment, backup, and recovery procedures

---

## 16. V1 Scope Lock

Build all primary capabilities defined in this plan. Do not add social features, AI calls, notifications, native wrappers, or full offline mutation support during V1.

Small implementation necessities—validation, accessible states, database constraints, safe confirmations, error handling, and installation guidance—are part of V1 quality, not scope expansion.

---

## 17. Future Roadmap

Scaffold the model only where the V1 schema already naturally supports future work. Do not build future UI or dormant complexity merely to claim readiness.

Recommended order after V1:

1. Pick My Next Book
2. ISBN/barcode scanner
3. Calendar heatmap
4. Series and edition tracking
5. Year in Books recap and monthly wrap-up
6. Portable archive including uploaded cover files
7. Offline reading-log mutation queue
8. Achievements, challenges, reminders, and widgets
9. Author pages and richer metadata
10. Optional recommendations only after sufficient personal history exists

Other possible future fields: mood tags, “would recommend to,” series position, format, ownership, lending, and reading location. None are V1 requirements.

---

## 18. Final Product Definition

Pagewise V1 is a polished private reading application available at one web URL and installable as a PWA. Installation does not create a separate dataset or separate application build: web and standalone modes authenticate against the same Supabase account and remain synchronized across devices.

The launch standard is not merely that features exist. Reading history must remain correct, private records must be isolated by RLS, backups must restore safely, daily logging must feel effortless, and the installed experience must look intentional on both mobile and desktop.
