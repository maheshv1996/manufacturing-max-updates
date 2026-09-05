"use strict";
/**
 * ELECTRON MAIN (Phase 1 + 2 + 4)
 * -------------------------------
 * Tray launcher shell. Built with `electron-builder` on a Windows machine
 * (see docs/OFFLINE_EDITION.md). The heavy lifting (watchdog, vault,
 * licensing, migrations) lives in desktop/launcher.js and is pure Node —
 * this file only wires Electron UI to it.
 *
 * Build note: this file cannot run in a headless sandbox; it is verified by
 * unit tests on the pure-Node modules + manual validation on the installer.
 */
const { app, BrowserWindow, Tray, Menu, dialog, shell, ipcMain, session } = require("electron");
const path = require("path");
const fs = require("fs");
const { DesktopApp, resolveResourcesDir, licenseStartError } = require("../launcher");

let tray = null;
let mainWindow = null;
let appInstance = null;

// ---------------------------------------------------------------------------
// STALE-BUILD GUARD
// ---------------------------------------------------------------------------
// The app's service worker caches the HTML shell + hashed static chunks. When
// the server is rebuilt and restarted under a LIVE window (installer swap,
// watchdog restart, restore), the old SW entries keep the window showing the
// previous build indefinitely. This guard (a) clears SW cache storage on every
// boot so the first load is always fresh, and (b) polls /api/health and reloads
// the window whenever the server's boot time (startedAt) changes.

let lastServerStartedAt = null;
let staleGuardArmed = false;
let staleGuardTimer = null;

async function clearServiceWorkerStorage() {
  try {
    const userDir = app.getPath("userData");
    const versionFile = path.join(userDir, ".sw_cache_version");
    const currentVersion = app.getVersion() || "1.0.0";
    let storedVersion = "";
    if (fs.existsSync(versionFile)) {
      try {
        storedVersion = fs.readFileSync(versionFile, "utf8").trim();
      } catch {}
    }

    if (storedVersion !== currentVersion) {
      console.log(`[stale-build] Version change detected (${storedVersion || "none"} -> ${currentVersion}). Clearing Service Worker cache storage...`);
      await session.defaultSession.clearStorageData({
        storages: ["cachestorage", "serviceworkers"],
      });
      try {
        fs.writeFileSync(versionFile, currentVersion, "utf8");
      } catch {}
    } else {
      console.log(`[stale-build] Version ${currentVersion} matches cached state. Preserving cache storage for fast LAN startup.`);
    }
  } catch (e) {
    console.log("[stale-build] SW clear check failed:", e?.message);
  }
}

function armStaleGuard(port) {
  // Stale-guard: disabled automatic reload loop to prevent interrupting user sessions
}

function iconPath(name) {
  const candidates = [
    path.join(process.resourcesPath, "standalone", "public", "icons", name),
    path.join(__dirname, "..", "..", "public", "icons", name),
  ];
  return candidates.find((c) => fs.existsSync(c)) || candidates[0];
}

