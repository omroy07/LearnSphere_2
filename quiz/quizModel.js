/*
 * quizModel.js — Canonical quiz attempt scoring model + adapters
 *
 * Goal: unify quiz JSON structure and scoring evaluation across quiz modules.
 *
 * This file is loaded by quiz pages that want canonical scoring.
 * It attaches `window.quizModel`.
 */

(function () {
  const MODEL_VERSION = { major: 1, minor: 0 };

  function safeString(x) {
    return typeof x === 'string' ? x : '';
  }

  function normalizeLegacySingleSelect({ topicId, quizId, questionType, questions, userSelections }) {
    // Legacy format used widely in current quiz modules:
    // questions: [{ question, options?, answer }]
    // userSelections: [selectedOptionText or null]

    const qArr = Array.isArray(questions) ? questions : [];
    const uArr = Array.isArray(userSelections) ? userSelections : [];

    const results = qArr.map((q, idx) => {
      const prompt = safeString(q?.question).trim();
      const correctAnswer = q?.answer;
      const userAnswer = uArr[idx];
      const isCorrect = userAnswer === correctAnswer;

      return {
        questionId: null,
        prompt: prompt || null,
        userAnswer: userAnswer ?? null,
        correctAnswer: correctAnswer ?? null,
        isCorrect,
        scoreEarned: isCorrect ? 1 : 0,
        scorePossible: 1,
      };
    });

    const correctCount = results.reduce((acc, r) => acc + (r.isCorrect ? 1 : 0), 0);
    const totalQuestions = results.length;
    const score = correctCount; // points=correctCount for now
    const accuracy = totalQuestions > 0 ? correctCount / totalQuestions : null;

    return {
      version: MODEL_VERSION,
      quiz: { id: quizId ?? null, topicId: topicId ?? null },
      question: {
        type: questionType ?? 'mcq-single',
        answerFormat: 'choice-text',
      },
      evaluation: {
        results,
        totals: { correctCount, totalQuestions, score, accuracy },
      },
      attempt: {
        startedAt: null,
        finishedAt: Date.now(),
        timeTakenMs: null,
        practiceDate: null,
      },
      metadata: {
        questionType: questionType ?? 'mcq-single',
        attemptMode: 'first_try',
      },
    };
  }

  function buildCanonicalAttemptFromLegacyGlobals({
    topicId,
    quizId = null,
    questionType = 'mcq-single',
    startedAt = null,
    finishedAt = Date.now(),
    timeTakenMs = null,
    practiceDate = null,
  } = {}) {
    // Try to detect the legacy quiz runtime globals.
    // Preferred: adaptiveSteps + userSelectionsByStep.
    // Fallback: window.questions + window.userAnswers.

    const hasAdaptive = Array.isArray(window.adaptiveSteps) && window.adaptiveSteps.length > 0;
    const hasSimple = Array.isArray(window.questions) && window.questions.length > 0;

    let questions = [];
    let userSelections = [];

    if (hasAdaptive) {
      questions = window.adaptiveSteps;
      userSelections = window.userSelectionsByStep || [];
    } else if (hasSimple) {
      questions = window.questions;
      userSelections = window.userAnswers || [];
    }

    const canonical = normalizeLegacySingleSelect({
      topicId,
      quizId,
      questionType,
      questions,
      userSelections,
    });

    canonical.attempt.startedAt = startedAt;
    canonical.attempt.finishedAt = finishedAt;
    canonical.attempt.timeTakenMs = typeof timeTakenMs === 'number' ? timeTakenMs : null;
    canonical.attempt.practiceDate = practiceDate;
    return canonical;
  }

  function scoreCanonicalAttempt(canonicalAttempt) {
    const totals = canonicalAttempt?.evaluation?.totals;
    if (!totals) return null;
    return {
      score: totals.score,
      totalQuestions: totals.totalQuestions,
      correctCount: totals.correctCount,
      accuracy: totals.accuracy,
    };
  }

  window.quizModel = {
    MODEL_VERSION,
    normalizeLegacySingleSelect,
    buildCanonicalAttemptFromLegacyGlobals,
    scoreCanonicalAttempt,
  };
})();

