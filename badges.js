/*
 * badges.js — Badge System 2.0 (Rules-based achievement unlocking)
 *
 * Requirements implemented:
 * - Rule schema: { id, title, condition: { type, params }, reward }
 * - Achievement evaluator runs via existing call-sites:
 *     window.achievements.checkAndNotify() (triggered after quiz + mastery updates)
 * - State:
 *     unlockedBadges: []
 *     badgeProgress: { [badgeId]: {...} }
 * - UI:
 *     locked vs unlocked + progress toward badge
 * - Persistence: localStorage key learnsphere_achievements_v1
 */

(function () {
  const ACHIEVEMENTS_KEY = "learnsphere_achievements_v1";
  const QUIZ_PROGRESS_KEY = "learnsphere_quiz_progress_v1";

  // ---------------------------
  // 1) Badge rule schema
  // ---------------------------
  const BADGE_RULES = [
    {
      id: "perfect_3_quizzes_in_week",
      title: "3 perfect quizzes in a week",
      icon: "🏆",
      reward: { type: "badge" },
      condition: {
        type: "perfect_quizzes_in_week",
        params: { targetPerfectQuizzes: 3, window: "week", perfectAccuracy: 1.0 }
      },
      description: "Achieve 100% accuracy in 3 quizzes within the same week."
    },
    {
      id: "mastery_gt_80_any_skill",
      title: "Mastery > 80% in any skill",
      icon: "🎯",
      reward: { type: "badge" },
      condition: {
        type: "mastery_threshold_any_skill",
        params: { threshold: 0.8 }
      },
      description: "Reach at least 80% accuracy in any skill."
    },

    {
      id: "streak_7_days",
      title: "7-day study streak",
      icon: "🔥",
      reward: { type: "badge" },
      condition: {
        type: "streak_threshold",
        params: { targetStreakDays: 7 }
      },
      description: "Practice every day for 7 consecutive days."
    },
    {
      id: "streak_14_days",
      title: "14-day study streak",
      icon: "🌟",
      reward: { type: "badge" },
      condition: {
        type: "streak_threshold",
        params: { targetStreakDays: 14 }
      },
      description: "Practice every day for 14 consecutive days."
    },

    {
      id: "improve_10pct_recent",
      title: "Accuracy improvement",
      icon: "📈",
      reward: { type: "badge" },
      condition: {
        type: "accuracy_improvement",
        params: {
          recentDays: 3,
          previousDays: 3,
          improvementThreshold: 0.10,
          minRecentAttempts: 2
        }
      },
      description: "Improve your average accuracy by at least 10% (recent 3 days vs previous 3 days)."
    }
  ];


  // ---------------------------
  // 2) Persistence
  // ---------------------------
  function loadAchievements() {
    try {
      const raw = localStorage.getItem(ACHIEVEMENTS_KEY);
      if (!raw) {
        return { unlockedBadges: [], badgeProgress: {} };
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return { unlockedBadges: [], badgeProgress: {} };
      }
      if (!Array.isArray(parsed.unlockedBadges)) parsed.unlockedBadges = [];
      if (!parsed.badgeProgress || typeof parsed.badgeProgress !== "object") parsed.badgeProgress = {};
      return parsed;
    } catch {
      return { unlockedBadges: [], badgeProgress: {} };
    }
  }

  function saveAchievements(data) {
    try {
      localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("LearnSphere: Could not save achievements.", e);
    }
  }

  // ---------------------------
  // 3) Date helpers
  // ---------------------------
  function safeDateKey(d) {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString();
  }

  function getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${weekNo}`;
  }

  // ---------------------------
  // 4) Stats extraction
  // ---------------------------
  function getQuizAttemptsRaw() {
    try {
      const raw = localStorage.getItem(QUIZ_PROGRESS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed.attempts) ? parsed.attempts : [];
    } catch {
      return [];
    }
  }

  function getPerfectAttemptsInWindow({ windowType = "week", perfectAccuracy = 1.0 } = {}) {
    const attempts = getQuizAttemptsRaw();
    if (!attempts.length) {
      return { perfectCount: 0, totalConsidered: 0, perfectAttemptDates: [] };
    }

    const now = new Date();
    const currentWindowKey = windowType === "week" ? getWeekNumber(now) : null;

    let perfectCount = 0;
    let totalConsidered = 0;
    const perfectAttemptDates = [];

    for (const a of attempts) {
      if (!a || !a.finishedAt) continue;
      if (typeof a.accuracy !== "number" || Number.isNaN(a.accuracy)) continue;

      if (windowType === "week") {
        if (getWeekNumber(a.finishedAt) !== currentWindowKey) continue;
      }

      // Considered (within window)
      totalConsidered++;

      const isPerfect = a.accuracy >= perfectAccuracy;
      if (isPerfect) {
        perfectCount++;
        perfectAttemptDates.push(a.finishedAt);
      }
    }

    return { perfectCount, totalConsidered, perfectAttemptDates };
  }

  function getAnySkillMasteryAccuracy() {
    // Uses quizProgress.js mastery stats
    if (!window.quizProgress || typeof window.quizProgress.getMasteryStats !== "function") {
      return { bestAccuracy: null, bestSkillId: null };
    }

    const mastery = window.quizProgress.getMasteryStats();
    if (!mastery || typeof mastery !== "object") {
      return { bestAccuracy: null, bestSkillId: null };
    }

    let bestAccuracy = null;
    let bestSkillId = null;

    for (const [skillId, m] of Object.entries(mastery)) {
      const attempts = m?.attempts || 0;
      const correct = m?.correct || 0;
      if (!attempts || attempts <= 0) continue;
      const acc = correct / attempts;
      if (typeof acc === "number" && !Number.isNaN(acc)) {
        if (bestAccuracy == null || acc > bestAccuracy) {
          bestAccuracy = acc;
          bestSkillId = skillId;
        }
      }
    }

    return { bestAccuracy, bestSkillId };
  }

  function getCurrentStreakDerived() {
    try {
      if (window.studyProgress && typeof window.studyProgress.loadStreakState === "function") {
        const s = window.studyProgress.loadStreakState();
        const current = Number(s?.currentStreak);
        return {
          currentStreakDays: Number.isFinite(current) ? current : 0,
          lastActiveDate: s?.lastActiveDate || null
        };
      }
    } catch {}

    try {
      const st = window.quizProgress?.getStreak?.();
      const current = Number(st?.currentStreak);
      return {
        currentStreakDays: Number.isFinite(current) ? current : 0,
        lastActiveDate: st?.lastPracticeDate || null
      };
    } catch {}

    return { currentStreakDays: 0, lastActiveDate: null };
  }

  function getAccuracyImprovementDerived({ recentDays = 3, previousDays = 3, minRecentAttempts = 2 } = {}) {
    const attempts = getQuizAttemptsRaw();
    if (!attempts.length) {
      return {
        recentAvg: null,
        previousAvg: null,
        improvement: null,
        recentAttemptsCount: 0,
        previousAttemptsCount: 0,
      };
    }

    const now = new Date();

    function localISODate(d) {
      const dd = new Date(d);
      const yyyy = dd.getFullYear();
      const mm = String(dd.getMonth() + 1).padStart(2, "0");
      const day = String(dd.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${day}`;
    }

    function parseISOToToken(isoDateYYYYMMDD) {
      if (!isoDateYYYYMMDD || typeof isoDateYYYYMMDD !== "string") return null;
      const [y, m, d] = isoDateYYYYMMDD.split("-").map(Number);
      if (!y || !m || !d) return null;
      const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
      return Math.floor(dt.getTime() / 86400000);
    }

    const todayToken = parseISOToToken(localISODate(now));
    if (todayToken == null) {
      return {
        recentAvg: null,
        previousAvg: null,
        improvement: null,
        recentAttemptsCount: 0,
        previousAttemptsCount: 0,
      };
    }

    const recentStart = todayToken - (recentDays - 1);
    const previousStart = todayToken - (recentDays + previousDays - 1);
    const previousEnd = todayToken - recentDays;

    let recentCorrect = 0;
    let recentTotal = 0;
    let recentAttemptsCount = 0;

    let prevCorrect = 0;
    let prevTotal = 0;
    let previousAttemptsCount = 0;

    for (const a of attempts) {
      if (!a || !a.practiceDate) continue;
      const token = parseISOToToken(a.practiceDate);
      if (token == null) continue;

      // Only consider attempts where accuracy is usable (0..1)
      const acc = typeof a.accuracy === "number" && !Number.isNaN(a.accuracy) ? a.accuracy : null;
      const totalQ = typeof a.totalQuestions === "number" && !Number.isNaN(a.totalQuestions) ? a.totalQuestions : null;

      if (acc == null || totalQ == null || totalQ <= 0) continue;

      const correctFromCount = acc * totalQ;

      if (token >= recentStart && token <= todayToken) {
        recentCorrect += correctFromCount;
        recentTotal += totalQ;
        recentAttemptsCount += 1;
      } else if (token >= previousStart && token <= previousEnd) {
        prevCorrect += correctFromCount;
        prevTotal += totalQ;
        previousAttemptsCount += 1;
      }
    }

    const recentAvg = recentTotal > 0 ? recentCorrect / recentTotal : null;
    const previousAvg = prevTotal > 0 ? prevCorrect / prevTotal : null;

    let improvement = null;
    if (recentAvg != null && previousAvg != null) {
      improvement = (recentAvg - previousAvg);
    }

    return {
      recentAvg,
      previousAvg,
      improvement,
      recentAttemptsCount,
      previousAttemptsCount,
      metMinRecentAttempts: recentAttemptsCount >= (minRecentAttempts || 0)
    };
  }


  // ---------------------------
  // 5) Rule evaluator + progress
  // ---------------------------
  function evaluateBadge(rule, derived) {
    const { type, params } = rule.condition || {};

    // Progress objects are used for UI. unlocked is boolean.
    if (type === "perfect_quizzes_in_week") {
      const target = Number(params?.targetPerfectQuizzes) || 0;
      const perfectAccuracy = typeof params?.perfectAccuracy === "number" ? params.perfectAccuracy : 1.0;
      const windowType = params?.window || "week";

      const { perfectCount } = derived.perfectAttemptsInWindow;
      const pct = target > 0 ? Math.min(1, perfectCount / target) : 0;
      return {
        unlocked: perfectCount >= target && target > 0,
        progress: {
          kind: "count",
          current: perfectCount,
          target,
          percent: pct
        },
        progressText: target > 0 ? `${Math.min(perfectCount, target)}/${target}` : "—"
      };
    }

    if (type === "mastery_threshold_any_skill") {
      const threshold = typeof params?.threshold === "number" ? params.threshold : 0.8;
      const bestAccuracy = derived.anySkillBestAccuracy.bestAccuracy;
      const bestSkillId = derived.anySkillBestAccuracy.bestSkillId;

      const safeBest = typeof bestAccuracy === "number" && !Number.isNaN(bestAccuracy) ? bestAccuracy : 0;
      const pct = Math.min(1, safeBest / threshold);
      const unlocked = typeof bestAccuracy === "number" && bestAccuracy >= threshold && safeBest > 0;

      return {
        unlocked,
        progress: {
          kind: "ratio",
          current: safeBest,
          target: threshold,
          percent: pct,
          bestSkillId
        },
        progressText: typeof bestAccuracy === "number" && !Number.isNaN(bestAccuracy)
          ? `${Math.round(bestAccuracy * 100)}% / ${Math.round(threshold * 100)}%`
          : `0% / ${Math.round(threshold * 100)}%`
      };
    }

    if (type === "streak_threshold") {
      const targetDays = Number(params?.targetStreakDays) || 0;
      const currentDays = derived.currentStreak?.currentStreakDays ?? 0;
      const pct = targetDays > 0 ? Math.min(1, currentDays / targetDays) : 0;
      return {
        unlocked: targetDays > 0 && currentDays >= targetDays,
        progress: {
          kind: "count",
          current: currentDays,
          target: targetDays,
          percent: pct
        },
        progressText: targetDays > 0 ? `${Math.min(currentDays, targetDays)}/${targetDays} days` : "—"
      };
    }

    if (type === "accuracy_improvement") {
      const recentDays = Number(params?.recentDays) || 3;
      const previousDays = Number(params?.previousDays) || 3;
      const thresholdDelta = typeof params?.improvementThreshold === "number" ? params.improvementThreshold : 0.1;
      const minRecentAttempts = Number(params?.minRecentAttempts) || 0;

      const imp = derived.accuracyImprovement;
      const recentAvg = imp?.recentAvg;
      const previousAvg = imp?.previousAvg;
      const improvement = imp?.improvement;

      const canScore =
        recentAvg != null &&
        previousAvg != null &&
        imp?.metMinRecentAttempts;

      let pct = 0;
      if (canScore) {
        // Map delta [0..threshold] to [0..1]
        // e.g., improvement=0 => 0, improvement=threshold => 1
        pct = thresholdDelta > 0 ? Math.max(0, Math.min(1, improvement / thresholdDelta)) : 0;
      }


      const deltaMet = canScore && improvement >= thresholdDelta;

      const currentDeltaPctText = canScore
        ? `${Math.round(improvement * 100)}% improvement`
        : "Not enough recent data";

      return {
        unlocked: !!deltaMet,
        progress: {
          kind: "delta",
          current: canScore ? improvement : 0,
          target: thresholdDelta,
          percent: pct,
          recentDays,
          previousDays
        },
        progressText: canScore
          ? `${Math.round(Math.max(0, improvement) * 100)}% / ${Math.round(thresholdDelta * 100)}%`
          : currentDeltaPctText
      };
    }

    return {
      unlocked: false,
      progress: { kind: "unknown", current: 0, target: 0, percent: 0 },
      progressText: "—"
    };
  }


  function buildDerived() {
    return {
      perfectAttemptsInWindow: getPerfectAttemptsInWindow({
        windowType: "week",
        perfectAccuracy: 1.0
      }),
      anySkillBestAccuracy: getAnySkillMasteryAccuracy(),
      currentStreak: getCurrentStreakDerived(),
      accuracyImprovement: getAccuracyImprovementDerived({
        recentDays: 3,
        previousDays: 3,
        minRecentAttempts: 2
      })
    };
  }


  function getUnlockedSet(ach) {
    const set = new Set(Array.isArray(ach.unlockedBadges) ? ach.unlockedBadges : []);
    return set;
  }

  function unlockBadgeIfNeeded(ach, rule, evaluation) {
    const unlockedSet = getUnlockedSet(ach);
    if (unlockedSet.has(rule.id)) {
      return { changed: false, unlockedNow: false };
    }

    if (evaluation.unlocked) {
      ach.unlockedBadges.push(rule.id);
      if (!ach.badgeProgress) ach.badgeProgress = {};
      ach.badgeProgress[rule.id] = {
        ...evaluation.progress,
        unlockedAt: new Date().toISOString(),
        progressText: evaluation.progressText
      };
      return { changed: true, unlockedNow: true };
    }

    // Not unlocked: still update progress cache
    if (!ach.badgeProgress) ach.badgeProgress = {};
    ach.badgeProgress[rule.id] = {
      ...evaluation.progress,
      unlockedAt: ach.badgeProgress?.[rule.id]?.unlockedAt || null,
      progressText: evaluation.progressText
    };

    return { changed: true, unlockedNow: false };
  }

  // ---------------------------
  // 6) Toast
  // ---------------------------
  function ensureToastStyles() {
    if (document.getElementById("badge-toast-styles")) return;
    const style = document.createElement("style");
    style.id = "badge-toast-styles";
    style.textContent = `
      .badge-toast-container {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 12px;
        pointer-events: none;
      }
      .badge-toast {
        background: rgba(15, 23, 42, 0.85);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(102, 252, 241, 0.35);
        border-radius: 12px;
        padding: 14px 18px;
        width: 320px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 15px rgba(102, 252, 241, 0.2);
        display: flex;
        gap: 14px;
        align-items: center;
        pointer-events: auto;
        animation: toast-slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        transition: opacity 0.3s ease, transform 0.3s ease;
      }
      .badge-toast.fade-out { animation: toast-fade-out 0.3s ease forwards; }
      .badge-toast-icon {
        font-size: 28px;
        background: rgba(102, 252, 241, 0.1);
        border-radius: 50%;
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(102, 252, 241, 0.25);
        flex-shrink: 0;
      }
      .badge-toast-title {
        color: #66fcf1;
        font-weight: 800;
        font-size: 0.95rem;
        margin: 0 0 4px 0;
        text-shadow: 0 0 8px rgba(102, 252, 241, 0.4);
      }
      .badge-toast-desc {
        color: #cbd5e1;
        font-size: 0.8rem;
        margin: 0;
        line-height: 1.3;
      }
      @keyframes toast-slide-in {
        from { opacity: 0; transform: translateY(20px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes toast-fade-out {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-20px) scale(0.95); }
      }
    `;
    document.head.appendChild(style);
  }

  function showUnlockToast(rule) {
    ensureToastStyles();

    let container = document.getElementById("badge-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "badge-toast-container";
      container.className = "badge-toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = "badge-toast";
    toast.setAttribute("role", "alert");

    toast.innerHTML = `
      <div class="badge-toast-icon">${rule.icon || "🏅"}</div>
      <div class="badge-toast-details">
        <h4 class="badge-toast-title">Achievement Unlocked!</h4>
        <p class="badge-toast-desc"><strong>${rule.title}</strong>: ${rule.description || ""}</p>
      </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("fade-out");
      toast.addEventListener("animationend", () => {
        toast.remove();
        if (container.children.length === 0) container.remove();
      });
    }, 4500);
  }

  // ---------------------------
  // 7) Public evaluator
  // ---------------------------
  function checkAndNotify() {
    const derived = buildDerived();
    const ach = loadAchievements();

    let changed = false;
    const newlyUnlocked = [];

    for (const rule of BADGE_RULES) {
      const evaluation = evaluateBadge(rule, derived);
      const { changed: c, unlockedNow } = unlockBadgeIfNeeded(ach, rule, evaluation);
      if (c) changed = true;
      if (unlockedNow) newlyUnlocked.push(rule);
    }

    if (changed) saveAchievements(ach);
    newlyUnlocked.forEach(rule => showUnlockToast(rule));

    return newlyUnlocked;
  }

  // ---------------------------
  // 8) UI rendering
  // ---------------------------
  function ensureStyles(containerEl) {
    if (!containerEl) return;
    if (containerEl.dataset.badgesStylesApplied === "true") return;
    containerEl.dataset.badgesStylesApplied = "true";

    const style = document.createElement("style");
    style.textContent = `
      .badges-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        margin-top: 10px;
      }
      @media (max-width: 560px) {
        .badges-grid { grid-template-columns: 1fr; }
      }

      .badge-card {
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 12px;
        padding: 12px;
        transition: transform 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
      }
      .badge-card:hover { transform: translateY(-2px); }

      .badge-top {
        display:flex;
        gap:10px;
        align-items:flex-start;
      }
      .badge-icon { width:26px; text-align:center; font-size:20px; }
      .badge-title { font-weight:800; }
      .badge-desc { font-size:12px; opacity:0.85; margin-top:2px; }

      .badge-bottom {
        margin-top:10px;
        font-size:12px;
        opacity:0.9;
        display:flex;
        flex-direction:column;
        gap:8px;
      }

      .badge-progressbar {
        width:100%;
        height:8px;
        background: rgba(255,255,255,0.08);
        border-radius: 999px;
        overflow:hidden;
      }
      .badge-progressbar > i {
        display:block;
        height:100%;
        width:0%;
        background: #66fcf1;
        border-radius: 999px;
      }
    `;
    document.head.appendChild(style);
  }

  function badgeCardHTML(rule, unlocked, progressEntry) {
    const dim = unlocked ? "" : "opacity:0.55; filter: grayscale(0.3);";
    const border = unlocked ? "border-color: rgba(102,252,241,0.55);" : "border-color: rgba(255,255,255,0.12);";
    const shadow = unlocked ? "0 10px 26px rgba(102,252,241,0.16)" : "none";

    const progressText = progressEntry?.progressText || "";
    const percent = typeof progressEntry?.percent === "number" ? Math.max(0, Math.min(1, progressEntry.percent)) : 0;
    const barW = Math.round(percent * 100);

    return `
      <div class="badge-card" style="${dim} ${border} box-shadow:${shadow}">
        <div class="badge-top">
          <div class="badge-icon" aria-hidden="true">${rule.icon || "🏅"}</div>
          <div style="min-width:0">
            <div class="badge-title" style="font-weight:800">${rule.title}</div>
            <div class="badge-desc">${rule.description || ""}</div>
          </div>
        </div>
        <div class="badge-bottom">
          ${unlocked
            ? `<span style="color:#66fcf1; font-weight:700">Unlocked ✓</span>`
            : `<span>Locked • ${progressText || "Progress"}</span>`}
          <div class="badge-progressbar" aria-hidden="true">
            <i style="width:${barW}%; background:${unlocked ? "#66fcf1" : "#66fcf1"}"></i>
          </div>
        </div>
      </div>
    `;
  }

  function getTopUnlocked(ach, limit = 3) {
    const unlockedSet = new Set(ach.unlockedBadges || []);
    const progress = ach.badgeProgress || {};

    const unlockedRules = BADGE_RULES.filter(r => unlockedSet.has(r.id));

    // Sort unlocked by unlockedAt desc if present; else keep order.
    unlockedRules.sort((a, b) => {
      const atA = progress?.[a.id]?.unlockedAt ? new Date(progress[a.id].unlockedAt).getTime() : 0;
      const atB = progress?.[b.id]?.unlockedAt ? new Date(progress[b.id].unlockedAt).getTime() : 0;
      return atB - atA;
    });

    return unlockedRules.slice(0, limit);
  }

  function renderBadges(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    ensureStyles(container);

    // Re-evaluate
    checkAndNotify();

    const ach = loadAchievements();
    const unlockedSet = getUnlockedSet(ach);
    const progress = ach.badgeProgress || {};

    container.innerHTML = `
      <div class="badges-grid" role="list" aria-label="Achievements and badges">
        ${BADGE_RULES.map(rule => {
          const unlocked = unlockedSet.has(rule.id);
          const entry = progress[rule.id] || {};
          return `<div role="listitem">${badgeCardHTML(rule, unlocked, entry)}</div>`;
        }).join("")}
      </div>
      <div style="margin-top:10px; font-size:12px; opacity:0.8">
        Achievements are based on your quiz accuracy and mastery progress.
      </div>
    `;
  }

  function renderTopUnlocked(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const ach = loadAchievements();
    const unlocked = getTopUnlocked(ach, 3);

    if (!unlocked.length) {
      container.innerHTML = `<div class="muted" style="font-size:13px; opacity:0.8">No achievements unlocked yet.</div>`;
      return;
    }

    container.innerHTML = `
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        ${unlocked.map(r => `
          <div style="display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:999px;
                      background:rgba(102,252,241,0.10); border:1px solid rgba(102,252,241,0.35);">
            <span aria-hidden="true">${r.icon || "🏅"}</span>
            <span style="font-weight:800; color:#66fcf1; font-size:13px;">${r.title}</span>
          </div>
        `).join("")}
      </div>
    `;
  }

  // Expose
  window.achievements = {
    BADGE_RULES,
    renderBadges,
    renderTopUnlocked,
    checkAndNotify
  };
})();

