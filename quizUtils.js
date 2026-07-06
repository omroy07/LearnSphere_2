// quizUtils.js — Pure calculations for score, aggregates, export and sync.
// This file is loaded as a global script in the browser, but behaves as an ES/CommonJS module in test runners.

(function () {
  "use strict";

  const quizUtils = {
    /**
     * Determines the actual number of correct answers.
     * Some older quiz pages pass score as ratio (0..1) or percentage (0..100) and omit correctCount.
     */
    calculateCorrectAnswers(score, totalQuestions, correctCount) {
      const got = Number(score) || 0;
      const total = Number(totalQuestions) || 0;
      let correct = null;

      if (typeof correctCount === "number" && Number.isFinite(correctCount)) {
        correct = correctCount;
      } else {
        const looksLikeRatio = got >= 0 && got <= 1;
        const looksLikePercent = got > 1 && got <= 100;
        if (total > 0 && (looksLikeRatio || looksLikePercent)) {
          const ratio = looksLikeRatio ? got : got / 100;
          correct = Math.round(ratio * total);
        }
      }
      return correct;
    },

    /**
     * Splits 14-day history array into current 7-day and prior 7-day windows and averages them.
     */
    calculateWeeklyAggregates(accuracyByDay) {
      if (!Array.isArray(accuracyByDay)) {
        return { last7: [], prev7: [], lastAvg: null, prevAvg: null };
      }
      const last7 = accuracyByDay.slice(-7);
      const prev7 = accuracyByDay.slice(0, 7);

      function avg(arr) {
        const nums = arr.filter((x) => typeof x === "number" && Number.isFinite(x));
        if (!nums.length) return null;
        return nums.reduce((s, v) => s + v, 0) / nums.length;
      }

      return { last7, prev7, lastAvg: avg(last7), prevAvg: avg(prev7) };
    },

    /**
     * Compiles attempts list into a lightweight history export summary.
     */
    aggregateQuizHistory(attempts = []) {
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
        const at =
          typeof finished === "number" && Number.isFinite(finished)
            ? finished
            : typeof started === "number" && Number.isFinite(started)
              ? started
              : null;

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
            accuracy: null,
          });
        }

        const bucket = byTopicMap.get(topicId);
        const totalQ = safeNumber(a?.totalQuestions) ?? 0;
        const correctCount = a?.correctCount == null ? null : safeNumber(a?.correctCount);

        bucket.quizAttemptCount += 1;
        bucket.questionsAttempted += totalQ;
        if (correctCount != null) {
          bucket.correctCount += correctCount;
        }
      }

      const byTopic = Array.from(byTopicMap.values())
        .map((b) => {
          if (b.questionsAttempted > 0 && b.correctCount !== null) {
            b.accuracy = b.correctCount / b.questionsAttempted;
          }
          return {
            topicId: b.topicId,
            quizAttemptCount: b.quizAttemptCount,
            questionsAttempted: b.questionsAttempted,
            correctCount: Number.isFinite(b.correctCount) ? b.correctCount : 0,
            accuracy: b.accuracy,
          };
        })
        .sort((x, y) => (y.quizAttemptCount - x.quizAttemptCount) || String(x.topicId).localeCompare(String(y.topicId)));

      const attemptsPreview = attempts.slice(-25).map((a) => ({
        topicId: a?.topicId || null,
        quizId: a?.quizId || null,
        practiceDate: a?.practiceDate || null,
        startedAt: typeof a?.startedAt === "number" ? new Date(a.startedAt).toISOString() : null,
        finishedAt: typeof a?.finishedAt === "number" ? new Date(a.finishedAt).toISOString() : null,
        totalQuestions: safeNumber(a?.totalQuestions) ?? null,
        correctCount: a?.correctCount == null ? null : safeNumber(a?.correctCount),
        accuracy: a?.accuracy == null ? null : safeNumber(a?.accuracy),
        score: safeNumber(a?.score) ?? null,
        timeTakenMs: a?.timeTakenMs == null ? null : safeNumber(a?.timeTakenMs),
      }));

      return {
        totalAttempts,
        firstAttemptAt: firstAttemptAt ? new Date(firstAttemptAt).toISOString() : null,
        lastAttemptAt: lastAttemptAt ? new Date(lastAttemptAt).toISOString() : null,
        byTopic,
        attempts: attemptsPreview,
      };
    },

    /**
     * Resolves pending sync conflict according to strategy (e.g. "latest").
     */
    resolveSyncConflicts(events = [], strategy = "latest") {
      if (!events.length) return [];
      if (strategy === "latest") {
        const map = new Map();
        events.forEach((e) => {
          const key = `${e.type}|${e.payload?.topicId || ""}|${e.payload?.quizId || ""}`;
          const existing = map.get(key);
          if (!existing || e.timestamp > existing.timestamp) {
            map.set(key, e);
          }
        });
        return Array.from(map.values());
      }
      return events;
    },
  };

  // Expose to window/global scope in browser
  if (typeof window !== "undefined") {
    window.quizUtils = quizUtils;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.quizUtils = quizUtils;
  }
  // Expose for CommonJS/Node environments (tests)
  if (typeof module !== "undefined" && module.exports) {
    module.exports = quizUtils;
  }
})();
