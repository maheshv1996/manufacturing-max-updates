# DEPTH 06 — Real-World Implementation

**Status:** Authoritative deployment & operations reference. Companion docs: `DEPTH_01` (OFF-1..3, SCALE-1/2), `DEPTH_02` (org), `DEPTH_03/04` (feature/workflow surfaces), `DEPTH_05` (AI tiers).
**One-line thesis:** *The plant server is the product* — everything that must survive (DB, server, backups, updates, AI, licensing) is packaged for a machine the customer owns and operated by people who are not IT specialists, with zero internet dependency (OFF-1/2/3).

Current state (accurate 2026-09): offline desktop edition ships as a Windows NSIS installer (`ManufacturingMax-Setup-<v>.exe`) running Electron tray + pure-Node launcher that orchestrates embedded Postgres (`pgbin` via `@embedded-postgres`), the Next.js standalone server (`server.js`), license gate, watchdogs, daily 20:00 backup (keep 30), 02:15 idempotency prune, 02:30 GL-integrity sweep, local control server (port 41841) for update + admin endpoints, and GitHub-direct update channel with an "Update from File…" fallback. See `docs/OFFLINE_EDITION.md`, `docs/DEPLOY_PLAYBOOK.md`, `docs/RELEASE_CHECKLIST.md`, `docs/FRESH_INSTALL_CHECKLIST.md`.

---

## 1. Deployment topologies

| Topology | Hardware | When | Data location |
|---|---|---|---|
| **Dev / demo** | laptop | building, demos | `file:` or local Postgres; `npm run dev` |
| **Shop PC (v1 live)** | a normal Windows PC at the plant | pilot shops today | `%USERPROFILE%\MfgMaxData` (configurable `MFGMAX_DATA_DIR`) |
| **Plant server (target)** | server-class Windows (or Linux VM) the plant owns, LAN | Tier-2/3 growth; Tier-1 (500+ users) | same `MfgMaxData` layout on server disk + NAS backup target |

Rules:
- **One installer** at every size (SCALE-2): same artifact on the shop PC and the plant server; only hardware and config differ. No cloud control plane anywhere.
- **Clients are browsers/tablets on the LAN** → the plant server (or shop PC) `http://<server>:3000`; kiosk tablets and andon TVs on the LAN; Electron tray (when present) is the operator console on the server machine itself.
- **Plant boundary:** every component binds to LAN/loopback; the update channel checks GitHub only when the org runs the check (never required); license validation is offline-first (grace-tolerant), online re-verify advisory only.

---

## 2. Sizing tables

### 2.1 Plant server (business workload)

| Class | Users (concurrent) | Machines | vCPU | RAM | Disk (data) | Notes |
|---|---|---|---|---|---|---|
| Pilot shop | ≤50 | ≤50 | 2–4 | 8 GB | 100 GB SSD | current embedded-Postgres shop-PC profile |
| Growing plant | 50–150 | ≤300 | 4–8 | 16 GB | 250 GB SSD | standard plant server |
| Large plant (Tier-1 target) | 150–500+ | ≤1,000+ | 8–16 | 32 GB+ | 1 TB SSD/RAID + NAS | pool sizing (`DB_POOL_MAX`), archiving, nightly backup to NAS/USB |

Postgres tuning knobs already plumbed: `DB_POOL_MAX` (default 20 → raise with users), connection timeouts, daily maintenance windows; server runs `NODE_ENV=production` standalone behind the launcher. Scale levers for 500+: (a) connection pooling headroom + read replicas are NOT in scope — single primary with tuned pool; (b) index/query discipline on hot tables (`ProductionLog`, `AuditLog`, `InventoryTransaction`, `IdempotencyKey`) with prune/archive jobs; (c) `AuditLog`/notification archival beyond retention; (d) separate OS user + service account for the server; (e) optional Linux deploy of the same standalone (containerizable — `Dockerfile` exists) for plants with Linux IT.

### 2.2 AI model tier (DEPTH_05 §3) — same machine or dedicated

| Tier | RAM/GPU | Typical use |
|---|---|---|
| A | none | built-in engines only (always available) |
| B | 8–16 GB | small model Q&A |
| C | 16–32 GB / modest GPU | full drafting copilots (default plant server) |
| D | dedicated GPU box | best quality + embeddings + ASR |

---

## 3. Offline resilience guarantees (OFF-3)

