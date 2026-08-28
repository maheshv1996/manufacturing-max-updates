# OFFLINE EDITION — Manufacturing Max

Internet-proof · power-proof · air-gap ready.

The offline edition is the same MfgMax application running **entirely on one
machine**: self-hosted fonts, zero runtime CDN calls, a local database, an
offline sync queue for every floor mutation, and a desktop launcher that
starts the stack, watches it, backs it up, and recovers from power cuts —
with the internet cable unplugged.

**Cloud edition is unchanged.** Every local-only behavior is gated behind
env flags (`DESKTOP_MODE`, `BACKUP_DIR`, `LOG_DIR`, `MFGMAX_LICENSE`,
`MFGMAX_LICENSE_SECRET`, `MFGMAX_DATA_DIR`, `MFGMAX_START_ON_BOOT`,
`CLOUD_BRIDGE`). Without those flags the app runs exactly as before.

---

## Architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│  ELECTRON SHELL (desktop/electron/main.js)                  │
│  tray · window · Backup/Restore/Export · Update from File   │
└──────────────┬──────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────┐
│  LAUNCHER (desktop/launcher.js) — pure Node, testable       │
│  license gate → DB start → migrate deploy → seed-if-empty  │
│  → spawn standalone server (watchdog) → 8 PM daily backup   │
└──────┬──────────────────────────────┬───────────────────────┘
       │                              │
┌──────▼────────┐          ┌──────────▼──────────┐
│ DATA VAULT    │          │  WATCHDOG (x2)      │
│ vault.js      │          │  watchdog.js        │
│ backups, keep │          │  ≤5s restart, max 3 │
│ 30, restore,  │          │  tries, then alert  │
│ pendrive      │          └─────────────────────┘
└───────────────┘
       │
┌──────▼──────────────────────────────┐
│  STANDALONE NEXT SERVER             │
│  .next/standalone/server.js         │
│  ├─ /api/health   (5s ping by UI)   │
│  ├─ offline sync queue (IndexedDB)  │
│  └─ /system/health (LAN QR page)    │
└─────────────────────────────────────┘
```

## Phase 0 — strip cloud dependencies (DONE)

| Item | Status |
|------|--------|
| `output: "standalone"` in next.config.ts | ✅ `.next/standalone` is produced by `npm run build` |
| Font self-hosting | ✅ Inter Variable (`src/app/fonts/InterVariable.woff2`) via `next/font/local` — zero runtime CDN, air-gapped builds never fetch fonts |
| External asset sweep | ✅ no external `https://` in `src/`, CSS, landing, or marketing |
| Google SSO / Razorpay degrade offline | ✅ already env-gated; password login + manual payment recording remain primary |

## Phase 3 — offline UX & LAN factory (DONE)

### Offline sync queue (pre-existing, extended)
`src/lib/offlineSync.ts` — IndexedDB queue with `clientId` dedupe, retry
budget, conflict flags, toast + status subscribers. The operator tablet now
routes **every** floor mutation through `offlineFetchWrapper`:

- good / scrap / rework / downtime — `/api/operator/action` ✅
- clock in / out — `/api/attendance/clock` ✅
- movement & hold points ✅
- **safety incident — `/api/safety` ✅ (new)**
- **idea submission — `/api/ideas` ✅ (new)**
- **maintenance request — `/api/maintenance/jobs` ✅ (new)**
- **shift handoff counts — `/api/shift-counts` ✅ (new)**

Offline → action is queued locally with a toast; reconnect → auto-drains in
chronological order; server-side state conflicts → flagged for supervisor
review on `/supply/reconcile`.

### Server-availability hook (new)
`src/lib/health.ts` pings `/api/health` every 5 s. `navigator.onLine` only
tells you the network is up — this tells you the **server** is reachable:

- `setServerOnline(false)` pauses queue draining (no burned retries against
  a dead server) and flips the sync status to OFFLINE.
