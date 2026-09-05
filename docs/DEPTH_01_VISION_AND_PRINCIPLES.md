# DEPTH 01 — Vision, Positioning & Product Principles

**Status:** Authoritative product reference. Companion docs: `DEPTH_02_ORG_MODEL_AND_ROLES`, `DEPTH_04_WORKFLOWS_END_TO_END`, `DEPTH_03_FEATURES_BY_DEPARTMENT`, `DEPTH_05_AI_COPILOTS_LOCAL`, `DEPTH_06_REALWORLD_IMPLEMENTATION`.
**Scope:** What the product is, why a plant replaces its stack for it, and the non-negotiable principles every feature, workflow, and build decision must honor.

---

## 1. The vision in one paragraph

Manufacturing Max is **one app, one install, a plant's entire system** — a single, fully offline platform a plant runs on its own server (accessed by every person and system over the LAN) that replaces the whole software stack: ERP, MES, QMS, finance, HR, maintenance, and engineering change control. It **models the organization's own structure and way of working** — their departments, their role levels, their people holding several responsibilities, their approval flows — instead of forcing the organization to conform to the software's rules. And it embeds a **role-aware AI that works beside every person in their own seat**, suggesting, drafting, and preparing work that the human approves — all powered by **local models sized to the customer's hardware**, because data never leaves the building.

---

## 2. What we are — and what we deliberately are not

| We are | We are not |
|---|---|
| A complete replacement for the ERP+MES+QMS+finance stack of **one plant** | A bolt-on that coexists with SAP/QAD while "complementing" it |
| Fully offline, LAN-only, with data sovereignty as a structural property | A cloud SaaS with an "offline mode" |
| Configurable to the organization's own structure and process | An opinionated ERP the customer must convert their habits to |
| Aero/defense/medical/automotive compliance **with guardrails that cannot be switched off** | A compliance checkbox that admins can configure away |
| One instance = one plant (multi-site = one instance per plant, rollup by export/report) | A federated multi-plant sync product |
| AI that runs on the customer's own hardware | AI that depends on cloud models or phone-home APIs |

**Deployment unit:** one instance serves one plant (a single legal/physical operating unit, optionally a campus). A multi-site company runs one instance per plant. HQ consolidation today = exports and reports from each instance, not live sync (see `DEPTH_06`).

---

## 3. Why a plant replaces its stack — the four load-bearing reasons

Every one of these must survive a skeptical procurement conversation. Together they are the moat. None of them is a slogan; each maps to concrete product behavior defined in this suite.

### 3.1 One source of truth — shop floor to finance, no integration tax
- The same record that logs a good piece on the terminal drives WIP, job cost, inventory, invoicing, and the GL — there is no "MES database" vs "ERP database" reconciliation, because there is one database (`prisma/schema.prisma`, 200+ models, one Postgres).
- Real-time job costing: a `LOG_GOOD`/scrap/downtime event mutates live cost (`src/lib/costingEngine.ts`), so margin is never a month-late surprise.
- Every operational document (PO, GRN, dispatch, invoice, payment) posts to the double-entry GL (`GlAccount/JournalEntry/JournalLine`) with provenance (`GlIntegrityRun`), and money is integer paise end-to-end (`src/lib/money.ts`) — the books always balance.

### 3.2 Compliance automation
- The paperwork that eats aero margins — AS9102 FAI (`FaiReport`), NCR/8D (`NcrReport`, `EightDReport` D1–D8), serial & lot genealogy (`SerialUnit`/`SerialEvent`), data packages (`DataPackage` DRAFT→RELEASED), mill-cert tracking (`MaterialCert`), hold points (`HoldPointSignoff`), calibration (`CalibratedTool`), ECO/ECN where "revisions become law" (`Eco`) — is generated, tracked, and gated by the system, not assembled by hand across Excel and email.
- Supplier and complaint loops (SCAR via 8D, complaint SLA with 24h ack/10-day 8D) are state machines with deadlines, not follow-up reminders in someone's head.

