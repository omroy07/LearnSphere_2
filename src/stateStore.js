// src/stateStore.js
// Central typed state store for LearnSphere client-side data.
// Provides a single source of truth for progress, quiz progress, and other app state.
// Uses localStorage under the key "learnsphere_state_v1".
// Types are defined using JSDoc for static analysis without requiring TypeScript.

/**
 * @typedef {Object} ProgressState
 * @property {number} xp - Experience points.
 * @property {number} level - Current level.
 * @property {Object.<string, string>} topicStates - Map of topicId -> state ("not-started"|"in-progress"|"completed").
 */

/**
 * @typedef {Object} QuizAttempt
 * @property {string} id - Unique event id.
 * @property {string} quizId - Identifier of the quiz.
 * @property {string} topicId - Topic the quiz belongs to.
 * @property {number} score - Score as a fraction (0‑1).
 * @property {number} totalQuestions
 * @property {number} correctCount
 * @property {number} timeTakenMs
 * @property {number} timestamp - epoch ms when the attempt occurred.
 */

/**
 * @typedef {Object} QuizProgressState
 * @property {QuizAttempt[]} attempts - List of all attempts (append‑only).
 * @property {Object.<string, { attempts: number, bestScore: number, completed: boolean }>} byTopic - Aggregated per‑topic stats.
 */

/**
 * @typedef {Object} AppState
 * @property {ProgressState} progress
 * @property {QuizProgressState} quizProgress
 */

const STORAGE_KEY = 'learnsphere_state_v1';

/** Default empty state */
const DEFAULT_STATE = /** @type {AppState} */ ({
  progress: {
    xp: 0,
    level: 0,
    topicStates: {},
  },
  quizProgress: {
    attempts: [],
    byTopic: {},
  },
});

let _state = { ...DEFAULT_STATE };

/** Load persisted state from localStorage */
function _load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      // shallow merge with defaults to protect against missing sections
      _state = { ...DEFAULT_STATE, ...parsed };
    }
  } catch (e) {
    console.warn('LearnSphere: Failed to load central state', e);
  }
}

/** Persist current state to localStorage */
function _save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
  } catch (e) {
    console.warn('LearnSphere: Failed to save central state', e);
  }
}

/** Get a deep copy of the whole state (read‑only) */
function getState() {
  return JSON.parse(JSON.stringify(_state));
}

/** Replace the whole state (used rarely, e.g., import/export) */
function setState(newState) {
  _state = { ...DEFAULT_STATE, ...newState };
  _save();
  _dispatchChange();
}

/** Helper: emit a custom event when any part of the state changes */
function _dispatchChange() {
  try {
    window.dispatchEvent(
      new CustomEvent('learnsphere:state-changed', { detail: { state: getState() } })
    );
  } catch {}
}

/** Progress helpers */
function getProgress() {
  return { ..._state.progress };
}

function setProgress(partial) {
  Object.assign(_state.progress, partial);
  _save();
  _dispatchChange();
}

/** Quiz progress helpers */
function getQuizProgress() {
  // Deep copy to avoid accidental mutation
  return JSON.parse(JSON.stringify(_state.quizProgress));
}

function setQuizProgress(partial) {
  Object.assign(_state.quizProgress, partial);
  _save();
  _dispatchChange();
}

/** Record a new quiz attempt (append‑only) */
function recordQuizAttempt({ quizId, topicId, score, totalQuestions, correctCount, timeTakenMs }) {
  const now = Date.now();
  const attempt = {
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    quizId,
    topicId,
    score,
    totalQuestions,
    correctCount,
    timeTakenMs,
    timestamp: now,
  };
  _state.quizProgress.attempts.push(attempt);

  // Update aggregated by‑topic stats
  const agg = _state.quizProgress.byTopic[topicId] || {
    attempts: 0,
    bestScore: 0,
    completed: false,
  };
  agg.attempts += 1;
  if (score > agg.bestScore) agg.bestScore = score;
  if (score === 1) agg.completed = true;
  _state.quizProgress.byTopic[topicId] = agg;

  _save();
  _dispatchChange();
  return attempt;
}

/** Update XP/level based on activity */
function addExperience(points) {
  const prog = _state.progress;
  prog.xp = (prog.xp || 0) + points;
  prog.level = Math.floor(prog.xp / 1000);
  _save();
  _dispatchChange();
}

/** Initialise on script load */
_load();

/** Export API on window */
window.stateStore = {
  getState,
  setState,
  getProgress,
  setProgress,
  addExperience,
  getQuizProgress,
  setQuizProgress,
  recordQuizAttempt,
  STORAGE_KEY,
};
