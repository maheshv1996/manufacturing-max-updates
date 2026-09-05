# Manufacturing Max

One offline, install-once system that runs a complete manufacturing plant — shop floor, quality/aero compliance, supply chain, engineering, finance, people, maintenance, EHS/lean — with a configurable org model and role-aware AI copilots. See `docs/DEPTH_01…06` for the vision and depth specs, and `docs/plans/` for the v2 rebuild program.

**Branches**
- `master` — the shippable prototype (1.0.x desktop edition, pilot-capable).
- `v2` — from-zero rebuild on the typed core + org model (cycles C1…C13, `docs/plans/2026-09-05-rebuild-master.md`). Work lands here, uncommitted until a cycle gate passes.

## Prerequisites

- **Node.js ≥ 20** (`.nvmrc` pins 24) and **npm** (the repo is `package-lock.json`-based).
- **PostgreSQL** running locally (any recent version). The committed `.env` points at the cloud pilot DB — **for development always override** `DATABASE_URL` via `.env.local` (gitignored) to your local server, e.g.:
  ```bash
  # .env.local
  DATABASE_URL="postgresql://postgres:1996@localhost:5432/mfgmax_v2_dev"
  ```

## Setup

```bash
cp .env.example .env        # then fill SESSION_SECRET etc. (first run only)
npm install                 # postinstall runs `prisma generate`
node scripts/v2-smoke-db.mjs mfgmax_v2_dev   # optional: recreate + push + seed a local scratch DB
npm run dev                 # http://localhost:3000
```

Login requires seeded users (prototype `prisma/seed.ts` on an empty DB, or v2 org data via `prisma/seed-v2.ts`).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server (uses `.env.local` over `.env`) |
| `npm test` | All suites: `desktop/tests/*.test.js` + `tests/*.test.ts` (tsx) |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Whole-repo type gate |
| `npm run ci` | verify-counts → tsc → build → tests (CI gate) |
| `node scripts/v2-smoke-db.mjs [db]` | Recreate a local scratch DB, `prisma db push`, run `seed-v2.ts` (localhost only) |
| `npm run dist` | Build the Windows desktop `.exe` (electron-builder NSIS; requires Windows) |

## Conventions (v2 rebuild)

- Type discipline: strict TS, **no `(prisma as any)`**, zod `parseOr400` at every API edge, DTO mapping, `src/lib/core/errors.ts` for API errors.
- Layering: route → engine (`src/lib/<domain>/`) → Prisma. Pure engines are TDD-tested DB-free (`tests/`); DB adapters (`*Db.ts` / `applyJobAction.ts`) are the only Prisma callers beyond routes.
- Integrity: audits (`recordAudit`), idempotency (`runIdempotent`), sequences (`allocateSequence`) on every mutating path.
- Seats & approval chains resolve through the org model (`src/lib/org/`); compliance guardrails G-1…G-10 (`docs/DEPTH_01`) are enforced in engines, never only in UI.
