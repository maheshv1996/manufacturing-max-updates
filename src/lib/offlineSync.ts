"use client";

export interface QueueItem {
  id: string; // unique queue item id
  clientId: string; // unique UUID payload id for deduplication
  clientTimestamp: number; // timestamp when action originated on client
  serverTimestamp?: number; // timestamp returned by server
  endpoint: string;
  method: string;
  body: string; // JSON string
  timestamp: number;
  retries: number;
  status: "PENDING" | "FAILED" | "FLAGGED_CONFLICT";
  conflictReason?: string;
}

export type SyncStatus =
  "ONLINE" | "OFFLINE" | "SYNCING" | "FAILED" | "FLAGGED_CONFLICT";

let dbInstance: IDBDatabase | null = null;
const DB_NAME = "MES_OfflineDB";
const STORE_NAME = "syncQueue";

// ----------------------------------------------------------------------
// TOAST NOTIFIER SUBSCRIBERS
// ----------------------------------------------------------------------
export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: "SUCCESS" | "CONFLICT" | "ERROR" | "INFO";
}

type ToastListener = (toast: ToastMessage) => void;
const toastListeners = new Set<ToastListener>();

export function subscribeToastMessages(listener: ToastListener) {
  toastListeners.add(listener);
  return () => {
    toastListeners.delete(listener);
  };
}

export function emitToast(
  title: string,
  message: string,
  type: ToastMessage["type"] = "INFO",
) {
  if (typeof window === "undefined") return;
  const toast: ToastMessage = {
    id:
      "toast-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
    title,
    message,
    type,
  };
  toastListeners.forEach((fn) => fn(toast));
}

// ----------------------------------------------------------------------
// STATUS SUBSCRIBERS
// ----------------------------------------------------------------------
type StatusListener = (status: SyncStatus, pendingCount: number) => void;
const statusListeners = new Set<StatusListener>();

export function subscribeSyncStatus(listener: StatusListener) {
  statusListeners.add(listener);
  notifyStatus();
  return () => {
    statusListeners.delete(listener);
  };
}

let currentStatus: SyncStatus = "ONLINE";
let lastPendingCount = 0;

function notifyStatus() {
  if (typeof window === "undefined") return;
  const isOnline = navigator.onLine;

  getPendingQueue()
    .then((queue) => {
      lastPendingCount = queue.length;
      const hasConflict = queue.some((i) => i.status === "FLAGGED_CONFLICT");
      const hasFailed = queue.some((i) => i.status === "FAILED");

      if (hasConflict) {
        currentStatus = "FLAGGED_CONFLICT";
      } else if (hasFailed) {
        currentStatus = "FAILED";
      } else if (!isOnline || !serverOnline) {
        currentStatus = "OFFLINE";
      } else if (isSyncing) {
        currentStatus = "SYNCING";
      } else {
        currentStatus = "ONLINE";
      }

      statusListeners.forEach((fn) => fn(currentStatus, lastPendingCount));
    })
    .catch(() => {
      currentStatus = isOnline ? "ONLINE" : "OFFLINE";
      statusListeners.forEach((fn) => fn(currentStatus, 0));
    });
}

function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "idx-" + Date.now() + "-" + Math.random().toString(36).substring(2, 9);
}

// ----------------------------------------------------------------------
// INDEXEDDB DATABASE INITIALIZATION
// ----------------------------------------------------------------------
function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) return resolve(dbInstance);
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB unavailable"));
    }

    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = (e: any) => {
      dbInstance = e.target.result;
      resolve(dbInstance as IDBDatabase);
    };

    request.onerror = (e) => reject(e);
  });
}

// ----------------------------------------------------------------------
// QUEUE OPERATIONS
// ----------------------------------------------------------------------
export async function enqueueAction(
  endpoint: string,
  method: string,
  bodyObj: any,
  clientId?: string,
): Promise<QueueItem> {
  const db = await getDB();
  const cid = clientId || generateUUID();
  const now = Date.now();

  const item: QueueItem = {
    id: "action-" + now + "-" + Math.random().toString(36).substring(2, 7),
    clientId: cid,
    clientTimestamp: now,
    endpoint,
    method: method.toUpperCase(),
    body: JSON.stringify({ ...bodyObj, clientId: cid, clientTimestamp: now }),
    timestamp: now,
    retries: 0,
    status: "PENDING",
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(item);

    req.onsuccess = () => {
      notifyStatus();
      resolve(item);
    };
    req.onerror = (err) => reject(err);
  });
}

export async function getPendingQueue(): Promise<QueueItem[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const items: QueueItem[] = req.result || [];
        items.sort((a, b) => a.timestamp - b.timestamp);
        resolve(items);
      };
      req.onerror = (err) => reject(err);
    });
  } catch (err) {
    return [];
  }
}

export async function removeQueueItem(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);

    req.onsuccess = () => {
      notifyStatus();
      resolve();
    };
    req.onerror = (err) => reject(err);
  });
}

export async function updateQueueItem(item: QueueItem): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(item);

    req.onsuccess = () => {
      notifyStatus();
      resolve();
    };
    req.onerror = (err) => reject(err);
  });
}

// ----------------------------------------------------------------------
// SERVER-AVAILABILITY FLAG (fed by the /api/health ping hook)
// ----------------------------------------------------------------------
// navigator.onLine only detects the network interface, not whether the
// server is actually reachable (LAN up but server down). The health hook
// sets this flag so the queue never burns retries against a dead server
// and drains immediately when it comes back.
let serverOnline = true;
const serverListeners = new Set<(online: boolean) => void>();

export function setServerOnline(online: boolean) {
  const changed = serverOnline !== online;
  serverOnline = online;
  if (changed) {
    serverListeners.forEach((fn) => fn(online));
    notifyStatus();
    if (online) drainQueue();
  }
}