- On recovery the queue drains immediately.
- `ServerHealthBanner` shows an amber "Server unreachable — retrying"
  banner at the top of the app.

### `/api/health` (new)
`GET /api/health` → `{ ok, mode, version, node, uptimeSeconds, startedAt,
db { ok, sizeMb }, disk { freeGb, warn }, backup { file, at }, lanIps,
time }`. DB size via `pg_database_size` (degrades gracefully on SQLite).

### `/system/health` page (new)
Uptime, DB size, disk free (warn < 10 GB), last backup, version, logs path,
LAN IP **with scannable QR** (`qrcode`, server-rendered, offline-safe) for
tablets on the shop floor. Reachable from the IT & Systems sidebar.

### Service worker (upgraded)
`public/sw.js` v2: app-shell precache (never white-screen), cache-first for
hashed static assets, **network-first for navigations with app-shell
fallback**, network-first for read-only API GETs, writes never intercepted.

## Phase 1 — self-healing local server (scaffolded, unit-tested)

`desktop/launcher.js` + `desktop/lib/watchdog.js`:

- **Watchdog** restarts a dead server (or Postgres) within `restartDelayMs`
  (default 5 s), max 3 consecutive tries, then fires a crash alert to the
  tray. A run that survives `stabilizeMs` resets the try budget so normal
  restarts never accumulate into a false crash.
- **Startup sequence**: license gate → start DB → wait ready → `prisma
  migrate deploy` → seed-if-empty → spawn `server.js` from the standalone
  build → schedule 8 PM daily backup.
- **Start with Windows**: `app.setLoginItemSettings({ openAtLogin })` gated
  by `MFGMAX_START_ON_BOOT` — a power cut never needs a human double-click.
- **Tray menu**: Open · Health · Backup Now · Restore… · Export to
  Pendrive… · LAN QR/Health Page · Update from File… · Quit.

> Database decision (v1): the desktop edition ships **embedded Postgres**
> (`@embedded-postgres/windows-x64` binaries packaged in `resources/pgbin`).
> First boot `initdb`s a cluster in `%APPDATA%/MfgMaxData/pgdata` with a random
> superuser password, creates the `mfgmax` database, applies
> `resources/schema.sql` (generated by `scripts/build-desktop-resources.js` —
> `prisma migrate diff --from-empty`, so the full 100+ model datamodel, not
> the drift-only migration folder), and runs a compiled seed. A legacy
> `DATABASE_URL=file:<data>/app.db` file-DB fallback remains for dev; bundled
> Postgres stays supported via `POSTGRES_BIN_DIR`.

## Phase 2 — data vault (scaffolded, unit-tested)

`desktop/lib/vault.js` (external/file DBs) and `desktop/lib/embeddedDb.js`
(embedded Postgres):

- **Backup Now / daily 8 PM auto-backup**: embedded PG → a consistent
  **physical `pgdata` copy** (postgres stopped briefly with `pg_ctl -m fast`,
  copied, restarted — no `pg_dump`/psql binaries shipped; EDB tools alone
  are ~337 MB). External/file DBs → `pg_dump -Fc` or plain file copy.
  Backups land in `<data>/backups`, **keep last 30**, size logged, last-run
  surfaced in `/system/health`.
- **Restore flow**: pick dump → confirm → restore → server restarted; audit
  `BACKUP_CREATED` / `RESTORE_DONE`.
- **Export vault to pendrive**: copies the latest dump to a chosen drive —
  the air-gapped site hand-off.

## Phase 4 — offline licensing & updates (scaffolded, unit-tested)

`desktop/lib/license.js`:

- **Key**: `base64url(JSON payload) + "." + HMAC-SHA256` — payload carries
  `plan`, `expiresAt`, `machineId`.
- **Machine fingerprint**: stable SHA-256 over hostname/platform/arch/CPU/
  memory — an extension point is documented for a real disk-serial native
  read (`readDiskSerial`).