| Event | Behavior (guarantee) | Mechanism (current + target) |
|---|---|---|
| Server crash/restart | auto-restart ≤5s, ≤3 tries then alert | `Watchdog` (server) in launcher |
| Postgres dies | TCP watchdog restarts cluster within seconds | `startDbWatchdog`; DB watchdog in launcher |
| Power loss mid-write | Postgres crash recovery; no partial financial docs | ACID + `$transaction` + idempotency keys (G-9) |
| Disk full | backup/restore/export fail loudly with clear message; logs rotate | vault + logging dirs; alert surfaces in tray/health |
| LAN blip on tablets | actions queue and replay idempotently | `offlineSync.ts` + `X-Client-ID` + `IdempotencyKey` prune (02:15) |
| Update interrupted | installer preserves `MfgMaxData`; app boots previous build until rerun | NSIS + standalone swap + stale-build SW guard in Electron main |
| Restore of bad backup | physical/logical restore stops server, swaps, restarts; failure rolls back to previous state and server is restarted anyway | `restoreFrom` in launcher (both pg_dump `-Fc` and pgdata paths) |
| Hardware change | license re-evaluation enters grace window (14 days) rather than bricking | `license.js` fingerprint + activation-state file |
| Unlicensed/expired | boot blocked before DB/server start | `licenseStartError` gate in Electron main + CLI |

Drills: the physical-restore drill and the walk-operator drill are codified in `docs/REALWORLD_PILOT.md`; a `RestoreDrill` record type exists to log drill outcomes — run it at every go-live.

---

## 4. Install, upgrade, backup & disaster

- **Fresh install:** one `.exe` → data dir created → embedded cluster initialized (`initCluster`) → first-run data applied (`applyInitialData` via schema.sql + seedbuild for embedded Postgres; `migrate deploy` + `seedIfEmpty` otherwise) → onboarding wizard (anonymous first-run) → license (grace on first run). Checklist: `docs/FRESH_INSTALL_CHECKLIST.md`.
- **Upgrade:** installer preserves data folder → migrations run on next boot (`runMigrations`) → version-stamped SW-cache clear → health verifies server+db. GitHub-direct update check + "Update from File…" for air-gapped. Release pipeline: `scripts/release-gate.ps1` → `build_and_deploy.ps1` / `npm run dist` → `scripts/publish-release.ps1`; smoke checks `scripts/smoke-install.ps1`, `scripts/smoke-update.mjs`; build verification `scripts/verify-build.js` + launcher's own `verifyBuild`.
- **Backups:** auto 20:00 daily (logical `pg_dump -Fc` preferred; physical pgdata copy fallback), keep last 30, to `backups/` under the data dir; tray "Backup Now"; schedule survives restarts; export to pendrive/NAS via vault (`exportToDrive`); restore from tray file-picker (logical or physical) with server restart after.
- **Disaster:** restore drill per REALWORLD_PILOT §2 on a test PC proves recoverability before production trust; multiple backups + export copies per retention policy the org chooses (default keep-30 local; advise monthly pendrive/NAS export).

---

## 5. Go-live migration (from paper/Excel/legacy)

Migration is **staged and reversible**, never big-bang destructive:
1. **Plant setup:** install → onboarding (company/branding, plants, shifts) → org model config (DEPTH_02 units/roles/reporting; default = role catalog bundles) → module activation (`activeDepartments`) — only modules the plant actually runs.
2. **Master data:** customers, suppliers, products/BOM/routing (from Excel via import tooling `src/lib/importConfig.ts` + `/api/import`), users+seats, machines/lines, calibration/instruments.
3. **Open-state entry:** current WOs, POs, stock balances (opening ADJUST with reason + approval), leave balances; parallel-run window where the app runs alongside the old registers.
4. **Floor switch:** terminals live for production logging first; finance cut-over at a month boundary so GL opens clean (opening balances as journal entries with provenance, audited).
5. **Verification:** reconcile system stock vs physical (cycle count), open WO list vs Excel, aging vs register; `docs/RELEASE_CHECKLIST.md` items + the REALWORLD_PILOT walk (kiosk lock, restore drill, two-operator terminal walk, ledger & governance walk).
6. **Comfort week:** shadow the old system, compare reports; only then retire paper/Excel.

Data hygiene rules: no "test rows" in production data (fresh install or clean sample); document codes seeded with the org's numbering (sequence counters, not count+1); every import audited with an import log.

---

## 6. Rollout playbooks per customer class

### 6.1 Job shop / Tier-2/3 pilot (≈40–150 users) — 2–4 weeks
Week 1: install + onboarding + org config + master data import + open-state entry. Week 2: terminal + andon live on 1–2 cells, shift counts + handover daily; quality (FAI/NCR) where certs demanded. Weeks 3–4: full floor + dispatch/invoicing + first finance close; drills (restore + walk) completed; digest for owner. Success bar: 30 days of clean daily close, disputes < tolerance, books balance on the 02:30 sweep.

### 6.2 Aero Tier-2/3 with AS9102 demands — 4–8 weeks
Adds: FAI + data package on a real first article, hold points + serial genealogy on a pilot part family, mill-cert enforcement on receipts, ECO on one drawing change, customer complaint drill through 8D. Customer-facing evidence pack generated *from the app* and approved before scale-up.

