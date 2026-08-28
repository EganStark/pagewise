# Pagewise — Full Build Master Spec

**App name:** Pagewise
**Purpose:** A personal, single-user book tracking web app — installable as a PWA on mobile and desktop — combining a Goodreads-style library/progress tracker with Letterboxd-style custom lists. No social features (no followers, likes, comments, or public profiles). This is a personal reading database, journal, and stats tool, built to last for years.

This document is the complete build spec. Build exactly what is described here. Do not invent additional features beyond what's listed in "V1 Scope" without flagging it first. Everything under "V2 / Future" should be scaffolded for but NOT built now.

---

## 1. Tech Stack

- **Frontend:** React (Vite), Tailwind CSS
- **Backend/Database:** Supabase (PostgreSQL + Auth). Sync across devices is a hard requirement — this app will be used from both a phone and a desktop and must show the same data on both.
- **Auth:** Supabase Auth, email magic-link (passwordless). Single user account, no multi-user/sharing features.
- **Metadata API:** Open Library Search API (free, no key required) — used to auto-fill cover image, author, page count, and publication year when adding a book, with manual override always available. (Use `https://openlibrary.org/search.json?q={query}` for search, and cover images via `https://covers.openlibrary.org/b/id/{cover_id}-L.jpg`.)
- **PWA:** `manifest.json` + a service worker (cache-first for the app shell/static assets, network-first for Supabase data calls). Must trigger the native "Add to Home Screen" / "Install App" prompt on Chrome and Edge (mobile + desktop), and support the manual "Add to Home Screen" flow on Safari/iOS.
- **Hosting/Deploy:** Vercel. Single deployed URL; no server process to keep running — static frontend + Supabase backend only.
- **AI features:** NOT included in v1. Do not add any AI/LLM integration now.

---

## 2. Database Schema (Supabase / PostgreSQL)

All tables include `user_id` (references `auth.users`) and rely on Supabase Row Level Security (RLS) so each user only ever sees their own data, even though this is a single-user app — build it correctly from the start.

```sql
-- Core book record (static info + current status/progress)
books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null,
  author text,
  cover_image_url text,
  genre text,
  total_pages int,
  publication_year int,
  description text,
  isbn text,
  status text check (status in ('want_to_read','reading','completed','on_hold','dropped')) default 'want_to_read',
  is_favorite boolean default false,
  current_page int default 0,
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- One row per read-through of a book — enables full reread history
reading_attempts (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references books(id) on delete cascade,
  user_id uuid references auth.users not null,
  attempt_number int not null,          -- 1 = first read, 2 = reread, etc.
  started_at date,
  completed_at date,
  rating_numeric numeric(2,1),          -- 0.5–5.0, half-star increments
  rating_tag text,                      -- see rating tag list in section 4
  review text,
  created_at timestamptz default now()
);

-- Custom lists (Letterboxd-style)
lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null,
  description text,
  created_at timestamptz default now()
);

-- Junction table: a book can belong to multiple lists
list_books (
  list_id uuid references lists(id) on delete cascade,
  book_id uuid references books(id) on delete cascade,
  added_at timestamptz default now(),
  primary key (list_id, book_id)
);

-- Reading diary entries — powers streaks, stats, and pace estimation
reading_logs (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references books(id) on delete cascade,
  user_id uuid references auth.users not null,
  log_date date not null,
  start_page int,
  end_page int,
  pages_read int,
  note text,
  created_at timestamptz default now()
);

-- Saved quotes/highlights per book
quotes (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references books(id) on delete cascade,
  user_id uuid references auth.users not null,
  page_number int,
  quote_text text not null,
  note text,
  created_at timestamptz default now()
);

-- Yearly reading goals
reading_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  year int not null,
  target_books int not null,
  unique(user_id, year)
);

-- User-level settings (streak freeze usage, theme preference, etc.)
user_settings (
  user_id uuid references auth.users primary key,
  theme text default 'dark',            -- 'dark' | 'light'
  streak_freeze_available boolean default true,  -- resets monthly, see section 5
  streak_freeze_last_reset date
);
```

Enable RLS on every table; policies restrict all reads/writes to `auth.uid() = user_id`.

---

## 3. Navigation Structure

Six main sections, in this order, accessible via a bottom nav bar on mobile and a sidebar on desktop:

1. **Home** — currently reading, progress bars, current streak, yearly goal progress, recently finished books, recent reviews
2. **Library** — all books, filterable by status (Want to Read / Reading / Finished / On Hold / Dropped / Favorites), searchable, sortable
3. **Lists** — all custom lists with completion percentage per list; create/edit/delete lists here
4. **Progress** — reading diary/log entries, current books' page progress, full reading history timeline
5. **Stats** — statistics dashboard (see section 7)
6. **Profile** — theme toggle, reading goals, export/import data, account settings

---

## 4. Core Feature Behaviors

