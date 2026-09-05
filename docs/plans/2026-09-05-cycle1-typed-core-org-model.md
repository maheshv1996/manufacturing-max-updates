# Cycle 1 — Typed Core + Org Model Implementation Plan

> **STATUS: COMPLETE — 2026-09-05.** All tasks landed on branch `v2` (uncommitted). Gate evidence: 9 suites / 40 tests green (`coreResult, coreErrors, coreParse, permissions, orgSeat, orgApproval, orgSeatContext, coreAuth, coreIntegrity`); `tsc --noEmit` exit 0 (whole repo); `prisma validate` 🚀; `as any` scan of `src/lib/core|org`, `src/app/api/v2`, `prisma/seed-v2.ts` → zero casts. Desktop suite 10/10 under the sanctioned runner (bun auto-loads `.env` → `SESSION_SECRET` env-override artifact, not a defect). **DB boundary CLOSED — 2026-09-05 (real Postgres):** user-provided local Postgres (:5432, scratch DB `mfgmax_v2_test`) — `db push` synced schema; `seed-v2.ts` ran twice (run 1: 7 levels + root + 3 chains; run 2: zero dups → idempotent); integrity smoke OK (audit row, apply-once + duplicate-skip + failure-release-retry idempotency, sequence 1-2-3, invalid name rejected); org e2e smoke OK (role create w/ validated keys → unit under ROOT → ACTIVE TEAM assignment → live `loadSeatContext`: 1 seat, exact 4-key perm union, no leakage, LEAD rank 4, home seat, role code). Remaining known boundaries: route **HTTP** behavior needs a running Next server + session cookie (engines + DB layer proven); org-admin **UI** and the approval-request **lifecycle engine** are later cycles (C12 / domain cycles) per the out-of-scope note below.

> **For the executing agent:** Work on branch `v2`. TDD every task: write the failing test → run it (must FAIL) → minimal implementation → run (must PASS) → refactor. verification-before-completion applies: evidence from the command output before any claim.

**Goal:** Establish the typed core (error envelope, DTO discipline, zod, typed permission catalog) and the configurable org model from DEPTH_02 §7 (`OrgUnit`, `RoleAssignment` with level/scope/acting, `ReportingLine`, `ApprovalChain`/`ApprovalTask`) plus the seat resolver, so every later cycle builds on a typed org spine. Behavior re-spec is allowed (user decision); recorded deltas noted per task.

**Architecture:** Additive first — new Prisma models + new pure-TS modules under `src/lib/org/` and `src/lib/core/` with tests in `tests/`. Existing prototype code stays untouched until its cycle replaces it (keeps `tsc --noEmit` green throughout).

**Tech stack:** Prisma 7 (driver adapter, `prisma.config.ts`), TypeScript strict, zod v4 (repo `validate.ts` precedent), tsx test runner.

**Verify commands (used throughout):**
- `npx prisma validate` — schema valid
- `node --import tsx --test tests/<file>.test.ts` — targeted tests
- `npm test` — full repo tests (after desktop tests still exist)
- `npx tsc --noEmit` — whole-repo type gate

---

### Task C1-0: Branch & baseline

**Files:** repo.
**Step 1:** `git status` — confirm clean enough; do not stage others' changes.
**Step 2:** `git checkout -b v2` (from master).
**Step 3:** Verify baseline: `npx tsc --noEmit` exit 0 (pre-existing state — record if not).
**Commit:** after tooling tasks only (ask before pushing).

---

### Task C1-1: Core error envelope + Result type

**Files:**
- Create: `src/lib/core/result.ts`
- Create: `tests/coreResult.test.ts`

**Step 1: failing test** — `tests/coreResult.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { ok, err, isOk, mapErr } from "../src/lib/core/result";

test("ok wraps a value and isOk is true", () => {
  const r = ok(42);
  assert.equal(isOk(r), true);
  assert.equal(r.value, 42);
});

test("err carries a typed error; mapErr rewrites it", () => {
  const r = mapErr(err("boom"), (m) => `wrapped: ${m}`);
  assert.equal(isOk(r), false);
  assert.equal(r.error, "wrapped: boom");
});

test("result is a discriminated union on tag", () => {
  const a: unknown = ok(1);
  assert.equal((a as { tag: string }).tag, "ok");
});
```

**Step 2:** run `node --import tsx --test tests/coreResult.test.ts` → FAIL (`Cannot find module`). Record red output.
**Step 3:** minimal implementation `src/lib/core/result.ts` — `Result<T,E>` = `{tag:"ok",value:T} | {tag:"err",error:E}` with `ok/err/isOk/mapErr`.
**Step 4:** run test → PASS (record green).
**Step 5:** refactor if duplicated; keep green.

