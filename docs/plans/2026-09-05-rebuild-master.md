# Manufacturing Max v2 Rebuild — Master Program Plan

> **For the executing agent:** Execute this program cycle-by-cycle, task-by-task, in the `v2` branch. Each task follows TDD (RED → GREEN) and verification-before-completion (run the command, read the output, then claim). Do not claim a cycle done without its verification gate passing.

**Goal:** Recreate Manufacturing Max from zero, one module per cycle, engineered to the standard defined by `docs/DEPTH_01..06` — strict typed core, org-model-driven architecture, TDD-verified, with the current prototype (`master`) kept as a shippable reference and support fallback until cycles land.

**Architecture:** A clean, typed application core (no `as any`, DTO boundaries, zod at every edge, service layer over Prisma) with the configurable org model (DEPTH_02) as the spine every module and the AI copilot layer (DEPTH_05) reads. Each domain module (DEPTH_03 F1–F13, DEPTH_04 W1–W12) is rebuilt on that core in dependency order.

**Tech stack:** Next.js 16 App Router (unchanged platform), TypeScript strict, Prisma 7 + PostgreSQL (existing `prisma.config.ts`/driver-adapter setup), zod, Tailwind v4; tests via `node --import tsx --test tests/*.test.ts` (repo `npm test` runner). Desktop launcher/embedded-Postgres/installer infra is **platform, not prototype debt** — retained as-is (see §5).

**Current date:** 2026-09-05.

---

## 1. Branch & repository strategy

- `master` = the working prototype (1.0.x, pilot-capable). **Never broken by v2 work.**
- `v2` = from-zero rebuild branch, cut from `master`. All cycle work lands here.
- Untracked spec/docs live in both working trees (DEPTH suite, plans).
- Nothing on `master` is deleted until a v2 cycle has passed its verification gate *and* the user approves the flip. Prototype code on `v2` is removed per-cycle only after the replacement module passes parity/re-spec review.
- Commits on `v2` per task (user approves commit/PR policy separately — ask before pushing).

## 2. Cycle inventory (dependency-ordered)

| Cycle | Scope | Spec anchor | Primary risk to retire |
|---|---|---|---|
| C1 | Typed core + org model + auth | DEPTH_01/02 | `(prisma as any)` everywhere; no org chart/levels |
| C2 | Shop-floor MES core (machine, WO, production/downtime logs, shifts) | DEPTH_03 F2, W2 | state engine correctness, idempotency |
| C3 | Quality & aero compliance (FAI, NCR/8D, serial/genealogy, data package, calibration, hold points) | F3, W5/W6, guardrails G-1..G-6 | guardrail enforcement depth |
| C4 | Engineering & change control (product/BOM/routing, ECO, docs, fixtures) | F4, W7 | revision-as-law |
| C5 | Supply chain & purchasing (PO/GRN/inventory/certs/subcontract/cycle count) | F5, W3/W4/W12 | atomic stock, cert gating |
| C6 | Commercial & finance (quote→SO→dispatch→invoice→GL, fixed-point money, treasury) | F6/F7, W1/W8/W9 | paise money end-to-end, balanced GL |
| C7 | People & payroll | F8, W10 | statutory, session rotation |
| C8 | Maintenance & tooling | F9, W11 | cal/tool-life gates |
| C9 | EHS, lean & continuous improvement | F10/F11 | incident closure evidence |
| C10 | Reports, digest, print center | F1/F12 reports | print fidelity |
| C11 | AI copilot framework (local models, seat context, approval broker) | DEPTH_05 | AI-1/2/3 enforcement |
| C12 | System/admin/config UI, custom entities, org-chart/approval-chain admin | F12/F13, DEPTH_02 §7 | admin UX completeness |
| C13 | Plant-server scale + desktop integration pass + go-live hardening | DEPTH_06 | 500+ user claims (benchmarked) |

Each cycle that ships a data model also ships: migration (expand-and-contract where relevant), typed engines + tests, route + DTO + zod, UI when user-facing, and an updated DEPTH cross-reference note.

## 3. The v2 architecture target (applies to every cycle)

- **Type discipline:** strict TS; no `(prisma as any)`; typed Prisma client models only; response DTO mapping at every API edge (never leak internal fields); shared `ErrorEnvelope` + typed `Result<T, E>`; zod `parseOr400` pattern at every POST/PATCH (repo precedent in `src/lib/validate.ts`).
- **Layering:** route → service/engine (`src/lib/<domain>/*`) → Prisma. No business logic in route handlers beyond parsing/authz/delegation.
- **Org spine (C1):** every scoped query resolves through the seat resolver (`seatContext(user, unit)`), RBAC keys stay the atomic currency (`permissions.ts` workspace keys), grade-gating compares levels, approval chains resolve against the live org chart.
- **Guardrails:** G-1…G-10 (DEPTH_01 §6) enforced in engines/routes, never only in UI; enforced identically for AI-proposed actions (DEPTH_05 approval broker).
- **Money & integrity:** integer paise via a single `money.ts`; sequence + idempotency + audit primitives used by every mutating path (patterns already proven in v1 — re-implement typed, don't reinvent semantics).

## 4. Cycle definition of done (gate)

1. Spec slice read from DEPTH docs and any behavior re-spec recorded.
2. Schema/models added; `prisma validate` + `prisma generate` clean.
3. Engines written TDD: failing test first (RED evidence), minimal impl (GREEN), refactor — `npm run test`-style run green.
4. Routes + DTO + zod with authz via proxy/seat checks; no new `as any`.
5. `tsc --noEmit` clean on the whole repo (no new errors introduced).
6. Behavior checklist from the DEPTH workflow section verified (each exception path named).
7. Docs updated: mark cycle complete in `HANDOVER`-style log + DEPTH cross-reference.

## 5. Retained platform (not rebuilt from zero — infra, not prototype)

`desktop/launcher.js`, `desktop/electron/main.js`, `desktop/lib/*` (vault, watchdog, license, embeddedDb, controlServer, updater, prune, ledgerIntegrity), `scripts/build-desktop-resources.js`, installer/NSIS config, Dockerfile, `src/proxy.ts` pattern (re-typed), Next standalone output config, `src/instrumentation.ts`. Rationale: these are deployment/packaging mechanics already at production standard and orthogonal to application code quality. If a cycle finds a defect in them, fix in place.

## 6. Skills & process governance

- **prisma-patterns / prisma-expert**: schema design, indexes, `migrate deploy` not `migrate dev` outside local, transaction rules (no external calls in interactive tx), DTO mapping.
- **typescript-pro / nextjs-app-router-patterns**: typing conventions, App Router data fetching.
- **tdd-workflow**: RED → GREEN → REFACTOR, one behavior per test.
- **verification-before-completion**: no success claim without fresh command output in the same turn.
- **writing-plans**: this plan + per-cycle plan docs under `docs/plans/YYYY-MM-DD-cycleN-*.md`.
- **review / test / simplify**: applied between cycles and on every completed module before it is considered done.
- Per-module persona mode adopted from the user skill library when useful (agency-engineering-*, agency-testing-*, security-review).

## 7. Sequencing discipline

One cycle at a time, in order C1 → C13. A cycle may split into lettered sub-cycles (C1a, C1b…) when its surface is large. No parallel cycles on `v2` without a dedicated worktree per cycle (avoid schema conflicts). Prototype parity: for re-spec changes, record the behavioral delta in the cycle's plan doc before implementation so reviews compare against intent, not nostalgia.

---

*Next: `docs/plans/2026-09-05-cycle1-typed-core-org-model.md`*
