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

  function _renderWeeklyReport() {
    _updateStreak();
    _renderStrengths();
    _renderWeaknesses();
    _renderBiggestImprovement();
    _renderNextGoals();
  }


  document.addEventListener('DOMContentLoaded', _renderWeeklyReport);
})();
