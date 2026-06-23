/**
 * quizProgress.js — Learners Quiz Progress + Daily Streak (localStorage)
 *
 * Stores quiz attempts + aggregates so learner can see:
 * - overall accuracy over time
 * - topic-wise performance
 * - recommended next quizzes (weak topics)
 * - daily streak for practice
 *
 * Persistence: localStorage (backend can be added later)
 */

const QUIZ_PROGRESS_KEY = "learnsphere_quiz_progress_v1";

/**
 * Topic registry (used for analytics + recommendations).
 * These ids should match what individual quiz pages pass as topicId.
 */
const QUIZ_TOPICS = [
  { id: "physics-motion", label: "Physics: Motion", subject: "physics", quizIds: ["quiz:motion"] },
  { id: "physics-nlm", label: "Physics: Newton's Laws of Motion", subject: "physics", quizIds: ["quiz:nlm"] },
  { id: "physics-projectile", label: "Physics: Projectile Motion", subject: "physics", quizIds: ["quiz:projectile"] },
  { id: "physics-ray", label: "Physics: Ray Optics", subject: "physics", quizIds: ["quiz:ray"] },

  { id: "maths-calculus", label: "Maths: Calculus", subject: "maths", quizIds: ["quiz:calculus"] },
  { id: "maths-vectors", label: "Maths: Vectors & 3D Geometry", subject: "maths", quizIds: ["quiz:vectors"] },
  { id: "maths-probability", label: "Maths: Probability & Statistics", subject: "maths", quizIds: ["quiz:probability"] },
  { id: "maths-geometry", label: "Maths: Coordinate Geometry", subject: "maths", quizIds: ["quiz:geometry"] },

  { id: "chemistry-atomic", label: "Chemistry: Atomic Structure", subject: "chemistry", quizIds: ["quiz:atomic"] },
  { id: "chemistry-bonding", label: "Chemistry: Chemical Bonding", subject: "chemistry", quizIds: ["quiz:bonding"] },
  { id: "chemistry-equil", label: "Chemistry: Equilibrium", subject: "chemistry", quizIds: ["quiz:equilibrium"] },
  { id: "chemistry-thermo", label: "Chemistry: Thermodynamics", subject: "chemistry", quizIds: ["quiz:thermo"] },
];

function _todayLocalISODate() {
  // YYYY-MM-DD in local time
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function _parseISODateToUTCStart(isoDateYYYYMMDD) {
  // Treat isoDate as local date; convert to a numeric day token.
  // For streak we only need day-to-day adjacency, so a day token in local time is fine.
  const [y, m, d] = isoDateYYYYMMDD.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  return Math.floor(dt.getTime() / 86400000);
}

function _loadState() {
  try {
    const raw = localStorage.getItem(QUIZ_PROGRESS_KEY);
    if (!raw) return { attempts: [], byTopic: {}, streak: { lastPracticeDate: null, currentStreak: 0 } };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { attempts: [], byTopic: {}, streak: { lastPracticeDate: null, currentStreak: 0 } };
    }
    if (!Array.isArray(parsed.attempts)) parsed.attempts = [];
    if (!parsed.byTopic || typeof parsed.byTopic !== "object") parsed.byTopic = {};
    if (!parsed.streak || typeof parsed.streak !== "object") parsed.streak = { lastPracticeDate: null, currentStreak: 0 };
    return parsed;
  } catch {
    return { attempts: [], byTopic: {}, streak: { lastPracticeDate: null, currentStreak: 0 } };
  }
}

