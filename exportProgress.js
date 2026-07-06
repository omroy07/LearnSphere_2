/**
 * exportProgress.js — Progress Export (local JSON; ready for backend later)
 *
 * Collects learner/mastery insights from existing analytics modules:
 * - window.quizProgress (quiz analytics + localStorage-backed attempt aggregates)
 * - window.studyProgress (streak + daily goal)
 */

(function () {
  const quizUtils = (typeof window !== 'undefined' && window.quizUtils) || 
                    (typeof require !== 'undefined' && require('./quizUtils.js')) || 
                    (typeof globalThis !== 'undefined' && globalThis.quizUtils) ||
                    {
                      aggregateQuizHistory(attempts) {
                        function safeNumber(n) {
                          const x = Number(n);
                          return Number.isFinite(x) ? x : null;
                        }
                        const totalAttempts = attempts.length;
                        let firstAttemptAt = null;
                        let lastAttemptAt = null;
                        const byTopicMap = new Map();

                        for (const a of attempts) {
                          const started = a?.startedAt;
                          const finished = a?.finishedAt;
                          const at = typeof finished === "number" && Number.isFinite(finished) ? finished : (typeof started === "number" && Number.isFinite(started) ? started : null);
                          if (at != null) {
                            if (firstAttemptAt == null || at < firstAttemptAt) firstAttemptAt = at;
                            if (lastAttemptAt == null || at > lastAttemptAt) lastAttemptAt = at;
                          }

                          const topicId = a?.topicId || null;
                          if (!topicId) continue;
                          if (!byTopicMap.has(topicId)) {
                            byTopicMap.set(topicId, {
                              topicId,
                              quizAttemptCount: 0,
                              questionsAttempted: 0,
                              correctCount: 0,
                              accuracy: null
                            });
                          }
                          const bucket = byTopicMap.get(topicId);
                          const totalQ = safeNumber(a?.totalQuestions) ?? 0;
                          const correctCount = (a?.correctCount == null) ? null : safeNumber(a?.correctCount);
                          bucket.quizAttemptCount += 1;
                          bucket.questionsAttempted += totalQ;
                          if (correctCount != null) bucket.correctCount += correctCount;
                        }

                        const byTopic = Array.from(byTopicMap.values()).map(b => {
                          if (b.questionsAttempted > 0 && b.correctCount != null) {
                            b.accuracy = b.correctCount / b.questionsAttempted;
                          }
                          return {
                            topicId: b.topicId,
                            quizAttemptCount: b.quizAttemptCount,
                            questionsAttempted: b.questionsAttempted,
                            correctCount: Number.isFinite(b.correctCount) ? b.correctCount : 0,
                            accuracy: b.accuracy
                          };
                        }).sort((x, y) => y.quizAttemptCount - x.quizAttemptCount);

                        const attemptsPreview = attempts
                          .slice(-25)
                          .map(a => ({
                            topicId: a?.topicId || null,
                            quizId: a?.quizId || null,
                            practiceDate: a?.practiceDate || null,
                            startedAt: a?.startedAt ?? null,
                            finishedAt: a?.finishedAt ?? null,
                            totalQuestions: safeNumber(a?.totalQuestions) ?? null,
                            correctCount: (a?.correctCount == null) ? null : safeNumber(a?.correctCount),
                            accuracy: (a?.accuracy == null) ? null : safeNumber(a?.accuracy),
                            score: safeNumber(a?.score) ?? null,
                            timeTakenMs: (a?.timeTakenMs == null) ? null : safeNumber(a?.timeTakenMs)
                          }));

                        return {
                          totalAttempts,
                          firstAttemptAt,
                          lastAttemptAt,
                          byTopic,
                          attempts: attemptsPreview
                        };
                      }
                    };

  function safeNumber(n) {
    const x = Number(n);
    return Number.isFinite(x) ? x : null;
  }

  function isoNow() {
    return new Date().toISOString();
  }

  function getStreak() {
    try {
      if (window.studyProgress && typeof window.studyProgress.loadStreakState === "function") {
        const s = window.studyProgress.loadStreakState();
        return {
          currentStreak: safeNumber(s.currentStreak) ?? 0,
          lastActiveDate: s.lastActiveDate || null,
          dailyGoalProgress: {
            quizzesCompleted: safeNumber(s.dailyGoalProgress?.quizzesCompleted) ?? 0,
            questionsReviewed: safeNumber(s.dailyGoalProgress?.questionsReviewed) ?? 0,
          },
          source: "studyProgress"
        };
      }
    } catch {}

    try {
      const s = window.quizProgress?.getStreak?.();
      if (s) {
        return {
          currentStreak: safeNumber(s.currentStreak) ?? 0,
          lastActiveDate: s.lastPracticeDate || null,
          dailyGoalProgress: null,
          source: "quizProgress"
        };
      }
    } catch {}

    return {
      currentStreak: 0,
      lastActiveDate: null,
      dailyGoalProgress: null,
      source: "none"
    };
  }

  function getQuizHistorySummary() {
    // From quizProgress localStorage attempts array.
    // quizProgress.js stores under: "learnsphere_quiz_progress_v1"
    // attempts items include: topicId, quizId, score, totalQuestions, correctCount, practiceDate, accuracy, timeTakenMs, finishedAt
    try {
      const raw = localStorage.getItem("learnsphere_quiz_progress_v1");
      if (!raw) {
        return {
          totalAttempts: 0,
          firstAttemptAt: null,
          lastAttemptAt: null,
          byTopic: [],
          attempts: []
        };
      }
      const parsed = JSON.parse(raw);
      const attempts = Array.isArray(parsed?.attempts) ? parsed.attempts : [];
      return quizUtils.aggregateQuizHistory(attempts);
    } catch {
      return {
        totalAttempts: 0,
        firstAttemptAt: null,
        lastAttemptAt: null,
        byTopic: [],
        attempts: []
      };
    }
  }

  function getMasterySnapshot() {
    // quizProgress.getMasteryStats returns { [skillId]: { attempts, correct, ... } }
    try {
      const mastery = window.quizProgress?.getMasteryStats?.() || {};
      const taxonomy = window.quizProgress?.SKILL_TAXONOMY || {};

      // Convert taxonomy to an indexed list for stable output.
      const outSkills = [];
      const seen = new Set();

      for (const [_, tax] of Object.entries(taxonomy)) {
        if (!tax?.skillId || seen.has(tax.skillId)) continue;
        seen.add(tax.skillId);

        const m = mastery[tax.skillId] || {};
        const attempts = safeNumber(m.attempts) ?? 0;
        const correct = safeNumber(m.correct) ?? 0;
        const accuracy = attempts > 0 ? (correct / attempts) : null;

        outSkills.push({
          skillId: tax.skillId,
          label: tax.label || tax.skillId,
          topicId: tax.topicId || null,
          quizUrl: tax.quizUrl || null,
          attempts,
          correct,
          accuracy
        });
      }

      // Also include any mastery entries not in taxonomy.
      for (const [skillId, m] of Object.entries(mastery)) {
        if (seen.has(skillId)) continue;
        const attempts = safeNumber(m?.attempts) ?? 0;
        const correct = safeNumber(m?.correct) ?? 0;
        const accuracy = attempts > 0 ? (correct / attempts) : null;
        outSkills.push({
          skillId,
          label: String(skillId),
          topicId: null,
          quizUrl: null,
          attempts,
          correct,
          accuracy
        });
      }

      outSkills.sort((a, b) => (b.attempts - a.attempts) || String(a.label).localeCompare(String(b.label)));
      return {
        totalSkills: outSkills.length,
        skills: outSkills
      };
    } catch {
      return { totalSkills: 0, skills: [] };
    }
  }

  function getTopicPerformanceSummary() {
    try {
      const byTopic = window.quizProgress?.getAllTopicStats?.() || {};
      const topics = window.quizProgress?.QUIZ_TOPICS || [];

      // Ensure stable ordering using topic registry.
      const out = [];
      const seenIds = new Set();

      for (const t of topics) {
        const agg = byTopic[t.id] || null;
        const attempts = safeNumber(agg?.attempts) ?? 0;
        const qTotal = safeNumber(agg?.questionsTotal) ?? 0;
        const correctTotal = safeNumber(agg?.correctTotal) ?? 0;
        const accuracy = qTotal > 0 ? (correctTotal / qTotal) : null;

        out.push({
          topicId: t.id,
          label: t.label,
          subject: t.subject || null,
          attempts,
          questionsTotal: qTotal,
          correctTotal,
          accuracy
        });
        seenIds.add(t.id);
      }

      // Include any unknown topic ids in localStorage.
      for (const [topicId, agg] of Object.entries(byTopic)) {
        if (seenIds.has(topicId)) continue;
        const attempts = safeNumber(agg?.attempts) ?? 0;
        const qTotal = safeNumber(agg?.questionsTotal) ?? 0;
        const correctTotal = safeNumber(agg?.correctTotal) ?? 0;
        const accuracy = qTotal > 0 ? (correctTotal / qTotal) : null;

        out.push({
          topicId,
          label: topicId,
          subject: null,
          attempts,
          questionsTotal: qTotal,
          correctTotal,
          accuracy
        });
      }

      out.sort((a, b) => (b.attempts - a.attempts) || String(a.topicId).localeCompare(String(b.topicId)));
      return out;
    } catch {
      return [];
    }
  }

  function getAccuracyTrend(days = 14) {
    try {
      const series = window.quizProgress?.getAccuracySeries?.({ days }) || null;
      if (!series || !Array.isArray(series.labels) || !Array.isArray(series.accuracyByDay)) {
        return {
          days,
          labels: [],
          accuracyByDay: []
        };
      }
      return {
        days,
        labels: series.labels,
        accuracyByDay: series.accuracyByDay
      };
    } catch {
      return { days, labels: [], accuracyByDay: [] };
    }
  }

  /**
   * JSON Schema (conceptual; enforced by stable keys rather than full JSON schema validation).
   *
   * {
   *   version: { major, minor },
   *   generatedAt: ISO8601 string,
   *   format: { type: "progress-export", format: "json" },
   *   learner: {
   *     id: string|null,
   *     roleContext: "teacher"|"parent"|"learner"|"unknown",
   *     timezone: string|null
   *   },
   *   metrics: {
   *     overallAccuracy: { accuracy: number|null, correct: number, total: number },
   *     streak: { currentStreak: number, lastActiveDate: string|null, dailyGoalProgress: {...}|null },
   *     dailyGoal: { quizzesCompleted: number, questionsReviewed: number },
   *     accuracyTrend: { days: number, labels: string[], accuracyByDay: (number|null)[] },
   *     mastery: { totalSkills: number, skills: [ {skillId, label, topicId, quizUrl, attempts, correct, accuracy} ] },
   *     topicPerformance: [ {topicId, label, subject, attempts, questionsTotal, correctTotal, accuracy} ],
   *     quizHistory: { totalAttempts, firstAttemptAt, lastAttemptAt, byTopic: [...], attempts: [...] }
   *   },
   *   client: { app: "LearnSphere", exportId: string }
   * }
   */

  function buildProgressExportPayload({ formatVersion = { major: 1, minor: 0 }, roleContext = "unknown" } = {}) {
    const overall = (() => {
      try {
        const o = window.quizProgress?.getOverallAccuracy?.();
        return {
          accuracy: (o?.accuracy == null) ? null : safeNumber(o.accuracy),
          correct: safeNumber(o?.correct) ?? 0,
          total: safeNumber(o?.total) ?? 0
        };
      } catch {
        return { accuracy: null, correct: 0, total: 0 };
      }
    })();

    const streak = getStreak();

    // Normalize dailyGoal into metrics.dailyGoal (even if streak source is quizProgress).
    const dailyGoal = {
      quizzesCompleted: safeNumber(streak?.dailyGoalProgress?.quizzesCompleted) ?? 0,
      questionsReviewed: safeNumber(streak?.dailyGoalProgress?.questionsReviewed) ?? 0
    };

    const payload = {
      version: {
        major: Number(formatVersion?.major ?? 1),
        minor: Number(formatVersion?.minor ?? 0)
      },
      generatedAt: isoNow(),
      format: {
        type: "progress-export",
        format: "json"
      },
      learner: {
        id: null,
        roleContext,
        timezone: Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || null
      },
      metrics: {
        overallAccuracy: overall,
        streak,
        dailyGoal,
        accuracyTrend: getAccuracyTrend(14),
        mastery: getMasterySnapshot(),
        topicPerformance: getTopicPerformanceSummary(),
        quizHistory: getQuizHistorySummary()
      },
      client: {
        app: "LearnSphere",
        exportId: `export_${Date.now()}_${Math.random().toString(16).slice(2)}`
      }
    };

    return payload;
  }

  function downloadJson(payload, filename = "learnsphere_progress_export.json") {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();


    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // Snapshot utilities
  async function generateSnapshot() {
    const payload = buildProgressExportPayload({ roleContext: "learner" });
    const exportId = `snapshot_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(payload));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const payloadHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const snapshot = { payload, payloadHash, generatedAt: new Date().toISOString() };
    localStorage.setItem(`snapshot_${exportId}`, JSON.stringify(snapshot));
    const index = JSON.parse(localStorage.getItem('snapshotIndex') || '[]');
    index.push({ exportId, generatedAt: snapshot.generatedAt, payloadHash });
    localStorage.setItem('snapshotIndex', JSON.stringify(index));
    return exportId;
  }

  function downloadSnapshotAsImage(exportId) {
    const snapshotStr = localStorage.getItem(`snapshot_${exportId}`);
    if (!snapshotStr) { alert('Snapshot not found'); return; }
    const snapshot = JSON.parse(snapshotStr);
    const iframe = createSnapshotFrame(snapshot.payload);
    setTimeout(() => {
      html2canvas(iframe.contentDocument.body).then(canvas => {
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `${exportId}.png`;
        link.click();
        iframe.remove();
      });
    }, 500);
  }

  function downloadSnapshotAsPDF(exportId) {
    const snapshotStr = localStorage.getItem(`snapshot_${exportId}`);
    if (!snapshotStr) { alert('Snapshot not found'); return; }
    const snapshot = JSON.parse(snapshotStr);
    const iframe = createSnapshotFrame(snapshot.payload);
    setTimeout(() => {
      html2canvas(iframe.contentDocument.body).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jspdf.jsPDF();
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`${exportId}.pdf`);
        iframe.remove();
      });
    }, 500);
  }

  function listSnapshots() {
    return JSON.parse(localStorage.getItem('snapshotIndex') || '[]');
  }

  function createSnapshotFrame(payload) {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    doc.open();
    doc.close();

    const pre = doc.createElement('pre');
    pre.textContent = JSON.stringify(payload, null, 2);
    doc.body.appendChild(pre);

    return iframe;
  }

  window.exportProgress = {
    buildProgressExportPayload,
    downloadJson,
    generateSnapshot,
    downloadSnapshotAsImage,
    downloadSnapshotAsPDF,
    listSnapshots
  };})();