---

### Task C1-2: Domain error envelope

**Files:** Create `src/lib/core/errors.ts`; test in `tests/coreErrors.test.ts` (or extend C1-1 file).
**Behavior:** `AppError` with `code` (e.g. `NOT_FOUND | FORBIDDEN | VALIDATION | CONFLICT | INTERNAL`), message, optional details; serializer for API responses that never leaks `details.error.message` (matches `internalError` precedent).
RED → GREEN same cycle as C1-1.

---

### Task C1-3: zod parse helpers (typed edge)

**Files:** Create `src/lib/core/parse.ts`; tests.
**Behavior:** `parseOr400(schema, input)` returns `ok(parsed)` or a VALIDATION AppError with field list (mirror `src/lib/validate.ts`, typed, no `any`). Tests cover valid, invalid, unknown-key-stripped.

---

### Task C1-4: Typed permission catalog

**Files:**
- Create: `src/lib/org/permissions.ts` — TS literal union `PermissionKey` derived from workspace keys (ops/supply/commercial/people/system/quality/metrology/engineering/finance/ehs/maintenance/projects/exec/legal/risk/brand/sustainability × view/edit/approve) + special keys (users.manage, terminal.use, reports.print, records.edit, kpi.override, audit.view). Export `ALL_PERMISSIONS` const + `isPermissionKey(s): s is PermissionKey`.
- Create: `tests/permissions.test.ts` — every workspace key present; approve key shape; invalid key rejected; no duplicate entries.

**Note:** DEPTH_02 §8 requires org-created roles may only reference existing keys — this module is the compile-time source of truth. Re-spec delta: v1 `permissions.ts` strings become a typed union; runtime sets must migrate by validation.

---

### Task C1-5: Org schema (Prisma, additive) — DEPTH_02 §7 design

**Files:** Modify `prisma/schema.prisma` (append models/enums).

```prisma
model OrgUnit {
  id         String   @id @default(cuid())
  code       String
  name       String
  type       String   // DIVISION | DEPARTMENT | CELL | TEAM | FUNCTION
  parentId   String?
  parent     OrgUnit? @relation("OrgTree", fields: [parentId], references: [id], onDelete: SetNull)
  children   OrgUnit[] @relation("OrgTree")
  headUserId String?
  costCenter String?
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  @@unique([code])
  @@index([parentId])
}

model Level {
  id     String @id @default(cuid())
  name   String
  rank   Int
  family String? // role family (null = global ladder)
  @@unique([name, family])
}

model RoleAssignment {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  orgUnitId     String
  orgUnit       OrgUnit  @relation(fields: [orgUnitId], references: [id], onDelete: Cascade)
  roleId        String
  role          Role     @relation(fields: [roleId], references: [id])
  levelName     String
  scope         String   @default("SELF") // SELF | TEAM | UNIT | PLANT | ALL
  validFrom     DateTime @default(now())
  validTo       DateTime?
  status        String   @default("ACTIVE") // ACTIVE | ACTING | SUSPENDED | EXITED
  actsForUserId String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@index([userId, status])
  @@index([orgUnitId, status])
}

model ReportingLine {
  id             String   @id @default(cuid())
  managerUserId  String
  reportUserId   String
  orgUnitId      String?
  validFrom      DateTime @default(now())
  validTo        DateTime?
  createdAt      DateTime @default(now())
  @@index([reportUserId])
  @@index([managerUserId, validTo])
}

model ApprovalChain {
  id         String   @id @default(cuid())
  entityType String
  name       String
  steps      Json
  isActive   Boolean  @default(true)
  createdBy  String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  @@index([entityType, isActive])
}

model ApprovalTask {
  id                String    @id @default(cuid())
  entityType        String
  entityId          String
  stepIndex         Int
  status            String    @default("PENDING") // PENDING | APPROVED | REJECTED | ESCALATED | SUPERSEDED
  assignedToUserId  String?
  criteriaSnapshot  Json
  decidedAt         DateTime?
  decidedByUserId   String?
  note              String?
  createdAt         DateTime  @default(now())
  @@index([entityType, entityId])
  @@index([assignedToUserId, status])
}
```

**Steps:** 1) append above; 2) `npx prisma validate` (PASS); 3) `npx prisma generate` (PASS). Do NOT run `migrate dev` yet — dev DB may be external; record whether a migration is created locally vs deferred (desktop embedded path uses `resources/schema.sql` rebuilt by `scripts/build-desktop-resources.js` — run that only when data model changes must reach packaged builds, and never without the migrate source of truth).
**Also:** add `RoleAssignment` relations to `User` (optional back-relation) and `Role` if needed — validate.