function safeOpenExternal(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      shell.openExternal(targetUrl);
    } else {
      console.warn("[security] Blocked attempt to open non-http external URL:", targetUrl);
    }
  } catch {
    console.warn("[security] Invalid external URL:", targetUrl);
  }
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    icon: iconPath("icon-512x512.png"),
    autoHideMenuBar: true,
    backgroundColor: "#030408",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
    },
  });

  // Webview Hardening: prevent webview attachment inside the main window
  mainWindow.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
    console.warn("[security] Prevented webview attachment");
  });

  // Navigation Hardening: prevent in-window navigation away from the local app
  mainWindow.webContents.on("will-navigate", (event, navigationUrl) => {
    try {
      const parsed = new URL(navigationUrl);
      const isLocal =
        (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") &&
        parsed.port === String(appInstance?.port || "3000");
      if (!isLocal) {
        event.preventDefault();
        console.log("[security] will-navigate blocked cross-origin:", navigationUrl);
        safeOpenExternal(navigationUrl);
      }
    } catch {
      event.preventDefault();
    }
  });

  // Popup Hardening: deny untrusted child windows; open safe http(s) externally
  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    safeOpenExternal(targetUrl);
    return { action: "deny" };
  });

  mainWindow.loadURL(url);
  mainWindow.on("closed", () => (mainWindow = null));
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow(`http://127.0.0.1:${appInstance.port}`);
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: "Open MfgMax", click: showWindow },
    {
      // Version comes from the launcher's single source (package.json via
      // APP_VERSION) — identical to /api/health and /system/health.
      label: `About Manufacturing Max v${appInstance.health().version}`,
      click: () => {
        const h = appInstance.health();
        dialog.showMessageBox({
          type: "info",
          title: "About Manufacturing Max",
          message: `Manufacturing Max v${h.version}`,
          detail: `Server: ${h.server}\nDatabase: ${h.db}\nLicense: ${h.license}\nData: ${h.dataDir}\nBackups: ${h.backupsDir}`,
        });
      },
    },
    { label: `Health: server ${appInstance.state.server} · license ${appInstance.state.license?.status || "unknown"}`, enabled: false },
    { type: "separator" },
    {
      label: "Backup Now",
      click: async () => {
        try {
          const r = await appInstance.backupNow();
          dialog.showMessageBox({ type: "info", message: `Backup created: ${r.file} (${r.sizeMb} MB)` });
        } catch (e) {
          dialog.showErrorBox("Backup failed", e.message);
        }
      },
    },
    {
      label: "Restore…",
      click: async () => {
        // Both logical .dump files AND physical pgdata-* folders are restorable.
        const picked = await dialog.showOpenDialog({ properties: ["openFile", "openDirectory"], filters: [{ name: "Backups", extensions: ["dump", "backup", "db", "sqlite"] }] });
        if (picked.canceled || !picked.filePaths[0]) return;
        const ok = await dialog.showMessageBox({ type: "warning", buttons: ["Restore", "Cancel"], defaultId: 1, message: "Restore will replace the current database. Continue?" });
        if (ok.response !== 0) return;
        try {
          await appInstance.restoreFrom(picked.filePaths[0]);
          // restoreFrom() restarts the server itself (stop -> swap -> start).
          dialog.showMessageBox({ type: "info", message: "Restore complete. Server restarted." });
        } catch (e) {
          dialog.showErrorBox("Restore failed", e.message);
        }
      },
    },
    {
      label: "Export to Pendrive…",
      click: async () => {
        const picked = await dialog.showOpenDialog({ properties: ["openDirectory"] });
        if (picked.canceled || !picked.filePaths[0]) return;
        try {
          const r = appInstance.exportToDrive(picked.filePaths[0]);
          dialog.showMessageBox({ type: "info", message: `Exported: ${r.copied.join(", ")}` });
        } catch (e) {
          dialog.showErrorBox("Export failed", e.message);
        }
      },
    },
    { label: "LAN QR / Health Page", click: () => safeOpenExternal(`http://127.0.0.1:${appInstance.port}/system/health`) },
    {
      label: "Reload App Window",
      click: () => mainWindow?.webContents.reloadIgnoringCache(),
    },
    {
      label: "Inspect / Developer Tools",
      click: () => mainWindow?.webContents.toggleDevTools(),
    },
    {
      label: "Start on System Boot",
      type: "checkbox",
      checked: app.getLoginItemSettings().openAtLogin || process.env.MFGMAX_START_ON_BOOT === "1",
      click: (item) => {
        app.setLoginItemSettings({
          openAtLogin: item.checked,
          path: process.execPath,
          args: ["--hidden"],
        });
      },
    },
    { type: "separator" },
    {
      label: "Update from File…",
      click: async () => {
        const picked = await dialog.showOpenDialog({ properties: ["openFile"], filters: [{ name: "Installer", extensions: ["exe"] }] });
        if (picked.canceled || !picked.filePaths[0]) return;
        // The installer preserves the data folder and re-runs migrations.
        shell.openPath(picked.filePaths[0]);
      },
    },
    { type: "separator" },
    { label: "Quit", click: () => { appInstance.stop(); app.quit(); } },
  ]);
}

// ---------------------------------------------------------------------------
// STARTUP SECURITY & FLAG INJECTION DEFENSE
// ---------------------------------------------------------------------------
// Prevent attackers or untrusted local processes from launching Electron with
// dangerous debugging or web security bypass flags via Windows shortcuts/CLI.
const DANGEROUS_FLAGS = [
  "inspect",
  "inspect-brk",
  "remote-debugging-port",
  "remote-debugging-pipe",
  "disable-web-security",
  "allow-running-insecure-content",
  "ignore-certificate-errors",
  "js-flags",
];
for (const flag of DANGEROUS_FLAGS) {
  if (app.commandLine?.hasSwitch && app.commandLine.hasSwitch(flag)) {
    console.error(`[security] Terminating: unauthorized security flag detected: --${flag}`);
    app.quit();
    process.exit(1);
  }
}

