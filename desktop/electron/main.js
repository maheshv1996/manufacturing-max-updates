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
const { DesktopApp, resolveResourcesDir } = require("../launcher");

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
    await session.defaultSession.clearStorageData({
      storages: ["cachestorage", "serviceworkers"],
    });
  } catch (e) {
    console.log("[stale-build] SW clear failed:", e?.message);
  }
}

function armStaleGuard(port) {
  if (staleGuardTimer) {
    clearInterval(staleGuardTimer);
    staleGuardTimer = null;
  }
  lastServerStartedAt = null;
  staleGuardArmed = true;
  const url = `http://127.0.0.1:${port}/api/health`;
  const tick = async () => {
    if (!staleGuardArmed || !mainWindow || mainWindow.isDestroyed()) return;
    let h = null;
    try {
      const res = await fetch(url);
      if (res.ok) h = await res.json();
    } catch {
      return; // server unreachable — try again next tick
    }
    if (!h || typeof h.startedAt !== "string") return;
    if (lastServerStartedAt === null) {
      lastServerStartedAt = h.startedAt; // first observation — baseline only
      return;
    }
    if (h.startedAt !== lastServerStartedAt) {
      lastServerStartedAt = h.startedAt;
      console.log("[stale-build] server restarted — purging SW cache + reloading window");
      staleGuardArmed = false; // one shot per restart
      await clearServiceWorkerStorage();
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.reload();
    }
  };
  tick();
  staleGuardTimer = setInterval(tick, 5000);
  staleGuardTimer.unref?.();
}

function iconPath(name) {
  const candidates = [
    path.join(process.resourcesPath, "standalone", "public", "icons", name),
    path.join(__dirname, "..", "..", "public", "icons", name),
  ];
  return candidates.find((c) => fs.existsSync(c)) || candidates[0];
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: iconPath("icon-512x512.png"),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true },
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
          appInstance.restartServer?.();
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
    { label: "LAN QR / Health Page", click: () => shell.openExternal(`http://127.0.0.1:${appInstance.port}/system/health`) },
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

// Single-instance: a second launch focuses the existing window instead of
// double-booting Postgres against the same data dir.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.whenReady().then(async () => {
  if (!gotLock) return;

  // Packaged layout: standalone build + data resources live under resourcesPath.
  if (process.resourcesPath) {
    process.env.MFGMAX_APP_ROOT = path.join(process.resourcesPath, "standalone");
    process.env.MFGMAX_RESOURCES_DIR = path.join(process.resourcesPath, "resources");
    process.env.POSTGRES_BIN_DIR = path.join(process.resourcesPath, "pgbin", "bin");
  }

  appInstance = new DesktopApp({ dataDir: process.env.MFGMAX_DATA_DIR, log: (m) => console.log("[launcher]", m) });
  appInstance.ensureDirs();
  appInstance.evaluateLicense();
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

app.on("window-all-closed", (e) => {
  // Keep running in tray.
  e.preventDefault();
});

if (gotLock) {
  app.on("second-instance", () => showWindow());
}

app.on("before-quit", () => {
  appInstance?.stop();
});
