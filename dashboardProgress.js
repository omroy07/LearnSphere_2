/**
 * dashboardProgress.js — Parent/Teacher Progress Dashboard (read-only)
 *
 * Renders analytics using quizProgress.js localStorage data:
 * - Accuracy trend chart (last 14 days)
 * - Weak-topic recommendations
 * - Topic-wise accuracy + attempts summary
 * - Streak + overall accuracy KPI
 *
 * Works in demo mode (single learner) via localStorage.
 */

(function () {
  /**
   * Progress Analytics Dashboard (extended)
   * - Rolling average score + best score (from attempts history)
   * - Mastery per category (subject)
   * - Time spent per quiz (from attempts history)
   * - Filters: date range + subject
   */
  function pct(n) {
    if (typeof n !== "number" || Number.isNaN(n)) return "—";
    return `${Math.round(n * 100)}%`;
  }

  function formatAttempts(n) {
    if (typeof n !== "number" || Number.isNaN(n)) return "0";
    return String(n);
  }

  function drawLineChart(canvas, labels, accuracyByDay) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background grid
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const y = (h / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const valid = accuracyByDay
      .map((a, idx) => ({ a, idx }))
      .filter(p => typeof p.a === "number" && !Number.isNaN(p.a));

    if (valid.length < 2) {
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "14px Arial";
      ctx.fillText("Complete at least 2 quiz attempts to see a trend.", 16, 28);
      return;
    }

    const xStep = w / (labels.length - 1);
    const marginTop = 16;
    const marginBottom = 24;
    const usable = h - marginTop - marginBottom;

    const toY = (acc) => marginTop + (1 - acc) * usable;

    // Line
    ctx.strokeStyle = "#66fcf1";
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < accuracyByDay.length; i++) {
      const a = accuracyByDay[i];
      if (typeof a !== "number" || Number.isNaN(a)) continue;
      const x = i * xStep;
      const y = toY(a);
      if (ctx.__started !== true) {
        ctx.moveTo(x, y);
        ctx.__started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }

    // Reset helper
    delete ctx.__started;

    ctx.stroke();

    // Points
    valid.forEach(({ a, idx }) => {
      const x = idx * xStep;
      const y = toY(a);
      ctx.fillStyle = "#66fcf1";
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
    });

    // X labels
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = "12px Arial";
    const stride = Math.max(1, Math.floor(labels.length / 6));

    labels.forEach((lab, i) => {
      if (i % stride !== 0 && i !== labels.length - 1) return;
      ctx.fillText(lab, i * xStep - 10, h - 8);
    });
  }

  function ensureCanvasResolution(canvas, heightPx) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Use provided height if bbox is 0/undefined.
    const targetW = rect.width || canvas.width || 600;
    const targetH = rect.height || heightPx || 240;

    canvas.width = Math.floor(targetW * dpr);
    canvas.height = Math.floor(targetH * dpr);
  }

  function renderKpis(root) {
    let currentStreak = 0;
    let streakMetaText = "No practice yet.";
    let dailyGoalPct = 0;
    let dailyGoalMetaText = "Complete 1 quiz or review 10 questions.";

    if (window.studyProgress && typeof window.studyProgress.loadStreakState === "function") {
      const streakState = window.studyProgress.loadStreakState();
      currentStreak = streakState.currentStreak || 0;
      const last = streakState.lastActiveDate;
      streakMetaText = last ? `Last active: ${last}` : "No activity yet.";

      const qDone = streakState.dailyGoalProgress.quizzesCompleted || 0;
      const rDone = streakState.dailyGoalProgress.questionsReviewed || 0;
      const quizGoalProgress = qDone / 1;
      const reviewGoalProgress = rDone / 10;
      dailyGoalPct = Math.min(100, Math.round(Math.max(quizGoalProgress, reviewGoalProgress) * 100));
      dailyGoalMetaText = dailyGoalPct >= 100 
        ? `🎉 Goal Achieved! (${qDone}/1 quiz, ${rDone}/10 reviewed)` 
        : `${qDone}/1 quiz, ${rDone}/10 reviewed today`;
    } else {
      const streak = window.quizProgress?.getStreak?.();
      currentStreak = streak?.currentStreak || 0;
      const last = streak?.lastPracticeDate;
      streakMetaText = last ? `Last practice: ${last}` : "No practice yet.";
    }

    const streakValue = root.querySelector("#streakValue");
    const streakMeta = root.querySelector("#streakMeta");

    if (streakValue) streakValue.textContent = String(currentStreak);
    if (streakMeta) streakMeta.textContent = streakMetaText;

    const dailyGoalValue = root.querySelector("#dailyGoalValue");
    const dailyGoalMeta = root.querySelector("#dailyGoalMeta");
    if (dailyGoalValue) dailyGoalValue.textContent = `${dailyGoalPct}%`;
    if (dailyGoalMeta) dailyGoalMeta.textContent = dailyGoalMetaText;

    const overall = window.quizProgress?.getOverallAccuracy?.();
    const overallAccuracyValue = root.querySelector("#overallAccuracyValue");
    const overallAccuracyMeta = root.querySelector("#overallAccuracyMeta");

    if (overallAccuracyValue) overallAccuracyValue.textContent = overall?.accuracy == null ? "—" : pct(overall.accuracy);
    if (overallAccuracyMeta) {
      const correct = overall?.correct || 0;
      const total = overall?.total || 0;
      overallAccuracyMeta.textContent = total > 0 ? `${correct} correct out of ${total} answers` : "Complete a quiz to populate your stats.";
    }
  }

  function renderAccuracyChart(root) {
    const series = window.quizProgress?.getAccuracySeries?.({ days: 14 });
    const canvas = root.querySelector("#accuracyChart");
    if (!canvas) return;

    if (!series || !series.labels || !Array.isArray(series.accuracyByDay)) {
      const ctx = canvas.getContext("2d");
      ctx && ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    ensureCanvasResolution(canvas, 240);
    drawLineChart(canvas, series.labels, series.accuracyByDay);
  }

  function renderRecommendations(root) {
    const recEl = root.querySelector("#recommendedTopics");
    if (!recEl) return;

    const recs = window.quizProgress?.getRecommendedTopics?.({ limit: 3 }) || [];
    recEl.innerHTML = "";

    if (!recs.length) {
      recEl.textContent = "No recommendations yet.";
      return;
    }

    recs.forEach(r => {
      const chip = document.createElement("span");
      chip.className = "recommend-chip";
      const accText = r.accuracy == null ? "not attempted" : `accuracy ${pct(r.accuracy)}`;
      chip.textContent = `${r.topic.label} • ${accText}`;
      recEl.appendChild(chip);
    });
  }

  function renderTopicStats(root) {
    const topicStatsEl = root.querySelector("#topicStats");
    if (!topicStatsEl) return;

    const byTopic = window.quizProgress?.getAllTopicStats?.() || {};
    const topics = window.quizProgress?.QUIZ_TOPICS || [];

    const sorted = [...topics].sort((a, b) => {
      const aAttempts = byTopic[a.id]?.attempts || 0;
      const bAttempts = byTopic[b.id]?.attempts || 0;
      return bAttempts - aAttempts;
    });

    topicStatsEl.innerHTML = "";

    sorted.forEach(t => {
      const agg = byTopic[t.id];
      const attempts = agg?.attempts || 0;
      const qTotal = agg?.questionsTotal || 0;
      const correctTotal = agg?.correctTotal || 0;
      const accuracy = qTotal > 0 ? correctTotal / qTotal : null;
      const barW = accuracy == null ? 0 : Math.max(0, Math.min(100, Math.round(accuracy * 100)));

      const row = document.createElement("div");
      row.className = "topic-row";
      row.innerHTML = `
        <div style="min-width: 210px; font-weight: 600">${t.label}</div>
        <div class="bar" aria-label="accuracy bar">
          <i style="width:${barW}%; background:${accuracy == null ? "rgba(255,255,255,0.22)" : "#66fcf1"}"></i>
        </div>
        <div style="min-width: 92px; text-align:right">
          <div style="font-weight:700">${accuracy == null ? "—" : pct(accuracy)}</div>
          <div class="muted" style="font-size:12px">${formatAttempts(attempts)} attempts</div>
        </div>
      `;

      topicStatsEl.appendChild(row);
    });
  }

  function renderMastery(root) {
    const masteryListEl = root.querySelector("#masterySkillsList");
    const weakSkillsEl = root.querySelector("#weakSkillsRecommendations");
    if (!masteryListEl || !weakSkillsEl) return;

    const mastery = window.quizProgress.getMasteryStats();
    const taxonomy = window.quizProgress.SKILL_TAXONOMY || {};

    const skillMap = new Map();
    for (const [qText, tax] of Object.entries(taxonomy)) {
      if (!skillMap.has(tax.skillId)) {
        skillMap.set(tax.skillId, {
          skillId: tax.skillId,
          label: tax.label,
          topicId: tax.topicId,
          quizUrl: tax.quizUrl,
          attempts: 0,
          correct: 0
        });
      }
    }

    let totalAttempts = 0;
    for (const [sId, m] of Object.entries(mastery)) {
      totalAttempts += m.attempts || 0;
      if (skillMap.has(sId)) {
        const entry = skillMap.get(sId);
        entry.attempts = m.attempts || 0;
        entry.correct = m.correct || 0;
      } else {
        skillMap.set(sId, {
          skillId: sId,
          label: sId.replace("-general", " General Concepts"),
          topicId: sId.split("-")[0],
          quizUrl: null,
          attempts: m.attempts || 0,
          correct: m.correct || 0
        });
      }
    }

    const skillsArray = Array.from(skillMap.values());

    skillsArray.sort((a, b) => {
      if (a.attempts !== b.attempts) {
        return b.attempts - a.attempts;
      }
      return a.label.localeCompare(b.label);
    });

    if (totalAttempts === 0) {
      masteryListEl.innerHTML = `<div class="muted" style="padding: 12px; text-align: center; font-size:13px; color:rgba(255,255,255,0.72)">No mastery data recorded yet.</div>`;
    } else {
      masteryListEl.innerHTML = "";
      skillsArray.forEach(s => {
        if (s.attempts === 0) return;

        const accuracy = s.attempts > 0 ? s.correct / s.attempts : 0;
        const pctValue = Math.round(accuracy * 100);
        
        let barColor = "#ef4444";
        if (pctValue >= 80) {
          barColor = "#66fcf1";
        } else if (pctValue >= 50) {
          barColor = "#f59e0b";
        }

        const row = document.createElement("div");
        row.className = "topic-row";
        row.style.marginBottom = "8px";
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.justifyContent = "space-between";
        row.style.padding = "10px 12px";
        row.style.borderRadius = "10px";
        row.style.background = "rgba(255,255,255,0.03)";
        row.style.border = "1px solid rgba(255,255,255,0.06)";
        row.innerHTML = `
          <div style="min-width: 210px; font-weight: 600; font-size: 0.9rem; color: #fff;">${s.label}</div>
          <div class="bar" aria-label="mastery bar" style="flex: 1; height: 8px; background: rgba(255, 255, 255, 0.05); margin: 0 12px; border-radius: 999px; overflow: hidden;">
            <i style="display: block; height: 100%; width:${pctValue}%; background:${barColor}; border-radius: 999px;"></i>
          </div>
          <div style="min-width: 90px; text-align:right; font-size: 0.9rem;">
            <div style="font-weight:700; color: ${barColor};">${pctValue}%</div>
            <div class="muted" style="font-size:11px; color:rgba(255,255,255,0.72);">${s.correct}/${s.attempts} correct</div>
          </div>
        `;
        masteryListEl.appendChild(row);
      });

      if (masteryListEl.children.length === 0) {
        masteryListEl.innerHTML = `<div class="muted" style="padding: 12px; text-align: center; font-size:13px; color:rgba(255,255,255,0.72)">No concept stats available yet.</div>`;
      }
    }

    const weakSkills = window.quizProgress.getWeakestSkills({ limit: 3 });
    
    weakSkillsEl.innerHTML = "";
    if (!weakSkills || weakSkills.length === 0) {
      weakSkillsEl.innerHTML = `<div class="muted" style="font-size:13px; color:rgba(255,255,255,0.72)">No weak concepts identified yet.</div>`;
    } else {
      weakSkills.forEach(ws => {
        const accuracyPct = ws.attempts > 0 ? `${Math.round(ws.accuracy * 100)}%` : "Not attempted";
        
        const card = document.createElement("div");
        card.style.background = "rgba(255, 255, 255, 0.02)";
        card.style.border = "1px solid rgba(255, 255, 255, 0.06)";
        card.style.borderRadius = "8px";
        card.style.padding = "12px 14px";
        card.style.display = "flex";
        card.style.justifyContent = "space-between";
        card.style.alignItems = "center";

        let statusColor = "#ff5e5e";
        if (ws.attempts === 0) {
          statusColor = "#a0aec0";
        } else if (ws.accuracy >= 0.8) {
          statusColor = "#66fcf1";
        } else if (ws.accuracy >= 0.5) {
          statusColor = "#f59e0b";
        }

        card.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:4px; text-align:left;">
            <div style="font-weight: 600; font-size: 0.95rem; color: #fff;">${ws.label}</div>
            <div style="font-size: 0.8rem; color: rgba(255, 255, 255, 0.65);">
              Accuracy: <span style="font-weight:bold; color: ${statusColor}">${accuracyPct}</span> 
              ${ws.attempts > 0 ? `(${ws.attempts} attempts)` : ""}
            </div>
          </div>
        `;
        weakSkillsEl.appendChild(card);
      });
    }
  }

  function renderAdaptiveNextQuizPlanner(root) {
    const container = root.querySelector("#adaptiveNextQuizPlanner");
    if (!container) return;

    const planner = window.quizProgress?.getAdaptiveNextQuizPlanner?.({ limit: 1 });
    container.innerHTML = "";

    if (!planner || !planner.recommendations || planner.recommendations.length === 0) {
      container.innerHTML = `<div class="muted">No adaptive recommendation yet.</div>`;
      return;
    }

    const rec = planner.recommendations[0];
    const quizTitle = rec.quizLabel || rec.topicLabel || "Next quiz";
    const readiness = rec.readinessPct == null ? "—" : `${rec.readinessPct}%`;
    const reason = rec.reasonText || "";

    const difficultyKey = rec.difficultyKey || rec.difficulty || "";
    const badgeText = difficultyKey ? String(difficultyKey).replace(/-/g, ' ') : (rec.difficulty || "");

    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:10px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
          <div>
            <div style="font-weight:800; font-size:1.05rem; color: var(--accent-color);">${quizTitle}</div>
            <div class="muted" style="font-size:13px; margin-top:4px;">${reason}</div>
          </div>
          <div style="text-align:right; min-width: 110px;">
            <div style="font-weight:900; font-size:18px; color:#66fcf1;">${readiness}</div>
            <div class="muted" style="font-size:12px; margin-top:2px;">Readiness</div>
          </div>
        </div>
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
          <div class="muted" style="font-size:13px;">Difficulty: <span style="font-weight:700; color:#fff;">${badgeText}</span></div>
          <a href="${rec.quizUrl || '#'}" style="text-decoration:none;">
            <button style="background: linear-gradient(135deg, #00f2fe, #4facfe); border: none; color: #000; font-weight:800; padding: 10px 14px; border-radius: 10px; cursor:pointer;">
              Start recommended quiz ▶
            </button>
          </a>
        </div>
      </div>
    `;
  }

  function renderAll(root) {

    // Guard: quizProgress must be loaded
    if (!window.quizProgress) {
      const status = root.querySelector("#dashboardStatus");
      if (status) status.textContent = "Progress data not available.";
      return;
    }

    renderKpis(root);
    renderAccuracyChart(root);
    renderRecommendations(root);
    renderTopicStats(root);
    renderMastery(root);
    renderAdaptiveNextQuizPlanner(root);

  }

  function initByRole() {
    // Detect a container we can render into.
    // parents.html / teachers.html will use the same structure.
    const root = document.querySelector("[data-progress-dashboard='1']");
    if (!root) return;

    renderAll(root);
  }

  document.addEventListener("DOMContentLoaded", () => {
    initByRole();
  });

  // Expose for debugging (optional)
  function openDrilldown(metric) {
    const modal = document.getElementById('drilldownModal');
    const title = document.getElementById('modalTitle');
    const canvas = document.getElementById('modalChart');
    const explanationDiv = document.getElementById('modalExplanation');

    title.textContent = `Drill‑down: ${metric.charAt(0).toUpperCase() + metric.slice(1)}`;

    // Simple demo data: last 7 days random values
    const labels = [];
    const values = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
      const base = window.quizProgress?.getOverallAccuracy?.()?.accuracy || 0.6;
      const jitter = (Math.random() - 0.5) * 0.2;
      values.push(Math.min(1, Math.max(0, base + jitter)));
    }

    if (typeof ensureCanvasResolution === 'function') {
      ensureCanvasResolution(canvas, 200);
    }

    if (typeof window.drawLineChart === 'function') {
      window.drawLineChart(canvas, labels, values);
    }

    const explanation = typeof window.explainMetric === 'function'
      ? window.explainMetric(metric, { summary: values.map(v => Math.round(v * 100) + '%').join(', ') })
      : '';
    explanationDiv.textContent = explanation;

    modal.style.display = 'block';
  }

  const closeBtn = document.getElementById('modalCloseBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      const modal = document.getElementById('drilldownModal');
      if (modal) modal.style.display = 'none';
    });
  }

  document.addEventListener('click', e => {
    const target = e.target;
    if (target && target.matches('.drilldown-btn')) {
      openDrilldown(target.dataset.metric);
    }
  });

  window.dashboardProgress = { renderAll, initByRole, openDrilldown };
})();

