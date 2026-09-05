# DEPTH 05 — AI Copilots (Local, Role-Aware, Assist-First)

**Status:** Authoritative AI architecture & product spec. Companion docs: `DEPTH_01` (AI-1/2/3, principle 7), `DEPTH_02` §10 (seat-context contract), `DEPTH_03` (module touchpoints), `DEPTH_04` (workflow touchpoints).
**Non-negotiables (restated):** AI-1 all computation local/on-prem, nothing phones home · AI-2 assist-first — every consequential action is a human approval with audit · AI-3 context comes from the org model + plant data, not generic prompts · Principle 7: deterministic engines are the source of truth; the LLM explains/drafts around them, never overrides them.

---

## 1. Design stance

The app's intelligence is a **ladder, not a single model**:
1. **Deterministic engines** (`src/lib/*`: costing, capacity, SPC, readiness, GL integrity, compliance digest, SLA, MRP) — always run, authoritative, explainable. These already do the "smart" parts that can't hallucinate.
2. **Structured knowledge services** — org model, seat resolver, permission/scope trimming, audit trail, sequence/idempotency — the plumbing that keeps any AI honest.
3. **Local LLM layer** — adds natural language: drafting, explanation, summarization, triage, multilingual, guided configuration. Quality varies by customer hardware; the product must be *useful* at every tier and *better* at higher tiers — never *broken* at low tiers (graceful degradation is a first-class requirement).
4. **Voice layer** — TTS/ASR local where hardware allows; text-first otherwise (terminal already has sound/voice hooks, EN/TE/HI).

Copilots are therefore **thin, consistent UI shells over one SDK** — every seat gets the same mechanics (context, draft, suggest, explain, approve) with seat-specific capabilities.

---

## 2. Architecture (components)

```
┌─ Client (seat UI: terminal / dashboards / modals) ─────────────────────┐
│  CopilotSurface (chat + inline "AI" affordances per screen)            │
└──────────────┬─────────────────────────────────────────────────────────┘
               │ HTTPS on LAN only (127.0.0.1 / plant server)
┌──────────────▼─────────────────────────────────────────────────────────┐
│  /api/ai/*  (Next server, same auth/authorization as every route)       │
│   • session verify → seat resolution (DEPTH_02 §10) → scope trim       │
│   • capability gate (which copilot tools this seat may invoke)         │
│   • request log (who asked what, model used, latency, cost-token)      │
└──────────────┬─────────────────────────────────────────────────────────┘
┌──────────────▼─────────────────────────────────────────────────────────┐
│  Copilot Core (server-side)                                            │
│   SeatContext assembler · Task router · Prompt builder (static,        │
│   injection-safe) · Tool registry · Draft store · Approval broker      │
│   Fusion layer (calls deterministic engines for numbers, never LLM)    │
└───────┬──────────────────────┬──────────────────────┬──────────────────┘
        │                      │                      │
┌───────▼───────┐   ┌──────────▼─────────┐   ┌────────▼─────────────────┐
│ Local LLM     │   │ Embeddings / RAG   │   │ Engines & Data (read)    │
│ gateway       │   │ (local index over  │   │ Prisma via scoped reads, │
│ (llmGateway   │   │ docs, travelers,   │   │ deterministic engines,   │
│ style chain)  │   │ past 8Ds, SOPs)    │   │ audit/approval services  │
└───────┬───────┘   └────────────────────┘   └────────▲─────────────────┘
        │                                             │
┌───────▼─────────────────────────────────────────────┴─────────────────┐
│ Model providers (all local/on-prem, configurable)                      │
│  Tier A: built-in heuristic engines (no model needed)                  │
│  Tier B: small local model — Ollama (default http://127.0.0.1:11434)   │
│  Tier C: mid local model (14B–32B class, e.g. deepseek-r1:14b default) │
│  Tier D: plant GPU server (vLLM/Ollama, 32B–70B+), embeddings server   │
└─────────────────────────────────────────────────────────────────────────┘
```