function _saveState(state) {
  try {
    localStorage.setItem(QUIZ_PROGRESS_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("LearnSphere: Could not save quiz progress.", e);
  }
}

function _ensureTopicExists(topicId) {
  if (!QUIZ_TOPICS.some(t => t.id === topicId)) {
    // Still allow unknown topicId; dashboard will just show it under "Other".
    QUIZ_TOPICS.push({ id: topicId, label: topicId, subject: "other", quizIds: [] });
  }
}

function recordAttempt({ topicId, score, totalQuestions, correctCount, timeTakenMs, quizId = null }) {
  if (!topicId) return;

  _ensureTopicExists(topicId);

  const state = _loadState();
  const now = Date.now();
  const today = _todayLocalISODate();

  const total = Number(totalQuestions) || 0;
  const got = Number(score) || 0;

  // Determine correctness count used for accuracy analytics.
  // Priority:
  // 1) If caller provides correctCount as a number -> trust it.
  // 2) Else, try to infer correct answers from score only when it looks like an accuracy metric:
  //    - score is ratio: 0..1
  //    - score is percent: 0..100
  //    In those cases, correct = round(score * total).
  // 3) Otherwise, we cannot infer correct answers safely -> set null.
  //    (Prevents corrupting accuracy trend charts when score is points/marks.)
  let correct = null;
  if (typeof correctCount === "number" && Number.isFinite(correctCount)) {
    correct = correctCount;
  } else {
    // Some quiz pages historically pass a percentage/ratio as `score` and omit `correctCount`.

    const looksLikeRatio = got >= 0 && got <= 1;
    const looksLikePercent = got > 1 && got <= 100;
    if (total > 0 && (looksLikeRatio || looksLikePercent)) {
      const ratio = looksLikeRatio ? got : got / 100;
      correct = Math.round(ratio * total);
    }
  }



  const timeMs = typeof timeTakenMs === "number" && timeTakenMs >= 0 ? timeTakenMs : null;


  // Topic aggregate init
  if (!state.byTopic[topicId]) {
    state.byTopic[topicId] = {
      attempts: 0,
      bestScore: null,
      latestScore: null,
      correctTotal: 0,
      questionsTotal: 0,
      timeTakenMsTotal: 0,
      timeTakenMsCount: 0,
      lastAttemptAt: null,
    };
  }

  const agg = state.byTopic[topicId];
  agg.attempts += 1;
  agg.bestScore = agg.bestScore === null ? got : Math.max(agg.bestScore, got);
  agg.latestScore = got;
  if (typeof correct === "number" && Number.isFinite(correct)) {
    agg.correctTotal += correct;
  }

  agg.questionsTotal += total;
  agg.lastAttemptAt = now;
  if (timeMs !== null) {
    agg.timeTakenMsTotal += timeMs;
    agg.timeTakenMsCount += 1;
  }

  // Add attempt record for charts
  state.attempts.push({
    topicId,
    quizId,
    score: got,
    totalQuestions: total,
    correctCount: correct,
    accuracy: total > 0 && typeof correct === "number" && Number.isFinite(correct) ? correct / total : null,

    timeTakenMs: timeMs,
    startedAt: null,
    finishedAt: now,
    practiceDate: today,
  });

  // Keep attempts bounded
  if (state.attempts.length > 500) {
    state.attempts = state.attempts.slice(state.attempts.length - 500);
  }

  // Update streak (daily practice)
  const s = state.streak || { lastPracticeDate: null, currentStreak: 0 };

  const prevDate = s.lastPracticeDate;
  const prevToken = prevDate ? _parseISODateToUTCStart(prevDate) : null;
  const todayToken = _parseISODateToUTCStart(today);

  if (!prevDate) {
    s.currentStreak = 1;
    s.lastPracticeDate = today;
  } else if (today === prevDate) {
    // Same day: do not increment
    s.lastPracticeDate = today;
  } else if (prevToken !== null && todayToken === prevToken + 1) {
    s.currentStreak += 1;
    s.lastPracticeDate = today;
  } else {
    s.currentStreak = 1;
    s.lastPracticeDate = today;
  }

  state.streak = s;
  _saveState(state);

  return state;
}

function getStreak() {
  const state = _loadState();
  const s = state.streak || { lastPracticeDate: null, currentStreak: 0 };
  if (s.lastPracticeDate) {
    const today = _todayLocalISODate();
    const todayToken = _parseISODateToUTCStart(today);
    const prevToken = _parseISODateToUTCStart(s.lastPracticeDate);
    if (todayToken > prevToken + 1) {
      return { lastPracticeDate: s.lastPracticeDate, currentStreak: 0 };
    }
  }
  return s;
}

function getTopicStats(topicId) {
  const state = _loadState();
  return state.byTopic[topicId] || null;
}

function getAllTopicStats() {
  const state = _loadState();
  return state.byTopic || {};
}

function getAccuracySeries({ days = 14 } = {}) {
  // Returns {labels:[], accuracyByDay:[]}
  const state = _loadState();
  const attempts = state.attempts || [];

  const end = new Date();
  const labels = [];
  const tokens = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    const token = Math.floor(d.getTime() / 86400000);
    // compute date string for label
    // (yyyy intentionally unused)
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const label = `${mm}/${dd}`;

    tokens.push(token);
    labels.push(label);
  }

  const byToken = new Map();
  tokens.forEach(t => byToken.set(t, { correct: 0, total: 0 }));

  attempts.forEach(a => {
    if (!a.practiceDate) return;
    const token = _parseISODateToUTCStart(a.practiceDate);
    if (!byToken.has(token)) return;
    if (typeof a.correctCount === "number" && typeof a.totalQuestions === "number") {
      const bucket = byToken.get(token);
      bucket.correct += a.correctCount;
      bucket.total += a.totalQuestions;
      byToken.set(token, bucket);
    }
  });

  const accuracyByDay = tokens.map(t => {
    const bucket = byToken.get(t);
    if (!bucket || bucket.total <= 0) return null;
    return bucket.correct / bucket.total;
  });

  return { labels, accuracyByDay };
}

function getOverallAccuracy() {
  const state = _loadState();
  const attempts = state.attempts || [];
  let correct = 0;
  let total = 0;
  for (const a of attempts) {
    if (typeof a.correctCount === "number" && typeof a.totalQuestions === "number") {
      correct += a.correctCount;
      total += a.totalQuestions;
    }
  }
  if (total <= 0) return { accuracy: null, correct, total };
  return { accuracy: correct / total, correct, total };
}

function getRecommendedTopics({ limit = 3 } = {}) {
  const state = _loadState();
  const byTopic = state.byTopic || {};

  const topicScores = QUIZ_TOPICS.map(t => {
    const agg = byTopic[t.id];
    const attempts = agg?.attempts || 0;
    const qTotal = agg?.questionsTotal || 0;
    const correctTotal = agg?.correctTotal || 0;
    const accuracy = qTotal > 0 ? correctTotal / qTotal : null;

    // Recommendation heuristic:
    // - Prefer topics with low accuracy
    // - Also prefer topics with fewer attempts (less practiced)
    // Use a numeric weakness score where bigger means weaker.
    let weakness = 0;
    if (accuracy === null) {
      weakness = 1.0; // unseen topic = highest weakness
    } else {
      weakness = (1 - accuracy);
    }

    const attemptPenalty = attempts >= 8 ? -0.05 : 0; // slightly reduce for well-practiced
    weakness += attemptPenalty;

    return { topic: t, attempts, accuracy, weakness };
  });

  topicScores.sort((a, b) => b.weakness - a.weakness);
  return topicScores.slice(0, limit);
}

window.quizProgress = {
  QUIZ_TOPICS,
  recordAttempt,
  getStreak,
  getTopicStats,
  getAllTopicStats,
  getAccuracySeries,
  getOverallAccuracy,
  getRecommendedTopics,
};