---

### Task C1-6: Seat resolver (pure engine, TDD)

**Files:**
- Create: `src/lib/org/seat.ts`
- Create: `tests/orgSeat.test.ts`

**Behavior (DEPTH_02 §3/§10):** `resolveSeats(userId, assignments, levels)` — pure, DB-free (take records as args) — computes: effective permissions (union across ACTIVE/ACTING assignments, respecting validFrom/validTo relative to `now`), effective level rank (max rank in unit context), scope ladder resolution, home seat, and `actsFor` flattening. Tests:
1. single role → perms = role perms, level = role level.
2. multi-role union of perms + max level.
3. expired/not-yet-valid assignment excluded; ACTING adds covered perms + records actsFor.
4. scope SELF vs PLANT changes `canSee(scopeA, scopeB)` outcome.
RED → GREEN (module missing → fail → implement minimal pure functions → pass).

---

### Task C1-7: Approval chain resolver (pure, TDD)

**Files:** Create `src/lib/org/approval.ts`; `tests/orgApproval.test.ts`.
**Behavior:** given a chain template (steps JSON from `ApprovalChain`) + org chart snapshot + document entity/unit → resolve ordered candidate approver seats; escalation rule: if no seat matches criteria, walk manager chain up N levels then unit head. Tests: happy path; criteria with no holder → escalate; minApprovals 1 vs 2; step snapshot stored (criteriaSnapshot) so later re-org doesn't re-route a decided task.

---

### Task C1-8: Auth core (typed): password hash, session token, epoch rotation

**Files:** Create `src/lib/core/auth.ts` (wraps existing crypto/argon/bcrypt usage — verify what v1 uses) + tests.
**Behavior:** hash/verify password; issue JWT session (payload id/username/roleIds/sess epoch/isOwner/mustChangePassword); verify + decode typed payload; `rotateEpoch(n)` returns n+1. Tests for hash roundtrip, wrong password false, token tamper fail, epoch mismatch → invalid.

---

### Task C1-9: Audit + idempotency + sequence primitives (typed, TDD)

**Files:** Create `src/lib/core/audit.ts`, `src/lib/core/idempotency.ts`, `src/lib/core/sequence.ts` + `tests/coreAudit.test.ts` etc.
**Behavior:** pure helpers over Prisma types with typed callers: `recordAudit(actor, action, entityType, entityId, details)`; `withIdempotencyKey(clientId, fn)` guard (unique violation → return existing result shape); `nextSequence(tx, name)` using `SequenceCounter` increment (never count+1). Re-spec note: v1 semantics (7-day TTL prune, X-Client-ID) preserved; these are typed re-implementations, not behavior changes.

---

### Task C1-10: Settings engine (typed)

**Files:** `src/lib/core/settings.ts` + tests: typed get/parse with defaults (branding, activeDepartments, guardrail-adjacent flags like requireMillCerts) returning typed object; unknown key handling.

---

### Task C1-11: Routes layer v2 (auth + org admin + seat-aware me)

**Files (server pages/API):** `src/app/api/auth-v2/login/route.ts` (or extend existing auth routes with typed core), `src/app/api/v2/org/units/route.ts`, `.../roles/route.ts`, `.../assignments/route.ts`, `.../approval-chains/route.ts`, `.../me/route.ts`. Each: zod parse → engine → DTO → typed JSON. Proxy additions for `/api/v2/*` gated by session + org perms.
**Verify:** targeted route smoke via dev server (manual) or unit-test route handlers where feasible; `tsc --noEmit` clean; no `as any` in new code (grep).

---

### Task C1-12: Cycle 1 verification gate

1. `npx prisma validate` → PASS.
2. `node --import tsx --test tests/coreResult.test.ts tests/coreErrors.test.ts tests/permissions.test.ts tests/orgSeat.test.ts tests/orgApproval.test.ts tests/coreAudit.test.ts tests/coreIdempotency.test.ts tests/coreSequence.test.ts tests/coreSettings.test.ts` → all PASS (record counts).
3. `npx tsc --noEmit` → 0 errors (no new).
4. Grep new dirs for `as any` → none.
5. Update DEPTH_02 cross-ref note: models/§7 now implemented (C1); record re-spec deltas (level strings vs UserLevel enum mapping; `RoleAssignment` authoritative when present, `User.roleId` kept for fallback).
6. Mark C1 tasks complete in plan; report to user with evidence.

---

## C1 out of scope (later cycles)

Money/GL/finance models, shop-floor models, quality/supply/commercial/people domains, AI copilot SDK, org-chart & approval-chain **UI** (C12), migration of live pilot data (only after cycles that own each domain land and user approves flip).