**Current state anchors:** `src/lib/llmGateway.ts` already implements the provider chain concept (gemini → ollama → groq → heuristic "AURA Industrial Knowledge Core"); `analystEngine.ts` does natural-language→SQL-ish Q&A with guardrails; `/ai/cortex` AURA client + voice exist as the surface precursor. This spec generalizes those into the full copilot system; cloud providers (gemini/groq) remain *available for orgs that opt in*, but the shipped default is Tier A/B and nothing requires them (AI-1).

---

## 3. Hardware-tiered model support & sizing

| Tier | Typical hardware | Default model class | What copilots can do |
|---|---|---|---|
| A — Engine-only | any shop PC (even no GPU) | none (heuristics + templates) | Structured suggestions, generated-from-data drafts (8D skeletons, defect narratives), multilingual phrasebank, digests. No free-text LLM. |
| B — Small local | office PC / plant server, 8–16GB RAM | ≤8B quantized (Ollama) | Q&A over scoped data, drafting assist, translation quality for floor terms |
| C — Mid local | plant server, 16–32GB RAM / modest GPU | 14B–32B (e.g., `deepseek-r1:14b` default) | Full drafting (8D D-sections, ECO impacts), summarization of digests/audits, guided config |
| D — GPU server | dedicated GPU box (plant owns) | 32B–70B+ + embeddings server | Best drafting/analysis quality, local embeddings for RAG, voice ASR on-device |

Rules:
- **One config**: model endpoint(s) are admin-set (`Setting` or env) with health check at boot (control server pings the endpoint; offline/unreachable → automatic Tier-A fallback with a visible "assisted by built-in engine" label).
- **Per-task routing**: task registry declares a minimum tier (e.g., "explain GL anomaly" = B, "draft 8D D4 hypotheses" = C, "natural-language org builder" = C/D). If the current tier is below minimum, the surface offers the structured (non-LLM) experience instead.
- **Never block work**: no core workflow (DEPTH_04) waits on an LLM. Drafts are advisory, generated in parallel or on demand.
- **OpenAI-compatible contract**: Ollama/vLLM/LM Studio all speak it; the gateway uses baseUrl+model+timeouts, request logged.

---

## 4. Seat context & scope (the AI-3 contract)

Server-side `seatContext(user, unit, action)` (DEPTH_02 §10) produces, once per request:
- identity + employeeNumber + preferred language (EN/TE/HI) + terminal context;
- active seats with unit paths, role codes, level, scope, `actsFor` (acting coverage);
- effective permission set **after scope trim** — used both for what data is offered to the model *and* what tools may be invoked;
- reporting chain (manager/direct reports/deputies) for "who should approve";
- workload snapshot: open approvals, due documents, my queue, plant tz/shifts.

**Prompt hygiene rules**
- System prompt is static text per copilot + seat facts injected as data (JSON), never raw concatenation of user input.
- Data offered to the model is pre-trimmed by scope; the model never receives a query string to the DB (analyst pattern: engine builds the query from intent + allowed schema, dry-runs it read-only, caps rows).
- Every response renders with "draft"/"suggestion"/"explanation" framing, and — when it references records — inline citations to entity/route.

---

## 5. Tools, drafts & the human-approval loop (AI-2)

**Tool registry** (all read-only unless approval):
- *Read tools:* `summarizeRecord`, `lookupMaterial/Part/Customer`, `genealogyTrace(serial)`, `readinessExplain(wo)`, `integrityExplain`, `digest(scope, since)` — authorized by effective perms + scope.
- *Draft tools (no mutation):* `draft8D(section)`, `draftNcr`, `draftEcoImpact`, `draftChallanNote`, `draftCreditNoteReason`, `draftComplaintReply`, `draftRequisition`, `draftAdjustmentRationale`, `draftIncidentNarrative`, `draftPolicyAnswer`.
- *Action tools (mutation — ALWAYS via approval broker):* `prepareApproval(doc, nextState, note)` — creates the same `ApprovalTask` a human click would; `queueNotification(seats, msg)`; `proposeOverride(kpi, value, reason)` (needs `kpi.override` + manager level + reason); `proposeRecordEdit(entity, id, change, reason)` (needs `records.edit` + reason — identical path to `sourceRecordEdit`).

