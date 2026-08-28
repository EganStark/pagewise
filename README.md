# Pagewise

Pagewise is a private, installable reading tracker for managing a personal library, page progress, reading sessions, completed-read Diary, rereads, reviews, custom lists, quotes, goals, backups, and reading statistics.

## Requirements

- Node.js 22.13 or newer
- A Supabase project for authentication, synchronized data, and uploaded covers
- Google Books API key only if Google Books enrichment is desired
- OpenAI API key only if the optional AI metadata review is desired

## Local setup

1. Run `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Optionally add `GOOGLE_BOOKS_API_KEY`, `OPENAI_API_KEY`, and `OPENAI_METADATA_MODEL`.
5. Apply every SQL file in `supabase/migrations/` in numeric order.
6. Run `npm run dev` and open the printed local URL.

Without Supabase credentials, Pagewise opens in clearly labeled preview mode with temporary sample data.

## Commands

- `npm run dev` — local development server
- `npm run typecheck` — TypeScript validation
- `npm run lint` — code-quality checks
- `npm run test:unit` — domain tests for progress, streaks, statistics, import parsing, backup validation, and PWA configuration
- `npm test` — unit tests, production build, and rendered worker checks
- `npm run build` — production build
- `npm run release:check` — complete local release-readiness gate
- `npm run release:check:production` — release gate that also requires Supabase production environment values

## Metadata providers

Metadata search runs server-side and merges Open Library, optional Google Books, Wikidata, and Internet Archive. Results are scored and deduplicated before the user applies them. Provider failures are isolated, public searches are rate-limited, and successful responses use a short shared cache.

Add Book and Edit Book also offer an optional, manual AI review. It uses the provider results as grounding, returns structured suggestions, and applies nothing until the signed-in user chooses an individual field or Apply all. The OpenAI key remains server-side.

## PWA behavior

The manifest includes standard and maskable icons plus Add Book and Quick Log shortcuts. The service worker caches only the public app shell and safe static assets, keeps a bounded Open Library cover cache, bypasses Supabase requests, and uses a dedicated offline screen. Writes are never presented as saved while offline.

## Production checklist

- Configure Supabase Site URL and magic-link redirect URLs for local, preview, and production origins.
- Verify sign-in and row-level isolation using two separate accounts.
- Verify cover upload, replacement, and removal against the `book-covers` bucket.
- Verify reading lifecycle and backup-restore RPCs after applying migrations.
- Test Merge and Replace restore with a fresh backup.
- Test install/update/offline behavior on Chrome or Edge, Android, and Safari on iPhone or iPad.
- Run `npm audit`; investigate production-impacting findings before release. Some build-only transitive advisories can require upstream vinext or Drizzle upgrades and should not be force-upgraded without a successful compatibility build.

## Data and recovery

Supabase is the source of truth. Profile → Backup exports a versioned JSON document containing private Pagewise and LitShelves records. Backups created before LitShelves remain supported. Uploaded cover binaries are not embedded; their URLs and storage paths are preserved. LitShelves also provides a UTF-8 CSV catalogue export for spreadsheet use. Keep periodic backups outside the application and test restore before relying on them.

## Project references

- `pagewise-master-spec.md` — original product specification
- `pagewise-master-plan-v2.md` — implementation architecture and sequence
- `IMPLEMENTATION_STATUS.md` — completed packets and live-service acceptance work
- `SECURITY.md` — security boundary, reporting, and release checks
- `RELEASE_CHECKLIST.md` — automated, Supabase, device, and release acceptance steps
