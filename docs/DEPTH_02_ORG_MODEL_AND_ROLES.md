# DEPTH 02 — Org Model & Roles

**Status:** Authoritative design reference. Companion docs: `DEPTH_01_VISION_AND_PRINCIPLES`, `DEPTH_04_WORKFLOWS_END_TO_END` (approval flows), `DEPTH_05_AI_COPILOTS_LOCAL` (how AI reads org context).
**One-line thesis:** *The organization is configuration, not code. One job-shop hires five managers for one function; another has one person covering three; both must be able to express themselves — and the app's permissions, approvals, workflows, visibility, and AI must then behave as that org behaves.*

---

## 1. What exists today (accurate baseline, 2026-09)

| Concern | Current implementation | Notes |
|---|---|---|
| User | `User` (schema 454): name, username/email, **employeeNumber** (badge login), passwordHash, `mustChangePassword`, **sessionEpoch** (session rotation), `roleId → Role`, `createdById` (creator chain), **isOwner**, **level: UserLevel** (WORKER \| MANAGER), `homePlantId`, `prefs Json`, isActive | One role per user today; `isOwner` is a hard root; level gates "My queues" vs "Approvals + team KPIs + budget" |
| Role | `Role` (schema 545): name unique, **permissions String[]** (permission keys), isSystem | Dynamic — orgs can name their own roles and pick keys; no level/grade column |
| Permission catalog | `src/lib/permissions.ts`: workspace keys `<ws>.view/.edit`, department approve keys `<ws>.approve`, special keys (users.manage, terminal.use, reports.print, records.edit, kpi.override, audit.view) | Route→permission mapping in `src/lib/departments.ts` (`permissionForPath`) |
| Levels | `UserLevel` enum WORKER/MANAGER; **grades** TRAINEE/JUNIOR/SENIOR/LEAD exist in `roleCatalog.ts` but are not yet enforced ("junior drafts, senior approves falls out of grades once grade-gating lands" — backlog T2-1/T3-3) | Grade-gating is a designed-but-unbuilt capability |
| Role catalog | `roleCatalog.ts`: stable codes (EXEC-OWNER, …), department/workspace, discipline, optional grade ladder, permission bundles; seeded via `seed-rbac.ts`/governance seeds | Org-facing "role templates" |
| Departments | No `Department` DB model. Departments/workspaces are code concepts in `departments.ts` (nav + route mapping); `activeDepartments` Setting toggles which modules a plant uses | Gap: departments should become org-configurable units |
| Employee/HR | `Employee` (schema 4780) joined by employeeNumber; designation/department as free strings | HR facts live here; org-chart links missing |
| Org chart | **None** — no reporting lines, no org-unit tree, no deputy/acting coverage anywhere in schema | Core design gap this doc fills |
| Custom entities | `CustomEntity/CustomField/CustomRecord` (schema 4552) — org-defined record types with typed fields | Extension pattern for "everything else the org tracks" |
| Scoping | Multi-plant scoping (`src/lib/plantScope.ts`, settings) works per-user/request; records carry plantId | Kept per instance; see DEPTH_01 §2 |

**Design consequence:** the building blocks (dynamic roles, permission keys, creator tree-of-trust, catalog templates, custom entities) exist. What is missing is the *structure* layer: an org-unit tree, reporting lines, multi-role assignment, level enforcement, delegation/acting coverage, and approval routing driven by that structure.

---

## 2. Target org model — conceptual diagram

```
Instance (one plant / campus)
└── OrgUnit tree (root = the company/plant; unlimited nesting)
      • unit types: DIVISION, DEPARTMENT, CELL, TEAM, FUNCTION, PROJECT-ROOM
      • a unit carries: name, code, type, parent, head seat(s), cost-center link, active flag
      • a person (Employee↔User) sits in units as a "member"
└── Seats (a person's assignments inside the org)
      • Seat = Employee + OrgUnit + RoleAssignment(s)
      • RoleAssignment = Role + Level + Scope + validFrom/validTo + status(ACTIVE/LEAVE/ACTING/EXITED)
      • one person may hold several RoleAssignments in one or several units (the "one person does 3 jobs" case)
└── Reporting lines (who answers to whom)
      • Manager link per seat (or per unit head), with validFrom/validTo
      • drives: approval escalation, delegation, acting coverage, visibility windows, AI context
└── Approval chains (defined per document type by org admin)
      • template: [role/level criteria] → approver seat(s) → next
      • resolved at runtime against the live org chart (e.g., "the head of the WO's plant quality unit", not a frozen name)
```