// Single-instance: a second launch focuses the existing window instead of
// double-booting Postgres against the same data dir.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.whenReady().then(async () => {
  if (!gotLock) return;

  // Permission Hardening: deny arbitrary device sensor, microphone, and camera access
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ["notifications"];
    const isAllowed = allowed.includes(permission);
    if (!isAllowed) {
      console.warn(`[security] Denied permission request: ${permission}`);
    }
    callback(isAllowed);
  });

  // Packaged layout: standalone build + data resources live under resourcesPath.
  if (process.resourcesPath) {
    process.env.MFGMAX_APP_ROOT = path.join(process.resourcesPath, "standalone");
    process.env.MFGMAX_RESOURCES_DIR = path.join(process.resourcesPath, "resources");
    process.env.POSTGRES_BIN_DIR = path.join(process.resourcesPath, "pgbin", "bin");
  }

  if (process.env.MFGMAX_START_ON_BOOT === "1") {
    app.setLoginItemSettings({ openAtLogin: true, path: process.execPath, args: ["--hidden"] });
  }

  appInstance = new DesktopApp({ dataDir: process.env.MFGMAX_DATA_DIR, log: (m) => console.log("[launcher]", m) });
  appInstance.ensureDirs();
  appInstance.evaluateLicense();
  // License gate: GRACE keeps running (offline-first evaluation window), but an
  // EXPIRED key or an INVALID state (grace over, no key) blocks the boot BEFORE
  // the database or server start — the machine cannot run unlicensed.
  const licErr = licenseStartError(appInstance.state.license);
  if (licErr) {
    await dialog.showMessageBox({
      type: "error",
      title: "License Required",
      message: "Manufacturing Max cannot start",
      detail: licErr + "\n\nInstall a license key and restart the application.",
    });
    app.quit();
    return;
  }
  appInstance.ensureEmbeddedDb();
  appInstance.startDb();
  if (!(await appInstance.waitForDbReady())) dialog.showErrorBox("Database", "Database did not become ready.");
  try {
    appInstance.applyInitialDataIfNeeded();
    if (!(appInstance.dbConfig?.url || "").startsWith("postgres")) {
      // Embedded Postgres is fully provisioned by schema.sql + seedbuild on first run.
      appInstance.runMigrations();
      appInstance.seedIfEmpty();
    }
  } catch (e) {
    dialog.showErrorBox("Startup", "Schema/seed failed: " + e.message);
  }
  appInstance.startServer();
  // Web <-> launcher bridge for the update channel (/api/update/* proxies here).
  // The CLI path (launcher.js main()) starts it, but the Electron path never
  // did — so the packaged app's UpdateCard always hit CONTROL_UNREACHABLE.
  appInstance.startControlServer();
  appInstance.startDbWatchdog();
  appInstance.scheduleDailyBackup();
  appInstance.scheduleIdempotencyPrune();
  appInstance.scheduleLedgerIntegrity();

  tray = new Tray(iconPath("icon-192x192.png"));
  tray.setToolTip("MfgMax Offline Edition");
  tray.setContextMenu(buildTrayMenu());
  tray.on("click", showWindow);

  // Start with Windows (installer option sets this; we keep it in sync).
  app.setLoginItemSettings({ openAtLogin: process.env.MFGMAX_START_ON_BOOT === "true" });

  // IPC for the tray health window (reuse the web /system/health page).
  ipcMain.handle("health", () => appInstance.health());

  // Never boot into a stale SW-cached build: clear the service worker's
  // cache storage BEFORE the first load so the window always gets the freshly
  // started server's HTML + chunks (IndexedDB / offline queue untouched).
  await clearServiceWorkerStorage();

  createWindow(`http://127.0.0.1:${appInstance.port}`);
  mainWindow.webContents.on("did-finish-load", () => armStaleGuard(appInstance.port));
});

// Global security hardening for all web contents (main window, popups, utility views)
app.on("web-contents-created", (event, contents) => {
  contents.on("will-attach-webview", (ev) => {
    ev.preventDefault();
    console.warn("[security] Blocked webview creation in child contents");
  });

  contents.setWindowOpenHandler(({ url: targetUrl }) => {
    safeOpenExternal(targetUrl);
    return { action: "deny" };
  });

  contents.on("will-navigate", (ev, navigationUrl) => {
    try {
      const parsed = new URL(navigationUrl);
      const isLocal =
        (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") &&
        parsed.port === String(appInstance?.port || "3000");
      if (!isLocal) {
        ev.preventDefault();
        console.warn("[security] will-navigate blocked cross-origin in contents:", navigationUrl);
        safeOpenExternal(navigationUrl);
      }
    } catch {
      ev.preventDefault();
    }
  });
});

app.on("window-all-closed", () => {
  // Keep running in tray. Note: Electron emits this event with NO arguments,
  // so any `event` parameter is undefined — never call preventDefault() here.
  // Simply subscribing is what stops the default quit on Windows/Linux.
});

if (gotLock) {
  app.on("second-instance", () => showWindow());
}

app.on("before-quit", () => {
  appInstance?.stop();
});
