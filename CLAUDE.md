@AGENTS.md

# Home Library

Android-first Expo app (SDK 57, Expo Router, TypeScript) for cataloguing physical books across several **libraries**
(home, office, a friend's home), backed by a self-hosted **NestJS API** (`server/`) on the home server via Coolify:
Postgres 17 + Prisma 7, Better Auth, Garage (S3) for covers, home Ollama for AI. Supabase was the first backend and was
removed before ever being deployed (2026-10-06). Sibling of `~/projects/financy` (same Expo conventions).

## Repo layout
- `src/`: the Expo app. `shared/`: framework-free code used by both sides: `isbn.ts`, `metadata.ts` (Open Library +
  Google Books), `ai.ts` (prompts, parsers, OpenAI-compatible client), `permissions.ts`, and **zod contracts**
  (`shared/contracts/*.ts`) for every request/response. App imports `~shared/*`; server imports `../../../shared/*`.
  Relative imports inside `shared/` use `.ts` extensions (app: `allowImportingTsExtensions`; server: `rewriteRelativeImportExtensions`).
- `server/`: NestJS 11 + Express (Better Auth's Nest integration is Express-first), Prisma `~7.10` (npm latest is the
  Prisma 8 RC; don't upgrade blindly), nestjs-zod 5.5 (blocks Nest 12). `module: node20` so the CommonJS output can require the
  ESM-only better-auth packages.

## Domain
- **Library** = tenant. Membership is `owner` (every permission; only role that can rename/delete the library or change owners)
  or `member` with a **granular permission set** (`library_permission` enum ↔ `shared/permissions.ts`; UI labels/presets in
  `src/constants/Permissions.ts`): `books.add`, `books.edit`, `books.move`, `loans.manage`, `books.archive`,
  `books.delete`, `shelves.manage`, `audits.run`, `members.manage`, `ai.manage`. Everyone can read/search/see stats.
  A `members.manage` holder can only grant/revoke permissions they hold and never touches owners.
- Joining: invite codes (create → share → accept) carrying a permission set. Everyone (kids too) has their own account.
- **Bookcases (racks) → shelves**. A **book row = one physical copy**; `shelf_id` is its home shelf: kept while lent out or
  missing, cleared when given away (DB check constraint).
- Status machine: `on_shelf` ⇄ `borrowed` (lend/return), `on_shelf` → `missing` (finishing a book check) → `on_shelf`
  (seen again / "I found it"), any → `archived` (given away/lost/discarded) → `on_shelf` (bring back). Every change writes `book_events`.
- Book checks: `random` (N books weighted to longest-unseen; the app plays it as a one-book-at-a-time game) or `shelf`
  (scan every barcode; books from other shelves recorded as `unexpected`). Finishing marks unchecked items missing.

## API (server/)
- Routes under `/api`; every library route is `/api/libraries/:libraryId/...`. Swagger at `/docs`, `/health` public.
- **AccessGuard** (the single global guard, in a fixed order): Better Auth session → `@AllowAnonymous`/`@OptionalAuth` →
  401 → **unverified users are read-only** (403 `email_unverified`; `@AllowUnverified` exempts e.g. lookup) →
  `@RequireLibrary(permission?)`: no membership = **404** (other libraries are invisible), missing permission = 403
  `{ code: 'forbidden', permission }`. Secondary checks inside services use `requirePermission()` (e.g. returning a book
  to another shelf also needs `books.move`; enrich/presign need `books.add` or `books.edit`).
- State changes run in `prisma.$transaction` with `SELECT … FOR UPDATE` (`books/BookLocks.ts`). DB constraints are the
  backstop; `ErrorFilter` maps P2002 → 409 `duplicate`, FK violations (P2003, or P2039/SQLSTATE 23001 for RESTRICT) → 409 `in_use`.
  Error shape everywhere: `{ statusCode, code, message, ...extra }`.
- The Prisma schema mirrors the old SQL (snake_case via @map). Composite FKs `(x_id, library_id)` keep rows inside their
  tenant; CHECKs + `pg_trgm` are hand-written in the init migration. No stored tsvector: search builds it on the fly.
  Nested `createMany` can't fill composite FKs, so audit items are inserted separately.
- **Auth = Better Auth 1.7** (`server/src/auth/CreateAuth.ts`):
  - Methods: email+password, email OTP (verification on sign-up, passwordless sign-in, password reset; typed 6-digit
    codes sent through Resend) and Google ID-token sign-in (web client first in `GOOGLE_CLIENT_IDS`).
  - Google auto-links only to *verified* accounts (Better Auth's `requireLocalEmailVerified` default); the app explains the
    `OAUTH_LINK_ERROR` case.
  - 90-day sliding sessions; database-backed rate limits.
  - Delete-user is blocked for the last owner of a shared library; solo libraries are deleted; loans keep the borrower's name.
  - Gotcha: sending the OTP on sign-up needs `emailVerification.sendOnSignUp` when `overrideDefaultEmailVerification` is set.
  - Passkeys are phase 2; the table already exists.
- AI: per-library OpenAI/Gemini/self-hosted keys sealed with AES-256-GCM (`AI_KEYS_KEY`, never returned). Enrichment uses the
  library's provider, else **Home AI** (direct Ollama `/api/chat`, `format` schema, `think:false`, queued one at a time)
  when the server admin (`ADMIN_EMAILS`) allowed it for that library. Cover recognition needs a vision provider (OpenAI/Gemini).
- Google Books: every request goes through `GoogleBooksBudget` (`books-budget/`): a Postgres counter per **Pacific** day
  (Google's quota day), taken atomically (`INSERT … ON CONFLICT DO UPDATE … WHERE count < limit`), default 900/day
  (`GOOGLE_BOOKS_DAILY_LIMIT`, under the key's 1,000). When spent, or with no key, lookups use Open Library only.
  Shared fetchers take `IGoogleBooks { apiKey, take }` or null. Tags/categories are also derived from subject headings
  (`suggestTags`, `categoryPath`, `subjectCategories` in shared/metadata.ts) so they fill in without AI.
- Web search during AI enrichment: when the draft still has gaps (`needsWebSearch`), `AiService.enrich` queries the
  home **SearXNG** (`SEARXNG_URL` = `https://searxng.home.nitroxis.com`, locked: `SEARXNG_API_KEY` sent as `X-API-Key`;
  it has no internal route to the API) and keeps only the ≤3 results whose text matches the title (`relevantResults`),
  snippets ≤200 chars. Prompts stay small because Home AI runs on a CPU-only i3: a ~1,500-token search prompt took
  400–580 s on the 4B model. Ollama calls set `num_predict` 300 / `num_ctx` 4096.
  The AI also returns isbn/publisher/year/pages. An ISBN is kept only if it's printed in a relevant result
  (`isbnsInResults`, checksum-valid); exactly one such ISBN is used even if the AI names none. Year/pages are
  range-checked, and the app only fills blank, untouched fields. Searches happen only on user-triggered enrichment, with
  one retry on an empty answer (upstream engines get rate-limited).
- Covers: `POST /covers/presign` → the app PUTs the JPEG straight to Garage (`library-covers` bucket); key
  `{library}/{book}-{ts}.jpg`. The S3Client must use `requestChecksumCalculation: 'WHEN_REQUIRED'` (Garage rejects SDK CRC32).

## App
- `src/api/Auth.ts` (Better Auth client, cookie in SecureStore), `src/api/Http.ts` (`api.get/post/...` sends the cookie,
  throws `ApiError {status, code, permission}` from `src/api/ApiError.ts`), `coverUri()` → `EXPO_PUBLIC_COVERS_URL`.
- Hooks (`src/hooks/*`) call the API with React Query; models (`src/models/*`) are aliases of the shared contract types.
- Route guards (`src/app/_layout.tsx`): signed out → sign-in/sign-up/sign-in-code/forgot-password; signed in but
  unverified → verify-email only; verified without a library → welcome; otherwise the app. Devices + delete-account live in settings.
- Google Cloud: the shared **"Nitroxis Technologies"** project (`nitroxis-technol-1759477873971`), used by every Nitroxis
  Android app. It holds Library's Web + Android OAuth clients (package `com.nitroxis.library`; debug SHA-1 is RN's shared
  debug key `5E:8F:16:…:F6:25`, EAS key still to add) and the Books API key (`GOOGLE_BOOKS_API_KEY` on the server; without a
  key Google Books answers 429).
- Google sign-in: `react-native-nitro-google-signin` (Android **Credential Manager**: one tap → create → account sheet) in
  `src/auth/GoogleSignIn.ts`. Its config plugin is NOT in app.json: Android needs none, and the plugin throws without an
  iOS `iosUrlScheme` (add it when an iOS OAuth client exists).

## Commands
- App: `npm run typecheck`, `npm run lint`, `npm run test:ci` (Vitest, ≥85% coverage on utils/ApiError/shared), `npx expo-doctor`.
- API: `cd server && npm test` (Vitest + unplugin-swc; e2e on **PGlite** in-process, incl. the permission matrix), `npx tsc --noEmit`,
  `npx nest build` → `dist/server/src/main.js`.
  - `npm run test:e2e:pg` runs the same suite on a throwaway Postgres 17 container. **Run it on the home server** (ask the
    `homeserver` session); there are no Docker DB tests on this Mac.
  - `test/smoke/Garage.smoke.test.ts` runs only when `server/.env.garage` exists (live Garage upload check).
- Prisma: edit `server/prisma/schema.prisma`, then `npx prisma migrate dev --create-only` against a dev DB and hand-add any
  CHECKs/extensions. `npx prisma generate` writes `server/src/generated/prisma` (gitignored).
- Deploy: a Coolify Docker Compose resource "library-api" with base dir `/server` and compose file `/docker-compose.coolify.yml`
  (api only; networks default + `n8n_default`). Postgres 17 is the shared Coolify database "nitroxis-pg" (project "common",
  container `mgpp9dnk3gikz7hdfhazv7ev`; database + non-superuser role `library`, `pg_trgm` pre-created by the superuser),
  reached over the `coolify` network ("Connect To Predefined Network") via `DATABASE_URL`. Coolify app uuid `bhidfqpixbpmtniphkxm62ln`, domain `https://api.library.home.nitroxis.com`. The container runs `prisma migrate deploy` on start.
- Device e2e (Maestro, `.maestro/`): boot an emulator, build the release APK (`cd android && ./gradlew assembleRelease`;
  `.env.local` must point at the API you want), then `bash scripts/run-e2e.sh`. It signs in as the pre-verified test account
  in `.maestro/.env.local` (TEST_EMAIL/TEST_PASSWORD, gitignored), runs the whole journey against that API and deletes its
  "Maestro Library" at the end (and any leftover from an aborted run at the start). Inputs are targeted by `testID`.
- App env (`.env.local`): `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_COVERS_URL`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
  Release APK: `npm run build:preview` (clears the Metro cache, builds locally with EAS, runs `scripts/check-apk.sh`).

## UX conventions (kid-friendly: "a 6-year-old can use it")
- **Pictures first**: books appear as covers (`BookTile`/`BookGrid`, shelves as cover rows on a "plank"); emoji label big actions.
- **Plain words**, never jargon in UI: Bookcase (not rack), Book check (not audit; random = "Quick check", shelf = "Check a whole
  shelf"), Given away (not archive/donate), Borrowed / It's back! (not lend/return). DB/RPC names stay technical.
  Permission labels + presets (Editor, Reader, Helper, Checker, Viewer) live in `constants/Permissions.ts`.
- **One obvious action per screen**: a single `Button big` for the main step; secondary actions smaller; rare fields behind
  `Collapsible` ("More details"). Add-book = cover hero → shelf (`ShelfChoice` remembers the last one) → colour → "Put it on the shelf".
- **Scan does everything**: the centre Scan button is shown to everyone; a known ISBN shows where it lives + one-tap
  "I'm borrowing it" / "I'm giving it back" / "I found it!"; unknown → add form (or "ask someone" without books.add).
- **Always confirm success** with `useToast()` (big toast + success haptic), e.g. "📚 Added to Living room · Top shelf".
- **Touch & text sizes**: tappables ≥ 44–56px (`min-h-11/12/14`), body text ≥ `text-base`, titles `text-2xl/3xl`; icon-only
  buttons need `accessibilityLabel`. Quick check is a game (`audit/play/[id]`): one book at a time, answers applied locally first.
- Lint allows apostrophes in JSX text (`react/no-unescaped-entities` forbids only `>` and `}`).

## Gotchas (inherited from financy)
- NativeWind v5 rc: `className` only on core RN components (use `SafeArea`), `/NN` opacity modifiers don't render (use hex alpha).
- `lightningcss` pinned to 1.30.1 via `overrides`. `app.config.js` stays plain JS (older eas-cli + TS 6).
- `deno.json` lives in `supabase/`, not `supabase/functions/`.
- Cover uploads use a fresh path per upload (`{library}/{book}-{ts}.jpg`) so cached images refresh.
