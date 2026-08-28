# Pagewise Release Checklist

## Automated gate

Run `npm run release:check`. It verifies TypeScript, lint, domain tests, the production build, rendered routes, production dependency security, PWA assets, service-worker privacy rules, and migration ordering.

After production environment values are present, run `npm run release:check:production`. This additionally requires a valid HTTPS Supabase URL and a non-empty public anonymous key.

AI metadata review is optional. To enable it, configure `OPENAI_API_KEY` and `OPENAI_METADATA_MODEL` as server-side values. Confirm that an unsigned request is rejected, malformed input fails without contacting OpenAI, and the key never appears in browser-delivered code or logs.

## Supabase acceptance

- Apply every migration from `supabase/migrations/0001` through `0007` in order.
- Configure local, preview, and production magic-link redirect URLs.
- Sign in with two test accounts and prove neither can read or mutate the other account’s records.
- Exercise Start, Hold, Resume, Finish, and Reread lifecycle functions.
- Upload, replace, and remove a cover in the owner-scoped bucket.
- Export a backup, test Merge, then test Replace using disposable data.
- Confirm restored LitShelves records retain lending, location, value, cover references, and Pagewise links.
- Export LitShelves CSV and verify Bengali text and quoted titles in a spreadsheet.

## Device acceptance

- Chrome or Edge desktop: install, launch standalone, Add Book shortcut, Quick Log shortcut, update prompt.
- Android Chrome: install, safe-area layout, offline fallback, reconnect banner.
- iPhone or iPad Safari: Add to Home Screen instructions, standalone launch, theme/status bar.
- Confirm offline mode never claims that a write was saved.

## Optional AI acceptance

- Sign in, open Add Book, enter a Bengali title, and review an AI suggestion without applying it.
- Apply one suggested field, then verify the other fields stay unchanged.
- Repeat from Edit Book and from an uncertain Smart Import row.
- Confirm the normal provider search and manual entry still work after removing the OpenAI key.
- Review OpenAI usage limits and billing before enabling the feature for regular use.

## Release decision

- Confirm `npm audit --omit=dev` reports zero vulnerabilities.
- Review build-only audit findings without using a forced breaking upgrade.
- Create and securely store a fresh Pagewise JSON backup.
- Record the release date, app version, migration version, and rollback destination.