**Approval broker guarantees**
1. An AI-proposed action produces the exact same `AuditLog`/`ApprovalTask`/idempotency treatment as a manual one; the audit records `initiator: AI (model, requestId)` + `approver: <seat>`.
2. No AI action can exceed the seat's effective permissions or scope — the broker enforces `can()` like every route.
3. Rejected proposals are logged (`AI_PROPOSAL_REJECTED`) and become cheap feedback signals (do not propose the same thing twice for the same doc).
4. Bulk/self-serving actions (e.g., proposing your own override approval) are structurally blocked by the same tree-of-trust + separation rules humans obey.
5. If the plant is on Tier A (no LLM), the same surfaces offer **template drafts generated from data** — the approval loop still exists, just no generative step.

---

## 6. Per-seat copilot specs

### 6.1 Setup / Configuration copilot (day-one seat: owner/admin)
Capabilities: guided onboarding in natural language ("we run 2 shifts, buyers approve above ₹25k, and we call quotations job estimates") → writes the org model/approval chain/terminology **as structured proposals the admin approves**; explains what a change would affect (routes, roles, reports); can compare "sample org" vs "empty" starts and propose role assignments from job titles; drafts policy answers from settings. Guardrail awareness: it states when a request would violate a guardrail (G-1…G-10) and refuses to configure it away, offering the compliant alternative.
Tier floor: A (structured wizard) / C (natural-language). Success metric: fresh-install → first WO logged without an admin course.

### 6.2 Operator Terminal copilot (seat: floor user, EN/TE/HI, touch/voice)
Capabilities: next-action prompting from machine+WO state ("This WO isn't ready: milling cert for the issued lot is missing — show the storekeeper"); explains readiness/hold reasons in plain words; on scrap, suggests likely defect codes from machine history and drafts the quarantine note; on downtime, suggests category/reason and drafts the maintenance call; shift-count explainer when a dispute triggers; tool-wear and cal-due heads-ups; multilingual phrasebank always available (Tier A), full voice Q&A on Tier C/D.
Constraints: 48px touch-first, ≤2s perceived latency, offline-queue safe (suggestions never assume a live model).

