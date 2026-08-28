# RELEASE CHECKLIST — Online Update Channel (GitHub Direct, zero Vercel)

**GitHub is the update server.** The desktop edition polls the public
releases API of a dedicated `<brand>-updates` repo:

```
GET https://api.github.com/repos/<owner>/<brand>-updates/releases/latest
```

- `tag_name` is compared (semver) against the installed version.
- The release must contain exactly two assets:
  - `ManufacturingMax-Setup-<version>.exe` — the installer (the
    `browser_download_url` is streamed to temp with a progress bar)
  - `ManufacturingMax-Setup-<version>.exe.sha256` — `<64-hex>  ManufacturingMax-Setup.exe`
    (fetched and verified against the download; **mismatch → abort + red
    security alert, file deleted, never runs**)
- Release `body` is shown in the update modal as release notes.
- Unauthenticated GitHub rate limit (60/hr) is plenty: silent check on
  launcher start + manual checks only.

The private source repo stays untouched — the `-updates` repo is
**releases only** (public, or private with a fine-grained token if you
prefer; public keeps the launcher token-free).

---

## The ritual (in order)

### 1. Bump the version
```bash
# package.json — set the new version, e.g. 1.2.0
npm run build
```

### 2. Build the installer
```bash
# On the Windows build machine (see docs/OFFLINE_EDITION.md packaging):
npx electron-builder --win nsis
```
The installer **must** preserve `%APPDATA%/MfgMaxData` on update and
re-run `prisma migrate deploy` on next boot.

### 3. Compute the sha256
```bash
sha256sum dist/ManufacturingMax-Setup-1.2.0.exe > dist/ManufacturingMax-Setup-1.2.0.exe.sha256
# file contents: <64-hex>  ManufacturingMax-Setup-1.2.0.exe
```

### 4. Create the GitHub Release
- In the `<brand>-updates` repo: create a tag `v1.2.0` (the `v` prefix is
  expected — the launcher strips it for semver comparison).
- Attach **both** assets: the `.exe` and the `.sha256`.
- Write release notes in the body (shown in the update modal).

### 5. DONE — every installed app sees it
Silent check on next launcher start; tray "Check for Updates" and the
`/system/health` button show the modal immediately. No Vercel deploy, no
version.json — GitHub is the update server.

---

## Client behavior (what your users experience)

| Situation | Behavior |
|-----------|----------|
| Newer tag, online | Silent check logs it; tray / health-page button shows the modal (tag, release notes, size) → **Download & Install** streams with progress → `.sha256` asset fetched → checksum verified → server+DB stopped → installer launches → launcher quits. Data dir preserved; migrations re-run on next boot. |
| Checksum mismatch | **Red SECURITY ALERT**, download aborted, temp file deleted. Never runs. |
| Missing `.sha256` asset | Update refused (`NO_SHA_ASSET`) — an unverifiable installer is never run. |
| Offline / rate-limited | Toast/banner: "Offline — use Update from File" (pendrive `.exe` flow, unchanged). |
| Same version | Nothing shown. |
| Web (cloud) edition | `/system/health` shows the feed info; install is desktop-only. |

---

## Verification (before shipping a release)

```bash
npx tsc --noEmit                      # green
npm run build                         # green
node --test "desktop/tests/*.test.js" # 31 tests: GitHub feed check, tag semver,
                                      # .sha256 parsing, download pass/fail,
                                      # full apply cycle, data preservation
```

Manual smoke on a test install:
1. Create a test release with a newer tag → modal appears with notes + size.
2. Download completes → `.sha256` matches → installer launches → data dir
   intact after update, migrations re-run.
3. Corrupt the `.sha256` asset → red alert, file deleted.
4. Pull the network cable → "Update from File" path still works.

## Rollback

Delete the bad release (or add a newer fixed one). The launcher only ever
installs the latest release the API returns — no client change needed.
