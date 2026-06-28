/**
 * adaptiveQuiz.js
 * Shared helper for Adaptive Quiz Difficulty (client-side only).
 *
 * Usage (per quiz page JS):
 *   import/require is not used here (no bundler). Include this file via:
 *     <script src="../quiz/adaptiveQuiz.js"></script>
 *   Then call:
 *     const adaptive = buildAdaptiveQuiz({ questions });
 */

(function () {
  'use strict';

  function normalizeDifficulty(d) {
    const val = String(d || '').toLowerCase();
    if (val === 'easy' || val === 'e') return 0;
    if (val === 'medium' || val === 'med' || val === 'm') return 1;
    if (val === 'hard' || val === 'h') return 2;

    // Default: medium
    return 1;
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  /**
   * Build a per-difficulty bucket of question copies.
   * @param {Array<{difficulty?: string|number}>} questions
   */
  function buildBuckets(questions) {
    const buckets = { 0: [], 1: [], 2: [] };
    questions.forEach((q, idx) => {
      const di = normalizeDifficulty(q.difficulty);
      // keep original index for tracking
      buckets[di].push({ ...q, __qid: idx });
    });

    // Shuffle or sort each bucket based on mode.
    Object.keys(buckets).forEach(k => {
      const arr = buckets[k];
      if (window.isWeaknessFocusMode && window.quizProgress && typeof window.quizProgress.getQuestionWeaknessWeight === 'function') {
        arr.sort((a, b) => {
          const weightA = window.quizProgress.getQuestionWeaknessWeight(a);
          const weightB = window.quizProgress.getQuestionWeaknessWeight(b);
          return weightB - weightA; // weakest first
        });
      } else {
        // Shuffle each bucket for variety.
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
      }
    });

    return buckets;
  }

  function createAdaptiveQuiz({ questions, startingDifficultyIndex = 1 }) {
    const buckets = buildBuckets(questions);
    const totalSteps = questions.length;

    let difficultyIndex = clamp(startingDifficultyIndex, 0, 2);
    let consecutiveCorrect = 0;
    let consecutiveIncorrect = 0;
    let lastAbilityHint = 0; // for future use / debugging

    // Flattened remaining counts for quick fallback.
    function countRemainingAt(di) {
      return buckets[di].length;
    }

    function totalRemaining() {
      return buckets[0].length + buckets[1].length + buckets[2].length;
    }

    /**
     * Pick next question from the current difficulty if possible.
     * Otherwise, fallback to nearest difficulty that still has questions.
     */
    function takeNext() {
      if (totalRemaining() <= 0) return null;

      // Try current difficulty first.
      if (countRemainingAt(difficultyIndex) > 0) {
        return buckets[difficultyIndex].shift();
      }

      // Fallback: nearest difficulty.
      for (let dist = 1; dist <= 2; dist++) {
        const lower = difficultyIndex - dist;
        const upper = difficultyIndex + dist;
        if (lower >= 0 && countRemainingAt(lower) > 0) return buckets[lower].shift();
        if (upper <= 2 && countRemainingAt(upper) > 0) return buckets[upper].shift();
      }

      // Final fallback: any remaining.
      for (let di = 0; di <= 2; di++) {
        if (countRemainingAt(di) > 0) return buckets[di].shift();
      }

      return null;
    }

    /**
     * Update difficulty after an answer.
     */
    function updateDifficulty({ isCorrect }) {
      if (isCorrect) {
        consecutiveCorrect += 1;
        consecutiveIncorrect = 0;

        // After 2 consecutive correct: go harder.
        if (consecutiveCorrect >= 2) {
          difficultyIndex = clamp(difficultyIndex + 1, 0, 2);
          consecutiveCorrect = 0;
        }
      } else {
        consecutiveIncorrect += 1;
        consecutiveCorrect = 0;

        // After 2 consecutive incorrect: go easier.
        if (consecutiveIncorrect >= 2) {
          difficultyIndex = clamp(difficultyIndex - 1, 0, 2);
          consecutiveIncorrect = 0;
        }
      }

      return difficultyIndex;
    }

    return {
      takeNext,
      updateDifficulty,
      getDifficultyIndex: () => difficultyIndex,
      getTotalSteps: () => totalSteps,
      // abilityIndex is synonymous with difficulty bucket.
      getAbilityIndex: () => difficultyIndex,
    };
  }

  function getStartingDifficultyFromAccuracy({ accuracy }) {
    if (typeof accuracy !== 'number' || !isFinite(accuracy)) return 1; // medium
    if (accuracy >= 0.8) return 2; // hard
    if (accuracy <= 0.5) return 0; // easy
    return 1; // medium
  }

  // Export to window.
  window.createAdaptiveQuiz = createAdaptiveQuiz;
  window.getStartingDifficultyFromAccuracy = getStartingDifficultyFromAccuracy;

})();

