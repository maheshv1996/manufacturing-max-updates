# Fresh-Install Checklist — Manufacturing Max Desktop Edition

Every shipped installer must pass this end-to-end validation on a **brand-new
machine** (or an isolated scratch environment). It mirrors exactly what the
first real user on a factory floor will experience. Run it once per release.

> Automated: `scripts/smoke-install.ps1` performs steps 1–9 headlessly
> (install → scratch-data first boot → health → login → /command → kiosk →
> cluster initialized → real-app restore) and prints a PASS/FAIL matrix.
> The manual steps 10–14 below cover what a script cannot see.

---

## Pre-flight

- [ ] `npm run build` green (tsc 0, Next standalone produced)
- [ ] `npm run dist` green (staged desktop tests 44/44)
- [ ] Installer exists: `dist\ManufacturingMax-Setup-<version>.exe`
- [ ] Expected version confirmed: `package.json` → `version` field
      (single source — the launcher, `/api/health`, `/system/health`, tray
      and updater all read it; `next.config.ts` bakes `APP_VERSION` at build)

## Automated smoke (scripts/smoke-install.ps1)

| # | Check | Expect |
|---|-------|--------|
| 1 | Installer runs silently | exit 0 |
| 2 | First boot (scratch `MFGMAX_DATA_DIR`) | `initdb` → schema → seed → server up |
| 3 | `/api/health` | `ok:true`, `status:healthy`, `db.ok:true` |
| 4 | Health version | equals package.json version |
| 5 | Scratch cluster size | ~22–24 MB (full seed) |
| 6 | Login `1001 / factory123` | HTTP 200, `success:true`, ADMIN |
| 7 | `/command` with session | HTTP 200 |
| 8 | `/api/operator/init` anonymous | HTTP 200 (kiosk is public by design) |
| 9 | Scratch `config.json` | `initialized:true`, `pgdata/PG_VERSION` exists |
| 10 | Teardown + real-app restore | real app healthy again, login 200 |

## Manual checks (visual / interactive — what the script can't see)

- [ ] **App window opens** and shows the gateway (particle field + 13 department
      tiles), not a white screen or error card. Title reads **Manufacturing Max**
      (or `<company> — Manufacturing Max` after onboarding).
- [ ] **Onboarding wizard** on first login: Company → Departments → Team → Data;
      Finish lands directly on `/command` (no flash back to the wizard).
- [ ] **Login surfaces**: `/login` and the gateway contextual login both accept
      the employee number (`1001`); legacy username/email still works.
- [ ] **Operator terminal** renders on a phone-width viewport: machine list,
      employee-number keypad, big buttons, no horizontal scroll. Clock in a
      test user; the queue badge clears after reconnect.
- [ ] **Print a report** (e.g. `/reports/...` white-paper routes) — renders
      cleanly, no dark-theme leakage into the print CSS.
- [ ] **Tray menu** shows: Open, Backup Now, Show LAN address, Check for
      Updates, Quit. Health window reports uptime, DB size, disk free.
- [ ] **Backup → restore round trip**: Backup Now, then Restore from the
      newest pgdata backup, then confirm a known row is present and a marker
      row inserted before the restore is gone.
- [ ] **LAN access**: from a phone/tablet on the same network,
      `http://<lan-ip>:3000` loads the terminal (kiosk) and login.
- [ ] **Watchdog**: kill the server process → it restarts within ~5 s
      (max 3 tries, then tray alert).

## Data-safety rules (why the smoke test is safe)

- The smoke test boots the app with `MFGMAX_DATA_DIR=<scratch>` so the real
  cluster (`%USERPROFILE%\MfgMaxData`) is never touched.
- The real Postgres on :5432 is stopped only briefly during the test and is
  restarted by the real app afterwards (WAL recovery).
- The installer preserves the data dir across upgrades by design — data lives
  outside the install path.

## Known environment gotchas (Windows)

- **PowerShell 5.1 mangles inline JSON passed to native `curl.exe`**
  (`-d '{"a":"b"}'` arrives truncated → the API's `request.json()` throws →
  500). Always write the body to a temp file and use `curl --data-binary @file`
  inside scripts. This was the cause of a false "login 500" in early smoke runs.
- `$pid` is a read-only automatic variable — never assign to it in PowerShell
  scripts.
- `pg_ctl stop` on a not-running cluster prints to stderr, which becomes a
  terminating error under `$ErrorActionPreference = "Stop"` — wrap it.
- libcurl does not send `Secure` cookies over plain http; use a manual
  `Cookie:` header or the Electron/browser localhost exemption when testing
  sessions with curl.
- If the embedded postmaster wedges (error 487), force-kill it and let
  `pg_ctl start` WAL-recover.

## Release gate

An installer only ships when: `tsc` 0, `npm run build` green, desktop tests
green, **smoke-install.ps1 = 10/10**, and the manual checks above are signed
off. Then `scripts/publish-release.ps1` (GitHub release + `.sha256`) or the
air-gapped "Update from File" pendrive flow.