### Manual book entry
Fields: title, author, cover image (upload, paste URL, or auto-fetch via Open Library, or default placeholder), genre, total pages, publication year, description/notes, ISBN. Open Library lookup triggers on title/ISBN search and pre-fills fields, all fields remain editable after.

### Reading status
One of: Want to Read, Currently Reading, Finished, On Hold, Dropped. Plus an independent `is_favorite` boolean toggle (a book can be Finished AND Favorite simultaneously).

### Custom lists
- A list has a title, description, and a set of books (via `list_books`)
- A book can belong to any number of lists
- Each list displays: `X / Y books read` and a completion percentage, computed as `(books in list with status = 'completed') / (total books in list) × 100`
- Each book within a list view shows a small status indicator: ✅ Read / 📖 Reading / ○ Not Read

### Reading progress
- Track via current page OR percentage — updating one recalculates the other using `current_page / total_pages × 100`
- Shown on the book detail page and the Home page for all "Currently Reading" books

### Reviews
- Attached to a specific `reading_attempt`, not to the book directly (so rereads keep separate reviews)
- Short-form text, always visible on the book detail page under that read's entry

### Rating system
- 5-star scale with half-star increments (0.5–5.0), shown as a star input (e.g. ⭐⭐⭐⭐½)
- Plus a text rating tag, chosen from this 7-tier list (do not collapse this list):
  `Masterpiece / Excellent / Very Good / Good / Average / Below Average / Bad / Very Bad`
- Both are stored per `reading_attempt`

### Reading streak
- A "reading day" = at least one `reading_logs` entry with that `log_date`
- Current streak = consecutive reading days ending today (or yesterday, if today has no entry yet)
- Longest streak = longest historical consecutive run
- **Streak freeze:** each user gets one "grace day" available at a time (tracked in `user_settings.streak_freeze_available`). If a day is missed, the freeze auto-consumes to preserve the streak instead of resetting it. Freeze availability resets on the 1st of each month (`streak_freeze_last_reset`). Show the user when a freeze is used ("Streak saved — freeze used") and how many they have.

### Reading diary / reading logs
- Each entry: book, date, start page, end page (pages_read auto-calculated), optional note
- Feeds streak calculation, pace estimation, and the Progress page timeline

### Pace estimator (estimated finish date)
- Calculate average pages/day from recent `reading_logs` for the currently-reading book (e.g. trailing 7–14 days)
- Estimated finish date = `(total_pages - current_page) / avg_pages_per_day` days from today
- Shown on the Home page currently-reading card, clearly labeled as an estimate

### Reading goals
- Yearly target book count, set on Profile
- Home page shows `X / Y books, Z% complete` for the current year, based on count of `reading_attempts` with `completed_at` in that year

### Rereads
- A book can have multiple `reading_attempts`. The book detail page shows each attempt as its own history entry ("First Read — 2024, ⭐4/5", "Second Read — 2026, ⭐4.5/5") with its own dates, rating, and review

### Tags
- Free-form tags stored as a text array on `books` (e.g. `dark-academia`, `slow-burn`, `space-opera`)
- Filterable in Library and searchable globally

### Quotes & notes
- Saved per book with optional page number, quote text, and a personal note underneath
- Shown in a dedicated section on the book detail page

### Global search
- Single search bar searches across: book titles, authors, list titles, genres, tags, and review text
- Debounced client-side search is sufficient given expected personal-library data volume

### Export / Import
- Export: single JSON file containing all of the user's data (books, reading_attempts, lists, list_books, reading_logs, quotes, reading_goals)
- Import: re-hydrate from that JSON file — this is the user's backup/migration path, treat it as a first-class v1 feature, not an afterthought

---

## 5. Statistics Page

Show as clean stat cards (not tables):
- Total books read
- Total pages read
- Books read this year / this month
- Average rating
- Current streak / longest streak
- Most-read author
- Most-read genre
- Average book length (pages)
- Rating distribution (simple bar chart, count per rating tier)

---

## 6. Book Detail Page Layout

Top to bottom: cover + title + author, genre + page count, current rating (numeric + tag) for the latest/active reading attempt, status badge, started/finished dates, review text, list memberships (chips linking back to each list), tags, saved quotes section, and — if more than one `reading_attempts` row exists — a reread history section showing each past attempt.

---

## 7. Theme & Visual Design System

**Overall direction:** Minimal, modern, editorial, book-cover-forward. Not a social feed — closer to a well-designed personal library catalog. Generous whitespace, restrained color, one accent color used consistently and sparingly (progress bars, stars, active nav state, streak flame icon).

**Dark mode is the primary/default theme.** Build and polish dark mode first; light mode is a secondary toggle derived from the same design system, not designed independently.

### Color palette