### 3.3 Full offline + data sovereignty
- No internet is required to install, run, back up, update, or be supported. All components — Postgres, the Next standalone server, licensing, backup/restore, update channel — run inside the plant's network (`desktop/launcher.js`, `desktop/electron/main.js`).
- Because data never leaves the LAN, privacy is structural, not a policy. Local-model AI preserves this at the intelligence layer too (see 3.4 and `DEPTH_05`).

### 3.4 Cost + time-to-value, with AI that makes a big system usable
- A fraction of the SAP + QMS + MES stack cost, one installer, one go-live, no big-bang IT project (`DEPTH_06` rollout playbooks).
- The breadth that would normally require training is absorbed by a role-aware local AI that already knows the user's seat, the org structure, and the plant's own data — so a big system does not require big manuals.

---

## 4. Non-negotiable pillars (numbered for citation in later docs)

**Offline & sovereignty**
- **OFF-1** The product must be fully functional with zero internet. No feature may depend on a network call to a vendor/cloud endpoint.
- **OFF-2** Data lives only in the plant's own Postgres; all backups, restores, exports, and updates are LAN/file-based. Egress of business data is never required by design.
- **OFF-3** The launcher and server must survive power loss, disk-full, DB crash, and update failure without corrupting data (watchdogs + integrity checks; see `DEPTH_06`).

**Org-model flexibility**
- **ORG-1** The org's structure is configuration, not code: departments/units, roles with levels, people holding multiple roles, reporting lines, and responsibility flows are modeled and editable by the customer's administrator.
- **ORG-2** Workflows, approvals, terminology, forms/fields, numbering, and status pipelines follow the org's definition of who does what.
- **ORG-3** Nothing an org configures may violate a compliance guardrail (Section 6). Guardrails are law.

**Compliance depth**
- **CMP-1** Aerospace (AS9100/AS9102) is the reference depth; defense (ITAR/DFARS-aware handling), NADCAP special processes, ISO 13485, and IATF 16949 modules layer onto the same core and same traceability thread.
- **CMP-2** Every regulated gate (FAI before full production, evidence before 8D closure, hold-point sign-off, calibration validity, ECO effectivity) is enforced in the engine, not just displayed in the UI.

**AI — local, assist-first**
- **AI-1** All AI runs on local models/engines the customer hosts (or on built-in deterministic engines). Cloud providers are never required; nothing phones home.
- **AI-2** AI assists — it drafts, suggests, prepares, explains — and every consequential action lands as a **human approval with a full audit record**. No autonomous mutations of regulated records.
- **AI-3** AI context is assembled from the org model + the plant's own data (role-aware, seat-aware, scope-aware), not from generic prompts.

**Security & access**
- **SEC-1** Auth is fail-closed in production: every route is gated (JWT `app_session` + per-request `sessionEpoch` re-check + `permissionForPath`/`can()` in `src/proxy.ts`); only an explicit public allowlist (login, onboarding, health, kiosk terminal APIs) is unauthenticated, and kiosk APIs can be LAN-token-gated.
- **SEC-2** Records are append-only where it matters: every mutation can be audited (`AuditLog`), source-record edits require a reason and keep history (`adjustmentHistory`, `src/lib/sourceRecordEdit.ts`), and KPI overrides are visibly badged (`Override`).
- **SEC-3** "Tree of trust": a user can only grant/configure what is a subset of their own authority; the Owner is indestructible (`isOwner`, creator-chain scoping).

**Scale**
- **SCALE-1** Design target: 500+ concurrent users, 1,000+ machines, one plant instance, running on a server-class machine the plant owns.
- **SCALE-2** The installable artifact stays "one installer" as it graduates from shop PC to plant server (`DEPTH_06`).

---

## 5. The market ladder

