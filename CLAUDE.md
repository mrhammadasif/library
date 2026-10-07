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
  (seen again / "I found it") or → `borrowed` ("Someone has it": lending a missing book records who has it), any → `archived` (given away/lost/discarded) → `on_shelf` (bring back). Every change writes `book_events`.
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
- AI: **only the library's own key** (OpenAI / Gemini / self-hosted OpenAI-compatible), added in Smart helpers, sealed
  with AES-256-GCM (`AI_KEYS_KEY`, never returned) and tested with a tiny request on save. The server has no AI key of
  its own: Home AI (Ollama, then OmniRoute) was removed on 2026-10-07 before going public. Each library chooses a daily
  cap on its AI requests (`libraries.ai_daily_limit`, null = no limit; `GET/PUT /ai/limit`). Every enrich/identify
  request is counted in `library_daily_usage` (kind `ai`), and over the cap → 429 `ai_daily_limit`.
  Cover recognition needs a vision-capable provider.
- **Free tier:** libraries without their own key get `FREE_AI_PER_LIBRARY` (5) book-detail suggestions a day through the
  owner's OmniRoute (`FREE_AI_BASE_URL`, `FREE_AI_API_KEY`, model `FREE_AI_MODEL` = `hammad/free`, provider `'free'`).
  It's capped server-wide by `FREE_AI_DAILY_TOTAL` (200) in `server_daily_usage`. Trusted libraries skip only their
  own cap. Over the cap → 429 `free_ai_used_up` / `free_ai_busy`, with a hint to add their own key. Text only:
  `hammad/free` can't read images, so cover photos still need the library's own key. `/me.freeAiPerDay` tells the app
  whether it's on (null = no key configured).
- Google Books: every request goes through `GoogleBooksBudget` (`books-budget/`): a Postgres counter per **Pacific** day
  (Google's quota day), taken atomically (`INSERT … ON CONFLICT DO UPDATE … WHERE count < limit`), default 900/day
  (`GOOGLE_BOOKS_DAILY_LIMIT`, under the key's 1,000). When spent, or with no key, lookups use Open Library only.
  Shared fetchers take `IGoogleBooks { apiKey, take }` or null. Tags/categories are also derived from subject headings
  (`suggestTags`, `categoryPath`, `subjectCategories` in shared/metadata.ts) so they fill in without AI.
- **Public use (bring your own key):** strangers never touch the owner's keys. Everyone adds their own Gemini/OpenAI key in Smart helpers (tested with a tiny request on save:
  `AI_KEY_CHECK`, mapped to `invalid_key` / `invalid_model` / `provider_unreachable`; a new key is switched on
  automatically). Shared services have per-library daily allowances in `library_daily_usage` (`LibraryAllowance`,
  Pacific day, atomic like the Google budget): `LIBRARY_DAILY_GOOGLE_BOOKS` (150) and `LIBRARY_DAILY_WEB_SEARCHES` (50).
  Libraries the admin marks **trusted** (`libraries.trusted`, `PUT /libraries/:id/trusted`, admin-only switch in
  Settings) are exempt. When an allowance is spent, lookups use Open Library only and AI runs without web results.
- Missing books: a red banner on Home ("❓ N books are missing") opens `missing.tsx`, where each book can be marked
  found, borrowed by someone (lend sheet) or gone for good (give-away sheet).
- Deleting a library: a dedicated page (`delete-library.tsx`) lists what's lost (with counts) and needs the exact
  name typed back. The server checks it too (`DELETE /libraries/:id` body `{ confirmName }` → 400 `name_mismatch`).
- Devices: the app sends `User-Agent: HomeLibrary/<version> (<maker model>; Android <n>)` (`USER_AGENT` in
  `src/api/Env.ts`) so sessions are recognisable; the current session is matched by id; "Sign out all other devices".
- **Free for everyone (no AI needed):** Open Library and the home SearXNG. In a title lookup ("Find it online"), when no
  database candidate with an ISBN matches the title (`titleScore` ≥ 0.75), `LookupService.webCandidates` searches the
  web and turns ISBNs printed in matching results into candidates (≤3, filled from Open Library/Google when known).
  Every lookup costs one unit of `LIBRARY_DAILY_LOOKUPS` (300/library/day, 429 `lookup_limit`). Web searches use
  `LIBRARY_DAILY_WEB_SEARCHES`. Trusted libraries are exempt.
- Web search during AI enrichment: when the draft still has gaps (`needsWebSearch`), `AiService.enrich` queries the
  home **SearXNG** (`SEARXNG_URL` = `https://searxng.home.nitroxis.com`, locked: `SEARXNG_API_KEY` sent as `X-API-Key`;
  it has no internal route to the API) and keeps only the ≤3 results whose text matches the title (`relevantResults`),
  snippets ≤200 chars (cheap and fast whatever the model).
  The AI also returns isbn/publisher/year/pages. An ISBN is kept only if it's printed in a relevant result
  (`isbnsInResults`, checksum-valid); exactly one such ISBN is used even if the AI names none. Year/pages are
  range-checked, and the app only fills blank, untouched fields. When the AI finds a new ISBN, the app looks it up and
  that record's publisher/year/pages win (web snippets can describe another edition); the AI's values are the fallback. Searches happen only on user-triggered enrichment, with
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
  (api only; default network: SearXNG is reached via its public URL + key). Postgres 17 is the shared Coolify database "nitroxis-pg" (project "common",
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
- NativeWind v5 rc: `className` only on core RN components (use `SafeArea`), `/NN` opacity modifiers don't render (use hex alpha),
  and `leading-*` line heights blow up to huge gaps on device: set `style={{ lineHeight: n }}` instead.
- Keyboard: Android is edge-to-edge, so the window doesn't resize for the keyboard. `KeyboardProvider` (root) +
  `KeyboardAwareScrollView` from `react-native-keyboard-controller` (in `Screen`, sign-in, sign-up) scroll the
  focused input above it. Not a core component, so use `contentContainerStyle`, not NativeWind classes. Chained forms
  use `returnKeyType="next"` + a ref (`Field` takes `ref`) so "Next" moves on. Maestro: force the soft keyboard on
  emulators (`adb shell settings put secure show_ime_with_hard_keyboard 1`) to see real keyboard behaviour.
- `lightningcss` pinned to 1.30.1 via `overrides`. `app.config.js` stays plain JS (older eas-cli + TS 6).
- `deno.json` lives in `supabase/`, not `supabase/functions/`.
- Cover uploads use a fresh path per upload (`{library}/{book}-{ts}.jpg`) so cached images refresh.
