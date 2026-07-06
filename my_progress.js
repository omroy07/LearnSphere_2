function pct(n) {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

function formatAttempts(n) {
  if (typeof n !== "number") return "0";
  return String(n);
}

function drawLineChart(canvas, labels, accuracyByDay) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  // Clear
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

  // Build points (skip nulls)
  const valid = accuracyByDay
    .map((a, idx) => ({ a, idx }))
    .filter(p => typeof p.a === "number");

  if (valid.length < 2) {
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "14px Arial";
    ctx.fillText("Complete at least 2 quiz attempts to see a trend.", 16, 28);
    return;
  }

  const xStep = w / (labels.length - 1);
  const toY = (acc) => {
    // acc: 0..1
    const marginTop = 16;
    const marginBottom = 24;
    const usable = h - marginTop - marginBottom;
    return marginTop + (1 - acc) * usable;
  };

  // Line
  ctx.strokeStyle = "#66fcf1";
  ctx.lineWidth = 2;
  ctx.beginPath();

  // Find first valid index
  const firstIdx = valid[0].idx;
  let started = false;
  for (let i = 0; i < accuracyByDay.length; i++) {
    const a = accuracyByDay[i];
    if (typeof a !== "number") continue;
    const x = i * xStep;
    const y = toY(a);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
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

  // X labels (mm/dd)
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "12px Arial";
  const stride = Math.max(1, Math.floor(labels.length / 6));
  labels.forEach((lab, i) => {
    if (i % stride !== 0 && i !== labels.length - 1) return;
    ctx.fillText(lab, i * xStep - 10, h - 8);
  });
}

function init() {
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
    const streak = window.quizProgress.getStreak();
    currentStreak = streak.currentStreak || 0;
    const last = streak.lastPracticeDate;
    streakMetaText = last ? `Last practice: ${last}` : "No practice yet.";
  }

  const streakValue = document.getElementById("streakValue");
  const streakMeta = document.getElementById("streakMeta");
  if (streakValue) streakValue.textContent = String(currentStreak);
  if (streakMeta) streakMeta.textContent = streakMetaText;

  const dailyGoalValue = document.getElementById("dailyGoalValue");
  const dailyGoalMeta = document.getElementById("dailyGoalMeta");
  if (dailyGoalValue) dailyGoalValue.textContent = `${dailyGoalPct}%`;
  if (dailyGoalMeta) dailyGoalMeta.textContent = dailyGoalMetaText;

  const overall = window.quizProgress.getOverallAccuracy();
  const overallAccuracyValue = document.getElementById("overallAccuracyValue");
  const overallAccuracyMeta = document.getElementById("overallAccuracyMeta");

  if (overallAccuracyValue) overallAccuracyValue.textContent = overall.accuracy == null ? "—" : pct(overall.accuracy);
  if (overallAccuracyMeta) {
    overallAccuracyMeta.textContent = overall.total > 0 ? `${overall.correct} correct out of ${overall.total} answers` : "Complete a quiz to populate your stats.";
  }

  // Chart
  const series = window.quizProgress.getAccuracySeries({ days: 14 });
  const canvas = document.getElementById("accuracyChart");
  if (canvas) {
    // Ensure canvas resolution matches layout size
    // (Canvas width/height are attributes; default may be too small.)
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(240 * dpr);

    drawLineChart(canvas, series.labels, series.accuracyByDay);
  }

  // Topic stats
  const topicStatsEl = document.getElementById("topicStats");
  const byTopic = window.quizProgress.getAllTopicStats();

  if (topicStatsEl) {
    const topics = window.quizProgress.QUIZ_TOPICS;
    const sorted = [...topics].sort((a, b) => {
      const aAttempts = byTopic[a.id]?.attempts || 0;
      const bAttempts = byTopic[b.id]?.attempts || 0;
      return (bAttempts - aAttempts) || String(a.label).localeCompare(String(b.label));
    });

    topicStatsEl.innerHTML = `
      <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: rgba(255,255,255,0.5); border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 6px; margin-bottom: 8px;">
        <span style="min-width: 210px;">Topic</span>
        <span style="flex: 1; margin: 0 10px; text-align: center;">Accuracy Trend</span>
        <span style="min-width: 92px; text-align: right;">Stats</span>
      </div>
    `;

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

  // Recommendations
  const recEl = document.getElementById("recommendedTopics");
  if (recEl) {
    const recs = window.quizProgress.getRecommendedTopics({ limit: 3 });
    recEl.innerHTML = "";
    recs.forEach(r => {
      const chip = document.createElement("span");
      chip.className = "recommend-chip";
      const accText = r.accuracy == null ? "not attempted" : `accuracy ${pct(r.accuracy)}`;
      chip.textContent = `${r.topic.label} • ${accText}`;
      recEl.appendChild(chip);
    });
  }
}

  function initReviewQueueWidget() {
  const widget = document.getElementById("reviewQueueWidget");
  if (!widget) return;

  const STORAGE_KEY = "learnsphere_review_schedule_v1";
  let schedule = {};
  try {
    schedule = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    schedule = {};
  }

  // Topic IDs must match progress.js topic list.
  const TOPIC_IDS = [
    "physics-motion",
    "physics-nlm",
    "physics-projectile",
    "physics-ray",
    "maths-calculus",
    "maths-vectors",
    "maths-probability",
    "maths-geometry",
    "chemistry-atomic",
    "chemistry-bonding",
    "chemistry-equil",
    "chemistry-thermo",
  ];

  // Use the same day-token rules as spaced repetition logic in progress.js/review.js.
  function todayLocalISODate() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function parseISODateToUTCStart(isoDateYYYYMMDD) {
    const [y, m, day] = isoDateYYYYMMDD.split("-").map(Number);
    const dt = new Date(y, m - 1, day, 0, 0, 0, 0);
    return Math.floor(dt.getTime() / 86400000);
  }

  const todayToken = parseISODateToUTCStart(todayLocalISODate());

  let dueCount = 0;
  const nextDates = [];

  for (const topicId of TOPIC_IDS) {
    const s = schedule[topicId];
    if (!s || !s.nextReviewDate) continue;

    const nextToken = parseISODateToUTCStart(s.nextReviewDate);
    if (todayToken >= nextToken) dueCount += 1;
    else nextDates.push(s.nextReviewDate);
  }

  if (dueCount > 0) {
    widget.innerHTML = `<a href="review.html" style="color: var(--accent-color); text-decoration: none; font-weight: bold;">${dueCount} review${dueCount === 1 ? "" : "s"} due today. Click here to start review.</a>`;
  } else {
    const earliest = nextDates.sort().shift();
    widget.innerHTML = earliest ? `Next review available on ${earliest}. <a href="review.html" style="color: var(--accent-color); text-decoration: none; font-weight: bold;">View queue</a>` : `No reviews scheduled yet. Complete topics to start getting review sessions. <a href="review.html" style="color: var(--accent-color); text-decoration: none; font-weight: bold;">View queue</a>`;
  }
}

function initMasteryDashboard() {
  const masteryListEl = document.getElementById("masterySkillsList");
  const weakSkillsEl = document.getElementById("weakSkillsRecommendations");
  if (!masteryListEl || !weakSkillsEl) return;

  const mastery = window.quizProgress.getMasteryStats();
  const taxonomy = window.quizProgress.SKILL_TAXONOMY || {};

  // Group all unique skills from taxonomy
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

  // Populate actual attempts and correct values
  let totalAttempts = 0;
  for (const [sId, m] of Object.entries(mastery)) {
    totalAttempts += m.attempts || 0;
    if (skillMap.has(sId)) {
      const entry = skillMap.get(sId);
      entry.attempts = m.attempts || 0;
      entry.correct = m.correct || 0;
    } else {
      // Fallback for dynamically generated or legacy general skills
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

  // Render Left Column: Concept Mastery Details
  // Sort attempted first, then alphabetical by label
  skillsArray.sort((a, b) => {
    if (a.attempts !== b.attempts) {
      return b.attempts - a.attempts; // attempted first
    }
    return a.label.localeCompare(b.label);
  });

  if (totalAttempts === 0) {
    masteryListEl.innerHTML = `<div class="muted" style="padding: 12px; text-align: center;">No mastery data recorded yet. Complete quizzes to see concept-wise stats!</div>`;
  } else {
    masteryListEl.innerHTML = `
      <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: rgba(255,255,255,0.5); border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 6px; margin-bottom: 8px;">
        <span style="min-width: 210px;">Concept</span>
        <span style="flex: 1; margin: 0 12px; text-align: center;">Mastery level</span>
        <span style="min-width: 90px; text-align: right;">Accuracy</span>
      </div>
    `;
    skillsArray.forEach(s => {
      // Only render if attempted to keep the dashboard clean and focused on progress
      if (s.attempts === 0) return;

      const accuracy = s.attempts > 0 ? s.correct / s.attempts : 0;
      const pctValue = Math.round(accuracy * 100);
      
      // Determine premium color based on accuracy
      let barColor = "#ef4444"; // red for <50%
      if (pctValue >= 80) {
        barColor = "#66fcf1"; // teal for >=80%
      } else if (pctValue >= 50) {
        barColor = "#f59e0b"; // orange/yellow for 50-80%
      }

      const row = document.createElement("div");
      row.className = "topic-row";
      row.style.marginBottom = "8px";
      row.innerHTML = `
        <div style="min-width: 210px; font-weight: 600; font-size: 0.9rem;">${s.label}</div>
        <div class="bar" aria-label="mastery bar" style="background: rgba(255, 255, 255, 0.05); margin: 0 12px; height: 8px;">
          <i style="width:${pctValue}%; background:${barColor}; border-radius: 999px;"></i>
        </div>
        <div style="min-width: 90px; text-align:right; font-size: 0.9rem;">
          <div style="font-weight:700; color: ${barColor};">${pctValue}%</div>
          <div class="muted" style="font-size:11px;">${s.correct}/${s.attempts} correct</div>
        </div>
      `;
      masteryListEl.appendChild(row);
    });

    if (masteryListEl.children.length === 0) {
      masteryListEl.innerHTML = `<div class="muted" style="padding: 12px; text-align: center;">Complete quizzes to see concept-wise stats!</div>`;
    }
  }

  // Render Right Column: Weakest Concepts & Recommended Practice
  const weakSkills = window.quizProgress.getWeakestSkills({ limit: 3 });
  
  weakSkillsEl.innerHTML = "";
  if (!weakSkills || weakSkills.length === 0) {
    weakSkillsEl.innerHTML = `<div class="muted">No weak concepts identified yet. Keep practicing!</div>`;
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
      card.style.transition = "all 0.2s ease";
      
      card.addEventListener("mouseenter", () => {
        card.style.background = "rgba(255, 255, 255, 0.04)";
        card.style.borderColor = "rgba(102, 252, 241, 0.3)";
      });
      card.addEventListener("mouseleave", () => {
        card.style.background = "rgba(255, 255, 255, 0.02)";
        card.style.borderColor = "rgba(255, 255, 255, 0.06)";
      });

      const practiceUrl = ws.quizUrl ? ws.quizUrl : "#";

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
        ${ws.quizUrl ? `
          <a href="${practiceUrl}" style="
            background: rgba(102, 252, 241, 0.08); 
            border: 1px solid rgba(102, 252, 241, 0.4); 
            color: #66fcf1;
            padding: 6px 12px;
            border-radius: 6px;
            text-decoration: none;
            font-size: 0.8rem;
            font-weight: bold;
            transition: all 0.2s ease;
          " onmouseover="this.style.background='#66fcf1'; this.style.color='#0f1115'" onmouseout="this.style.background='rgba(102, 252, 241, 0.08)'; this.style.color='#66fcf1'">
            Practice ➔
          </a>
        ` : ""}
      `;
      weakSkillsEl.appendChild(card);
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  init();
  initMasteryDashboard();
  initReviewQueueWidget();

  // Export Progress UI wiring
  const downloadBtn = document.getElementById("downloadProgressJsonBtn");
  const printBtn = document.getElementById("printProgressBtn");
  const previewBtn = document.getElementById("previewExportBtn");
  const previewContainer = document.getElementById("exportPreviewContainer");
  const previewContent = document.getElementById("exportPreviewContent");
  const previewWarning = document.getElementById("exportPreviewWarning");
  const closePreviewBtn = document.getElementById("closePreviewBtn");

  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      if (!window.exportProgress?.buildProgressExportPayload || !window.exportProgress?.downloadJson) return;
      const payload = window.exportProgress.buildProgressExportPayload({
        formatVersion: { major: 1, minor: 0 },
        roleContext: "learner"
      });
      window.exportProgress.downloadJson(payload, "learnsphere_progress_export.json");
    });
  }

  if (printBtn) {
    printBtn.addEventListener("click", () => {
      window.print();
    });
  }

  if (previewBtn && previewContainer && previewContent && previewWarning) {
    previewBtn.addEventListener("click", () => {
      if (!window.exportProgress?.buildProgressExportPayload) return;
      const payload = window.exportProgress.buildProgressExportPayload({
        formatVersion: { major: 1, minor: 0 },
        roleContext: "learner"
      });

      // Validate empty states
      const attemptsCount = payload?.metrics?.quizHistory?.totalAttempts || 0;
      if (attemptsCount === 0) {
        previewWarning.style.display = "block";
        previewWarning.textContent = "⚠️ [Empty State Check] No quiz attempts recorded yet. The generated export payload will contain empty progress metrics.";
      } else {
        previewWarning.style.display = "none";
      }

      previewContent.textContent = JSON.stringify(payload, null, 2);
      previewContainer.style.display = "block";
      previewContainer.scrollIntoView({ behavior: "smooth" });
    });
  }

  if (closePreviewBtn && previewContainer) {
    closePreviewBtn.addEventListener("click", () => {
      previewContainer.style.display = "none";
    });
  }

  // Populate print-only report container before printing.
  window.addEventListener("beforeprint", () => {
    try {
      const container = document.getElementById("printReport");
      if (!container) return;

      const generatedAt = container.querySelector(".muted")?.textContent || "";
      const payload = window.exportProgress?.buildProgressExportPayload?.({
        formatVersion: { major: 1, minor: 0 },
        roleContext: "learner"
      });

      // Set generatedAt (first occurrence of {{generatedAt}} in the inline template)
      const headerMuteds = container.querySelectorAll(".muted");
      // Best-effort: update any text that looks like the placeholder.
      headerMuteds.forEach(el => {
        if (el.textContent && el.textContent.includes("{{generatedAt}}")) {
          el.textContent = payload?.generatedAt || new Date().toISOString();
        }
      });

      const streakValue = document.getElementById("streakValue");
      const streakMeta = document.getElementById("streakMeta");
      const overallAccValue = document.getElementById("overallAccuracyValue");
      const overallAccMeta = document.getElementById("overallAccuracyMeta");

      const pStreakValue = document.getElementById("printStreakValue");
      const pStreakMeta = document.getElementById("printStreakMeta");
      const pOverallAccValue = document.getElementById("printOverallAccuracyValue");
      const pOverallAccMeta = document.getElementById("printOverallAccuracyMeta");

      if (pStreakValue && streakValue) pStreakValue.textContent = streakValue.textContent || "—";
      if (pStreakMeta && streakMeta) pStreakMeta.textContent = streakMeta.textContent || "—";
      if (pOverallAccValue && overallAccValue) pOverallAccValue.textContent = overallAccValue.textContent || "—";
      if (pOverallAccMeta && overallAccMeta) pOverallAccMeta.textContent = overallAccMeta.textContent || "—";

      // Weak skills
      const printWeakSkills = document.getElementById("printWeakSkills");
      if (printWeakSkills && window.quizProgress?.getWeakestSkills) {
        const weak = window.quizProgress.getWeakestSkills({ limit: 3 }) || [];
        printWeakSkills.innerHTML = `
          <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: rgba(255,255,255,0.5); border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px; margin-bottom: 8px;">
            <span>Concept/Skill</span>
            <span style="text-align: right;">Performance</span>
          </div>
        `;
        weak.forEach(ws => {
          const accTxt = ws.attempts > 0 && ws.accuracy != null ? `${Math.round(ws.accuracy * 100)}%` : "Not attempted";
          const el = document.createElement("div");
          el.style.border = "1px solid rgba(255,255,255,0.12)";
          el.style.borderRadius = "10px";
          el.style.padding = "10px 12px";
          el.style.background = "rgba(255,255,255,0.02)";
          el.innerHTML = `
            <div style="font-weight:800;">${ws.label}</div>
            <div class="muted" style="font-size:12px; margin-top:4px;">Accuracy: <b style="color:#66fcf1;">${accTxt}</b> ${ws.attempts ? `(${ws.attempts} attempts)` : ""}</div>
          `;
          printWeakSkills.appendChild(el);
        });
      }

      // Topic stats (top 8 by attempts)
      const printTopicStats = document.getElementById("printTopicStats");
      if (printTopicStats && window.quizProgress?.getAllTopicStats && window.quizProgress?.QUIZ_TOPICS) {
        const byTopic = window.quizProgress.getAllTopicStats() || {};
        const topics = window.quizProgress.QUIZ_TOPICS || [];
        const rows = topics
          .map(t => {
            const agg = byTopic[t.id] || {};
            const attempts = agg.attempts || 0;
            const qTotal = agg.questionsTotal || 0;
            const correctTotal = agg.correctTotal || 0;
            const accuracy = qTotal > 0 ? (correctTotal / qTotal) : null;
            return { topicId: t.id, label: t.label, attempts, questionsTotal: qTotal, accuracy };
          })
          .sort((a, b) => (b.attempts - a.attempts) || String(a.label).localeCompare(String(b.label)))
          .slice(0, 8);

        printTopicStats.innerHTML = `
          <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: rgba(255,255,255,0.5); border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px; margin-bottom: 8px;">
            <span>Topic</span>
            <span style="text-align: right;">Accuracy & Attempts</span>
          </div>
        `;
        rows.forEach(r => {
          const accTxt = r.accuracy == null ? "—" : `${Math.round(r.accuracy * 100)}%`;
          const barW = r.accuracy == null ? 0 : Math.max(0, Math.min(100, Math.round(r.accuracy * 100)));

          const el = document.createElement("div");
          el.style.border = "1px solid rgba(255,255,255,0.12)";
          el.style.borderRadius = "10px";
          el.style.padding = "10px 12px";
          el.style.background = "rgba(255,255,255,0.02)";
          el.innerHTML = `
            <div style="display:flex; justify-content:space-between; gap:12px; align-items:center;">
              <div style="font-weight:800;">${r.label}</div>
              <div class="muted" style="font-size:12px;">${accTxt} • ${r.attempts} attempts</div>
            </div>
            <div style="margin-top:8px; height:8px; border-radius:999px; background: rgba(255,255,255,0.07); overflow:hidden;">
              <div style="height:100%; width:${barW}%; background:#66fcf1;"></div>
            </div>
          `;
          printTopicStats.appendChild(el);
        });
      }

      // Accuracy chart for print: re-draw using canvas inside printReport.
      const printCanvas = document.getElementById("printAccuracyChart");
      if (printCanvas && window.quizProgress?.getAccuracySeries) {
        const series = window.quizProgress.getAccuracySeries({ days: 14 }) || null;
        if (series?.labels && Array.isArray(series.accuracyByDay)) {
          const ctx = printCanvas.getContext("2d");
          // Basic redraw (simplified) to avoid importing canvas helpers.
          ctx.clearRect(0, 0, printCanvas.width, printCanvas.height);

          // Grid
          ctx.strokeStyle = "rgba(255,255,255,0.08)";
          ctx.lineWidth = 1;
          for (let i = 1; i <= 4; i++) {
            const y = (printCanvas.height / 5) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(printCanvas.width, y);
            ctx.stroke();
          }

          const marginTop = 16;
          const marginBottom = 24;
          const usable = printCanvas.height - marginTop - marginBottom;
          const toY = (acc) => marginTop + (1 - acc) * usable;

          const labels = series.labels;
          const xStep = printCanvas.width / (labels.length - 1);

          // Line
          ctx.strokeStyle = "#66fcf1";
          ctx.lineWidth = 2;
          ctx.beginPath();
          let started = false;
          for (let i = 0; i < series.accuracyByDay.length; i++) {
            const a = series.accuracyByDay[i];
            if (typeof a !== "number") continue;
            const x = i * xStep;
            const y = toY(a);
            if (!started) {
              ctx.moveTo(x, y);
              started = true;
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();

          // Points
          ctx.fillStyle = "#66fcf1";
          for (let i = 0; i < series.accuracyByDay.length; i++) {
            const a = series.accuracyByDay[i];
            if (typeof a !== "number") continue;
            const x = i * xStep;
            const y = toY(a);
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fill();
          }

          // X labels
          ctx.fillStyle = "rgba(255,255,255,0.65)";
          ctx.font = "12px Arial";
          const stride = Math.max(1, Math.floor(labels.length / 6));
          for (let i = 0; i < labels.length; i++) {
            if (i % stride !== 0 && i !== labels.length - 1) continue;
            ctx.fillText(labels[i], i * xStep - 10, printCanvas.height - 8);
          }
        }
      }

      // Ensure print-only container becomes visible for the printer.
      container.style.display = "block";
    } catch {}
  });

  window.addEventListener("afterprint", () => {
    const container = document.getElementById("printReport");
    if (container) container.style.display = "none";
  });

  if (window.achievements?.renderBadges) {
    window.achievements.renderBadges("badgesContainerMyProgress");
  }
});






