@AGENTS.md

# Home Library

Android-first Expo app (SDK 57, Expo Router, TypeScript) for cataloguing physical books across several **libraries**
(home, office, a friend's home). Backend: **Supabase cloud** project `jcqnojqtqzpdjuivtcgr` (Postgres + RLS, Storage,
Vault, Edge Functions). Sibling of `~/projects/financy`; configs and UI kit were copied from there.

## Domain
- **Library** = tenant. Membership is `owner` (every permission, only role that can rename/delete the library or change owners)
  or `member` with a **granular permission set** (`library_permission` enum ↔ `src/constants/Permissions.ts`, keep in sync):
  `books.add`, `books.edit`, `books.move`, `loans.manage`, `books.archive`, `books.delete`, `shelves.manage`, `audits.run`,
  `members.manage`, `ai.manage`. Everyone can read/search/see reports. Presets (Editor/Lender/Auditor/Viewer) are UI-only.
  A `members.manage` holder can only grant/revoke permissions they hold and never touches owners.
- Joining: invite codes (`create_invite` → share → `accept_invite`), carrying a permission set. No email sending needed.
- **Racks → shelves** (both renamable, sortable by `position`). A **book row = one physical copy**; `shelf_id` is its
  home shelf: kept while lent out or missing, cleared when archived (DB check constraint).
- Status machine: `on_shelf` ⇄ `borrowed` (lend/return), `on_shelf` → `missing` (audit completion) → `on_shelf` (seen again /
  `mark_book_found`), any → `archived` (donate/lost/discarded) → `on_shelf` (restore). Every change writes `book_events`.
- Audits: `random` (N books weighted to longest-unseen) or `shelf` (scan every barcode on a shelf; unknown/elsewhere books
  recorded as `unexpected`). Completing marks unchecked items missing.

## Architecture
- `supabase/migrations/`: `core_schema` (tables, composite `(id, library_id)` FKs so rows can't cross tenants),
  `rls` (helpers `is_member`/`is_owner`/`has_permission`/`require_permission`, column-level grants), `rpcs` (every state
  change; `require_permission` raises 42501 with the permission in HINT → `src/utils/Errors.ts` names it), `storage`
  (public-read `covers` bucket, writes need books.add/edit for the first path segment = library id).
- Clients can't write `books.status/shelf_id/archived_*`, `library_members`, `loans`, `audits`, `book_events` directly: RPCs only.
- **AI keys** live in Vault via `set_ai_provider`; `library_ai_providers` has no client grants; `ai_config_for` is service_role
  only. `libraries.enrich_provider` / `vision_provider` pick which configured provider does what.
- Edge functions (`supabase/functions`, Deno): `lookup-book` (ISBN → Open Library + Google Books merge, or title/author →
  candidates; no AI, fast), `enrich-book` (AI tags/categories/description; app calls it in the background after lookup),
  `identify-cover` (vision → title/authors → candidates; 409 `ai_not_configured` without a vision provider). Auth: JWT
  verified with the service role + explicit membership check (`_shared/http.ts`); queries must stay scoped to the library.
  One OpenAI-compatible adapter (`_shared/ai.ts`) serves OpenAI, Gemini (`/v1beta/openai`) and self-hosted gateways.
- **Ollama** (home server, CPU-only, LAN-only) is reached only through **OmniRoute** `https://omniroute.home.nitroxis.com/v1`
  (Bearer key, model `ollama-local/hf.co/unsloth/Qwen3.5-0.8B-GGUF:UD-Q4_K_XL`), configured per library as provider
  `openai_compatible`. ~10–30 s per call, vision untested → use it for enrichment only; covers need OpenAI/Gemini.
- App: `src/app` routes (`(tabs)` Home/Shelves/Search/Reports + centre scan button), hooks call `getSupabase()` directly
  (no backend interface layer), `mappers/SupabaseMapper.ts` (snake_case rows ↔ models), `library/LibraryProvider.tsx`
  (current library + `useCan(permission)`), route guards in `_layout.tsx` (signed out → sign-in; no library → welcome).
- Shared pure code: `src` imports `supabase/functions/_shared/*.ts` via the `~fn/*` alias (only import-free files like
  `isbn.ts`, `metadata.ts` types).
- The Supabase client is untyped (no generated `Database.ts` yet); row shapes are declared in the mapper.

## Commands
- `npm run typecheck`, `npm run lint`, `npm run test:ci` (Vitest, ≥85% coverage on utils/mappers/_shared), `npm run check:fn` (deno check).
- `npm run test:db`: pgTAP (`supabase/tests/database`) in a throwaway `supabase/postgres` container. **Not on this Mac**
  (no local Docker DB tests, same policy as financy): ask the `homeserver` Claude session to rsync `supabase/` + `scripts/`
  and run it (`DOCKER="sudo docker"` + a psql shim; the bare image lacks the storage schema, so the covers migration is a no-op there).
- Deploy: `supabase login` → `supabase link --project-ref jcqnojqtqzpdjuivtcgr` → `supabase db push` →
  `supabase functions deploy lookup-book enrich-book identify-cover`. Optional secret: `GOOGLE_BOOKS_API_KEY`.
- Dev: `npx expo run:android` or a dev client (`eas build --profile development --local`), then `npx expo start --dev-client`.
  Release APK: `npm run build:preview` (clears Metro cache, local EAS build, `scripts/check-apk.sh`).
- `.env.local` (gitignored, bundled via `.easignore` for local builds): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY`.

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
