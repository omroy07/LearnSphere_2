// weeklyReport.js — Parent Weekly Summary
// Generates a concise weekly overview: streak, top strengths, and areas to improve.
// Assumes window.quizProgress and window.studyProgress are already loaded.

(function () {
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
    streakEl.textContent = streak !== null && streak !== undefined ? streak : '—';
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
      empty.textContent = 'No strength data yet.';
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
      empty.textContent = 'No weak concepts identified yet.';
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

  function _renderWeeklyReport() {
    _updateStreak();
    _renderStrengths();
    _renderWeaknesses();
  }

  document.addEventListener('DOMContentLoaded', _renderWeeklyReport);
})();
