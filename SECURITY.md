# Pagewise Security Notes

## Private-data boundary

Supabase authentication and row-level security are the production data boundary. Every user-owned table and Storage mutation must remain scoped to `auth.uid()`. Never place the Supabase service-role key or any provider secret in a `NEXT_PUBLIC_` variable.

## Reporting a problem

Do not include real backup files, access tokens, magic links, private reviews, or database records in a public report. Record the affected screen, expected behavior, reproduction steps using sample data, and the Pagewise version.

## Release checks

- Run `npm audit --omit=dev`; production dependencies must report zero known vulnerabilities.
- Review full `npm audit` output separately. Build-only transitive findings may depend on upstream vinext or Drizzle releases and must not be force-upgraded without the full build/test suite.
- Apply migrations in order and perform a two-account RLS isolation test.
- Verify authenticated-only execution of lifecycle and restore RPCs.
- Confirm uploaded covers remain owner-scoped and reject unsupported or oversized files.
- Confirm metadata throttling and upstream timeouts under repeated requests.
- Keep `.env*`, credentials, logs, backups, and local Cloudflare state out of source control.

## Backup safety

Imports are size- and record-limited, validate parent relationships before restore, reassign records to the authenticated user, and reject cross-account identifier collisions. Replace restore is destructive and must retain its typed confirmation.