export function getServerOnline() {
  return serverOnline;
}

export function subscribeServerOnline(listener: (online: boolean) => void) {
  serverListeners.add(listener);
  listener(serverOnline);
  return () => {
    serverListeners.delete(listener);
  };
}

// ----------------------------------------------------------------------
// AUTO-SYNC DRAINING MECHANISM WITH CONFLICT RESOLUTION
// ----------------------------------------------------------------------
let isSyncing = false;

export async function drainQueue(): Promise<void> {
  if (
    typeof window === "undefined" ||
    !navigator.onLine ||
    !serverOnline ||
    isSyncing
  )
    return;

  isSyncing = true;
  notifyStatus();

  let autoMergedCount = 0;
  let flaggedConflictCount = 0;

  try {
    const queue = await getPendingQueue();
    const pendingItems = queue.filter(
      (i) => i.status === "PENDING" || (i.status === "FAILED" && i.retries < 3),
    );

    for (const item of pendingItems) {
      try {
        const res = await fetch(item.endpoint, {
          method: item.method,
          headers: {
            "Content-Type": "application/json",
            "X-Client-ID": item.clientId,
            "X-Client-Timestamp": String(item.clientTimestamp),
          },
          body: item.body,
        });

        const resData = await res.json().catch(() => ({}));

        // Case A: 2xx Success or 409 Duplicate -> Chronologically Auto-Merged
        if (res.ok || (res.status === 409 && resData.duplicate)) {
          await removeQueueItem(item.id);
          autoMergedCount++;
        }
        // Case B: 412 Precondition Failed or 409 Conflict -> State Lock Conflict
        else if (res.status === 412 || res.status === 409 || resData.conflict) {
          item.status = "FLAGGED_CONFLICT";
          item.serverTimestamp = resData.serverTimestamp || Date.now();
          item.conflictReason =
            resData.message ||
            "State Conflict: Machine/WO status modified by another terminal during offline window.";
          await updateQueueItem(item);
          flaggedConflictCount++;

          emitToast(
            "⚠️ State Conflict Flagged",
            `Action on ${item.endpoint} conflicted with server state. Flagged for supervisor review on /reconcile.`,
            "CONFLICT",
          );
        }
        // Case C: Transient Network/Server Retry
        else {
          item.retries += 1;
          if (item.retries >= 3) {
            item.status = "FAILED";
          }
          await updateQueueItem(item);
        }
      } catch (networkError) {
        item.retries += 1;
        if (item.retries >= 3) {
          item.status = "FAILED";
        }
        await updateQueueItem(item);
        break; // stop loop if network error persists
      }
    }

    if (autoMergedCount > 0 && flaggedConflictCount === 0) {
      emitToast(
        "📡 Auto-Sync Complete",
        `${autoMergedCount} offline action(s) auto-merged chronologically to server.`,
        "SUCCESS",
      );
    }
  } catch (err) {
    console.error("Queue drain error:", err);
  } finally {
    isSyncing = false;
    notifyStatus();
  }
}

// ----------------------------------------------------------------------
// OFFLINE FETCH WRAPPER
// ----------------------------------------------------------------------
export async function offlineFetchWrapper(
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const method = (options.method || "GET").toUpperCase();
  const isWriteMethod =
    method === "POST" || method === "PUT" || method === "PATCH";

  let bodyObj: any = {};
  if (options.body && typeof options.body === "string") {
    try {
      bodyObj = JSON.parse(options.body);
    } catch (e) {
      bodyObj = {};
    }
  }

  const clientId = bodyObj.clientId || generateUUID();
  const clientTimestamp = bodyObj.clientTimestamp || Date.now();
  bodyObj.clientId = clientId;
  bodyObj.clientTimestamp = clientTimestamp;

  // IF OFFLINE: Queue action immediately
  if (typeof window !== "undefined" && !navigator.onLine && isWriteMethod) {
    await enqueueAction(endpoint, method, bodyObj, clientId);

    emitToast(
      "📡 Network Offline",
      "Action saved locally in Offline Sync Queue. Will auto-sync when connection restores.",
      "INFO",
    );

    return new Response(
      JSON.stringify({
        success: true,
        offline: true,
        message: "Network offline. Action saved locally in Offline Sync Queue.",
        clientId,
        clientTimestamp,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // ONLINE TRY FETCH WITH CATCH FOR NETWORK DROP
  try {
    const headers = {
      ...(options.headers || {}),
      "X-Client-ID": clientId,
      "X-Client-Timestamp": String(clientTimestamp),
    };

    const res = await fetch(endpoint, {
      ...options,
      headers,
      body: isWriteMethod ? JSON.stringify(bodyObj) : options.body,
    });

    return res;
  } catch (networkErr) {
    if (isWriteMethod) {
      await enqueueAction(endpoint, method, bodyObj, clientId);

      emitToast(
        "📡 Connection Dropped",
        "Action saved locally in Offline Sync Queue. Will auto-sync when connection restores.",
        "INFO",
      );

      return new Response(
        JSON.stringify({
          success: true,
          offline: true,
          message:
            "Connection dropped. Action saved locally in Offline Sync Queue.",
          clientId,
          clientTimestamp,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    throw networkErr;
  }
}

// ----------------------------------------------------------------------
// GLOBAL LISTENERS (ONLINE EVENT & 30s TICKER)
// ----------------------------------------------------------------------
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    notifyStatus();
    drainQueue();
  });

  window.addEventListener("offline", () => {
    notifyStatus();
  });

  setInterval(() => {
    if (navigator.onLine) {
      drainQueue();
    } else {
      notifyStatus();
    }
  }, 30000);
}
