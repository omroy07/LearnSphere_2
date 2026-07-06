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

  let storageEnabled = false;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("__test_storage_active__", "1");
      localStorage.removeItem("__test_storage_active__");
      storageEnabled = true;
    }
  } catch {}

  let inMemoryStore = null;

  // Badge count = unread notifications count
  function loadStore() {
    try {
      if (storageEnabled) {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          return { notifications: [], lastEventAt: null };
        }
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") throw new Error("bad store");
        if (!Array.isArray(parsed.notifications)) parsed.notifications = [];
        return parsed;
      }
    } catch {
      return { notifications: [], lastEventAt: null };
    }
    if (!inMemoryStore) {
      inMemoryStore = { notifications: [], lastEventAt: null };
    }
    return inMemoryStore;
  }

  function saveStore(store) {
    try {
      if (storageEnabled) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      }
    } catch (e) {
      console.warn("LearnSphere: could not save notifications", e);
    }
    inMemoryStore = store;
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

  function pushNotification({ id = null, type, title, message, ctaUrl = null, dedupeKey = null }) {
    const store = loadStore();

    const notifId = id || uuid();
    if (id && store.notifications.some((n) => n.id === id)) {
      return { inserted: false, reason: "duplicate_id" };
    }

    if (dedupeKey) {
      const existing = store.notifications.find((n) => n.dedupeKey === dedupeKey);
      if (existing) {
        const ageMs = Date.now() - new Date(existing.createdAt).getTime();
        if (ageMs < 24 * 60 * 60 * 1000) {
          return { inserted: false, reason: "duplicate_dedupe_key" };
        }
      }
    }

    // Prevents spam loops: deduplicate similar content pushed within 60s
    const recentDuplicate = store.notifications.find((n) => 
      n.title === title && 
      n.message === message && 
      (Date.now() - new Date(n.createdAt).getTime() < 60 * 1000)
    );
    if (recentDuplicate) {
      return { inserted: false, reason: "duplicate_content_recent" };
    }

    const n = {
      id: notifId,
      type,
      title,
      message,
      ctaUrl,
      createdAt: nowISO(),
      readAt: null,
      deliveredAt: null,
      deliveryState: "pending",
      dedupeKey: dedupeKey || null,
    };

    store.notifications.unshift(n);
    store.lastEventAt = nowISO();
    saveStore(store);

    return { inserted: true, notification: n };
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

  function markAllDelivered() {
    const store = loadStore();
    let updated = false;
    store.notifications.forEach((n) => {
      if (n.deliveryState === "pending") {
        n.deliveryState = "delivered";
        n.deliveredAt = nowISO();
        updated = true;
      }
    });
    if (updated) {
      saveStore(store);
    }
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

      const header = document.createElement("div");
      header.style.padding = "12px 12px 10px";
      header.style.borderBottom = "1px solid rgba(255,255,255,0.08)";
      header.style.display = "flex";
      header.style.alignItems = "center";
      header.style.justifyContent = "space-between";
      header.style.gap = "10px";

      const title = document.createElement("div");
      title.style.fontWeight = "800";
      title.textContent = `🔔 ${_t("notifications.panelTitle")}`;

      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "8px";
      actions.style.alignItems = "center";

      const btnAll = document.createElement("button");
      btnAll.id = "notifications-mark-all";
      btnAll.style.background = "rgba(255,255,255,0.06)";
      btnAll.style.border = "1px solid rgba(255,255,255,0.10)";
      btnAll.style.color = "rgba(255,255,255,0.9)";
      btnAll.style.borderRadius = "10px";
      btnAll.style.padding = "6px 10px";
      btnAll.style.cursor = "pointer";
      btnAll.style.fontWeight = "700";
      btnAll.style.fontSize = "12px";
      btnAll.textContent = _t("notifications.markAllRead");

      const btnClose = document.createElement("button");
      btnClose.id = "notifications-close";
      btnClose.setAttribute("aria-label", _t("notifications.close"));
      btnClose.style.background = "transparent";
      btnClose.style.border = "1px solid rgba(255,255,255,0.18)";
      btnClose.style.color = "rgba(255,255,255,0.9)";
      btnClose.style.borderRadius = "10px";
      btnClose.style.padding = "6px 10px";
      btnClose.style.cursor = "pointer";
      btnClose.style.fontWeight = "900";
      btnClose.style.fontSize = "12px";
      btnClose.textContent = "✕";

      actions.appendChild(btnAll);
      actions.appendChild(btnClose);
      header.appendChild(title);
      header.appendChild(actions);

      const list = document.createElement("div");
      list.id = "notifications-list";
      list.style.padding = "10px";
      list.style.display = "flex";
      list.style.flexDirection = "column";
      list.style.gap = "10px";

      panel.appendChild(header);
      panel.appendChild(list);
      document.body.appendChild(panel);

      btnAll.addEventListener("click", () => {
        markAllRead();
        render();
      });

      btnClose.addEventListener("click", () => hidePanel());

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

    // Clear list (no HTML injection)
    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);


    if (!notifications || notifications.length === 0) {
      const empty = document.createElement("div");
      empty.style.color = "rgba(255,255,255,0.65)";
      empty.style.fontSize = "13px";
      empty.style.padding = "10px";
      empty.textContent = _t("notifications.empty");
      listEl.appendChild(empty);
      return;
    }

    notifications.slice(0, 25).forEach((n) => {
      const isUnread = !n.readAt;

      const item = document.createElement("div");
      item.style.padding = "10px";
      item.style.borderRadius = "12px";
      item.style.border = "1px solid rgba(255,255,255,0.08)";
      item.style.background = isUnread ? "rgba(102,252,241,0.06)" : "rgba(255,255,255,0.03)";
      item.style.cursor = "pointer";

      item.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON" || e.target.tagName === "A") return;
        if (isUnread) {
          markReadById(n.id);
          renderBadgeOnly();
          render();
        }
      });

      // Top row
      const top = document.createElement("div");
      top.style.display = "flex";
      top.style.justifyContent = "space-between";
      top.style.gap = "10px";
      top.style.alignItems = "flex-start";

      const left = document.createElement("div");

      const titleEl = document.createElement("div");
      titleEl.style.fontWeight = "900";
      titleEl.style.color = isUnread ? "#66fcf1" : "rgba(255,255,255,0.95)";
      titleEl.style.fontSize = "13px";
      titleEl.textContent = n.title || _t("notifications.defaultTitle");

      const msgEl = document.createElement("div");
      msgEl.style.marginTop = "4px";
      msgEl.style.color = "rgba(255,255,255,0.78)";
      msgEl.style.fontSize = "12.5px";
      msgEl.style.lineHeight = "1.35";
      msgEl.textContent = n.message || "";

      left.appendChild(titleEl);
      left.appendChild(msgEl);

      const timeEl = document.createElement("div");
      timeEl.style.fontSize = "11px";
      timeEl.style.color = "rgba(255,255,255,0.55)";
      timeEl.style.whiteSpace = "nowrap";
      try {
        timeEl.textContent = new Date(n.createdAt).toLocaleString();
      } catch {
        timeEl.textContent = "";
      }

      top.appendChild(left);
      top.appendChild(timeEl);

      item.appendChild(top);

      // CTA link (safe attributes; no HTML injection)
      if (n.ctaUrl) {
        const ctaWrap = document.createElement("div");
        ctaWrap.style.marginTop = "10px";
        ctaWrap.style.display = "flex";
        ctaWrap.style.justifyContent = "flex-end";

        const a = document.createElement("a");
        a.textContent = _t("notifications.open");
        a.setAttribute("rel", "noopener noreferrer");
        a.style.textDecoration = "none";
        a.style.background = "rgba(102,252,241,0.10)";
        a.style.border = "1px solid rgba(102,252,241,0.35)";
        a.style.color = "#66fcf1";
        a.style.padding = "7px 10px";
        a.style.borderRadius = "10px";
        a.style.fontWeight = "900";
        a.style.fontSize = "12px";

        a.addEventListener("click", () => {
          if (isUnread) {
            markReadById(n.id);
          }
        });

        // Allow only relative/absolute same-origin URLs to avoid javascript: etc.
        try {
          const parsed = new URL(String(n.ctaUrl), window.location.origin);
          if (parsed.origin === window.location.origin) {
            a.href = parsed.pathname + parsed.search + parsed.hash;
          } else {
            a.href = "#";
          }
        } catch {
          a.href = "#";
        }

        ctaWrap.appendChild(a);
        item.appendChild(ctaWrap);
      }

      // Mark read button
      if (isUnread) {
        const markWrap = document.createElement("div");
        markWrap.style.marginTop = "10px";
        markWrap.style.display = "flex";
        markWrap.style.justifyContent = "flex-end";

        const markBtn = document.createElement("button");
        markBtn.type = "button";
        markBtn.textContent = _t("notifications.markRead");
        markBtn.dataset.notifId = String(n.id);
        markBtn.style.background = "rgba(255,255,255,0.06)";
        markBtn.style.border = "1px solid rgba(255,255,255,0.10)";
        markBtn.style.color = "rgba(255,255,255,0.9)";
        markBtn.style.borderRadius = "10px";
        markBtn.style.padding = "7px 10px";
        markBtn.style.cursor = "pointer";
        markBtn.style.fontWeight = "900";
        markBtn.style.fontSize = "12px";

        markBtn.addEventListener("click", (e) => {
          e.preventDefault();
          const id = markBtn.dataset.notifId;
          if (id) markReadById(id);
          renderBadgeOnly();
          render();
        });

        markWrap.appendChild(markBtn);
        item.appendChild(markWrap);
      }

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
    markAllDelivered();
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

    const bellBtn = document.createElement("button");
    bellBtn.id = "notifications-bell";
    bellBtn.type = "button";
    bellBtn.setAttribute("aria-label", "Open notifications");
    bellBtn.style.background = "rgba(255,255,255,0.06)";
    bellBtn.style.border = "1px solid rgba(255,255,255,0.14)";
    bellBtn.style.color = "rgba(255,255,255,0.92)";
    bellBtn.style.borderRadius = "12px";
    bellBtn.style.padding = "8px 12px";
    bellBtn.style.cursor = "pointer";
    bellBtn.style.fontWeight = "900";
    bellBtn.style.display = "flex";
    bellBtn.style.alignItems = "center";
    bellBtn.style.gap = "8px";

    const icon = document.createElement("span");
    icon.textContent = "🔔";

    const hiddenLabel = document.createElement("span");
    hiddenLabel.style.display = "none";
    hiddenLabel.textContent = "Notifications";

    const badge = document.createElement("span");
    badge.id = "notifications-badge-count";
    badge.style.display = "none";
    badge.style.minWidth = "20px";
    badge.style.height = "20px";
    badge.style.padding = "0 6px";
    badge.style.background = "#ff4500";
    badge.style.color = "#fff";
    badge.style.borderRadius = "999px";
    badge.style.alignItems = "center";
    badge.style.justifyContent = "center";
    badge.style.fontSize = "12px";
    badge.style.fontWeight = "900";
    badge.textContent = "0";

    bellBtn.appendChild(icon);
    bellBtn.appendChild(hiddenLabel);
    bellBtn.appendChild(badge);
    wrapper.appendChild(bellBtn);

    anchor.appendChild(wrapper);

    bellBtn.addEventListener("click", () => {
      const panel = document.getElementById("notifications-panel");
      const isOpen = panel && panel.style.display === "block";
      if (isOpen) hidePanel();
      else showPanel();
    });

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


  if (typeof window !== "undefined") {
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
  }

  // Support exporting for unit tests
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      pushNotification,
      markAllRead,
      markReadById,
      markAllDelivered,
      loadStore,
      saveStore
    };
  }
})();