1. **Aerospace Tier-2/3 (live pilots today)** — AS9100/AS9102, serialization, FAI, NCR/8D, data packages, ECO.
2. **Aerospace Tier-1** — full replacement of SAP+QMS+MES; adds plant-server scale, customer-connect surface (portal/EDI/ASN formats), deeper config mgmt and customer-specific requirements (CSR) handling.
3. **Defense** — controlled/uncontrolled data handling, ITAR/DFARS-aware document and export workflows.
4. **NADCAP special processes** — accreditation tracking for heat treat, NDT, surface finishing, welding; evidence capture against accredited scopes.
5. **Medical (ISO 13485)** — device traceability, DHR-style records, stricter document control and risk files.
6. **Automotive (IATF 16949)** — PPAP, run-at-rate, APQP/FMEA/SPC/MSA core tools.
7. **General discrete job shops (always in scope)** — quoting, production, costing, invoicing, with no certification needed.

Same core product; compliance modules and scale depth layer on. India-first sales motion with live shop pilots, expanding across segments; multi-lingual shop floor (EN/TE/HI) throughout.

---

## 6. Compliance guardrail charter

A guardrail is a rule the organization **cannot configure away**, because it is required by a standard, a law, or the integrity of the business. Guardrails are enforced in engines/routes, not merely recommended in UI.

| # | Guardrail | Where it binds |
|---|---|---|
| G-1 | A work order requiring FAI cannot proceed to full production without an APPROVED FAI report for the part-revision. | WO start gate (`readinessEngine`/workflow), terminal action routes |
| G-2 | A serial/lot unit cannot advance past a hold-point routing step without a `HoldPointSignoff` by an authorized role. | operator action + serial event routes |
| G-3 | An 8D cannot move to CLOSED without D4–D7 evidence recorded (root cause, corrective, preventive, verification). | 8D state machine |
| G-4 | A calibration-expired or expiring instrument cannot be used to record inspection results. | quality inspection routes |
| G-5 | An ECO cannot be IMPLEMENTED without APPROVED state and effectivity defined (date/serial/BOM rev). | ECO engine |
| G-6 | A data package once RELEASED is frozen (no silent edits; changes require a new revision + audit). | data package route |
| G-7 | Production/dispatch/invoice documents cannot be deleted; corrections are reversals/edit-with-reason. | `sourceRecordEdit`, reversal patterns |
| G-8 | Money posts to the GL only through double-entry journal lines that balance (debits = credits, integer paise). | GL posting/integrity engine |
| G-9 | Operator clock-in and machine actions are idempotent (a network retry can never double-log). | `IdempotencyKey` pattern |
| G-10 | Unlicensed operation is impossible: EXPIRED/INVALID license state blocks boot before DB/server start. | `desktop/launcher.js` license gate |

The full list per module lives in `DEPTH_02` (org/roles), `DEPTH_03` (features), and `DEPTH_04` (workflows).

---

## 7. Product principles (decision rules)

1. **One traceability thread.** Piece → batch/serial → WO → routing → FAI → inspection → dispatch → invoice → GL. Features may branch, but they must not fork the thread.
2. **Record, don't delete.** Corrections are edits-with-reason or reversals, always audited; statuses move forward, history stays.
3. **Their org, their words.** Terminology, structure, and process belong to the customer's configuration (see `DEPTH_02`). The app proposes sensible defaults (role catalog, workflow templates) but adopts the org's decisions.
4. **Configurable except guardrails.** Anything not on the guardrail charter is a candidate for configuration; anything on it is enforced.
5. **Offline is the default path, not a mode.** Every screen, route, and engine is written for the offline plant first; there is no separate "online feature set".
6. **AI assists; humans approve; audit remembers.** Drafts and suggestions are cheap to produce and clearly labeled; actions require approval; everything is logged.
7. **Deterministic engines first, AI second.** Costing, capacity, SPC, GL integrity, readiness — the app's rules engines always run and are the source of truth; LLM output never overrides an engine result (it can explain or draft around it).
8. **Every workflow has a failure mode spelled out.** If a spec cannot say what happens on shortage, rejection, dispute, absent approver, or power loss, it is not done (`DEPTH_04`).
9. **The plant server is the product.** Everything that must survive — DB, server, backups, updates, AI — is packaged for a machine the customer owns, operated by people who are not IT specialists (`DEPTH_06`).

---

## 8. Where the codebase stands today vs. this vision (audit snapshot)

