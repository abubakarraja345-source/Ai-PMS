# Project Status — AI PMS (Hostly)

_Audit date: 2026-08-10. Read-only analysis, no code changed._

## Stack

- **Backend**: Node.js + Express 4 + TypeScript (`tsx`/`tsc`), Supabase as the only data store (no ORM, no local schema/migrations checked in). Package name `hostly-backend`.
- **Frontend**: Next.js 16 (App Router, **canary/bleeding-edge — breaking changes vs stable Next.js**, per `frontend/AGENTS.md`) + React 19 + TypeScript, Tailwind v4, shadcn/ui components installed.
- **Auth**: Supabase Auth (magic link / OTP). Backend verifies bearer tokens via `supabase.auth.getUser()`; no custom JWT despite `jsonwebtoken`/`bcrypt` being installed.
- **Database**: Supabase Postgres, accessed only through `@supabase/supabase-js` query builder. No migrations, SQL, or ERD anywhere in the repo (`/database`, `/docs`, `backend/src/database` are all empty) — schema exists only implicitly in query code.
- **No automated tests** on either side (no test scripts, no test frameworks installed).

## Completed Features

- **Properties module (backend)** — full CRUD (`GET/POST/PATCH/DELETE /api/properties`), layered repository/service/controller, hand-rolled validation, org-scoped via `requireOrganization` middleware. Most mature module in the codebase.
- **Reservations module (backend)** — full CRUD, date validation, ownership checks (property/guest belong to org), nights recalculation.
- **Properties UI (frontend)** — list, create, view, edit pages under `app/(dashboard)/properties/*`, wired to the real backend via `lib/api.ts`.
- **Reservations UI (frontend)** — list with create/view/edit modals, detail page, edit page under `app/(dashboard)/reservations/*`.
- **Guests (partial)** — backend supports Create/Read only (no update/delete); consumed by the reservation flow.
- **Dashboard stats** — `GET /api/dashboard/stats` (counts of properties/reservations/guests/cleaning/maintenance) + a working `DashboardStats` UI component.
- **Auth (functional slice)** — Supabase magic-link login (`app/auth/login`), OAuth/magic-link callback route (`app/auth/callback/route.ts`), working logout button, backend token verification middleware (`requireAuth`, `requireOrganization`).

## In-Progress / Scaffolded Only (no real logic)

- **Backend "module" scaffolds with zero implementation**: `auth`, `calendar`, `cleaning`, `ai`, `integrations`, `reports` — each is `Repository.findAll() → []`, wired to a controller/router that is **never mounted** in `app.ts`.
- **Backend `src/routes/index.ts` aggregator** — a whole second routing tree (health/auth/properties/reservations/guests/calendar/cleaning/maintenance/inventory/reports/ai/integrations/notifications/settings) exists but is **never imported by `app.ts`** — 100% dead/unreachable code. Confirmed directly: `app.ts` has no reference to `routes/index`.
- **AI integration** — `@google/genai` dependency installed but never imported anywhere; `GeminiService.generate()` just returns the literal string `'generated text'`. No prompt handling, no API key usage.
- **Frontend `features/*` tree** (all 15 domains: ai, analytics, auth, calendar, cleaning, dashboard, guests, integrations, inventory, maintenance, notifications, properties, reports, reservations, settings) — every sub-folder (`api/components/hooks/pages/schemas/services/types`) is **completely empty**, confirmed (0 files). None of it is imported anywhere; the real Properties/Reservations UI lives directly under `app/(dashboard)/...` instead, bypassing this intended architecture entirely.
- **Frontend `services/*.ts`** (ai/guest/property/reservation) — each a stub with a `// TODO:` comment returning `null`/`[]`; unused (real pages call `lib/api.ts` directly).
- **Background jobs/queues** — `backend/src/jobs/` and `backend/src/queues/` exist but are completely empty; `@upstash/redis` is installed but no Redis client is ever instantiated anywhere.

## Missing Features

- Maintenance, inventory, notifications, settings — no backend module content at all (beyond dead one-line route stubs) and no frontend routes/pages.
- Calendar, cleaning, reports, integrations, analytics — same: stubs only, nothing reachable.
- No signup/registration endpoint anywhere (login-only via Supabase magic link).
- No landing/marketing page — `app/page.tsx` and `app/layout.tsx` are still unmodified `create-next-app` boilerplate.

## Bugs / Issues

