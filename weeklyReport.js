// weeklyReport.js — Parent Weekly Summary
// Generates a concise weekly overview: streak, top strengths, and areas to improve.
// Assumes window.quizProgress and window.studyProgress are already loaded.

(function () {
  const quizUtils = (typeof window !== 'undefined' && window.quizUtils) || 
                    (typeof require !== 'undefined' && require('./quizUtils.js')) || 
                    (typeof globalThis !== 'undefined' && globalThis.quizUtils) ||
                    {
                      calculateWeeklyAggregates(accuracyByDay) {
                        if (!Array.isArray(accuracyByDay)) {
                          return { last7: [], prev7: [], lastAvg: null, prevAvg: null };
                        }
                        const last7 = accuracyByDay.slice(-7);
                        const prev7 = accuracyByDay.slice(0, 7);
                        function avg(arr) {
                          const nums = arr.filter((x) => typeof x === 'number' && Number.isFinite(x));
                          if (!nums.length) return null;
                          return nums.reduce((s, v) => s + v, 0) / nums.length;
                        }
                        return { last7, prev7, lastAvg: avg(last7), prevAvg: avg(prev7) };
                      }
                    };

  function _t(key, params) {
    try {
      return window.i18n && typeof window.i18n.t === "function" ? window.i18n.t(key, params) : key;
    } catch {
      return key;
    }
  }


  /** Helper: map skillId → human readable label */
  const _skillLabelMap = (() => {
    const map = {};
    if (window.quizProgress && window.quizProgress.SKILL_TAXONOMY) {
      Object.values(window.quizProgress.SKILL_TAXONOMY).forEach(t => {
        if (t && t.skillId) map[t.skillId] = t.label;
      });
    }
    return map;
  })();

  function _updateStreak() {
    const streakEl = document.getElementById('streakValue');
    if (!streakEl) return;
    let streak = null;
    if (window.studyProgress && typeof window.studyProgress.loadStreakState === 'function') {
      const state = window.studyProgress.loadStreakState();
      streak = state.currentStreak;
    } else if (window.quizProgress && typeof window.quizProgress.getStreak === 'function') {
      streak = window.quizProgress.getStreak().currentStreak;
    }
    streakEl.textContent = streak !== null && streak !== undefined ? streak : _t('weeklyReport.dash');

  }

  /** Render top strength skills (high accuracy, enough attempts) */
  function _renderStrengths() {
    const container = document.getElementById('masterySkillsList');
    if (!container) return;
    const mastery = (window.quizProgress && typeof window.quizProgress.getMasteryStats === 'function')
      ? window.quizProgress.getMasteryStats()
      : {};
    const strengths = Object.entries(mastery)
      .filter(([, m]) => m.attempts && m.attempts >= 3)
      .map(([skillId, m]) => ({
        skillId,
        attempts: m.attempts,
        correct: m.correct,
        accuracy: m.attempts ? m.correct / m.attempts : 0,
        label: _skillLabelMap[skillId] || skillId,
      }))
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(0, 3);

    container.innerHTML = '';
    if (strengths.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = _t('weeklyReport.noStrength');

      container.appendChild(empty);
      return;
    }
    strengths.forEach(s => {
      const card = document.createElement('div');
      card.style.display = 'flex';
      card.style.justifyContent = 'space-between';
      card.style.padding = '4px 0';

      const label = document.createElement('span');
      label.textContent = s.label;
      label.style.fontWeight = '500';
      const info = document.createElement('span');
      const pct = Math.round(s.accuracy * 100);
      info.textContent = `${pct}% (${s.attempts} attempts)`;
      info.style.color = 'var(--text-muted)';

      card.appendChild(label);
      card.appendChild(info);
      container.appendChild(card);
    });
  }

  /** Render weak concepts (recommended focus) */
  function _renderWeaknesses() {
    const container = document.getElementById('weakSkillsRecommendations');
    if (!container) return;
    const weak = (window.quizProgress && typeof window.quizProgress.getWeakestSkills === 'function')
      ? window.quizProgress.getWeakestSkills({ limit: 3 })
      : [];

    container.innerHTML = '';
    if (weak.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = _t('weeklyReport.noWeak');


      container.appendChild(empty);
      return;
    }
    weak.forEach(w => {
      const card = document.createElement('div');
      card.style.display = 'flex';
      card.style.justifyContent = 'space-between';
      card.style.padding = '4px 0';

      const label = document.createElement('span');
      label.textContent = w.label;
      label.style.fontWeight = '500';
      const info = document.createElement('span');
      const pct = w.accuracy !== null ? Math.round(w.accuracy * 100) : 'N/A';
      info.textContent = `${pct}% (${w.attempts} attempts)`;
      info.style.color = 'var(--text-muted)';

      card.appendChild(label);
      card.appendChild(info);
      container.appendChild(card);
    });
  }

  function _getWeekAccuracySeries(days = 14) {
    // Uses quizProgress.getAccuracySeries, then splits into last 7 vs previous 7.
    if (!window.quizProgress || typeof window.quizProgress.getAccuracySeries !== 'function') return null;
    const series = window.quizProgress.getAccuracySeries({ days });
    if (!series || !Array.isArray(series.accuracyByDay)) return null;
    const acc = series.accuracyByDay;
    const aggregates = quizUtils.calculateWeeklyAggregates(acc);
    return {
      last7: aggregates.last7,
      prev7: aggregates.prev7,
      lastAvg: aggregates.lastAvg,
      prevAvg: aggregates.prevAvg,
      series
    };
  }

  function _renderBiggestImprovement() {
    const container = document.getElementById('weeklyBiggestImprovement');
    if (!container) return;

    const series = _getWeekAccuracySeries(14);
    if (!series || series.lastAvg == null || series.prevAvg == null) {
      container.textContent = _t('weeklyReport.incompleteWeek');

      return;
    }

    const delta = series.lastAvg - series.prevAvg;
    const pctDelta = Math.round(delta * 100);

    if (pctDelta === 0) {
      container.textContent = _t('weeklyReport.steady');

    } else if (pctDelta > 0) {
      container.textContent = _t('weeklyReport.improvement', { pct: pctDelta });

    } else {
      container.textContent = _t('weeklyReport.decline', { pct: pctDelta });

    }
  }

  function _renderNextGoals() {
    const container = document.getElementById('weeklyNextGoals');
    if (!container) return;

    const daily = (window.studyProgress && typeof window.studyProgress.loadStreakState === 'function')
      ? window.studyProgress.loadStreakState()
      : null;

    const qDone = daily?.dailyGoalProgress?.quizzesCompleted || 0;
    const rDone = daily?.dailyGoalProgress?.questionsReviewed || 0;

    const goalAchieved = qDone >= 1 || rDone >= 10;

    const weak = (window.quizProgress && typeof window.quizProgress.getWeakestSkills === 'function')
      ? window.quizProgress.getWeakestSkills({ limit: 3 })
      : [];

    const recs = (window.quizProgress && typeof window.quizProgress.getRecommendedTopics === 'function')
      ? window.quizProgress.getRecommendedTopics({ limit: 3 })
      : [];

    const topTargets = weak.length ? weak : (recs.map((r) => ({ label: r.topic?.label || r.topicId || 'Next topic' })));

    const lines = [];
    if (goalAchieved) {
      lines.push(_t('weeklyReport.dailyGoalAchieved'));

    } else {
      lines.push(_t('weeklyReport.dailyGoal', { quizzes: qDone, questions: rDone }));

    }

    if (topTargets && topTargets.length) {
      const names = topTargets.slice(0, 2).map((t) => t.label || t.topic?.label).filter(Boolean);
      if (names.length) {
        lines.push(_t('weeklyReport.nextGoals', { targets: names.join(' and ') }));
      }

    }

    if (lines.length === 0) {
      container.textContent = _t('weeklyReport.unlock');

    } else {
      container.innerHTML = lines.map((l) => `<div style="margin-top:6px;">${l}</div>`).join('');

    }
  }

  function _estimatePracticeSessionsPerWeek() {
    // Parent-friendly heuristic:
    // - Use weakest skills (if available) and scale with their attempts.
    // - Output a single “sessions this week” number.
    // Goal: show a reasonable range even with partial data.

    // If we can see per-skill attempt counts from mastery stats, use it.
    const weak = (window.quizProgress && typeof window.quizProgress.getWeakestSkills === 'function')
      ? window.quizProgress.getWeakestSkills({ limit: 5 })
      : [];

    let attemptsSum = 0;
    let weakCount = 0;
    for (const w of (Array.isArray(weak) ? weak : [])) {
      if (typeof w?.attempts === 'number' && Number.isFinite(w.attempts)) {
        attemptsSum += w.attempts;
        weakCount += 1;
      }
    }

    // If weakest skills aren’t available, fall back to mastery stats.
    if (!weakCount && window.quizProgress && typeof window.quizProgress.getMasteryStats === 'function') {
      const mastery = window.quizProgress.getMasteryStats() || {};
      const entries = Object.entries(mastery)
        .map(([skillId, m]) => ({ skillId, attempts: m?.attempts, accuracy: m?.attempts ? (m?.correct / m?.attempts) : null }))
        .filter((x) => typeof x.attempts === 'number' && Number.isFinite(x.attempts) && x.attempts > 0);

      // Select low-accuracy skills with at least some attempts.
      const sorted = entries.sort((a, b) => {
        const aa = typeof a.accuracy === 'number' ? a.accuracy : 0;
        const bb = typeof b.accuracy === 'number' ? b.accuracy : 0;
        return aa - bb;
      });
      const picked = sorted.slice(0, 5);
      attemptsSum = picked.reduce((s, p) => s + (p.attempts || 0), 0);
      weakCount = picked.length;
    }

    // Convert attempt signal → recommended weekly sessions.
    // Heuristic mapping:
    // - No/unknown data => 3 sessions.
    // - Low attempts / emerging weakness => 4 sessions.
    // - Higher attempts / consistent weakness => 5-6 sessions.
    if (!weakCount || attemptsSum <= 0) return 3;

    // Normalize by number of weak skills so “attemptsSum grows with more weak skills” doesn’t inflate too much.
    const avgAttemptsPerWeak = attemptsSum / Math.max(weakCount, 1);

    // Tuned constants for stability.
    if (avgAttemptsPerWeak < 3) return 4;
    if (avgAttemptsPerWeak < 8) return 5;
    return 6;
  }

  function _renderPracticeSessions() {
    const el = document.getElementById('practiceSessionsRecommendation');
    if (!el) return;

    const sessions = _estimatePracticeSessionsPerWeek();
    // Parent-friendly language.
    const headline = `Recommended: ${sessions} short practice session${sessions === 1 ? '' : 's'} this week`;
    const sub = '5–10 minutes each, focused on the topics your child is struggling with.';
    el.textContent = headline;

    const subEl = document.getElementById('practiceSessionsRecommendationSub');
    if (subEl) subEl.textContent = sub;
  }

  function _renderAccuracyChart() {
    // Draw a simple chart into #accuracyChart using last 14 days.
    const canvas = document.getElementById('accuracyChart');
    if (!canvas) return;

    if (typeof window.Chart === 'undefined' && canvas.getContext) {
      // If Chart.js isn’t available, do a minimal fallback text.
      const fallback = document.createElement('div');
      fallback.style.fontSize = '13px';
      fallback.style.color = 'rgba(255,255,255,0.72)';
      fallback.style.marginTop = '8px';
      fallback.textContent = 'Accuracy trend: not available in this view.';
      // Avoid duplicating fallback.
      if (!document.getElementById('accuracyChartFallback')) {
        fallback.id = 'accuracyChartFallback';
        canvas.parentElement?.appendChild(fallback);
      }
      return;
    }

    const series = _getWeekAccuracySeries(14);
    if (!series) return;

    const last7 = series.last7;
    const prev7 = series.prev7;

    // If accuracyByDay includes null/undefined, Chart.js can handle gaps, but we’ll filter to show labels.
    const lastValues = last7.map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : null));
    const prevValues = prev7.map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : null));

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Compute averages for parent-friendly tooltip/legend.
    const lastAvg = series.lastAvg;
    const prevAvg = series.prevAvg;

    const labels = ['D-13', 'D-12', 'D-11', 'D-10', 'D-9', 'D-8', 'D-7', 'D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'D-1', 'Today'];

    // Combine prev7 + last7 into a 14-day sequence: prev7 (7) then last7 (7)
    const combined = prevValues.concat(lastValues);

    // Destroy existing chart if present.
    if (canvas.__chartInstance && typeof canvas.__chartInstance.destroy === 'function') {
      canvas.__chartInstance.destroy();
    }

    const ChartCtor = window.Chart;
    canvas.__chartInstance = new ChartCtor(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Accuracy (last 14 days)',
            data: combined.map((v) => (v === null ? null : Math.round(v * 100))),
            borderColor: 'rgba(102,252,241,0.9)',
            backgroundColor: 'rgba(102,252,241,0.12)',
            pointBackgroundColor: 'rgba(102,252,241,0.95)',
            pointRadius: 3,
            tension: 0.35,
            spanGaps: true
          },
          {
            label: 'Last 7 days avg',
            data: combined.map((_, idx) => {
              if (idx < 7) return null;
              if (typeof lastAvg !== 'number' || !Number.isFinite(lastAvg)) return null;
              return Math.round(lastAvg * 100);
            }),
            borderColor: 'rgba(16,185,129,0.8)',
            borderDash: [6, 6],
            pointRadius: 0,
            fill: false
          },
          {
            label: 'Previous 7 days avg',
            data: combined.map((_, idx) => {
              if (idx >= 7) return null;
              if (typeof prevAvg !== 'number' || !Number.isFinite(prevAvg)) return null;
              return Math.round(prevAvg * 100);
            }),
            borderColor: 'rgba(239,68,68,0.8)',
            borderDash: [6, 6],
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: 'rgba(255,255,255,0.75)',
              font: { size: 11 }
            }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val = ctx.parsed?.y;
                if (val === null || val === undefined) return 'N/A';
                return `Accuracy: ${val}%`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: 'rgba(255,255,255,0.55)', maxTicksLimit: 7 },
            grid: { display: false }
          },
          y: {
            beginAtZero: true,
            max: 100,
            ticks: { color: 'rgba(255,255,255,0.55)', callback: (v) => `${v}%` },
            grid: { color: 'rgba(255,255,255,0.06)' }
          }
        }
      }
    });
  }

  function _renderWeeklyReport() {
    _updateStreak();
    _renderAccuracyChart();
    _renderStrengths();
    _renderWeaknesses();
    _renderPracticeSessions();
    // Keep legacy elements safe (only render if the parent page provides the containers)
    _renderBiggestImprovement();
    _renderNextGoals();
  }



  document.addEventListener('DOMContentLoaded', _renderWeeklyReport);
})();
