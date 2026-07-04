/*
 * notifications.js — Event-based In-App Notifications (Learner)
 *
 * Responsibilities:
 * - Maintain an in-app notification feed in localStorage
 * - Provide a simple event API to push notifications
 * - Provide a UI badge + panel renderer
 * - Trigger milestone events (streak, weekly report, quiz/review readiness)
 */

(function () {
  const STORAGE_KEY = "learnsphere_notifications_v1";

  function _t(key, params) {
    try {
      return window.i18n && typeof window.i18n.t === "function" ? window.i18n.t(key, params) : key;
    } catch {
      return key;
    }
  }


  const WEEKLY_REPORT_KEY = "learnsphere_weekly_report_notified_v1"; // YYYY-Www
  const LAST_QUIZ_READY_CHECK_KEY = "learnsphere_quiz_ready_check_v1"; // YYYY-MM-DD

  // Badge count = unread notifications count
  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { notifications: [], lastEventAt: null };
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") throw new Error("bad store");
      if (!Array.isArray(parsed.notifications)) parsed.notifications = [];
      return parsed;
    } catch {
      return { notifications: [], lastEventAt: null };
    }
  }

  function saveStore(store) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (e) {
      console.warn("LearnSphere: could not save notifications", e);
    }
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function uuid() {
    // Simple unique id for local-only usage
    return "n_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
  }

  function getUnreadCount(store) {
    return (store.notifications || []).filter((n) => !n.readAt).length;
  }

  function getWeekToken(d = new Date()) {
    // ISO week token YYYY-Www (local date approximation)
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
    const weekStr = String(weekNo).padStart(2, "0");
    return `${date.getUTCFullYear()}-W${weekStr}`;
  }

  function getTodayToken() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function pushNotification({ type, title, message, ctaUrl = null, dedupeKey = null }) {
    const store = loadStore();

    // Dedupe (best-effort): if same dedupeKey exists and is unread, don't add again.
    if (dedupeKey) {
      const existing = store.notifications.find((n) => n.dedupeKey === dedupeKey);
      if (existing) {
        // If it was read, we may want to re-notify only if caller asked.
        // For now, keep it simple: do nothing if existing.
        return { inserted: false, reason: "deduped" };
      }
    }

    const n = {
      id: uuid(),
      type,
      title,
      message,
      ctaUrl,
      createdAt: nowISO(),
      readAt: null,
      dedupeKey: dedupeKey || null,
    };

    store.notifications.unshift(n);
    store.lastEventAt = nowISO();
    saveStore(store);

    return { inserted: true };
  }

  function markAllRead() {
    const store = loadStore();
    const t = nowISO();
    store.notifications = (store.notifications || []).map((n) => {
      if (!n.readAt) n.readAt = t;
      return n;
    });
    saveStore(store);
    return store;
  }

  function markReadById(id) {
    const store = loadStore();
    const t = nowISO();
    store.notifications = (store.notifications || []).map((n) => {
      if (n.id === id && !n.readAt) n.readAt = t;
      return n;
    });
    saveStore(store);
    return store;
  }

  function escapeHTML(str) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(String(str)));
    return div.innerHTML;
  }

  function ensurePanel() {
    // We inject the bell + panel only once.
    const root = document;
    let panel = root.getElementById("notifications-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "notifications-panel";
      panel.style.display = "none";
      panel.style.position = "fixed";
      panel.style.right = "16px";
      panel.style.top = "70px";
      panel.style.width = "min(360px, calc(100vw - 32px))";
      panel.style.maxHeight = "70vh";
      panel.style.overflow = "auto";
      panel.style.zIndex = "10000";
      panel.style.background = "#0f1115";
      panel.style.border = "1px solid rgba(255,255,255,0.10)";
      panel.style.borderRadius = "14px";
      panel.style.boxShadow = "0 18px 60px rgba(0,0,0,0.45)";

      panel.innerHTML = `
        <div style="padding:12px 12px 10px; border-bottom:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:space-between; gap:10px;">
          <div style="font-weight:800;">🔔 ${_t("notifications.panelTitle")}</div>

          <div style="display:flex; gap:8px; align-items:center;">
            <button id="notifications-mark-all" style="background: rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.10); color: rgba(255,255,255,0.9); border-radius:10px; padding:6px 10px; cursor:pointer; font-weight:700; font-size:12px;">${_t("notifications.markAllRead")}</button>
            <button id="notifications-close" aria-label="${_t("notifications.close")}" style="background: transparent; border:1px solid rgba(255,255,255,0.18); color: rgba(255,255,255,0.9); border-radius:10px; padding:6px 10px; cursor:pointer; font-weight:900; font-size:12px;">✕</button>

          </div>
        </div>
        <div id="notifications-list" style="padding:10px; display:flex; flex-direction:column; gap:10px;">
        </div>
      `;

      document.body.appendChild(panel);

      const btnAll = document.getElementById("notifications-mark-all");
      if (btnAll) {
        btnAll.addEventListener("click", () => {
          markAllRead();
          render();
        });
      }

      const btnClose = document.getElementById("notifications-close");
      if (btnClose) {
        btnClose.addEventListener("click", () => hidePanel());
      }

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") hidePanel();
      });
    }

    return panel;
  }

  function showPanel() {
    const panel = ensurePanel();
    panel.style.display = "block";
    render();
  }

  function hidePanel() {
    const panel = document.getElementById("notifications-panel");
    if (panel) panel.style.display = "none";
  }

  function renderList(notifications) {
    const listEl = document.getElementById("notifications-list");
    if (!listEl) return;

    if (!notifications || notifications.length === 0) {
      listEl.innerHTML = `
        <div style="color: rgba(255,255,255,0.65); font-size:13px; padding:10px;">
          ${_t("notifications.empty")}
        </div>
      `;

      return;
    }

    listEl.innerHTML = "";

    notifications.slice(0, 25).forEach((n) => {
      const isUnread = !n.readAt;

      const item = document.createElement("div");
      item.style.padding = "10px";
      item.style.borderRadius = "12px";
      item.style.border = "1px solid rgba(255,255,255,0.08)";
      item.style.background = isUnread ? "rgba(102,252,241,0.06)" : "rgba(255,255,255,0.03)";

      const title = escapeHTML(n.title || _t("notifications.defaultTitle"));

      const msg = escapeHTML(n.message || "");

      item.innerHTML = `
        <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
          <div>
            <div style="font-weight:900; color: ${isUnread ? "#66fcf1" : "rgba(255,255,255,0.95)"}; font-size:13px;">${title}</div>
            <div style="margin-top:4px; color: rgba(255,255,255,0.78); font-size:12.5px; line-height:1.35;">${msg}</div>
          </div>
          <div style="font-size:11px; color: rgba(255,255,255,0.55); white-space:nowrap;">${new Date(n.createdAt).toLocaleString()}</div>
        </div>
        ${n.ctaUrl ? `
          <div style="margin-top:10px; display:flex; justify-content:flex-end;">
            <a href="${escapeHTML(n.ctaUrl)}" style="text-decoration:none; background: rgba(102,252,241,0.10); border:1px solid rgba(102,252,241,0.35); color:#66fcf1; padding:7px 10px; border-radius:10px; font-weight:900; font-size:12px;">${_t("notifications.open")}</a>

          </div>
        ` : ""}
        ${isUnread ? `
          <div style="margin-top:10px; display:flex; justify-content:flex-end;">
            <button data-notif-id="${escapeHTML(n.id)}" style="background: rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.10); color: rgba(255,255,255,0.9); border-radius:10px; padding:7px 10px; cursor:pointer; font-weight:900; font-size:12px;">${_t("notifications.markRead")}</button>

          </div>
        ` : ""}
      `;

      if (isUnread) {
        const markBtn = item.querySelector("button[data-notif-id]");
        if (markBtn) {
          markBtn.addEventListener("click", (e) => {
            e.preventDefault();
            const id = markBtn.getAttribute("data-notif-id");
            if (id) markReadById(id);
            renderBadgeOnly();
            render();
          });
        }
      }

      // Clicking item title could also mark read; keep it minimal.
      listEl.appendChild(item);
    });
  }

  function renderBadgeOnly() {
    const badge = document.getElementById("notifications-badge-count");
    if (!badge) return;
    const store = loadStore();
    const unread = getUnreadCount(store);
    badge.textContent = String(unread);

    badge.style.display = unread > 0 ? "inline-flex" : "none";
  }

  function render() {
    const listEl = document.getElementById("notifications-list");
    if (!listEl) return;

    const store = loadStore();
    renderList(store.notifications || []);
    renderBadgeOnly();
  }

  function initUI() {
    // Inject bell button into navbar area if present.
    // home.html does not have navbar; it has a headerStreakBadge. We'll add bell next to it.
    // my_progress.html has header via navbar.js; we inject into header if possible.

    if (document.getElementById("notifications-bell")) return;

    // Try find insertion points.
    const headerStreak = document.getElementById("headerStreakBadge");
    let anchor = null;

    if (headerStreak) {
      anchor = headerStreak.parentElement;
    } else {
      // fallback: top navbar right side
      anchor = document.querySelector("header.navbar .buttons") || document.querySelector("header.navbar");
    }

    if (!anchor) return;

    const wrapper = document.createElement("div");
    wrapper.style.position = "relative";
    wrapper.style.display = "inline-flex";
    wrapper.style.alignItems = "center";
    wrapper.style.gap = "8px";

    wrapper.innerHTML = `
      <button id="notifications-bell" aria-label="Open notifications" style="background: rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.14); color: rgba(255,255,255,0.92); border-radius:12px; padding:8px 12px; cursor:pointer; font-weight:900; display:flex; align-items:center; gap:8px;">
        <span>🔔</span>
        <span style="display:none;">Notifications</span>
        <span id="notifications-badge-count" style="display:none; min-width:20px; height:20px; padding:0 6px; background:#ff4500; color:#fff; border-radius:999px; align-items:center; justify-content:center; font-size:12px; font-weight:900;">0</span>
      </button>
    `;

    anchor.appendChild(wrapper);

    const bellBtn = document.getElementById("notifications-bell");
    if (bellBtn) {
      bellBtn.addEventListener("click", () => {
        const panel = document.getElementById("notifications-panel");
        const isOpen = panel && panel.style.display === "block";
        if (isOpen) hidePanel();
        else showPanel();
      });
    }

    // Clicking outside closes panel
    document.addEventListener("click", (e) => {
      const panel = document.getElementById("notifications-panel");
      const bell = document.getElementById("notifications-bell");
      if (!panel || panel.style.display !== "block") return;
      if (bell && bell.contains(e.target)) return;
      if (panel.contains(e.target)) return;
      hidePanel();
    });

    renderBadgeOnly();
  }

  /*
   * Milestone triggers
   */

  function triggerStreakMaintainedIfNeeded() {
    if (!window.studyProgress || typeof window.studyProgress.loadStreakState !== "function") return;
    const s = window.studyProgress.loadStreakState();
    const current = s.currentStreak || 0;
    if (current <= 0) return;

    // Dedupe per day per streak value.
    const dedupeKey = `streak-maintained-${getTodayToken()}-${current}`;

    // We only trigger when user was active today (lastActiveDate == today)
    const activeToday = s.lastActiveDate === getTodayToken();
    if (!activeToday) return;

    pushNotification({
      type: "streak",
      title: _t("notifications.streakMaintained.title"),
      message: _t("notifications.streakMaintained.message", { count: current }),

      ctaUrl: "my_progress.html",
      dedupeKey,
    });
  }

  function triggerWeeklyReportIfDue() {
    const weekToken = getWeekToken(new Date());
    const already = localStorage.getItem(WEEKLY_REPORT_KEY);
    if (already === weekToken) return;

    // Notify on first load of week
    pushNotification({
      type: "weekly_report",
      title: _t("notifications.weeklyReport.title"),
      message: _t("notifications.weeklyReport.message"),

      ctaUrl: "my_progress.html",
      dedupeKey: `weekly-${weekToken}`,
    });

    localStorage.setItem(WEEKLY_REPORT_KEY, weekToken);
  }

  function triggerNewQuizReadyIfDue() {
    // Avoid spamming: check at most once per day.
    const today = getTodayToken();
    const last = localStorage.getItem(LAST_QUIZ_READY_CHECK_KEY);
    if (last === today) return;

    const shouldHaveRecommendations =
      window.quizProgress && typeof window.quizProgress.getRecommendedTopics === "function";

    let hasRec = false;
    let recCount = 0;
    if (shouldHaveRecommendations) {
      try {
        const recs = window.quizProgress.getRecommendedTopics({ limit: 3 }) || [];
        recCount = recs.length;
        hasRec = recCount > 0;
      } catch {
        hasRec = false;
      }
    }

    if (!hasRec) {
      // Also consider review due: use schedule stored in localStorage.
      // If dueCount > 0, still show new quiz ready.
      try {
        if (window.progress && typeof window.progress === "object") {
          // no-op; progress.js doesn't expose due count.
        }
      } catch {}
    }

    if (hasRec) {
      pushNotification({
        type: "quiz_ready",
        title: _t("notifications.quizReady.title"),
        message: _t(recCount === 1 ? "notifications.quizReady.messageSingle" : "notifications.quizReady.messagePlural", { count: recCount }),

        ctaUrl: "home.html",
        dedupeKey: `quiz-ready-${today}-${recCount}`,
      });
    }

    localStorage.setItem(LAST_QUIZ_READY_CHECK_KEY, today);
  }

  function checkAndTriggerAll() {
    // UI first so user sees immediate badge updates.
    initUI();

    // Trigger events (best-effort; depends on pages loading progress/quizProgress first)
    try {
      if (window.quizProgress) {
        triggerNewQuizReadyIfDue();
      }
    } catch {}

    try {
      if (window.studyProgress) {
        triggerStreakMaintainedIfNeeded();
      }
    } catch {}

    try {
      triggerWeeklyReportIfDue();
    } catch {}

    render();
  }

  // Exposed API (called by progress flows)
  function notifyFromEvent({ type, title, message, ctaUrl = null, dedupeKey = null }) {
    initUI();
    pushNotification({ type, title, message, ctaUrl, dedupeKey });
    render();
  }

  // Exposed i18n-backed helper (optional)
  function notifyFromEventI18n({ type, titleKey, messageKey, messageParams, ctaUrl = null, dedupeKey = null }) {
    notifyFromEvent({
      type,
      title: _t(titleKey),
      message: _t(messageKey, messageParams),
      ctaUrl,
      dedupeKey,
    });
  }


  // Auto init on load (for pages that include notifications.js)
  window.addEventListener("DOMContentLoaded", () => {
    // If progress scripts aren't loaded yet, triggers will still be best-effort.
    checkAndTriggerAll();
  });

  window.notifications = {
    pushNotification,
    markAllRead,
    markReadById,
    render,
    initUI,
    checkAndTriggerAll,
    notifyFromEvent,
  };
})();