**Backend**
1. **Most backend routes are unreachable.** `app.ts` only mounts `/health`, `/api/test`, `/api/dashboard`, `/api/properties`, `/api/guests`, `/api/reservations`. The larger `routes/index.ts` tree is orphaned dead code. *(Verified directly.)*
2. **No global error handler registered** — `error.middleware.ts` exists but isn't wired into `app.ts`; an unhandled throw in a route without try/catch can crash the process or hang the request.
3. **`rateLimiter.ts` and `validate.ts` middleware are placeholders** (`next()` only) despite `express-rate-limit` and `zod` being installed — no rate limiting or schema validation is actually active anywhere.
4. **Duplicate implementations**: `src/routes/guest.routes.ts` (unused) duplicates `src/modules/guests/routes.ts` (mounted); same pattern for properties/reservations stub routes vs. the real module routes.
5. **Debug logging left in `organization.middleware.ts`** — `console.log`s dumping user IDs/emails/raw DB errors in the auth path.
6. **Inconsistent org-lookup pattern** — `properties` uses the `requireOrganization` middleware; `guests`/`reservations` duplicate an inline `getOrganizationId()` helper instead (3 copies of similar logic).
7. **`requireOrganization` only supports a single org per user** (`.limit(1).maybeSingle()`), no multi-org selection.
8. **CORS is wide-open with no options** (`cors()`), while `cookie-parser` is loaded but never actually used for auth — inconsistent setup, and not credentials-safe if cookie auth is ever added.
9. **Dead dependencies installed but never imported**: `bcrypt`, `jsonwebtoken`, `zod`, `@upstash/redis`, `express-rate-limit`, `@google/genai`.
10. **`guests/types.ts` has a stale/wrong stub type** (`Guests { id, name }`) that doesn't match the real guest shape used in the repository.

**Frontend**
1. **Route protection regression**: the old `middleware.ts.backup` (Next.js legacy convention) contained real redirect logic (block `/dashboard/*` when unauthenticated, block `/auth/login` when authenticated). The new `proxy.ts` + `lib/supabase/proxy.ts` (required by this Next.js 16 version) only refreshes the session cookie and **never redirects** — route-level auth protection has effectively been dropped, aside from a server-side check on the one dashboard landing page. *(Verified: `updateSession()` has no redirect logic.)*
2. **`store/*.ts` (auth/property/ui stores) import `mobx`, which is not installed** (`zustand` is installed instead but unused). These files would fail to compile if anything imported them — currently safe only because nothing does. *(Verified directly — `mobx` import present, zero mobx references in package.json/lock.)*
3. **`app/test-api/page.tsx` has duplicate declarations** (`PROPERTY_ID` declared twice, `getReservations()` defined multiple times in one scope) — scratch/debug page left in the route tree; is part of the Next.js build since it's a real page file.
4. **Dead nav links**: dashboard sidebar links to `/calendar`, `/guests`, `/cleaning`, `/maintenance`, `/ai`, `/settings` — none of these routes exist; 6 of 8 primary nav items 404.
5. **Duplicate/competing login pages**: `app/(auth)/login/page.tsx` (non-functional placeholder) vs `app/auth/login/page.tsx` (the real, working one).
6. **Three separate Supabase client constructors** (`lib/supabase.ts`, `lib/supabase/client.ts`, `lib/supabase/server.ts`) — redundant, maintenance risk.
7. **shadcn/ui component library (18 primitives) installed but unused** — every real page hand-rolls raw Tailwind markup instead.
8. **React Query and Sonner toaster installed but never mounted** in the root layout — no `QueryClientProvider`, no `<Toaster />`; all data fetching is manual `useEffect`/`useState`, all feedback is inline `<div>` banners.
9. **`services/auth.service.ts` hardcodes `http://localhost:3000/auth/callback`** for OTP redirect instead of using `window.location.origin` — would break in any non-local deployment (currently unused, dead code, but risky if revived).
10. **Scratch/dev pages still in the route tree**: `app/auth-test/page.tsx`, `app/test-api/page.tsx`.
11. **`tsconfig.json` explicitly includes `middleware.ts.backup`** in its `include` array, so a dead backup file is still type-checked on every build.

## Architecture Note

Two competing layering patterns exist on both sides of the stack (backend: `modules/*` layered pattern vs. flat `routes/*.routes.ts` stubs; frontend: real pages built directly in `app/(dashboard)/*` vs. an intended-but-empty `features/*` module tree). Whichever pattern is kept going forward, the other should be deleted to stop the drift — right now every new feature has two plausible places to live, and past additions inconsistently used the `requireOrganization` middleware vs. inline helpers as a direct symptom of this.

## Recommended Next Steps

1. **Fix the auth-protection regression first** (frontend `proxy.ts` has no redirect logic — this is a real security gap, not just a cleanup item).
2. **Wire up or delete `backend/src/routes/index.ts`** — decide once whether the `modules/*` pattern or the flat `routes/*` pattern is canonical, then delete the other. Currently half the backend is invisible dead code.
3. **Register the global error handler and real rate limiter/validation middleware** in `app.ts` before adding more endpoints — right now failures are inconsistent per-route.
4. **Pick one state/data-fetching strategy on the frontend** — remove the broken MobX stores (or replace with the already-installed Zustand), and either commit to React Query or the current manual `useEffect` approach, not both installed-but-unused.
5. **Delete scratch/dead files**: `app/test-api/page.tsx`, `app/auth-test/page.tsx`, `app/(auth)/login/page.tsx`, `middleware.ts.backup`, the unused `services/*.ts` stubs, the unmounted backend module scaffolds (`auth`, `calendar`, `cleaning`, `ai`, `integrations`, `reports`) — or actually implement them if they're still wanted.
6. **Add a schema source of truth** — no migrations or SQL exist anywhere; consider Supabase migrations or at minimum a checked-in schema dump, since right now table shape is only discoverable by reading query code.
7. Once the above is stable, extend real CRUD (guests update/delete, then maintenance/cleaning/inventory) using the properties/reservations modules as the template, since those are the most complete reference implementations on both ends.