**Nothing about this changes the permission-key engine.** Permission keys remain the atomic rights (`ops.edit`, `finance.approve`, …). The org model decides **who holds which keys**, **at what level**, **over what scope**, and **for how long** — and RBAC checks keep using `can(user, key)` after the proxy resolves the seat.

---

## 3. Seat semantics (the unit both RBAC and AI read)

A **seat** is the answer to "who is this user right now, in this unit, doing this job, at what level, with what scope?" Every authenticated request resolves one or more active seats and collapses them into:

- **Effective permissions** = union of permission keys across the user's active role assignments (respecting scope).
- **Effective level** = the highest level across assignments in the current unit context (for grade-gated actions).
- **Effective scope** = intersection logic per workspace: own → team → unit → department → plant (org-configurable; default ladder).
- **Home seat** = the seat used for default routing, digest, leaderboard, and AI persona.

**Levels and grades.** The default level ladder comes from the catalog — `TRAINEE < JUNIOR < SENIOR < LEAD` — plus org-defined levels above (e.g., `MANAGER`, `GM`, `PLANT_HEAD`, `DIRECTOR`), and existing `UserLevel` (WORKER/MANAGER) maps onto the ladder as sensible defaults (WORKER ≈ TRAINEE–SENIOR operator bands; MANAGER ≈ LEAD and above). Rule: a seat may only *approve/override* at its own level or below; grade-gating ("junior drafts, senior approves") compares the actor's level to the record's required level.

**Scope.** Where a permission key alone says "can you see quality records", scope says *which* records: `self` (only own logs), `team` (own + assigned machine group/shift mates), `unit` (the department/cell they sit in), `plant` (whole instance), or `all` (owner). Defaults are seeded with the role catalog; the org admin can tighten or loosen per assignment.

---

## 4. What the org can configure — and what it cannot

### 4.1 Configurable (by admin with `users.manage` + org-edit rights, fully audited)

| Surface | Examples |
|---|---|
| Unit tree | create/rename departments, cells, teams; move people; activate/deactivate units |
| Role definitions | new role names + permission bundles (reusing catalog keys); clone catalog roles; edit descriptions |
| Levels | org-defined level names and ordering within a role family |
| Assignments | one person in many roles/units; start/end dates; transfer |
| Reporting lines | manager per seat/unit; org chart display |
| Approval chains | per document type: who approves (by role/level/unit), fallback + escalation rules |
| Terminology | module/status/field labels (e.g., "Quotation"→"Job Estimate"), company-specific naming; numbering prefixes |
| Fields & statuses | extend records with org fields (`CustomField`), extra statuses/stages where guardrails permit |
| Custom entities | org-defined record types for anything not modeled (`CustomEntity/CustomRecord`) |
| Delegation & coverage | deputies, acting assignments, absence handover (Section 5) |

### 4.2 Not configurable (guardrails — see DEPTH_01 §6)

- FAI-before-production gate, hold-point sign-off requirement, 8D closure evidence, calibration validity gate, ECO approval+effectivity before implementation, frozen released data packages, no-delete on production/finance records, balanced double-entry GL, idempotent shop-floor actions, license gate, owner indestructibility, session rotation on permission change.
- Org admin may decide **who** holds quality authority, never **whether** quality authority exists for a gate that a standard mandates.

---

## 5. Delegation, acting coverage, and absences

Because real plants run shifts, leave, and vacancies, authority must be able to move without breaking the audit chain.

- **Deputy link**: a seat may declare a deputy (peer or higher level) who can act in the seat's approval/visibility role while the seat is unavailable.
- **Acting assignment**: admin assigns `ACTING` RoleAssignment (e.g., "Storekeeper on leave, Ramesh acts for 3 days") with validFrom/validTo and an optional link to the covered seat. Acting grants the covered role's permissions *for the window*, logged as `ACTING_GRANT`/`ACTING_REVOKE` audit events.
- **Absence handover**: when a person is marked on leave/exit, outstanding approvals route per the org's fallback chain (next manager up, then unit head, then plant head), each hop audited (`APPROVAL_ESCALATED`).
- **Audit rule**: every approval/override records the **acting** actor + the **covered** seat when different. Nothing is ever "approved by nobody".

---

## 6. Approval chains — defined in org config, enforced at runtime

Approval chains are **templates resolved against the live org chart**, not frozen name lists.

```
APPROVAL-CHAIN (per document type, org-editable)
  step: { gate: GATE, approvers: [ {criteria: role/level/scope} ], minApprovals: n,
          fallback: { escalateUp: nLevels | routeToUnitHead: unit-of | routeToSeat: X },
          timeoutHours: h  →  auto-escalate + digest alert }
```