The suite's later docs cite exact modules; this is the honest starting position.

**Already real (foundation to build on)**
- One Postgres + Prisma (200+ models) covering shop floor, quality/aero, supply, finance/GL (integer paise, `GlIntegrityRun` provenance), people, maintenance, EHS/lean, risk register, custom entities (`CustomEntity/CustomField/CustomRecord`).
- Offline desktop edition: Electron tray + launcher with embedded Postgres, license gate, watchdogs (server + DB), daily backup/prune/integrity sweeps, control server + GitHub-direct update channel, restore/export (`desktop/launcher.js` and `desktop/lib/*`).
- Auth & RBAC: proxy fail-closed with session rotation, dynamic `Role` (permission-key arrays), creator "tree of trust", `UserLevel` WORKER/MANAGER.
- Org seed work: `src/lib/roleCatalog.ts` (stable role codes, grades TRAINEE→LEAD, perms bundles; grade-gating explicitly backlog), `prisma/seed-rbac.ts`, governance seeds.
- AI plumbing: `src/lib/llmGateway.ts` provider chain (gemini → **local ollama** → groq → built-in "AURA" heuristic engines), `analystEngine.ts`, `/ai/cortex` AURA client with voice.
- Multilingual (EN/TE/HI), operator terminal + offline action queue (`src/lib/offlineSync.ts`), andon, kiosk LAN token gate.

**Gaps vs. the vision (designed in this suite, built later)**
- ~~Org chart: no reporting-line/org-unit model yet; `UserLevel` needs a real level model; multi-role + acting coverage not modeled (design: `DEPTH_02` §7).~~ **Built in C1 (2026-09-05, branch `v2`):** `OrgUnit`/`Level`/`RoleAssignment`/`ReportingLine`/`ApprovalChain`/`ApprovalTask` models + seat/approval engines + `/api/v2/org/*` routes (see `DEPTH_02` §7 status note). Remaining: enforcement of grade-gating and approval routing across domain documents (later cycles).
- Grade-gating and workflow/approval routing from org config not yet enforced (design: `DEPTH_02` §6, `DEPTH_04`).
- Role-aware AI copilot framework (context assembly, tools + human approval, per-seat copilots) exists only as point features (design: `DEPTH_05`).
- Plant-server deployment/scale beyond the single-PC packaging, customer-connect (EDI/portal/ASN/e-invoice IRN), and several commercial-loop items (credit/debit notes, petty cash, supplier portal) (design: `DEPTH_03`, `DEPTH_06`; gap analysis in `HANDOVER.md`/`docs/ORG_GAP_ANALYSIS.md`).

---

## 9. Glossary

- **Seat** — a person's position in the org model: combination of person, department/unit, role(s), level(s), scope(s), and reporting lines. The AI and the RBAC both read "the seat".
- **Role** — a named bundle of responsibilities + permission keys with a level ladder (today: `Role` row with permission-key array; catalog in `roleCatalog.ts`).
- **Level / grade** — vertical rank within a role family (TRAINEE → JUNIOR → SENIOR → LEAD; org-defined beyond the default ladder).
- **Scope** — what a seat can see/do: own records, team, department, plant, all plants.
- **Guardrail** — a configurable-away-impossible compliance rule (Section 6).
- **Traceability thread** — the continuous record from raw material lot/mill cert through production and quality to dispatch and invoice.
- **Instance** — one installed plant system: launcher + embedded Postgres + Next standalone server + local AI gateway.
- **Workspace** — a functional domain in the permission model (ops, supply, commercial, people, system, quality, metrology, engineering, finance, ehs, maintenance, projects, exec, legal, risk, brand, sustainability).
- **Copilot** — the role-aware AI surface in a given seat (see `DEPTH_05`).
- **Deterministic engine** — a rule-based computation in `src/lib` (costing, capacity, SPC, GL integrity, readiness) that is authoritative regardless of AI availability.

---

*Next: `docs/DEPTH_02_ORG_MODEL_AND_ROLES.md` — the configurable organization model.*