### 6.3 Emerging Tier-1 / plant server — 8–16 weeks
Adds: server-class install + sizing (Table 2.1), 150+ users onboarding in waves, AD/LDAP consideration (per SEC roadmap), access review cycles, CSR matrix per customer, customer-connect formats (ASN/portal exports, e-invoice IRN), finance parallel-run across a full month boundary, role of local AI tier C/D for 8D/FAI throughput, plus the org's own IT doing the restore drill under supervision. Contractual gates (customer-required MRB authority, data-package sign-off) verified in config before go-live.

Every class ends with the same exit checklist: health green (server/db/license/AI tier), daily backup observed, one restore drill logged, one dispute/exception handled end-to-end, one report the owner actually uses.

---

## 7. Monitoring, health & support

- **Health surface:** `/system/health` + `/api/health` (server/db/license/backup/AI tier, server boot time) and the launcher `health()` in tray/About; `serverEnv` pins version identity to package.json so tray ≈ API ≈ `/system/health`.
- **Watchdogs** (server + db) with crash alerting to tray; **scheduled jobs** visible: backup 20:00, idempotency prune 02:15, GL-integrity sweep 02:30 (logged to `GlIntegrityRun` and launcher log).
- **Logs:** `MfgMaxData/logs/` (server, postgres, launcher) with rotation; support pulls a single support bundle (logs + health JSON + backup list) — no remote access required, so support works fully offline (zip via file/email the customer chooses to send).
- **Support model:** Tier-0 = in-app health + digest; Tier-1 = vendor support via logs/support bundle; Tier-2 = remote session only if the customer permits (never required); updates via file or GitHub-direct when the org enables it.
- **Signal hygiene:** the app never phones home for telemetry by default (privacy); if an org opts into usage stats it is explicit, configurable, and auditable.

---

## 8. Scale to 500+ users — concrete work plan (SCALE-1)

1. **Packaging:** install as a Windows service (or headless start) + Linux option; run under a service account; `ELECTRON_RUN_AS_NODE` path already exists for headless node.
2. **Postgres:** tuned pool (`DB_POOL_MAX`), maintenance windows, storage headroom, per-table indexes reviewed on the hot set, archiving/prune jobs for audit + notifications + idempotency.
3. **App server:** Next standalone under the watchdog with graceful restart; static asset serving checked by `verifyBuild`; session JWT fast-path retained (per-request DB epoch re-check is the security cost — batch or cache carefully at scale; keep fail-closed semantics).
4. **Concurrency correctness:** all money/stock/sequence paths already `$transaction` + sequence counters + idempotency — extend the pattern to every new write path (test suite enforces via regression).
5. **AI at scale:** Tier C/D model host runs beside the DB server; gateway worker pool bounded; copilot requests logged and rate-shaped so AI never steals floor-action latency.
6. **Benchmarks:** a load script (LAN, synthetic users) proving p95 page < 2s and terminal action < 1s at 500 users / 1,000 machines before any Tier-1 sales claim is made.

---

## 9. Pilot → reference-site strategy

- Every live pilot produces a **reference package**: deployment facts (hardware class, module set, org shape), the REALWORLD_PILOT verification record, anonymized metrics the shop permits (OEE before/after, 8D cycle time, month-end days), and a testimonial path — the single strongest sales asset against SAP/QMS/MES incumbents (DEPTH_01 §3).
- Bugs/edge cases found in pilots feed `HANDOVER.md`/gap docs and the wedge plan; the wedge discipline (DEPTH_01, §build direction) keeps each 90-day cycle shippable to the next pilot.
- A dedicated **runbook owner** per pilot (plant-side champion) plus vendor-side support loop (Section 7) keeps the pilot from becoming an unpaid helpdesk.

---

## 10. Rollout readiness checklist (per release)

- [ ] `npm run ci` green (verify-counts, `tsc --noEmit`, build, verify-build, tests — incl. desktop tests)
- [ ] release-gate + smoke-install on a clean VM; smoke-update from previous version
- [ ] restore drill logged (`RestoreDrill`) on a test PC
- [ ] health page shows server/db/license/AI tier green on the target machine class
- [ ] docs updated (`docs/RELEASE_NOTES.md`, this suite) + pilot checklist ticked
- [ ] license path verified for ACTIVE / GRACE / EXPIRED / INVALID cases
- [ ] offline reboot test: pull the network cable, reboot, app fully functional

---

*End of the DEPTH suite. Cross-index: DEPTH_01 principles & guardrails · DEPTH_02 org model · DEPTH_03 feature inventory · DEPTH_04 workflow spine · DEPTH_05 AI copilots · DEPTH_06 deployment/ops.*