**Dark mode (default)**
| Token | Hex | Use |
|---|---|---|
| `bg` | `#14161A` | App background (near-black charcoal, not pure black) |
| `surface` | `#1E2126` | Cards, panels — one step lighter than bg |
| `surface-hover` | `#262A31` | Hover/active state on cards |
| `border` | `#2C3038` | Subtle dividers only, used sparingly |
| `text-primary` | `#EDEDED` | Titles, primary reading text (warm off-white, never pure white) |
| `text-secondary` | `#9B9FA6` | Metadata, labels |
| `text-muted` | `#6B6F76` | Timestamps, placeholder text |
| `accent` | `#E0995E` | Stars, progress bars, active nav, streak flame |
| `accent-hover` | `#EDA96F` | Hover state on accent elements |
| `success` | `#6FAE8C` | Completed/read indicators |
| `danger` | `#C97066` | Dropped status, destructive actions |

**Light mode**
| Token | Hex | Use |
|---|---|---|
| `bg` | `#FAF8F5` | App background (warm cream, not pure white) |
| `surface` | `#FFFFFF` | Cards, panels — pure white lifts off the cream bg |
| `surface-hover` | `#F3F0EB` | Hover/active state on cards |
| `border` | `#E4E0D9` | Subtle dividers |
| `text-primary` | `#1A1A1A` | Titles, primary text — near-black, full contrast |
| `text-secondary` | `#6B6E76` | Metadata, labels — deliberately darker than dark-mode's equivalent gray to preserve readability on light backgrounds |
| `text-muted` | `#8B8E94` | Timestamps, placeholder text |
| `accent` | `#C1703B` | Same hue family as dark mode, darkened for contrast on light bg |
| `accent-hover` | `#A85E2E` | Hover state |
| `success` | `#4F8F6B` | Completed/read indicators |
| `danger` | `#B85248` | Dropped status, destructive actions |

**Critical rule:** never reuse a color token's exact hex across modes and never let `text-secondary`/`text-muted` fall below a 4.5:1 contrast ratio against that mode's `bg`. Test both modes independently — do not assume a value that works in dark mode will read correctly in light mode.

### Typography
- **Headers & book titles:** Fraunces (serif) — gives the app a literary, editorial feel and is the single biggest visual differentiator from generic app UI
- **UI chrome, body text, metadata:** Inter (sans-serif) — clean and highly legible at small sizes
- **Numbers in Stats page (page counts, percentages, streak counts):** JetBrains Mono — gives stats a precise, tabular feel distinct from prose

### Layout
- Library and Lists use cover-forward grids (poster-style), covers as the primary visual anchor
- Card-based throughout, including Stats — no raw data tables
- Dark mode: minimal borders/shadows, rely on the surface-color step-up for depth
- Light mode: soft shadows on cards, since light mode needs an explicit depth cue that dark mode gets for free from contrast
- Mobile-first responsive layout; bottom nav bar on mobile, left sidebar on desktop/tablet

---

## 8. V1 Scope (build all of this now)

Manual book entry with Open Library auto-fill · reading statuses · favorites · custom lists with completion % · list_books junction · page/percent progress tracking · reviews per reading attempt · 5-star + half-star rating with 7-tier text label · reading streak with monthly streak-freeze · reading diary/logs · pace estimator (estimated finish date) · yearly reading goals · full stats page · book detail page with reread history · tags · quotes & notes · global search · JSON export/import · dark mode (default) + light mode toggle, following the palette above exactly · full PWA installability (manifest + service worker) · Supabase Auth (magic link) + synced storage across devices · Vercel deployment.

## 9. V2 / Future (do NOT build now — scaffold data model to allow it later, nothing more)

ISBN/barcode scanner · reading calendar heatmap (GitHub-style) · achievements/badges · monthly challenges · yearly "Year in Books" recap · author page · series tracking · AI-powered "recommended next book" (via a serverless function calling the Claude API — do not build the function or any AI call in v1) · "Pick My Next Book" random picker from Want to Read/a chosen list (this one is cheap — flag as easy to pull into v1 later if time allows, but not required now) · notifications/reminders · home-screen widgets · monthly wrap-up card · mood tags on reviews · "would recommend to" field.

---

## 10. Build Order

1. Supabase project setup: schema (section 2), RLS policies, magic-link auth
2. App shell: routing, nav (section 3), theme system (section 7) with dark mode built first
3. Book CRUD + Open Library integration
4. Library page (filters, search, grid)
5. Book detail page + reading attempts (rating, review, rereads)
6. Lists + list_books + completion %
7. Reading logs (diary) + streak engine + streak freeze logic
8. Progress page (pace estimator, timeline)
9. Reading goals + Home page assembly
10. Stats page
11. Quotes/notes
12. Global search
13. Export/import
14. PWA manifest + service worker + install flow testing (Chrome/Edge/Safari)
15. Light mode pass (verify contrast against section 7 rules)
16. Deploy to Vercel