### 6.3 Quality / Compliance copilot (seats: QC engineer, MRB, FAI engineer, QA manager)
Capabilities: 8D drafting per section with the evidence checklist enforced *before* D8 (G-3 — the copilot cannot submit D8 without D4–D7 content; it says what's missing); FAI prep (groups characteristics, flags at-risk from past deviations, drafts deviation justifications); NCR triage brief (history of part/defect/supplier, similar past dispositions — never the verdict); SCAR composition to suppliers; data-package completeness list; complaint-reply drafts within SLA clock. All drafts editable and signed by the owning engineer.
Tier floor: B/C. Success metric: engineer time per 8D and per data package halved, closure evidence never missing.

### 6.4 Finance copilot (seats: accounts, finance head, treasury)
Capabilities: explain anomalies from integrity scans (`GlIntegrityRun`) and aging ("why did receivables jump 12%?"); draft adjustment narrative (with balanced-paise reasoning from engines — the LLM never computes money); bank-recon discrepancy hypotheses; month-end commentary from integrity results; risk-register review drafting; answer "is this document posted to GL and by what?" with provenance. Money numbers always come from `money.ts`/engines, never generated.
Tier floor: B. Success metric: month-end close days reduced; integrity explanations reduce finance tickets.

### 6.5 Manager / Exec digest copilot (seats: dept heads, plant head)
Capabilities: overnight digest in the manager's language/scope — what changed, what breached, what needs a decision, who's holding approvals (from `ApprovalTask` workload); one-tap approve from the digest (same approval path); risk digest + MRM agenda drafting; program-health and SLA narration.
Tier floor: A (structured) / B (narrative). Success metric: exec reads digest in <5 min and acts from it.

### 6.6 Cross-seat "shift mentor" (optional, later)
A read-only assistant that observes a unit's day and, at shift end, proposes the supervisor's handover narrative from logs — audited, editable, purely drafting.

---

## 7. RAG over the plant's own data

- **What gets indexed (local):** revision-controlled documents/drawings metadata + text layers where extractable, SOPs, travelers, released data-package summaries, past 8D/NCR narratives, ECO histories, supplier communications, org config (units/roles/approval chains). Files already live in DB (`Document.fileData Bytes`) so the index is built by a local job, no egress.
- **Embeddings:** on Tier D a local embedding server; Tier B/C use keyword + deterministic record lookups first and only embed small corpora (or skip embeddings entirely — RAG is an enhancement, not a requirement for correctness).
- **Grounding discipline:** retrieval results are cited; when the corpus has no answer the copilot says so and offers the closest *record* links — it does not invent policy. Policy answers default to the org's configured settings/terminology first.
- **Freshness:** index rebuilds after document/ECO/data-package changes (hook or nightly sweep in the launcher, LAN-local).

---

## 8. Deterministic fusion (principle 7, enforced)

- Any number a user sees from a copilot (cost, margin, OEE, balances, aging, SLA remaining) is fetched from the engine output, not from the model text. The model may *phrase* it; the number is substituted from the engine result into the draft (template slots).
- If an engine and a model disagree, the engine wins and the copilot says so ("system shows X; the draft above reflects X").
- Analyst Q&A (`analystEngine`) remains query-built-by-engine, read-only, row-capped, audit-logged — never raw LLM SQL.

---

## 9. Privacy, security & audit

- All AI traffic stays on the LAN (loopback for the model gateway by default; plant server config). No provider keys required for Tier A/B. Tier C/D endpoints are the customer's own.
- Request logging: seat, copilot, model tier, latency, token counts, approval outcomes — visible to `audit.view` holders. Draft store retains proposal→approval→record linkage.
- Model endpoints are validated at boot + health page (`/system/health` shows AI tier, model, reachable/fallback state).
- If a customer later opts into a cloud provider (explicit setting), a banner + audit marks AI traffic egress; the product default and offline promise never depend on it.

---

## 10. Performance budgets & evaluation

- Latency targets: terminal inline suggestions ≤2s p95; chat ≤8s p95 at Tier C on the plant server; digests generated off the interaction path.
- Concurrency: the gateway serializes/queues per-plant requests with a small worker pool (configurable); floor actions never queue behind AI work (deterministic engines run first, AI in parallel/async where possible).
- Evaluations are offline-run scripts (fits this repo's test culture): golden sets per copilot (e.g., 20 complaint→8D drafts checked for D-order + evidence presence; 30 seat-context prompts checked for scope leakage; 20 finance explanations checked against engine numbers). Regression tests assert guardrail compliance (e.g., proposal for 8D D8 without D4–D7 must be refused) — deterministic, no network.
- Multilingual QA: EN/TE/HI phrasebanks + model prompt templates verified per language at Tier B/C.

---

## 11. Build roadmap (wedge-ordered, ~90-day compatible)

1. **Copilot Core SDK** (seat context resolver endpoint, draft store, approval broker, tool registry, logging) — foundation everything else uses.
2. **Setup/configuration copilot + org-model admin UI** (ties to DEPTH_02 §7 build).
3. **Operator terminal copilot** (structured suggestions first — works at Tier A immediately).
4. **Quality copilot (8D/NCR/FAI)** with guardrail refusal tests.
5. **Finance anomaly explainer + digest copilot.**
6. **Local RAG job + embeddings tier (D).**
Each step ships with its evaluation scripts and never blocks the deterministic path.

---

*Next: `docs/DEPTH_06_REALWORLD_IMPLEMENTATION.md` — deployment topologies, sizing, resilience, go-live and support.*