Example chains (defaults seeded, org-adjustable):

| Document | Chain (default) | Guardrail-bound? |
|---|---|---|
| Quotation margin < min% | creator's commercial head | no (org rule) |
| PO above ₹X | buyer → dept head ($$ tier by org config) | no |
| Supplier master new | buyer → dept head → finance (bank/credit) | no |
| NCR disposition USE_AS_IS / REWORK | quality engineer → customer-approved MRB seat if contractually required | yes (if customer-approval required, cannot route around it) |
| FAI approval | quality engineer + engineering (org config; can require customer rep) | yes (must exist) |
| 8D closure | quality manager (evidence must exist first — G-3) | yes |
| ECO implementation | engineering lead → quality manager → plant head (org config) | yes (must be APPROVED + effectivity set) |
| Leave/overtime | applicant's reporting manager → (HR for > n days / statutory) | no |
| Risk register review | risk owner → (auto due-date cadence) | yes (review cadence) |

At runtime, approval routes through the **current** holder of the criteria (so re-orgs don't break pending documents) and each hop is audited with the document state machine advanced only on approval.

---

## 7. Target schema extension

> **C1 implementation status (2026-09-05):** the six models below are **implemented** in `prisma/schema.prisma` on branch `v2` (appended before `CustomRecord`, relations on `User`/`Role`/`OrgUnit` added, `prisma validate` 🚀). Typed engines live in `src/lib/org/` (`seat.ts`, `approval.ts`, `seatContext.ts`, `permissions.ts`, `orgConstants.ts`) and CRUD routes under `src/app/api/v2/org/{units,roles,assignments,approval-chains,levels}` plus `src/app/api/v2/me`; global `Level` ladder + root `OrgUnit` + default `ApprovalChain`s are seeded by `prisma/seed-v2.ts`. Recorded re-spec deltas vs this section:
> - `OrgUnit.headSeatId` → **`headUserId`** (references `User` directly; seat = user's active assignment). `plantId` dropped (single-plant-per-instance product decision).
> - `Level.family` stays nullable (`null` = global ladder) — routes use `findFirst`-then-update/create instead of `upsert`, because Prisma's compound-unique `where` input rejects `null`.
> - `RoleAssignment` is authoritative for a user's seats when present; `User.roleId`/`UserLevel` are kept as v1 fallback until later cycles migrate off them.
> - `ReportingLine`/`ApprovalChain`/`ApprovalTask` implemented as designed below (approval-request **lifecycle engine** is a later cycle; schema + resolver are in).

```prisma
model OrgUnit {
  id          String   @id @default(cuid())
  code        String   // stable, e.g. DEPT-QC
  name        String
  type        String   // DIVISION | DEPARTMENT | CELL | TEAM | FUNCTION
  parentId    String?  // org tree
  parent      OrgUnit? @relation("OrgTree", fields: [parentId], references: [id])
  children    OrgUnit[] @relation("OrgTree")
  headSeatId  String?  // current unit head (may change on re-org)
  costCenter  String?
  isActive    Boolean  @default(true)
  plantId     String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Level {
  id        String @id @default(cuid())
  name      String // TRAINEE..LEAD..org-defined
  rank      Int    // ordering within the ladder
  family    String? // role family this level belongs to (null = global ladder)
}

model RoleAssignment {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  orgUnitId    String
  orgUnit      OrgUnit  @relation(fields: [orgUnitId], references: [id])
  roleId       String   // Role (permission bundle)
  levelName    String   // resolved level in the role family
  scope        String   // SELF | TEAM | UNIT | PLANT | ALL
  validFrom    DateTime @default(now())
  validTo      DateTime?
  status       String   // ACTIVE | ACTING | SUSPENDED | EXITED
  actsForUserId String? // if ACTING — the covered seat's user
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@index([userId, status])
  @@index([orgUnitId, status])
}

model ReportingLine {
  id          String   @id @default(cuid())
  managerUserId String
  reportUserId  String
  orgUnitId    String?  // scope of the line (unit tree node)
  validFrom    DateTime @default(now())
  validTo      DateTime?
  createdAt    DateTime @default(now())
  @@index([reportUserId])
  @@index([managerUserId])
}

model ApprovalChain {
  id        String   @id @default(cuid())
  entityType String   // WO | PO | GRN | NCR | FAI | 8D | ECO | LEAVE | OT | RISK ...
  name      String
  steps     Json     // ordered step template (criteria/min/fallback/timeout)
  isActive  Boolean  @default(true)
  createdBy String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ApprovalTask {          // runtime instance of a chain step on a document
  id          String   @id @default(cuid())
  entityType  String
  entityId    String
  stepIndex   Int
  status      String   // PENDING | APPROVED | REJECTED | ESCALATED | SUPERSEDED
  assignedToUserId String?
  criteriaSnapshot Json // what resolved (role/level/unit) when routed
  decidedAt   DateTime?
  decidedByUserId String?
  note        String?
  createdAt   DateTime @default(now())
  @@index([entityType, entityId])
  @@index([assignedToUserId, status])
}
```

Migration path: additive — `User.roleId` stays as the *home* role for backward compatibility and kiosk/fallback auth; new `RoleAssignment` rows become authoritative when present. `Employee.department/designation` strings get backfilled from the unit tree. Grade-gating reads `Level.rank` vs the record's required level. Org-chart UI, approval-chain builder UI, and acting-coverage UI are future builds on these models.

---

## 8. Permission catalog (authoritative key families)

From `src/lib/permissions.ts` (do not drift): workspace keys `<ws>.view/.edit` for ops, supply, commercial, people, system, quality, metrology, engineering, finance, ehs, maintenance, projects, exec, legal, risk, brand, sustainability; department approve keys `<ws>.approve`; special keys `users.manage`, `terminal.use`, `reports.print`, `records.edit`, `kpi.override`, `audit.view`. `permissionForPath` (in `departments.ts`) is the single route→key map. **Org-created roles may only ever reference keys that exist** (validated at role save), keeping "tree of trust" sound and audit grep-able.

---

## 9. Worked examples — two orgs, one model

### 9.1 40-person job shop (5 managers for one function)
- Units: Plant root → { Sales, Planning(PPC), Shopfloor, Quality, Maintenance, Purchase, Accounts, Admin }.
- Seats: 4 owners as exec seats; 3 planners (all level SENIOR, same role); 12 operators across 2 shifts each with a Shift role assignment + operator assignment on machines; Ravi = **three roles**: Production Operator (shift A), First-Aid/EHS warden (ACTING 3-month), and Internal Auditor (quarterly) — all active simultaneously.
- Reporting: shopfloor operators → shift leads → plant head (one of the owners).
- Config: quotation module labeled "Job Estimate"; WO numbering `JO-<plant>-<seq>`; PO approval > ₹25k → purchase head, > ₹1L → owner.
- Behavior: Ravi clocks in via terminal (employeeNumber), gets operator seat for machine logging; when he opens EHS screen he sees warden scope only; audit shows him acting under three distinct seats.

### 9.2 400-person Tier-1 aero (5 managers × 80 people, layered quality org)
- Units: Division Aero → { Engineering, Quality (→ Metrology Lab, MRB, FAI Cell, Cal Lab), Planning, Operations (→ Cell A/B/C), Supply Chain, Finance, HR, EHS, IT }.
- Seats: engineers at TRAINEE→LEAD by discipline; each department head is LEAD of their family + MANAGER level; quality manager holds `quality.approve` + `records.edit` scope=PLANT; FAI engineers scope=FAI Cell.
- Reporting: FAI engineer → FAI cell head → Quality dept head → Plant head (GM).
- Config: customer-specific requirements (CSR) matrix per customer; approval chains for ECO require engineering lead → quality manager → GM (aero default); acting coverage when the QA manager travels (deputy = MRB head, audited).
- Behavior: an engineer's ECO draft only *submits*; approval escalates per chain; a FAI report with a rejected characteristic cannot be approved by the engineer who signed the measurements (separation of duties rule available in chain config).

Both orgs use the same permission keys and the same workflow engines — only the org-model configuration differs. That is the definition of "melts into their way".

---

## 10. How the AI reads the org model (interface contract for DEPTH_05)

Every copilot request carries a **seat context bundle** assembled by one shared resolver:

```
seatContext(user, currentUnit?, action?) → {
  identity: { name, employeeNumber },
  seats: [{ unitPath, roleCode, level, scope, status, actsFor }],
  effectivePerms: [...], effectiveLevel, effectiveScope,
  reporting: { manager, directReports, deputies },
  plant: { id, tz, activeShifts },
  workload: { openApprovals, dueDocuments, myQueue }
}
```

Rules: the bundle is computed server-side from the org model (never client-supplied); scope trimming happens before any data is offered to the model; the AI may draft/suggest within scope but every tool call that mutates is routed to the same authorization + approval + audit path a human click would take (AI-2). Multilingual: the seat's language preference (EN/TE/HI) and the terminal's language are part of the bundle.

---

*Next: `docs/DEPTH_04_WORKFLOWS_END_TO_END.md` — every core workflow as a state machine with actors, exceptions, offline behavior, and AI touchpoints.*
