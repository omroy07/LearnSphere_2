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

const quizUtils = (typeof window !== 'undefined' && window.quizUtils) || 
                  (typeof require !== 'undefined' && require('./quizUtils.js')) || 
                  (typeof globalThis !== 'undefined' && globalThis.quizUtils) ||
                  {
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
                    }
                  };

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

/**
 * Central Skill Taxonomy mapping each question text to a unique skillId.
 */
const SKILL_TAXONOMY = {
  // --- Physics: Motion ---
  "What is the SI unit of speed?": { skillId: "motion-basics", label: "Speed & Velocity Basics", topicId: "physics-motion", quizUrl: "quiz/motionquiz.html" },
  "What causes an object to accelerate?": { skillId: "motion-forces", label: "Acceleration & Forces", topicId: "physics-motion", quizUrl: "quiz/motionquiz.html" },
  "Which of these is a scalar quantity?": { skillId: "motion-scalars", label: "Scalars & Vectors", topicId: "physics-motion", quizUrl: "quiz/motionquiz.html" },
  "What is the formula for acceleration?": { skillId: "motion-equations", label: "Equations of Motion", topicId: "physics-motion", quizUrl: "quiz/motionquiz.html" },

  // --- Physics: Newton's Laws ---
  "What does Newton's First Law state?": { skillId: "nlm-first-law", label: "Newton's First Law & Inertia", topicId: "physics-nlm", quizUrl: "quiz/nlmquiz.html" },
  "Which force is required to change the state of motion of an object?": { skillId: "nlm-forces", label: "Force & Equilibrium", topicId: "physics-nlm", quizUrl: "quiz/nlmquiz.html" },
  "Newton's Second Law states that force is equal to:": { skillId: "nlm-second-law", label: "Newton's Second Law (F=ma)", topicId: "physics-nlm", quizUrl: "quiz/nlmquiz.html" },
  "What happens when two equal and opposite forces act on an object?": { skillId: "nlm-forces", label: "Force & Equilibrium", topicId: "physics-nlm", quizUrl: "quiz/nlmquiz.html" },
  "According to Newton’s Third Law, what happens when you push on a wall?": { skillId: "nlm-third-law", label: "Newton's Third Law (Action/Reaction)", topicId: "physics-nlm", quizUrl: "quiz/nlmquiz.html" },
  "What is inertia?": { skillId: "nlm-first-law", label: "Newton's First Law & Inertia", topicId: "physics-nlm", quizUrl: "quiz/nlmquiz.html" },
  "If an object's mass increases, what happens to the force required to accelerate it?": { skillId: "nlm-second-law", label: "Newton's Second Law (F=ma)", topicId: "physics-nlm", quizUrl: "quiz/nlmquiz.html" },
  "Which of the following is an example of Newton’s Third Law?": { skillId: "nlm-third-law", label: "Newton's Third Law (Action/Reaction)", topicId: "physics-nlm", quizUrl: "quiz/nlmquiz.html" },

  // --- Physics: Projectile Motion ---
  "What is the path of a projectile in ideal conditions?": { skillId: "projectile-trajectory", label: "Projectile Trajectory", topicId: "physics-projectile", quizUrl: "quiz/projectilequiz.html" },
  "What is the horizontal acceleration of a projectile in the absence of air resistance?": { skillId: "projectile-acceleration", label: "Horizontal & Vertical Acceleration", topicId: "physics-projectile", quizUrl: "quiz/projectilequiz.html" },
  "At the highest point of its trajectory, what is the vertical velocity of a projectile?": { skillId: "projectile-velocity", label: "Velocity at Peak", topicId: "physics-projectile", quizUrl: "quiz/projectilequiz.html" },
  "Which factor affects the range of a projectile the most?": { skillId: "projectile-range-height", label: "Range & Maximum Height", topicId: "physics-projectile", quizUrl: "quiz/projectilequiz.html" },
  "What is the optimal angle for maximum range in projectile motion (neglecting air resistance)?": { skillId: "projectile-range-height", label: "Range & Maximum Height", topicId: "physics-projectile", quizUrl: "quiz/projectilequiz.html" },

  // --- Physics: Ray Optics ---
  "What is the law of reflection?": { skillId: "ray-reflection", label: "Reflection Laws", topicId: "physics-ray", quizUrl: "quiz/rayquiz.html" },
  "Which mirror always forms a virtual, upright, and diminished image?": { skillId: "ray-mirrors", label: "Spherical Mirrors", topicId: "physics-ray", quizUrl: "quiz/rayquiz.html" },
  "What is the focal length of a plane mirror?": { skillId: "ray-mirrors", label: "Spherical Mirrors", topicId: "physics-ray", quizUrl: "quiz/rayquiz.html" },
  "What happens when light travels from a denser to a rarer medium at an angle greater than the critical angle?": { skillId: "ray-tir", label: "Total Internal Reflection", topicId: "physics-ray", quizUrl: "quiz/rayquiz.html" },
  "Which lens is used to correct myopia (nearsightedness)?": { skillId: "ray-lenses", label: "Lenses & Vision Correction", topicId: "physics-ray", quizUrl: "quiz/rayquiz.html" },

  // --- Maths: Calculus ---
  "What is the limit of sin(x)/x as x approaches 0?": { skillId: "calculus-limits", label: "Limits & Continuity", topicId: "maths-calculus", quizUrl: "mathsquiz/calculusquiz.html" },
  "What is the derivative of f(x) = 3x² + 5x?": { skillId: "calculus-differentiation", label: "Differentiation Concepts", topicId: "maths-calculus", quizUrl: "mathsquiz/calculusquiz.html" },
  "What is the integral of g(x) = 4x³ + 2x² - 3x?": { skillId: "calculus-integration", label: "Integration & Antiderivatives", topicId: "maths-calculus", quizUrl: "mathsquiz/calculusquiz.html" },
  "What is the second derivative of f(x) = x³ - 6x² + 9x?": { skillId: "calculus-differentiation", label: "Differentiation Concepts", topicId: "maths-calculus", quizUrl: "mathsquiz/calculusquiz.html" },
  "Which of the following functions is NOT continuous at x = 2?": { skillId: "calculus-limits", label: "Limits & Continuity", topicId: "maths-calculus", quizUrl: "mathsquiz/calculusquiz.html" },

  // --- Maths: Vectors ---
  "What is the dot product of two perpendicular vectors?": { skillId: "vectors-dot-product", label: "Dot Product", topicId: "maths-vectors", quizUrl: "mathsquiz/vectorquiz.html" },
  "Which of the following is a scalar quantity?": { skillId: "vectors-scalars", label: "Scalars & Vectors", topicId: "maths-vectors", quizUrl: "mathsquiz/vectorquiz.html" },
  "If a vector has components (3, 4, 0), what is its magnitude?": { skillId: "vectors-magnitude", label: "Vector Magnitude", topicId: "maths-vectors", quizUrl: "mathsquiz/vectorquiz.html" },
  "The cross product of two parallel vectors is:": { skillId: "vectors-cross-product", label: "Cross Product", topicId: "maths-vectors", quizUrl: "mathsquiz/vectorquiz.html" },
  "In 3D space, how many components does a vector have?": { skillId: "vectors-components", label: "3D Vector Components", topicId: "maths-vectors", quizUrl: "mathsquiz/vectorquiz.html" },

  // --- Maths: Probability ---
  "If the mean of a dataset is 50 and the standard deviation is 5, what is the coefficient of variation?": { skillId: "probability-deviation", label: "Standard Deviation & Variation", topicId: "maths-probability", quizUrl: "mathsquiz/probabilityquiz.html" },
  "What is the probability of getting exactly one head when two fair coins are tossed?": { skillId: "probability-basic", label: "Basic Probability Concepts", topicId: "maths-probability", quizUrl: "mathsquiz/probabilityquiz.html" },
  "Which measure of central tendency is most affected by extreme values?": { skillId: "probability-central", label: "Central Tendency Measures", topicId: "maths-probability", quizUrl: "mathsquiz/probabilityquiz.html" },
  "A letter is chosen at random from the word 'STATISTICS'. What is the probability of selecting a vowel?": { skillId: "probability-basic", label: "Basic Probability Concepts", topicId: "maths-probability", quizUrl: "mathsquiz/probabilityquiz.html" },
  "In a normal distribution, approximately what percentage of data lies within one standard deviation from the mean?": { skillId: "probability-distribution", label: "Normal Distribution", topicId: "maths-probability", quizUrl: "mathsquiz/probabilityquiz.html" },

  // --- Maths: Coordinate Geometry ---
  "What is the distance between the points A(0, 6) and B(0, -2)?": { skillId: "geometry-distance", label: "Distance Formula", topicId: "maths-geometry", quizUrl: "mathsquiz/geometryquiz.html" },
  "The midpoint of the line segment joining (2, 3) and (4, 7) is:": { skillId: "geometry-midpoint", label: "Midpoint Formula", topicId: "maths-geometry", quizUrl: "mathsquiz/geometryquiz.html" },
  "If three points are collinear, then the area of the triangle formed by these points is:": { skillId: "geometry-collinearity", label: "Collinearity & Triangles", topicId: "maths-geometry", quizUrl: "mathsquiz/geometryquiz.html" },
  "Which quadrant does the point (-3, 5) lie in?": { skillId: "geometry-quadrants", label: "Quadrants & Coordinates", topicId: "maths-geometry", quizUrl: "mathsquiz/geometryquiz.html" },
  "The slope of a line perpendicular to a line with slope 2 is:": { skillId: "geometry-slope", label: "Slope & Line Properties", topicId: "maths-geometry", quizUrl: "mathsquiz/geometryquiz.html" },

  // --- Chemistry: Atomic Structure ---
  "Which of the following particles has a positive charge?": { skillId: "atomic-particles", label: "Subatomic Particles", topicId: "chemistry-atomic", quizUrl: "chemistryquiz/atomic_structurequiz.html" },
  "What is the trend in atomic radius as you move across a period from left to right?": { skillId: "atomic-periodic-trends", label: "Periodic Table Trends", topicId: "chemistry-atomic", quizUrl: "chemistryquiz/atomic_structurequiz.html" },
  "Which element has the highest electronegativity?": { skillId: "atomic-periodic-trends", label: "Periodic Table Trends", topicId: "chemistry-atomic", quizUrl: "chemistryquiz/atomic_structurequiz.html" },
  "What is the electron configuration of a neutral oxygen atom?": { skillId: "atomic-electron-config", label: "Electron Configurations", topicId: "chemistry-atomic", quizUrl: "chemistryquiz/atomic_structurequiz.html" },
  "Which of the following statements is true about elements in the same group of the periodic table?": { skillId: "atomic-periodic-trends", label: "Periodic Table Trends", topicId: "chemistry-atomic", quizUrl: "chemistryquiz/atomic_structurequiz.html" },

  // --- Chemistry: Chemical Bonding ---
  "What is the molecular geometry of CO₂?": { skillId: "bonding-geometry", label: "Molecular Geometry", topicId: "chemistry-bonding", quizUrl: "chemistryquiz/chemical_bondingquiz.html" },
  "Which of the following molecules has a trigonal pyramidal shape?": { skillId: "bonding-geometry", label: "Molecular Geometry", topicId: "chemistry-bonding", quizUrl: "chemistryquiz/chemical_bondingquiz.html" },
  "What is the hybridization of the central atom in BF₃?": { skillId: "bonding-hybridization", label: "Atom Hybridization", topicId: "chemistry-bonding", quizUrl: "chemistryquiz/chemical_bondingquiz.html" },
  "Which molecule has a bent molecular geometry due to lone pair repulsion?": { skillId: "bonding-geometry", label: "Molecular Geometry", topicId: "chemistry-bonding", quizUrl: "chemistryquiz/chemical_bondingquiz.html" },
  "What is the bond angle in a tetrahedral molecule like CH₄?": { skillId: "bonding-angles", label: "Bond Angles & Shapes", topicId: "chemistry-bonding", quizUrl: "chemistryquiz/chemical_bondingquiz.html" },

  // --- Chemistry: Equilibrium ---
  "What happens to the equilibrium position when the concentration of a reactant is increased?": { skillId: "equil-le-chatelier", label: "Le Chatelier's Principle", topicId: "chemistry-equil", quizUrl: "chemistryquiz/equilibriumquiz.html" },
  "In an exothermic reaction at equilibrium, what is the effect of increasing the temperature?": { skillId: "equil-le-chatelier", label: "Le Chatelier's Principle", topicId: "chemistry-equil", quizUrl: "chemistryquiz/equilibriumquiz.html" },
  "Adding an inert gas at constant volume to a gaseous equilibrium system will:": { skillId: "equil-le-chatelier", label: "Le Chatelier's Principle", topicId: "chemistry-equil", quizUrl: "chemistryquiz/equilibriumquiz.html" },
  "Which of the following factors does NOT affect the position of equilibrium?": { skillId: "equil-factors", label: "Equilibrium Factors", topicId: "chemistry-equil", quizUrl: "chemistryquiz/equilibriumquiz.html" },
  "For the reaction: N₂(g) + 3H₂(g) ⇌ 2NH₃(g), decreasing the pressure will:": { skillId: "equil-le-chatelier", label: "Le Chatelier's Principle", topicId: "chemistry-equil", quizUrl: "chemistryquiz/equilibriumquiz.html" },

  // --- Chemistry: Thermodynamics (and Kinetics) ---
  "Which of the following is NOT a state function in thermodynamics?": { skillId: "thermo-state-functions", label: "State Functions", topicId: "chemistry-thermo", quizUrl: "chemistryquiz/thermoquiz.html" },
  "According to the second law of thermodynamics, which statement is true?": { skillId: "thermo-second-law", label: "Second Law & Entropy", topicId: "chemistry-thermo", quizUrl: "chemistryquiz/thermoquiz.html" },
  "In the Arrhenius equation, what does the activation energy (Ea) represent?": { skillId: "thermo-activation-energy", label: "Activation Energy", topicId: "chemistry-thermo", quizUrl: "chemistryquiz/thermoquiz.html" },
  "How does a catalyst affect the rate of a chemical reaction?": { skillId: "thermo-catalysts", label: "Catalysts & Reaction Rates", topicId: "chemistry-thermo", quizUrl: "chemistryquiz/thermoquiz.html" },
  "Which factor does NOT affect the rate of a chemical reaction?": { skillId: "thermo-reaction-rates", label: "Reaction Rates Factors", topicId: "chemistry-thermo", quizUrl: "chemistryquiz/thermoquiz.html" }
};

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
    if (!raw) return { attempts: [], byTopic: {}, streak: { lastPracticeDate: null, currentStreak: 0 }, mastery: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { attempts: [], byTopic: {}, streak: { lastPracticeDate: null, currentStreak: 0 }, mastery: {} };
    }
    if (!Array.isArray(parsed.attempts)) parsed.attempts = [];
    if (!parsed.byTopic || typeof parsed.byTopic !== "object") parsed.byTopic = {};
    if (!parsed.streak || typeof parsed.streak !== "object") parsed.streak = { lastPracticeDate: null, currentStreak: 0 };
    if (!parsed.mastery || typeof parsed.mastery !== "object") parsed.mastery = {};
    return parsed;
  } catch {
    return { attempts: [], byTopic: {}, streak: { lastPracticeDate: null, currentStreak: 0 }, mastery: {} };
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
  // i18n (optional): use window.i18n.t when available.
  const _t = (key, params) => {
    try {
      return window.i18n && typeof window.i18n.t === "function" ? window.i18n.t(key, params) : key;
    } catch {
      return key;
    }
  };


  if (!topicId) return;

  _ensureTopicExists(topicId);

  const state = _loadState();
  const now = Date.now();
  const today = _todayLocalISODate();

  // --- Skill Mastery Tracking ---
  // Attempt to resolve individual questions/answers from global scope
  let resolvedQuestions = [];
  let resolvedAnswers = [];

  if (window.adaptiveSteps && window.adaptiveSteps.length > 0) {
    resolvedQuestions = window.adaptiveSteps;
    resolvedAnswers = window.userSelectionsByStep || [];
  } else if (window.questions && window.questions.length > 0) {
    resolvedQuestions = window.questions;
    resolvedAnswers = window.userAnswers || [];
  }

  let calculatedCorrect = 0;
  let hasAnswers = false;

  if (resolvedQuestions.length > 0) {
    resolvedQuestions.forEach((q, idx) => {
      const ans = resolvedAnswers[idx];
      if (ans !== undefined && ans !== null) {
        hasAnswers = true;
        // Determine correct option (which might be index number or string)
        const correctOption = typeof q.answer === 'number' && Array.isArray(q.options) ? q.options[q.answer] : q.answer;
        const isCorrect = ans === correctOption;

        if (isCorrect) {
          calculatedCorrect++;
        }

        // Find skill from taxonomy mapping
        const qText = q.question ? q.question.trim() : "";
        const taxonomyMatch = SKILL_TAXONOMY[qText];
        if (taxonomyMatch) {
          const sId = taxonomyMatch.skillId;
          if (!state.mastery[sId]) {
            state.mastery[sId] = { attempts: 0, correct: 0, lastAttemptAt: 0, weaknessAttempts: 0, weaknessCorrect: 0 };
          }
          state.mastery[sId].attempts += 1;
          if (isCorrect) {
            state.mastery[sId].correct += 1;
          }
          state.mastery[sId].lastAttemptAt = now;
          if (window.isWeaknessFocusMode) {
            state.mastery[sId].weaknessAttempts = (state.mastery[sId].weaknessAttempts || 0) + 1;
            if (isCorrect) {
              state.mastery[sId].weaknessCorrect = (state.mastery[sId].weaknessCorrect || 0) + 1;
            }
          }
        } else {
          // Fallback to topic-general skill if not mapped explicitly
          const fallbackSkillId = topicId + "-general";
          if (!state.mastery[fallbackSkillId]) {
            state.mastery[fallbackSkillId] = { attempts: 0, correct: 0, lastAttemptAt: 0, weaknessAttempts: 0, weaknessCorrect: 0 };
          }
          state.mastery[fallbackSkillId].attempts += 1;
          if (isCorrect) {
            state.mastery[fallbackSkillId].correct += 1;
          }
          state.mastery[fallbackSkillId].lastAttemptAt = now;
          if (window.isWeaknessFocusMode) {
            state.mastery[fallbackSkillId].weaknessAttempts = (state.mastery[fallbackSkillId].weaknessAttempts || 0) + 1;
            if (isCorrect) {
              state.mastery[fallbackSkillId].weaknessCorrect = (state.mastery[fallbackSkillId].weaknessCorrect || 0) + 1;
            }
          }
        }
      }
    });
  }

  // If we successfully calculated question-level details, override aggregate parameters
  if (hasAnswers) {
    correctCount = calculatedCorrect;
    score = calculatedCorrect;
    totalQuestions = resolvedQuestions.length;
  }

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
  const correct = quizUtils.calculateCorrectAnswers(score, totalQuestions, correctCount);



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
  // Question type (optional).
  // Captured from whatever the quiz runtime exposes; otherwise defaults to "unknown".
  const questionType = (() => {
    if (typeof window.questionType === "string" && window.questionType.trim()) return window.questionType;
    if (typeof window.quizQuestionType === "string" && window.quizQuestionType.trim()) return window.quizQuestionType;
    return "unknown";
  })();

  state.attempts.push({
    topicId,
    quizId,
    questionType,
    score: got,
    totalQuestions: total,
    correctCount: correct,
    accuracy: total > 0 && typeof correct === "number" && Number.isFinite(correct) ? correct / total : null,
    timeTakenMs: timeMs,
    startedAt: null,
    finishedAt: now,
    practiceDate: today,
    isWeaknessFocus: window.isWeaknessFocusMode || false,
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

  // Update unified streak & daily goal state
  _updateUnifiedStreakAndGoal("quiz", 1);

  // Milestone notifications (best-effort)
  try {
    if (window.notifications && typeof window.notifications.notifyFromEvent === "function") {
      // New quiz ready when there are meaningful recommendations
      if (window.quizProgress && typeof window.quizProgress.getRecommendedTopics === "function") {
        const recs = window.quizProgress.getRecommendedTopics({ limit: 3 }) || [];
        if (recs.length > 0) {
          const dedupeKey = `quiz-ready-${new Date().toISOString().slice(0, 10)}-${recs.length}`;
          window.notifications.notifyFromEvent({
            type: "quiz_ready",
            title: _t("notifications.quizReadyGeneric.title"),
            message: _t("notifications.quizReadyGeneric.message"),

            ctaUrl: "home.html",
            dedupeKey,
          });

        }
      }
    }
  } catch {}

  // Queue for future backend sync when offline

  if (window.offlineSync && typeof window.offlineSync.queueProgressUpdate === "function") {
    if (!window.offlineSync.isOnline()) {
      window.offlineSync.queueProgressUpdate("quiz_attempt", {
        topicId,
        score: got,
        totalQuestions: total,
        correctCount: correct,
        timeTakenMs: timeMs,
        quizId,
        finishedAt: now,
        practiceDate: today,
      });
    }
  }

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

  function toFiniteNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  attempts.forEach(a => {
    if (!a.practiceDate) return;
    const token = _parseISODateToUTCStart(a.practiceDate);
    if (!byToken.has(token)) return;

    const total = toFiniteNumber(a.totalQuestions);
    if (total === null || total <= 0) return;

    // Priority 1: correctCount
    const correctFromCount = toFiniteNumber(a.correctCount);
    if (correctFromCount !== null) {
      const bucket = byToken.get(token);
      bucket.correct += correctFromCount;
      bucket.total += total;
      byToken.set(token, bucket);
      return;
    }

    // Priority 2: attempt-level accuracy (already computed in recordAttempt)
    const acc = toFiniteNumber(a.accuracy);
    if (acc !== null) {
      const bucket = byToken.get(token);
      bucket.correct += acc * total;
      bucket.total += total;
      byToken.set(token, bucket);
      return;
    }

    // Otherwise we cannot safely infer correctness for chart aggregation.
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

  function toFiniteNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  for (const a of attempts) {
    const totalQ = toFiniteNumber(a.totalQuestions);
    if (totalQ === null || totalQ <= 0) continue;

    const correctFromCount = toFiniteNumber(a.correctCount);
    if (correctFromCount !== null) {
      correct += correctFromCount;
      total += totalQ;
      continue;
    }

    // Fallback: use attempt-level accuracy if present.
    const acc = toFiniteNumber(a.accuracy);
    if (acc !== null) {
      correct += acc * totalQ;
      total += totalQ;
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

function getMasteryStats() {
  const state = _loadState();
  return state.mastery || {};
}

function getWeakestSkills({ limit = 3 } = {}) {
  const state = _loadState();
  const mastery = state.mastery || {};
  
  const skillIds = new Set();
  const skillsList = [];
  
  for (const [qText, tax] of Object.entries(SKILL_TAXONOMY)) {
    if (!skillIds.has(tax.skillId)) {
      skillIds.add(tax.skillId);
      
      const m = mastery[tax.skillId] || { attempts: 0, correct: 0, lastAttemptAt: null };
      const accuracy = m.attempts > 0 ? m.correct / m.attempts : null;
      
      // Weakness score:
      // - Attempted skills with low accuracy have highest weakness (e.g. 1 - accuracy)
      // - Unattempted skills have weakness of 0.8
      let weakness = 0;
      if (m.attempts === 0) {
        weakness = 0.8;
      } else {
        weakness = 1 - accuracy;
      }
      
      skillsList.push({
        skillId: tax.skillId,
        label: tax.label,
        topicId: tax.topicId,
        quizUrl: tax.quizUrl,
        attempts: m.attempts,
        correct: m.correct,
        accuracy: accuracy,
        weakness: weakness
      });
    }
  }
  
  skillsList.sort((a, b) => b.weakness - a.weakness);
  return skillsList.slice(0, limit);
}

function getQuestionWeaknessWeight(q) {
  if (!q || !q.question) return 0.5;
  const qText = q.question.trim();
  const tax = SKILL_TAXONOMY[qText];
  if (!tax) return 0.5;
  
  const stats = getMasteryStats();
  const m = stats[tax.skillId];
  if (!m || m.attempts === 0) return 0.5;
  
  const accuracy = m.correct / m.attempts;
  return 1.0 - accuracy;
}

function _updateUnifiedStreakAndGoal(type, value = 1) {
  if (window.studyProgress && typeof window.studyProgress.recordActivity === "function") {
    window.studyProgress.recordActivity(type, value);
    return;
  }

  const STREAK_KEY = "learnsphere_streak_state_v1";
  const today = _todayLocalISODate();
  let state = { lastActiveDate: null, currentStreak: 0, dailyGoalProgress: { quizzesCompleted: 0, questionsReviewed: 0 } };

  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        state = parsed;
      }
    }
  } catch (e) {}

  if (!state.dailyGoalProgress || typeof state.dailyGoalProgress !== "object") {
    state.dailyGoalProgress = { quizzesCompleted: 0, questionsReviewed: 0 };
  }

  const lastActive = state.lastActiveDate;
  const todayToken = _parseISODateToUTCStart(today);
  const lastToken = lastActive ? _parseISODateToUTCStart(lastActive) : null;

  if (lastActive) {
    if (todayToken > lastToken + 1) {
      state.currentStreak = 0;
      state.dailyGoalProgress = { quizzesCompleted: 0, questionsReviewed: 0 };
    } else if (lastActive !== today) {
      state.dailyGoalProgress = { quizzesCompleted: 0, questionsReviewed: 0 };
    }
  } else {
    state.dailyGoalProgress = { quizzesCompleted: 0, questionsReviewed: 0 };
  }

  if (!lastActive) {
    state.currentStreak = 1;
    state.lastActiveDate = today;
  } else if (lastActive === today) {
    // Same day
  } else if (lastToken !== null && todayToken === lastToken + 1) {
    state.currentStreak += 1;
    state.lastActiveDate = today;
  } else {
    state.currentStreak = 1;
    state.lastActiveDate = today;
  }

  if (type === "quiz") {
    state.dailyGoalProgress.quizzesCompleted += value;
  } else if (type === "review") {
    state.dailyGoalProgress.questionsReviewed += value;
  }

  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(state));
  } catch (e) {}

  // Trigger achievements check if achievements is loaded
  if (window.achievements && typeof window.achievements.checkAndNotify === "function") {
    window.achievements.checkAndNotify();
  }
}

function getAttemptsHistory() {
  const state = _loadState();
  const attempts = Array.isArray(state?.attempts) ? state.attempts : [];
  // Return a copy to avoid accidental mutation
  return attempts.slice();
}

function recordAttemptCanonical(canonicalAttempt) {
  // Canonical adapter: writes the same localStorage shape as recordAttempt
  // but uses deterministic canonical totals.
  if (!canonicalAttempt || !canonicalAttempt.quiz || !canonicalAttempt.quiz.topicId) return null;

  const topicId = canonicalAttempt.quiz.topicId;
  const quizId = canonicalAttempt.quiz.id ?? null;

  const totals = canonicalAttempt.evaluation?.totals || {};
  const totalQuestions = Number.isFinite(totals.totalQuestions) ? totals.totalQuestions : Number(totals.totalQuestions);
  const correctCount = Number.isFinite(totals.correctCount) ? totals.correctCount : Number(totals.correctCount);
  const score = Number.isFinite(totals.score) ? totals.score : Number(totals.score);

  const timeTakenMs = canonicalAttempt.attempt?.timeTakenMs;

  // IMPORTANT: recordAttempt currently includes legacy correctness inference.
  // For canonical submissions we pass correctCount explicitly to ensure stable analytics.
  return recordAttempt({
    topicId,
    quizId,
    questionType: canonicalAttempt.metadata?.questionType,
    score,
    totalQuestions,
    correctCount,
    timeTakenMs,
  });
}

// Keep legacy recordAttempt but add canonical method.
window.quizProgress = {
  QUIZ_TOPICS,
  SKILL_TAXONOMY,
  recordAttempt,
  recordAttemptCanonical,
  getStreak,
  getTopicStats,
  getAllTopicStats,
  getAccuracySeries,
  getOverallAccuracy,
  getRecommendedTopics,
  getMasteryStats,
  getWeakestSkills,
  getQuestionWeaknessWeight,
  recordRetryAttempt,
  getAttemptsHistory,
  /** @returns {Object|null} offlineSync reference */
  get offlineSync() { return window.offlineSync || null; },
};


/**
 * Records a retry attempt (from "Retry Missed Questions") into mastery stats.
 * Stores retryAttempts and retryCorrect separately to avoid inflating first-attempt accuracy.
 *
 * @param {Object} params
 * @param {string} params.topicId
 * @param {Array}  params.results  - Array of { q, correct } objects from the retry session
 */
function recordRetryAttempt({ topicId, results }) {
  if (!topicId || !Array.isArray(results) || results.length === 0) return;

  const state = _loadState();
  const now = Date.now();

  results.forEach(({ q, correct }) => {
    const qText = typeof q === "string" ? q.trim() : "";
    const taxonomyMatch = SKILL_TAXONOMY[qText];
    const sId = taxonomyMatch ? taxonomyMatch.skillId : (topicId + "-general");

    if (!state.mastery[sId]) {
      state.mastery[sId] = { attempts: 0, correct: 0, lastAttemptAt: 0, weaknessAttempts: 0, weaknessCorrect: 0, retryAttempts: 0, retryCorrect: 0 };
    }
    state.mastery[sId].retryAttempts = (state.mastery[sId].retryAttempts || 0) + 1;
    if (correct) {
      state.mastery[sId].retryCorrect = (state.mastery[sId].retryCorrect || 0) + 1;
    }
    state.mastery[sId].lastAttemptAt = now;
  });

  _saveState(state);

  // Queue for future backend sync when offline
  if (window.offlineSync && typeof window.offlineSync.queueProgressUpdate === "function") {
    if (!window.offlineSync.isOnline()) {
      window.offlineSync.queueProgressUpdate("retry_attempt", { topicId, results });
    }
  }
}

// Listen for Background Sync flush messages from service worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data && event.data.action === "do-flush-offline-queue") {
      if (window.offlineSync && typeof window.offlineSync.flushQueue === "function") {
        window.offlineSync.flushQueue();
      }
    }
  });
}

