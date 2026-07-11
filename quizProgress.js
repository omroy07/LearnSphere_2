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
  const [y, m, d] = isoDateYYYYMMDD.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

function _loadState() {
  try {
    const raw = localStorage.getItem(QUIZ_PROGRESS_KEY);
    if (!raw) return { attempts: [], practiceAttempts: [], byTopic: {}, byTopicPractice: {}, streak: { lastPracticeDate: null, currentStreak: 0 }, mastery: {}, masteryPractice: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { attempts: [], practiceAttempts: [], byTopic: {}, byTopicPractice: {}, streak: { lastPracticeDate: null, currentStreak: 0 }, mastery: {}, masteryPractice: {} };
    }
    if (!Array.isArray(parsed.attempts)) parsed.attempts = [];
    if (!Array.isArray(parsed.practiceAttempts)) parsed.practiceAttempts = [];
    if (!parsed.byTopic || typeof parsed.byTopic !== "object") parsed.byTopic = {};
    if (!parsed.byTopicPractice || typeof parsed.byTopicPractice !== "object") parsed.byTopicPractice = {};
    if (!parsed.streak || typeof parsed.streak !== "object") parsed.streak = { lastPracticeDate: null, currentStreak: 0 };
    if (!parsed.mastery || typeof parsed.mastery !== "object") parsed.mastery = {};
    if (!parsed.masteryPractice || typeof parsed.masteryPractice !== "object") parsed.masteryPractice = {};
    if (!parsed.skillAttempts || typeof parsed.skillAttempts !== "object") parsed.skillAttempts = {};
    return parsed;

  } catch {
    return { attempts: [], practiceAttempts: [], byTopic: {}, byTopicPractice: {}, streak: { lastPracticeDate: null, currentStreak: 0 }, mastery: {}, masteryPractice: {} };
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

        // Resolve skill/topic using per-question metadata when available.
        // Falls back to SKILL_TAXONOMY via question text (legacy quizzes).
        const metaSkillId = q.skillId || null;
        const metaTopicId = q.topicId || null;

        const qText = q.question ? q.question.trim() : "";
        const taxonomyMatch = metaSkillId ? null : SKILL_TAXONOMY[qText];

        const resolvedTopicId = metaTopicId || topicId;
        const resolvedSkillId =
          metaSkillId ||
          taxonomyMatch?.skillId ||
          (resolvedTopicId ? resolvedTopicId + "-general" : topicId + "-general");

        const masteryObj = (window.quizProgress && window.quizProgress.mode === "practice")
          ? (state.masteryPractice = state.masteryPractice || {})
          : state.mastery;

        if (!masteryObj[resolvedSkillId]) {
          masteryObj[resolvedSkillId] = {
            attempts: 0,
            correct: 0,
            lastAttemptAt: 0,
            weaknessAttempts: 0,
            weaknessCorrect: 0,
          };
        }

        masteryObj[resolvedSkillId].attempts += 1;
        if (isCorrect) {
          masteryObj[resolvedSkillId].correct += 1;
        }
        masteryObj[resolvedSkillId].lastAttemptAt = now;

        // Compact per-skill attempt history for adaptive trend calculations.
        // This is stored separately to avoid breaking existing mastery totals.
        if (!state.skillAttempts) state.skillAttempts = {};
        if (!state.skillAttempts[resolvedSkillId]) state.skillAttempts[resolvedSkillId] = [];
        // Keep only lightweight info.
        state.skillAttempts[resolvedSkillId].push({
          ts: now,
          correct: !!isCorrect,
          practiceDate: today,
          topicId: resolvedTopicId,
          mode: (window.quizProgress && window.quizProgress.mode) || "exam",
        });
        // Bounded memory (last 50 observations per skill)
        if (state.skillAttempts[resolvedSkillId].length > 50) {
          state.skillAttempts[resolvedSkillId] = state.skillAttempts[resolvedSkillId].slice(-50);
        }


        if (window.isWeaknessFocusMode) {
          masteryObj[resolvedSkillId].weaknessAttempts = (masteryObj[resolvedSkillId].weaknessAttempts || 0) + 1;
          if (isCorrect) {
            masteryObj[resolvedSkillId].weaknessCorrect = (masteryObj[resolvedSkillId].weaknessCorrect || 0) + 1;
          }
        }

        // Topic aggregates are updated below at attempt-level (state.byTopic[topicId])
        // for backward compatibility. Per-question metadata primarily powers mastery +
        // weakness scoring.
        void resolvedTopicId;
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


  const topicObj = (window.quizProgress && window.quizProgress.mode === "practice")
    ? (state.byTopicPractice = state.byTopicPractice || {})
    : state.byTopic;

  // Topic aggregate init
  if (!topicObj[topicId]) {
    topicObj[topicId] = {
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

  const agg = topicObj[topicId];
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

  const attemptsArray = (window.quizProgress && window.quizProgress.mode === "practice")
    ? (state.practiceAttempts = state.practiceAttempts || [])
    : state.attempts;

  attemptsArray.push({
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
    mode: (window.quizProgress && window.quizProgress.mode) || "exam"
  });

  // Keep attempts bounded
  if (attemptsArray.length > 500) {
    const trimmed = attemptsArray.slice(attemptsArray.length - 500);
    if (window.quizProgress && window.quizProgress.mode === "practice") {
      state.practiceAttempts = trimmed;
    } else {
      state.attempts = trimmed;
    }
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
      // Generate a stable attemptId for idempotent sync
      const attemptId = `qa_${topicId}_${quizId || ""}_${now}_${correct}_${total}`;
      window.offlineSync.queueProgressUpdate("quiz_attempt", {
        attemptId,
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

  const today = new Date();
  const labels = [];
  const tokens = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const label = `${mm}/${dd}`;
    const token = Math.floor(Date.UTC(yyyy, d.getMonth(), d.getDate()) / 86400000);

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

const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
const initialMode = urlParams ? (urlParams.get("mode") === "practice" ? "practice" : "exam") : "exam";

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
  getAdaptiveNextQuizPlanner,
  mode: initialMode,

  logMistake,
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
      // Generate a stable attemptId for retry attempts
      const attemptId = `ra_${topicId}_${Date.now()}_${results.length}`;
      window.offlineSync.queueProgressUpdate("retry_attempt", { attemptId, topicId, results });
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

function getAdaptiveNextQuizPlanner({ limit = 1 } = {}) {

  const state = _loadState();
  const byTopic = state.byTopic || {};
  const mastery = state.mastery || {};
  const skillAttempts = state.skillAttempts || {};

  const skillTax = SKILL_TAXONOMY || {};
  const quizTopics = QUIZ_TOPICS || [];

  // Build skill -> topicUrl/label mapping from taxonomy
  const skillMeta = new Map();
  for (const [qText, tax] of Object.entries(skillTax)) {
    if (!tax || !tax.skillId) continue;
    if (!skillMeta.has(tax.skillId)) {
      skillMeta.set(tax.skillId, {
        skillId: tax.skillId,
        label: tax.label,
        topicId: tax.topicId,
        quizUrl: tax.quizUrl,
      });
    }
  }

  // Compute per-topic weakness from worst skills (last-3 trend) in that topic
  const candidateTopics = quizTopics.map(t => {
    const topicId = t.id;
    const attempts = byTopic[topicId]?.attempts || 0;
    const qTotal = byTopic[topicId]?.questionsTotal || 0;
    const correctTotal = byTopic[topicId]?.correctTotal || 0;
    const accuracy = qTotal > 0 ? correctTotal / qTotal : null;

    // Gather skills belonging to this topic
    const skillsInTopic = [];
    for (const [sId, meta] of skillMeta.entries()) {
      if (meta.topicId === topicId) {
        const m = mastery[sId] || { attempts: 0, correct: 0 };
        const accRatio = m.attempts > 0 ? (m.correct / m.attempts) : null;
        const hist = skillAttempts[sId] || [];
        const trend = quizUtils.calculateSkillMasteryTrend(hist);
        skillsInTopic.push({ sId, meta, attemptsN: m.attempts || 0, accRatio, trend });
      }
    }

    // Score topic weakness:
    // - Prefer topics where (1-accuracy) is high
    // - Prefer negative trend (delta < 0)
    // - Also allow unseen topics to be high weakness
    let weakness = 0;
    if (accuracy === null) {
      weakness = 1.0;
    } else {
      weakness = 1 - accuracy;
    }

    // If we have skill trends, adjust weakness by worst skill delta/accuracy
    if (skillsInTopic.length) {
      let worst = null;
      skillsInTopic.forEach(s => {
        const last3Acc = s.trend.last3Acc;
        const delta = s.trend.delta;
        const baseSkillWeakness = last3Acc == null ? 0.6 : (1 - last3Acc);
        const trendPenalty = typeof delta === 'number' ? (delta < 0 ? Math.abs(delta) : 0) : 0;
        const skillWeakness = baseSkillWeakness + trendPenalty * 0.7;
        if (!worst || skillWeakness > worst.skillWeakness) {
          worst = { skillWeakness, s };
        }
      });

      if (worst) {
        weakness += worst.skillWeakness * 0.35;
      }
    }

    // Mild penalty for already well-practiced topics
    if (attempts >= 8) weakness -= 0.05;

    // Difficulty heuristic from weakness
    let difficulty = 'easy';
    if (weakness >= 0.95) difficulty = 'hard';
    else if (weakness >= 0.65) difficulty = 'medium';

    // Readiness from topic accuracy + trend of the weakest skill
    let weakestSkillHist = null;
    let weakestSkillAcc = null;
    let weakestSkillTrendDelta = null;
    if (skillsInTopic.length) {
      // pick skill with max (1-last3Acc) or missing data
      let worstSkill = null;
      for (const s of skillsInTopic) {
        const last3Acc = s.trend.last3Acc;
        const w = last3Acc == null ? 1 : (1 - last3Acc);
        if (!worstSkill || w > worstSkill.w) {
          weakestSkillHist = s;
          weakestSkillAcc = s.trend.last3Acc;
          weakestSkillTrendDelta = s.trend.delta;
          worstSkill = { w };
        }
      }
    }

    const readinessPct = quizUtils.estimateReadinessPct({
      accuracyRatio: weakestSkillAcc,
      trendDelta: weakestSkillTrendDelta,
      attemptsN: byTopic[topicId]?.attempts || 0,
    });

    // Reason text key params (i18n happens in UI via reasonText)
    let reasonText = '';
    if (accuracy === null) {
      reasonText = 'New topic: start with foundational practice.';
    } else {
      const delta = weakestSkillTrendDelta;
      if (typeof delta === 'number' && delta < 0) {
        reasonText = 'Your recent attempts are trending down—focus here next.';
      } else {
        reasonText = 'This topic needs more practice—build consistency with targeted questions.';
      }
    }

    // Prefer quizUrl from taxonomy questions (fallback none)
    // Instead of guessing, use skillMeta for a skill in this topic

    let derivedQuizUrl = null;
    if (skillsInTopic.length) {
      derivedQuizUrl = skillsInTopic[0]?.meta?.quizUrl || null;
    }

    return {
      topicId,
      quizUrl: derivedQuizUrl || (t.quizIds && t.quizIds.length ? t.quizIds[0] : null),
      topicLabel: t.label,
      quizLabel: t.label,
      attempts,
      accuracy,
      weakness,
      difficulty,
      readinessPct,
      difficultyKey: `adaptiveNextQuizPlanner.difficulty.${difficulty}`,
      reasonText,
    };
  });

  candidateTopics.sort((a, b) => b.weakness - a.weakness);
  const recommendations = candidateTopics.slice(0, limit);

  return { recommendations };
}

function logMistake(topicId, q) {

  if (!topicId || !q) return;
  const MISSED_KEY = "learnsphere_review_missed_v1";
  let map = {};
  try {
    map = JSON.parse(localStorage.getItem(MISSED_KEY)) || {};
  } catch (e) {}

  if (!map[topicId]) {
    map[topicId] = { missedQids: [], updatedAt: Date.now() };
  }

  const qText = (q.question || q.q || "").trim();
  const qid = `${topicId}:quiz:${qText.replace(/\s+/g, '-').toLowerCase()}`;

  const missedList = map[topicId].missedQids || [];
  const exists = missedList.some(item => {
    if (item && typeof item === 'object') {
      return item.qid === qid;
    }
    return item === qid;
  });

  if (!exists) {
    const qObj = {
      qid: qid,
      q: qText,
      options: q.options,
      answer: typeof q.answer === 'number' ? q.options[q.answer] : q.answer,
      answerIndex: typeof q.answer === 'number' ? q.answer : q.options.indexOf(q.answer),
      explanation: q.explanation || ""
    };
    missedList.push(qObj);
    map[topicId].missedQids = missedList;
    map[topicId].updatedAt = Date.now();
    try {
      localStorage.setItem(MISSED_KEY, JSON.stringify(map));
    } catch (e) {
      console.warn("LearnSphere: Could not save quiz mistake", e);
    }
  }
}

function getTopicIdFromUrl() {
  const url = window.location.pathname;
  if (url.includes("motionquiz")) return "physics-motion";
  if (url.includes("nlmquiz")) return "physics-nlm";
  if (url.includes("projectilequiz")) return "physics-projectile";
  if (url.includes("rayquiz")) return "physics-ray";
  if (url.includes("calculusquiz")) return "maths-calculus";
  if (url.includes("vectorquiz")) return "maths-vectors";
  if (url.includes("probabilityquiz")) return "maths-probability";
  if (url.includes("geometryquiz")) return "maths-geometry";
  if (url.includes("atomic_structurequiz")) return "chemistry-atomic";
  if (url.includes("chemical_bondingquiz")) return "chemistry-bonding";
  if (url.includes("equilibriumquiz")) return "chemistry-equil";
  if (url.includes("thermoquiz")) return "chemistry-thermo";
  return null;
}

function _injectModeSwitcher() {
  if (typeof document === "undefined") return;

  const target = document.querySelector(".progress-container") || document.getElementById("quiz-box");
  if (!target) return; // Not on a quiz page

  // Check if switcher already exists
  if (document.getElementById("quiz-mode-switcher")) return;

  // Insert beautiful premium glassmorphism CSS
  const style = document.createElement("style");
  style.textContent = `
    .quiz-mode-container {
        display: flex;
        justify-content: center;
        gap: 15px;
        margin: 20px 0;
        padding: 10px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        backdrop-filter: blur(10px);
        box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
    }

    .mode-btn {
        background: transparent;
        color: #aaa;
        border: 1px solid rgba(255, 255, 255, 0.15);
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 0.95rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .mode-btn:hover {
        background: rgba(255, 255, 255, 0.05);
        color: #fff;
        border-color: rgba(255, 255, 255, 0.3);
    }

    .mode-btn.active {
        background: linear-gradient(135deg, #00f2fe, #4facfe);
        color: #000;
        font-weight: 700;
        border-color: transparent;
        box-shadow: 0 0 15px rgba(0, 242, 254, 0.4);
    }

    .practice-feedback {
        margin: 15px 0;
        padding: 15px;
        border-radius: 8px;
        font-size: 1rem;
        line-height: 1.5;
        text-align: left;
        animation: slideDown 0.3s ease-out;
    }
    .practice-feedback.correct {
        background: rgba(16, 185, 129, 0.1) !important;
        border: 1px solid rgba(16, 185, 129, 0.3) !important;
        color: #10b981 !important;
    }
    .practice-feedback.incorrect {
        background: rgba(239, 68, 68, 0.1) !important;
        border: 1px solid rgba(239, 68, 68, 0.3) !important;
        color: #ef4444 !important;
    }

    @keyframes slideDown {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);

  const switcher = document.createElement("div");
  switcher.id = "quiz-mode-switcher";
  switcher.className = "quiz-mode-container";
  switcher.innerHTML = `
    <button id="exam-mode-btn" class="mode-btn ${window.quizProgress.mode === 'exam' ? 'active' : ''}">Exam Mode 📝</button>
    <button id="practice-mode-btn" class="mode-btn ${window.quizProgress.mode === 'practice' ? 'active' : ''}">Practice Mode 🎯</button>
  `;

  target.parentNode.insertBefore(switcher, target);

  const examBtn = switcher.querySelector("#exam-mode-btn");
  const practiceBtn = switcher.querySelector("#practice-mode-btn");

  const changeMode = (newMode) => {
    if (window.quizProgress.mode === newMode) return;
    window.quizProgress.mode = newMode;

    examBtn.classList.toggle("active", newMode === "exam");
    practiceBtn.classList.toggle("active", newMode === "practice");

    // Update query param in URL without full page reload
    const url = new URL(window.location.href);
    url.searchParams.set("mode", newMode);
    window.history.replaceState({}, "", url);

    // Call restartQuiz to restart in the correct mode
    if (typeof window.restartQuiz === "function") {
      window.restartQuiz();
    }
  };

  examBtn.addEventListener("click", () => changeMode("exam"));
  practiceBtn.addEventListener("click", () => changeMode("practice"));
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    _injectModeSwitcher();

    // 0. Clean and normalize question answers for chemistry and maths quizzes (index to string text)
    if (typeof questions !== "undefined" && Array.isArray(questions)) {
      questions.forEach(q => {
        if (typeof q.answer === "number" && Array.isArray(q.options)) {
          q.answer = q.options[q.answer];
        }
      });
    }

    // Intercept selectOption and loadQuestion
    const origSelectOption = window.selectOption;
    const origLoadQuestion = window.loadQuestion;

    if (typeof window.selectOption === "function" && typeof window.loadQuestion === "function") {
      window.loadQuestion = function() {
        origLoadQuestion.apply(this, arguments);

        // Hide and clear practice feedback
        const feedbackDiv = document.getElementById("practice-feedback");
        if (feedbackDiv) {
          feedbackDiv.className = "practice-feedback hidden";
          feedbackDiv.innerHTML = "";
        }
      };

      window.selectOption = function(button, option) {
        if (window.quizProgress.mode !== "practice") {
          return origSelectOption.apply(this, arguments);
        }

        // Resolve question references dynamically for either adaptive (motion, nlm) or standard quizzes
        let q, qIndex, ansArray;
        if (typeof adaptiveSteps !== "undefined" && typeof currentStepIndex !== "undefined") {
          q = adaptiveSteps[currentStepIndex];
          qIndex = currentStepIndex;
          ansArray = userSelectionsByStep;
        } else {
          q = questions[currentQuestionIndex];
          qIndex = currentQuestionIndex;
          ansArray = userAnswers;
        }

        // Practice mode logic:
        // 1. Identify if it is correct or incorrect
        const correctText = typeof q.answer === 'number' && Array.isArray(q.options)
            ? q.options[q.answer]
            : q.answer;
        const isCorrect = (option === correctText);

        // 2. Disable all option buttons and style correct/wrong choices
        const buttons = document.querySelectorAll(".option");
        buttons.forEach(btn => {
          btn.disabled = true;
          if (btn.textContent === correctText) {
            btn.style.setProperty('background-color', '#10b981', 'important');
            btn.style.setProperty('color', '#ffffff', 'important');
          } else if (btn === button && !isCorrect) {
            btn.style.setProperty('background-color', '#ef4444', 'important');
            btn.style.setProperty('color', '#ffffff', 'important');
          } else {
            btn.style.opacity = "0.5";
          }
        });

        // 3. Mark selectedOption, userAnswers, and enable next/submit buttons
        selectedOption = option;
        ansArray[qIndex] = option;

        const nextBtn = document.getElementById("next-btn");
        if (nextBtn) nextBtn.disabled = false;
        const submitBtn = document.getElementById("submit-btn");
        if (submitBtn) submitBtn.disabled = false;

        // 4. Display feedback element
        let feedbackDiv = document.getElementById("practice-feedback");
        if (!feedbackDiv) {
          feedbackDiv = document.createElement("div");
          feedbackDiv.id = "practice-feedback";
          const optContainer = document.getElementById("options");
          if (optContainer) {
            optContainer.parentNode.insertBefore(feedbackDiv, optContainer.nextSibling);
          }
        }

        feedbackDiv.className = `practice-feedback ${isCorrect ? 'correct' : 'incorrect'}`;
        let feedbackHTML = isCorrect
          ? `<strong>✅ Correct!</strong>`
          : `<strong>❌ Incorrect!</strong> The correct answer is: <strong>${correctText}</strong>`;
        
        if (q.explanation) {
          feedbackHTML += `<div style="margin-top: 8px; font-size: 0.9rem; opacity: 0.95;">${q.explanation}</div>`;
        }
        feedbackDiv.innerHTML = feedbackHTML;

        // 5. If incorrect, log mistake for later review
        if (!isCorrect) {
          const topicId = q.topicId || (typeof getTopicIdFromUrl === "function" ? getTopicIdFromUrl() : null);
          window.quizProgress.logMistake(topicId, q);
        }
      };
    }
  });
}