- **Activation states**: `ACTIVE` (valid, same machine, not expired),
  `EXPIRED` (date passed), `GRACE` (first run or hardware change, 14 days),
  `INVALID` (bad/missing key after grace).
- **Update from File**: tray picks a newer `.exe` → installer verifies
  version + signature, **preserves the data folder**, re-runs migrations.

> Honest note: client-side licensing deters casual copying; it is not DRM.

## Phase 5 — optional cloud bridge (design only, default OFF)

`CLOUD_BRIDGE=true` → a nightly encrypted, compressed **KPI-only digest**
(never full records) uploads to the cloud edition for multi-plant HQ view.
Skips silently offline. Not yet implemented — see roadmap.

---

## Env flag matrix

| Flag | Effect |
|------|--------|
| `DESKTOP_MODE=true` | health page reports `mode: desktop` |
| `MFGMAX_DATA_DIR` | data + backups + licenses + logs root |
| `BACKUP_DIR` | where backups live (health page shows last backup) |
| `LOG_DIR` | launcher log directory |
| `MFGMAX_LICENSE` / `MFGMAX_LICENSE_SECRET` | offline license key + HMAC secret |
| `MFGMAX_START_ON_BOOT=true` | tray sets "Start with Windows" |
| `CLOUD_BRIDGE=true` | enable nightly KPI digest upload (default off) |
| `GITHUB_UPDATE_REPO` | `<owner>/<brand>-updates` — the public releases repo (the update server; zero Vercel) |
| `GITHUB_API_BASE` | testing/self-hosted override for the GitHub API (default `https://api.github.com`) |
| `POSTGRES_BIN_DIR` | bundled Postgres bin (electron main sets it to `resources/pgbin/bin`) |
| `DATABASE_URL` | explicit override; default on desktop = embedded Postgres (`config.json`), else `file:<data>/app.db` |

## Desktop build & packaging (needs a Windows machine)

The pure-Node modules are fully tested here (`node --test desktop/tests/` —
17 tests). The Electron shell (`desktop/electron/main.js`) cannot run in a
headless sandbox; on a Windows builder:

1. `npm run build` (produces `.next/standalone`)
2. `npm i -D electron electron-builder`
3. Copy the standalone build + `public/` next to `server.js`
4. `electron-builder --win nsis` with `desktop/electron/main.js` as entry;
   installer sets `MFGMAX_DATA_DIR` to `%APPDATA%/MfgMaxData`, preserves it
   on update, and re-runs `prisma migrate deploy` via the launcher.

## Test matrix

| Area | Result |
|------|--------|
| `npx tsc --noEmit` | ✅ green |
| `npm run build` | ✅ green (standalone output) |
| `node --test desktop/tests/*.test.js` | ✅ 31/31 (license, vault, watchdog, updater, control server) |
| License lifecycle (CLI) | ✅ MISSING→GRACE, valid key→ACTIVE, tamper→INVALID |
| Backup embedded-DB flow | ✅ physical pgdata copy, rotation, export |
| `/api/health` | ✅ live on running server |
| `/system/health` + QR | ✅ renders, QR generated server-side |
| Terminal offline queue (5 new endpoints) | ✅ wired via `offlineFetchWrapper` |
| SW app-shell fallback | ✅ v2 precache + navigation fallback |
| Google SSO / Razorpay offline | ✅ env-gated, degrade to local flows |
| Embedded Postgres first boot | ✅ installed exe: initdb → schema.sql → compiled seed → server up |
| Electron tray/installer/watchdog-on-power-cut | ✅ installer built (`ManufacturingMax-Setup-1.0.0.exe`), installed, clean restart verified on Windows |

## Roadmap (not yet built)

- Phase 5 cloud bridge implementation (`CLOUD_BRIDGE=true`)
- Real disk-serial fingerprint extension point
- Logical `pg_dump` backups for embedded Postgres (v1 uses physical pgdata copies)
