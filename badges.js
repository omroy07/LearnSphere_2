/*
 * badges.js — Unified “Achievements & Badges” system (Milestones)
 *
 * Computes milestones from existing quiz stats stored by quizProgress.js:
 *   localStorage key: learnsphere_quiz_progress_v1
 *
 * Badges are persisted once unlocked in:
 *   localStorage key: learnsphere_achievements_v1
 */

(function () {
  const QUIZ_PROGRESS_KEY = "learnsphere_quiz_progress_v1"; // for visibility in devtools
  const ACHIEVEMENTS_KEY = "learnsphere_achievements_v1";

  const BADGES = [
    {
      id: "first_quiz_attempt",
      title: "First quiz attempt",
      description: "Complete your first quiz.",
      icon: "🏁",
      getProgress: (stats) => {
        const firstAttempt = (stats.attemptCount || 0) >= 1;
        return {
          unlocked: firstAttempt,
          progressText: firstAttempt ? "Unlocked" : "0/1"
        };
      }
    },
    {
      id: "five_topics_completed",
      title: "5 topics completed",
      description: "Attempt quizzes in at least 5 topics.",
      icon: "📚",
      getProgress: (stats) => {
        const target = 5;
        const done = stats.topicAttemptedCount || 0;
        return {
          unlocked: done >= target,
          progressText: `${Math.min(done, target)}/${target}`
        };
      }
    },
    {
      id: "three_day_streak",
      title: "3-day practice streak",
      description: "Practice every day for 3 days.",
      icon: "⚡",
      getProgress: (stats) => {
        const target = 3;
        const done = stats.currentStreak || 0;
        return {
          unlocked: done >= target,
          progressText: `${Math.min(done, target)}/${target}`
        };
      }
    },
    {
      id: "seven_day_streak",
      title: "7-day practice streak",
      description: "Practice every day for 7 days.",
      icon: "🔥",
      getProgress: (stats) => {
        const target = 7;
        const done = stats.currentStreak || 0;
        return {
          unlocked: done >= target,
          progressText: `${Math.min(done, target)}/${target}`
        };
      }
    },
    {
      id: "fourteen_day_streak",
      title: "14-day practice streak",
      description: "Practice every day for 14 days.",
      icon: "👑",
      getProgress: (stats) => {
        const target = 14;
        const done = stats.currentStreak || 0;
        return {
          unlocked: done >= target,
          progressText: `${Math.min(done, target)}/${target}`
        };
      }
    },
    {
      id: "weekend_warrior",
      title: "Weekend Warrior",
      description: "Complete a quiz on a weekend (Saturday or Sunday).",
      icon: "⚔️",
      getProgress: (stats) => {
        const unlocked = !!stats.hasWeekendAttempt;
        return {
          unlocked,
          progressText: unlocked ? "Unlocked" : "0/1"
        };
      }
    },
    {
      id: "weekly_badge",
      title: "Weekly Scholar",
      description: "Complete at least one quiz this week.",
      icon: "🎓",
      getProgress: (stats) => {
        const unlocked = !!stats.hasWeeklyAttempt;
        return {
          unlocked,
          progressText: unlocked ? "Unlocked" : "0/1"
        };
      }
    },
    {
      id: "ninety_percent_accuracy",
      title: "90%+ accuracy",
      description: "Maintain 90% accuracy across your attempts.",
      icon: "🎯",
      getProgress: (stats) => {
        const target = 0.9;
        const total = stats.overallTotalAnswers || 0;
        const acc = stats.overallAccuracy;
        const unlocked = typeof acc === "number" && acc >= target && total > 0;

        let progressText;
        if (total <= 0 || typeof acc !== "number") {
          progressText = "No attempts";
        } else {
          progressText = `${Math.round(acc * 100)}%`;
        }

        return {
          unlocked,
          progressText
        };
      }
    },
    {
      id: "daily_goal_hero",
      title: "Daily Goal Hero",
      description: "Complete your daily learning goal today.",
      icon: "🔥",
      getProgress: (stats) => {
        const unlocked = stats.dailyGoalCompleted || false;
        return {
          unlocked,
          progressText: unlocked ? "Unlocked" : "0/1"
        };
      }
    }
  ];


  function loadAchievements() {
    try {
      const raw = localStorage.getItem(ACHIEVEMENTS_KEY);
      if (!raw) return { unlocked: {} };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return { unlocked: {} };
      if (!parsed.unlocked || typeof parsed.unlocked !== "object") parsed.unlocked = {};
      return parsed;
    } catch {
      return { unlocked: {} };
    }
  }

  function saveAchievements(ach) {
    try {
      localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(ach));
    } catch (e) {
      console.warn("LearnSphere: Could not save achievements.", e);
    }
  }

  function safeNumber(n) {
    return typeof n === "number" && !Number.isNaN(n) ? n : null;
  }

  function getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${weekNo}`;
  }

  function buildStatsFromQuizProgress() {
    if (!window.quizProgress) {
      return {
        attemptCount: 0,
        topicAttemptedCount: 0,
        currentStreak: 0,
        overallAccuracy: null,
        overallTotalAnswers: 0,
        hasWeekendAttempt: false,
        hasWeeklyAttempt: false
      };
    }

    // Streak
    let currentStreak = 0;
    if (window.studyProgress && typeof window.studyProgress.loadStreakState === "function") {
      currentStreak = window.studyProgress.loadStreakState().currentStreak || 0;
    } else if (window.quizProgress && typeof window.quizProgress.getStreak === "function") {
      const streak = window.quizProgress.getStreak();
      currentStreak = streak.currentStreak || 0;
    }

    // Daily Goal
    let dailyGoalCompleted = false;
    if (window.studyProgress && typeof window.studyProgress.loadStreakState === "function") {
      const state = window.studyProgress.loadStreakState();
      const qDone = state.dailyGoalProgress.quizzesCompleted || 0;
      const rDone = state.dailyGoalProgress.questionsReviewed || 0;
      if (qDone >= 1 || rDone >= 10) {
        dailyGoalCompleted = true;
      }
    } else {
      const STREAK_KEY = "learnsphere_streak_state_v1";
      try {
        const raw = localStorage.getItem(STREAK_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.dailyGoalProgress) {
            const qDone = parsed.dailyGoalProgress.quizzesCompleted || 0;
            const rDone = parsed.dailyGoalProgress.questionsReviewed || 0;
            if (qDone >= 1 || rDone >= 10) {
              dailyGoalCompleted = true;
            }
          }
        }
      } catch (e) {}
    }


    // Overall accuracy
    const overall = window.quizProgress.getOverallAccuracy ? window.quizProgress.getOverallAccuracy() : { accuracy: null, total: 0 };

    // Topic completion proxy
    const byTopic = window.quizProgress.getAllTopicStats ? window.quizProgress.getAllTopicStats() : {};
    const topics = window.quizProgress.QUIZ_TOPICS || [];
    let topicAttemptedCount = 0;
    for (const t of topics) {
      const a = byTopic[t.id];
      const attempts = a?.attempts || 0;
      if (attempts >= 1) topicAttemptedCount++;
    }

    let attemptCount = 0;
    for (const tId of Object.keys(byTopic || {})) {
      attemptCount += (byTopic[tId]?.attempts || 0);
    }

    // Load raw attempts from localStorage for weekend/weekly checks
    let attempts = [];
    try {
      const raw = localStorage.getItem(QUIZ_PROGRESS_KEY);
      if (raw) {
        attempts = JSON.parse(raw).attempts || [];
      }
    } catch (e) {}

    const currentWeek = getWeekNumber(new Date());
    let hasWeekendAttempt = false;
    let hasWeeklyAttempt = false;

    attempts.forEach(a => {
      if (!a.finishedAt) return;
      const d = new Date(a.finishedAt);
      const day = d.getDay();
      if (day === 0 || day === 6) {
        hasWeekendAttempt = true;
      }
      if (getWeekNumber(a.finishedAt) === currentWeek) {
        hasWeeklyAttempt = true;
      }
    });

    return {
      attemptCount,
      topicAttemptedCount,
      currentStreak: safeNumber(currentStreak) ?? 0,
      dailyGoalCompleted,
      overallAccuracy: overall?.accuracy == null ? null : safeNumber(overall.accuracy),
      overallTotalAnswers: safeNumber(overall?.total) ?? 0,
      hasWeekendAttempt,
      hasWeeklyAttempt
    };
  }


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
      .badge-toast.fade-out {
        animation: toast-fade-out 0.3s ease forwards;
      }
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
      .badge-toast-details {
        flex: 1;
        min-width: 0;
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
        from {
          opacity: 0;
          transform: translateY(20px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      @keyframes toast-fade-out {
        from {
          opacity: 1;
          transform: translateY(0);
        }
        to {
          opacity: 0;
          transform: translateY(-20px) scale(0.95);
        }
      }
    `;
    document.head.appendChild(style);
  }

  function showUnlockToast(badge) {
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
      <div class="badge-toast-icon">${badge.icon}</div>
      <div class="badge-toast-details">
        <h4 class="badge-toast-title">Achievement Unlocked!</h4>
        <p class="badge-toast-desc"><strong>${badge.title}</strong>: ${badge.description}</p>
      </div>
    `;
    
    container.appendChild(toast);
    
    console.log(`LearnSphere Achievement Unlocked: ${badge.title}`);
    
    setTimeout(() => {
      toast.classList.add("fade-out");
      toast.addEventListener("animationend", () => {
        toast.remove();
        if (container.children.length === 0) {
          container.remove();
        }
      });
    }, 4500);
  }

  function unlockNewBadges(ach, stats) {
    let changed = false;

    for (const badge of BADGES) {
      const already = !!ach.unlocked[badge.id];
      const prog = badge.getProgress(stats);
      if (!already && prog.unlocked) {
        ach.unlocked[badge.id] = { unlockedAt: new Date().toISOString() };
        changed = true;
      }
    }

    if (changed) saveAchievements(ach);
    return ach;
  }

  function checkAndNotify() {
    const stats = buildStatsFromQuizProgress();
    const ach = loadAchievements();
    
    let changed = false;
    const newlyUnlocked = [];

    for (const badge of BADGES) {
      const already = !!ach.unlocked[badge.id];
      const prog = badge.getProgress(stats);
      if (!already && prog.unlocked) {
        ach.unlocked[badge.id] = { unlockedAt: new Date().toISOString() };
        newlyUnlocked.push(badge);
        changed = true;
      }
    }

    if (changed) {
      saveAchievements(ach);
      newlyUnlocked.forEach(badge => {
        showUnlockToast(badge);
      });
    }
    return newlyUnlocked;
  }

  function badgeCardHTML(badge, unlocked, progressText) {
    const dim = unlocked ? "" : "opacity:0.55; filter: grayscale(0.3);";
    const border = unlocked ? "border-color: rgba(102,252,241,0.55);" : "border-color: rgba(255,255,255,0.12);";
    const shadow = unlocked ? "0 10px 26px rgba(102,252,241,0.16)" : "none";

    return `
      <div class="badge-card" style="${dim} ${border} box-shadow:${shadow}">
        <div class="badge-top">
          <div class="badge-icon" aria-hidden="true" style="font-size:20px">${badge.icon}</div>
          <div style="min-width:0">
            <div class="badge-title" style="font-weight:800">${badge.title}</div>
            <div class="badge-desc" style="font-size:12px; opacity:0.85">${badge.description}</div>
          </div>
        </div>
        <div class="badge-bottom" style="margin-top:10px; font-size:12px; opacity:0.9">
          ${unlocked ? `<span style="color:#66fcf1; font-weight:700">Unlocked ✓</span>` : `<span>Locked • ${progressText}</span>`}
        </div>
      </div>
    `;
  }

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
      @media (max-width: 560px) { .badges-grid { grid-template-columns: 1fr; } }

      .badge-card {
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 12px;
        padding: 12px;
        transition: transform 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
      }
      .badge-card:hover { transform: translateY(-2px); }
      .badge-top { display:flex; gap:10px; align-items:flex-start; }
      .badge-icon { width:26px; text-align:center; }

    `;
    document.head.appendChild(style);
  }

  function renderBadges(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    ensureStyles(container);

    const stats = buildStatsFromQuizProgress();
    const ach = loadAchievements();
    unlockNewBadges(ach, stats);

    const unlockedSet = ach.unlocked || {};

    container.innerHTML = `
      <div class="badges-grid" role="list" aria-label="Achievements and badges">
        ${BADGES.map((badge) => {
          const unlocked = !!unlockedSet[badge.id];
          const prog = badge.getProgress(stats);
          const progressText = prog.progressText || "";
          return `<div role="listitem">${badgeCardHTML(badge, unlocked, progressText)}</div>`;
        }).join("")}
      </div>
      <div style="margin-top:10px; font-size:12px; opacity:0.8">
        Badges are based on your quiz attempts, streak, and accuracy.
      </div>
    `;
  }

  window.achievements = {
    BADGES,
    renderBadges,
    checkAndNotify
  };
})();

