// offlineSync.js — Robust Offline Sync with Conflict Resolution
// This module implements an append‑only event log, configurable conflict handling,
// exponential back‑off retries, and idempotent sync requests.
//
// Smart Sync additions:
//   - Each attempt has a unique attemptId and timestamp
//   - Queue statuses: pending → synced | failed
//   - Dedupe logic: ignore duplicates by attemptId at queue time and sync time
//   - Dispatches fine-grained sync status events for UI indicators

(function () {
  "use strict";

  const quizUtils = (typeof window !== 'undefined' && window.quizUtils) || 
                    (typeof require !== 'undefined' && require('./quizUtils.js')) || 
                    (typeof globalThis !== 'undefined' && globalThis.quizUtils) ||
                    {
                      resolveSyncConflicts(events = [], strategy = "latest") {
                        if (!events.length) return [];
                        if (strategy === "latest") {
                          const map = new Map();
                          events.forEach((e) => {
                            const key = `${e.type}|${e.payload?.topicId || ""}|${e.payload?.quizId || ""}`;
                            const existing = map.get(key);
                            if (!existing || e.timestamp > existing.timestamp) {
                              map.set(key, e);
                            }
                          });
                          return Array.from(map.values());
                        }
                        return events;
                      }
                    };

  // ----- Configuration -------------------------------------------------------
  const DEFAULT_CONFIG = {
    maxRetries: 5,
    baseBackoffMs: 1000, // 1 second
    conflictStrategy: "latest", // "latest" | "maxScore" | "perAttempt"
  };
  // Users can override via window.offlineSyncConfig before this script loads.
  const config = Object.assign({}, DEFAULT_CONFIG, window.offlineSyncConfig || {});

  // ----- Persistence ----------------------------------------------------------
  const LOG_KEY = "learnsphere_offline_log_v1";

  function _loadLog() {
    try {
      const raw = localStorage.getItem(LOG_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function _saveLog(log) {
    try {
      localStorage.setItem(LOG_KEY, JSON.stringify(log));
    } catch (e) {
      console.warn("LearnSphere: Could not persist offline log.", e);
    }
  }

  // ----- Helpers -------------------------------------------------------------
  function _uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /**
   * Generate a stable attemptId from payload fields or create a fresh one.
   * If the payload already has an attemptId, use it (idempotent).
   */
  function _ensureAttemptId(payload) {
    if (payload && payload.attemptId) return payload.attemptId;
    // Build a deterministic-ish ID from key fields when possible
    const parts = [
      payload?.topicId || "",
      payload?.quizId || "",
      payload?.finishedAt || payload?.practiceDate || "",
      payload?.correctCount ?? "",
      payload?.totalQuestions ?? "",
    ].join("|");
    // If we have meaningful fields, hash them; otherwise use a random id
    if (parts.replace(/\|/g, "").length > 0) {
      // Simple string hash for local dedupe (not crypto-grade)
      let hash = 0;
      for (let i = 0; i < parts.length; i++) {
        hash = ((hash << 5) - hash + parts.charCodeAt(i)) | 0;
      }
      return "att_" + Math.abs(hash).toString(36) + "_" + (payload?.finishedAt || Date.now()).toString(36);
    }
    return "att_" + _uid();
  }

  function _backoffDelay(retryCount) {
    return config.baseBackoffMs * Math.pow(2, retryCount - 1);
  }

  // ----- Conflict Resolution -------------------------------------------------
  function _resolveConflicts(events) {
    return quizUtils.resolveSyncConflicts(events, config.conflictStrategy);
  }

  // ----- Public API ----------------------------------------------------------

  /**
   * Queue a progress update for offline sync.
   * Deduplicates by attemptId — if an event with the same attemptId
   * already exists in the queue, the new one is silently dropped.
   *
   * @param {string} type - Event type (e.g. "quiz_attempt", "retry_attempt")
   * @param {object} payload - Event payload; may include attemptId
   * @returns {{ queued: boolean, attemptId: string, reason?: string }}
   */
  function queueProgressUpdate(type, payload) {
    const log = _loadLog();
    const now = Date.now();

    // Ensure every queued item has a unique attemptId
    const attemptId = _ensureAttemptId(payload);
    const enrichedPayload = { ...payload, attemptId };

    // Dedupe: reject if an event with this attemptId is already queued
    const existingIdx = log.findIndex(
      (e) => e.payload?.attemptId === attemptId
    );
    if (existingIdx !== -1) {
      return { queued: false, attemptId, reason: "duplicate_attemptId" };
    }

    const event = {
      id: _uid(),
      attemptId,
      type,
      payload: enrichedPayload,
      timestamp: now,
      status: "pending",   // "pending" | "synced" | "failed"
      retryCount: 0,
      nextRetryAt: null,
      lastError: null,
    };
    log.push(event);
    // Keep log bounded (max 200 entries, remove oldest synced first)
    if (log.length > 200) {
      // Prefer removing synced items first
      const syncedIndices = [];
      log.forEach((e, i) => { if (e.status === "synced") syncedIndices.push(i); });
      if (syncedIndices.length > 0) {
        const removeCount = Math.min(syncedIndices.length, log.length - 200);
        for (let i = removeCount - 1; i >= 0; i--) {
          log.splice(syncedIndices[i], 1);
        }
      }
      if (log.length > 200) {
        log.splice(0, log.length - 200);
      }
    }
    _saveLog(log);
    _dispatchQueueChange(_pendingCount(log));
    return { queued: true, attemptId };
  }

  function _pendingCount(log) {
    const now = Date.now();
    return log.filter(
      (e) => e.status === "pending" && (!e.nextRetryAt || e.nextRetryAt <= now)
    ).length;
  }

  function _failedCount(log) {
    return log.filter((e) => e.status === "failed").length;
  }

  function getQueueLength() {
    const log = _loadLog();
    return _pendingCount(log);
  }

  /**
   * Get detailed queue status for UI display.
   * @returns {{ pending: number, synced: number, failed: number, total: number, items: Array }}
   */
  function getQueueStatus() {
    const log = _loadLog();
    return {
      pending: log.filter((e) => e.status === "pending").length,
      synced: log.filter((e) => e.status === "synced").length,
      failed: log.filter((e) => e.status === "failed").length,
      total: log.length,
      items: log.map((e) => ({
        id: e.id,
        attemptId: e.attemptId,
        type: e.type,
        status: e.status,
        timestamp: e.timestamp,
        retryCount: e.retryCount,
        lastError: e.lastError,
      })),
    };
  }

  function isOnline() {
    return navigator.onLine !== false;
  }

  // ----- Sync Endpoint -------------------------------------------------------
  function _syncEndpoint() {
    if (window && window.__learnsphereSyncEndpoint) return window.__learnsphereSyncEndpoint;
    return "/api/sync-progress";
  }

  async function _postSyncItem(event) {
    const endpoint = _syncEndpoint();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        id: event.id,
        attemptId: event.attemptId,  // Server uses this for idempotent upsert
        type: event.type,
        payload: event.payload,
        timestamp: event.timestamp,
      }),
    });

    // 409 Conflict = server already has this attemptId → treat as success (dedupe)
    if (res.status === 409) {
      console.info(`LearnSphere: Attempt ${event.attemptId} already synced (server dedupe).`);
      return { deduped: true };
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Sync failed: ${res.status} ${res.statusText}${text ? ": " + text : ""}`);
    }
    return { deduped: false };
  }

  async function flushQueue() {
    const log = _loadLog();
    if (!log.length) return;
    if (!isOnline()) {
      _dispatchQueueChange(_pendingCount(log));
      return;
    }

    // Filter events ready for sync
    const now = Date.now();
    const ready = log.filter(
      (e) => e.status === "pending" && (!e.nextRetryAt || e.nextRetryAt <= now)
    );
    if (!ready.length) return;

    // Dedupe within the ready batch: keep only the latest per attemptId
    const byAttemptId = new Map();
    for (const e of ready) {
      const aid = e.attemptId || e.payload?.attemptId;
      if (!aid) { byAttemptId.set(e.id, e); continue; }
      const existing = byAttemptId.get(aid);
      if (!existing || e.timestamp > existing.timestamp) {
        // Mark older duplicate as synced (dedupe)
        if (existing) existing.status = "synced";
        byAttemptId.set(aid, e);
      } else {
        // This event is older → mark as synced (dedupe)
        e.status = "synced";
      }
    }

    // Resolve conflicts according to strategy (produces a subset to send)
    const deduped = Array.from(byAttemptId.values());
    const toSync = _resolveConflicts(deduped);

    _dispatchSyncStart(toSync.length);

    let flushed = 0;
    let failed = 0;
    for (const event of toSync) {
      try {
        const result = await _postSyncItem(event);
        event.status = "synced";
        flushed++;
      } catch (e) {
        console.warn("LearnSphere: Failed to sync event", event.id, e);
        event.lastError = e.message || String(e);
        // Apply exponential back‑off
        event.retryCount = Math.min(event.retryCount + 1, config.maxRetries);
        if (event.retryCount >= config.maxRetries) {
          // Give up on this event — mark as failed for manual inspection
          event.status = "failed";
          failed++;
          console.error(`LearnSphere: Max retries reached for event ${event.id} (attemptId: ${event.attemptId})`);
        } else {
          event.nextRetryAt = now + _backoffDelay(event.retryCount);
        }
        // Stop processing further to avoid hammering the server
        break;
      }
    }

    // Keep synced items for a while (audit trail), but remove oldest synced if over limit
    _saveLog(log);

    if (flushed > 0) {
      console.info(`LearnSphere: Synced ${flushed} queued progress update(s).`);
      _dispatchSyncComplete(flushed, failed);
    } else if (failed > 0) {
      _dispatchSyncFailed(failed);
    }
    _dispatchQueueChange(_pendingCount(log));
  }

  /**
   * Retry all failed items (reset status to pending, clear retry counters).
   */
  function retryFailed() {
    const log = _loadLog();
    let reset = 0;
    log.forEach((e) => {
      if (e.status === "failed") {
        e.status = "pending";
        e.retryCount = 0;
        e.nextRetryAt = null;
        e.lastError = null;
        reset++;
      }
    });
    if (reset > 0) {
      _saveLog(log);
      _dispatchQueueChange(_pendingCount(log));
    }
    return reset;
  }

  /**
   * Purge synced items from the log to free localStorage space.
   */
  function purgeSynced() {
    const log = _loadLog();
    const remaining = log.filter((e) => e.status !== "synced");
    _saveLog(remaining);
    return log.length - remaining.length;
  }

  // ----- Event Dispatch ------------------------------------------------------
  function _dispatchQueueChange(pendingCount) {
    try {
      const log = _loadLog();
      window.dispatchEvent(new CustomEvent("learnsphere:queue-change", {
        detail: { pendingCount, failedCount: _failedCount(log) }
      }));
    } catch {}
  }

  function _dispatchSyncStart(itemCount) {
    try {
      window.dispatchEvent(new CustomEvent("learnsphere:sync-start", {
        detail: { itemCount }
      }));
    } catch {}
  }

  function _dispatchSyncComplete(syncedCount, failedCount) {
    try {
      window.dispatchEvent(new CustomEvent("learnsphere:sync-complete", {
        detail: { syncedCount, failedCount: failedCount || 0 }
      }));
    } catch {}
  }

  function _dispatchSyncFailed(failedCount) {
    try {
      window.dispatchEvent(new CustomEvent("learnsphere:sync-failed", {
        detail: { failedCount }
      }));
    } catch {}
  }

  // ----- UI: Offline Status Bar ---------------------------------------------
  function initOfflineStatusBar() {
    const container = document.querySelector(".container");
    if (!container) return;
    const bar = document.createElement("div");
    bar.id = "offline-status-bar";
    bar.setAttribute("role", "status");
    bar.setAttribute("aria-live", "polite");
    bar.style.cssText = [
      "display: none",
      "padding: 10px 16px",
      "border-radius: 10px",
      "margin-bottom: 16px",
      "font-size: 0.88rem",
      "font-weight: 600",
      "font-family: 'Poppins', 'Inter', sans-serif",
      "transition: all 0.3s ease",
      "position: relative",
      "overflow: hidden",
    ].join(";");
    container.insertBefore(bar, container.firstChild);

    if (!document.getElementById("offline-status-styles")) {
      const style = document.createElement("style");
      style.id = "offline-status-styles";
      style.textContent = `
        @keyframes offlineSlideDown { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes offlinePulse { 0%,100% { box-shadow:0 0 0 0 rgba(239,68,68,0.3);} 50% { box-shadow:0 0 0 6px rgba(239,68,68,0);} }
        @keyframes syncPulse { 0%,100% { box-shadow:0 0 0 0 rgba(34,197,94,0.3);} 50% { box-shadow:0 0 0 6px rgba(34,197,94,0);} }
        @keyframes syncingPulse { 0%,100% { box-shadow:0 0 0 0 rgba(59,130,246,0.3);} 50% { box-shadow:0 0 0 6px rgba(59,130,246,0);} }
        #offline-status-bar.offline-active { display:flex!important; align-items:center; gap:10px; background:linear-gradient(135deg,rgba(239,68,68,0.15),rgba(239,68,68,0.08)); border:1px solid rgba(239,68,68,0.3); color:#fca5a5; animation:offlineSlideDown 0.3s ease-out, offlinePulse 2s ease-in-out 3; }
        #offline-status-bar.syncing-active { display:flex!important; align-items:center; gap:10px; background:linear-gradient(135deg,rgba(59,130,246,0.15),rgba(59,130,246,0.08)); border:1px solid rgba(59,130,246,0.3); color:#93c5fd; animation:offlineSlideDown 0.3s ease-out, syncingPulse 1.5s ease-in-out infinite; }
        #offline-status-bar.sync-success { display:flex!important; align-items:center; gap:10px; background:linear-gradient(135deg,rgba(34,197,94,0.15),rgba(34,197,94,0.08)); border:1px solid rgba(34,197,94,0.3); color:#86efac; animation:offlineSlideDown 0.3s ease-out, syncPulse 1.5s ease-in-out 2; }
        #offline-status-bar .queue-badge { background:rgba(255,255,255,0.15); padding:2px 8px; border-radius:12px; font-size:0.78rem; margin-left:auto; }
        #offline-status-bar .dismiss-btn { background:none; border:none; color:inherit; cursor:pointer; font-size:1.1rem; padding:0 4px; margin-left:8px; opacity:0.7; transition:opacity 0.2s; }
        #offline-status-bar .dismiss-btn:hover { opacity:1; }
      `;
      document.head.appendChild(style);
    }

    let dismissTimer = null;
    function updateBar() {
      const online = isOnline();
      const pending = getQueueLength();
      const status = getQueueStatus();
      if (!online) {
        bar.className = "offline-active";
        let badgeHtml = "";
        if (pending > 0) badgeHtml += `<span class="queue-badge">${pending} pending</span>`;
        if (status.failed > 0) badgeHtml += `<span class="queue-badge" style="background:rgba(239,68,68,0.3);">${status.failed} failed</span>`;
        bar.innerHTML = `
          <span>📴 You're offline — your quiz works normally. Progress is saved locally.</span>
          ${badgeHtml}
        `;
        if (dismissTimer) { clearTimeout(dismissTimer); dismissTimer = null; }
      } else if (bar.classList.contains("offline-active") || bar.classList.contains("syncing-active")) {
        bar.className = "sync-success";
        let msg = "✅ Back online — progress synced!";
        if (status.failed > 0) {
          msg = `⚠️ Back online — ${status.failed} item(s) failed to sync.`;
        }
        bar.innerHTML = `
          <span>${msg}</span>
          ${status.failed > 0 ? `<button class="queue-badge" id="retryFailedBtn" style="cursor:pointer; background:rgba(239,68,68,0.25);">Retry</button>` : ""}
          <button class="dismiss-btn" aria-label="Dismiss" title="Dismiss">✕</button>
        `;
        bar.querySelector('.dismiss-btn')?.addEventListener('click', () => { bar.className = ""; bar.style.display = "none"; });
        const retryBtn = bar.querySelector('#retryFailedBtn');
        if (retryBtn) {
          retryBtn.addEventListener('click', () => {
            retryFailed();
            flushQueue();
          });
        }
        if (status.failed === 0) {
          dismissTimer = setTimeout(() => { bar.className = ""; bar.style.display = "none"; }, 5000);
        }
      }
    }

    function showSyncing(itemCount) {
      bar.className = "syncing-active";
      bar.innerHTML = `
        <span>🔄 Syncing ${itemCount} queued update${itemCount !== 1 ? "s" : ""}…</span>
        <span class="queue-badge">${itemCount} items</span>
      `;
    }

    window.addEventListener("online", updateBar);
    window.addEventListener("offline", updateBar);
    window.addEventListener("learnsphere:sync-start", (e) => { showSyncing(e.detail?.itemCount || 0); });
    window.addEventListener("learnsphere:sync-complete", () => { if (isOnline()) updateBar(); });
    window.addEventListener("learnsphere:sync-failed", () => { if (isOnline()) updateBar(); });
    window.addEventListener("learnsphere:queue-change", (e) => { if (!isOnline()) updateBar(); });
    updateBar();
  }

  // ----- Auto‑sync on reconnect ------------------------------------------------
  function _onOnline() {
    console.info("LearnSphere: Back online — flushing offline log.");
    flushQueue();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => {
          // Notify SW to coordinate sync across all tabs
          if (reg.active) {
            reg.active.postMessage({ action: "register-sync" });
          }
          // Also register Background Sync if available
          if ("SyncManager" in window) {
            return reg.sync.register("learnsphere-sync-progress");
          }
        })
        .catch(() => {});
    }
  }

  window.addEventListener("online", _onOnline);

  // Initial flush on page load if applicable
  function _initFlush() {
    if (isOnline() && getQueueLength() > 0) {
      flushQueue();
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _initFlush);
  } else {
    _initFlush();
  }

  // Auto‑init status bar
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initOfflineStatusBar);
  } else {
    initOfflineStatusBar();
  }

  // ----- UI: Offline pack download status (optional relay) -----------------
  // If a page includes the pack UI, we can still listen here and let it update its own DOM.
  // This module does not assume specific DOM ids; it only re-dispatches a window event.
  function initOfflinePackStatusRelay() {
    if (!('serviceWorker' in navigator)) return;
    try {
      navigator.serviceWorker.addEventListener('message', (event) => {
        const data = event.data || {};
        if (data.action !== 'offline-pack-status') return;
        try {
          window.dispatchEvent(
            new CustomEvent('learnsphere:offline-pack-status', { detail: data })
          );
        } catch {}
      });
    } catch {}
  }

  initOfflinePackStatusRelay();

  // Export API
  window.offlineSync = {
    queueProgressUpdate,
    flushQueue,
    getQueueLength,
    getQueueStatus,
    retryFailed,
    purgeSynced,
    isOnline,
    initOfflineStatusBar,
  };
})();

