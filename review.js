/*
 * review.js — Spaced Repetition Review Mode & Dashboard Controller
 *
 * Provides review quiz runner and updates per-topic nextReviewDate using spaced repetition logic
 * stored in progress.js localStorage key:
 *   learnsphere_review_schedule_v1
 *
 * Exposes methods to load lists, display stats, and timeline history.
 */

(function () {
  function _todayLocalISODate() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function _parseISODateToUTCStart(isoDateYYYYMMDD) {
    const [y, m, d] = isoDateYYYYMMDD.split("-").map(Number);
    const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
    return Math.floor(dt.getTime() / 86400000);
  }

  function _addDaysISO(isoDateYYYYMMDD, days) {
    const token = _parseISODateToUTCStart(isoDateYYYYMMDD);
    const target = token + days;
    const dt = new Date(target * 86400000);
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const REVIEW_SCHEDULE_KEY = "learnsphere_review_schedule_v1";
  const REVIEW_HISTORY_KEY = "learnsphere_review_history_v1";

  // NOTE:
  // review.js must stay in sync with the app's authoritative topic registry
  // (TOPICS in progress.js). If progress.js hasn't loaded yet, we must NOT
  // fall back to an alternate metadata set because it can diverge.

  function getTopicsList() {
    if (typeof TOPICS === "undefined") return null;
    if (!Array.isArray(TOPICS)) return null;
    // Basic shape check
    const ok = TOPICS.every(t => t && typeof t.id === "string" && typeof t.label === "string" && typeof t.subject === "string");
    return ok ? TOPICS : null;
  }

  async function waitForTopicsList({ timeoutMs = 3000, pollIntervalMs = 50 } = {}) {
    const start = Date.now();
    return new Promise(resolve => {
      function tick() {
        const topics = getTopicsList();
        if (topics) return resolve(topics);
        if (Date.now() - start >= timeoutMs) return resolve(null);
        setTimeout(tick, pollIntervalMs);
      }
      tick();
    });
  }



  function loadSchedule() {
    try {
      return JSON.parse(localStorage.getItem(REVIEW_SCHEDULE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveSchedule(map) {
    try {
      localStorage.setItem(REVIEW_SCHEDULE_KEY, JSON.stringify(map));
    } catch (e) {
      console.warn("LearnSphere: Could not save review schedule.", e);
    }
  }

  function loadHistory() {
    try {
      return JSON.parse(localStorage.getItem(REVIEW_HISTORY_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveHistory(list) {
    try {
      localStorage.setItem(REVIEW_HISTORY_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn("LearnSphere: Could not save review history.", e);
    }
  }

  function _updateUnifiedStreakAndGoal(type, value = 1) {
    if (window.studyProgress && typeof window.studyProgress.recordActivity === "function") {
      window.studyProgress.recordActivity(type, value);
      return;
    }

    const STREAK_KEY = "learnsphere_streak_state_v1";
    const today = (function() {
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    })();

    function parseISODateToUTCStart(isoDateYYYYMMDD) {
      const [y, m, d] = isoDateYYYYMMDD.split("-").map(Number);
      const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
      return Math.floor(dt.getTime() / 86400000);
    }

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
    const todayToken = parseISODateToUTCStart(today);
    const lastToken = lastActive ? parseISODateToUTCStart(lastActive) : null;

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

    if (window.achievements && typeof window.achievements.checkAndNotify === "function") {
      window.achievements.checkAndNotify();
    }
  }

  function recordReviewResult({ topicId, scorePct, answeredCount = 0 }) {

    if (!topicId) return;

    const today = _todayLocalISODate();
    const schedule = loadSchedule();
    const prev = schedule[topicId] || {};

    const prevInterval =
      typeof prev.intervalDays === "number" && prev.intervalDays > 0 ? prev.intervalDays : 1;

    const pct = typeof scorePct === "number" ? scorePct : 0;

    let nextInterval = prevInterval;
    if (pct >= 80) {
      nextInterval = Math.max(1, Math.round(prevInterval * 2));
    } else if (pct >= 50) {
      nextInterval = Math.max(1, Math.round(prevInterval * 1.3));
    } else {
      nextInterval = 1;
    }

    const nextReviewDate = _addDaysISO(today, nextInterval);

    schedule[topicId] = {
      intervalDays: nextInterval,
      nextReviewDate,
      lastReviewedAt: today,
      lastScorePct: pct,
      lastAnsweredCount: answeredCount,
      updatedAt: Date.now(),
    };

    saveSchedule(schedule);

    // Save to chronological history log
    const history = loadHistory();
    history.unshift({
      topicId,
      scorePct: pct,
      answeredCount,
      reviewedAt: today,
      timestamp: Date.now()
    });
    // Keep history reasonably bounded (e.g., last 100 reviews)
    if (history.length > 100) {
      history.splice(100);
    }
    saveHistory(history);

    // Update unified daily streak & daily goal state
    _updateUnifiedStreakAndGoal("review", answeredCount);

    return schedule[topicId];
  }


  function skipTopic(topicId) {
    if (!topicId) return;
    const today = _todayLocalISODate();
    const schedule = loadSchedule();
    const prev = schedule[topicId] || {};

    // Skip action: postpones review by a fixed interval of +2 days
    schedule[topicId] = {
      ...prev,
      intervalDays: 2,
      nextReviewDate: _addDaysISO(today, 2),
      updatedAt: Date.now()
    };

    saveSchedule(schedule);

    // Dispatch event to re-render UI in real time
    window.dispatchEvent(new Event("review-saved"));
  }

  // Minimal question set per topic.
  function getReviewQuiz(topicId) {
    const bank = {
      "physics-motion": [
        {
          q: "Which quantity describes how fast an object changes its velocity?",
          options: ["Speed", "Acceleration", "Distance", "Momentum"],
          answerIndex: 1,
        },
        {
          q: "If velocity is constant, acceleration is…",
          options: ["Constant", "Zero", "Increasing", "Negative"],
          answerIndex: 1,
        },
      ],
      "physics-nlm": [
        {
          q: "Newton's First Law relates to…",
          options: ["Motion with constant force", "Inertia and tendency to maintain velocity", "Mutual attractions", "Energy conservation"],
          answerIndex: 1,
        },
        {
          q: "Newton's Second Law: F is proportional to…",
          options: ["Velocity", "Acceleration", "Mass only", "Distance"],
          answerIndex: 1,
        },
      ],
      "physics-projectile": [
        {
          q: "In projectile motion (neglecting air resistance), horizontal acceleration is…",
          options: ["Zero", "Constant positive", "Constant negative", "Depends on time"],
          answerIndex: 0,
        },
        {
          q: "Vertical motion is influenced by…",
          options: ["No forces", "Gravity", "Magnetism", "Friction"],
          answerIndex: 1,
        },
      ],
      "physics-ray": [
        {
          q: "When light refracts, it changes direction due to…",
          options: ["Different speeds in different media", "Reflection only", "Electric fields", "Mass"],
          answerIndex: 0,
        },
        {
          q: "A concave mirror generally…",
          options: ["Always forms a virtual image", "Can form real images depending on object position", "Only forms real images", "Cannot focus light"],
          answerIndex: 1,
        },
      ],
      "maths-calculus": [
        {
          q: "The derivative of a function represents its…",
          options: ["Average value", "Rate of change", "Total distance", "Constant term"],
          answerIndex: 1,
        },
        {
          q: "∫ f(x) dx is the…",
          options: ["Difference", "Integral/accumulation", "Derivative", "Logarithm"],
          answerIndex: 1,
        },
      ],
      "maths-vectors": [
        {
          q: "A vector is defined by…",
          options: ["Magnitude only", "Magnitude and direction", "Direction only", "Neither"],
          answerIndex: 1,
        },
        {
          q: "The dot product of perpendicular vectors is…",
          options: ["1", "0", "-1", "Infinity"],
          answerIndex: 1,
        },
      ],
      "maths-probability": [
        {
          q: "Probability values lie in the range…",
          options: ["0 to 1", "-1 to 1", "1 to 100", "0 to 100"],
          answerIndex: 0,
        },
        {
          q: "If events are independent, then P(A and B) =…",
          options: ["P(A)+P(B)", "P(A)×P(B)", "P(A)-P(B)", "1"],
          answerIndex: 1,
        },
      ],
      "maths-geometry": [
        {
          q: "Distance formula in coordinate geometry gives the…",
          options: ["Length between points", "Slope only", "Area only", "Angle only"],
          answerIndex: 0,
        },
        {
          q: "The slope of a line measures its…",
          options: ["Steepness", "Length", "Area", "Curvature"],
          answerIndex: 0,
        },
      ],
      "chemistry-atomic": [
        {
          q: "The atomic number equals the number of…",
          options: ["Neutrons", "Protons", "Electrons only", "Nucleons"],
          answerIndex: 1,
        },
        {
          q: "Isotopes have the same…",
          options: ["Mass number only", "Number of neutrons", "Atomic number (protons)", "Volume"],
          answerIndex: 2,
        },
      ],
      "chemistry-bonding": [
        {
          q: "An ionic bond forms due to…",
          options: ["Sharing electrons", "Transfer of electrons", "Unequal mass", "Magnetism"],
          answerIndex: 1,
        },
        {
          q: "A covalent bond involves…",
          options: ["Transfer of electrons", "Sharing of electrons", "No electrons", "Only ions"],
          answerIndex: 1,
        },
      ],
      "chemistry-equil": [
        {
          q: "At equilibrium, the…",
          options: ["Reaction stops", "Forward and reverse rates become equal", "Concentrations are always zero", "Temperature is zero"],
          answerIndex: 1,
        },
        {
          q: "Le Chatelier's principle helps predict how a system responds to…",
          options: ["Only pressure changes", "Perturbations (stress)", "Only colors", "No changes"],
          answerIndex: 1,
        },
      ],
      "chemistry-thermo": [
        {
          q: "Thermodynamics primarily studies…",
          options: ["Motion", "Heat and energy transformations", "Electricity only", "Sound"],
          answerIndex: 1,
        },
        {
          q: "A process is exothermic if it…",
          options: ["Absorbs heat", "Releases heat", "Has zero heat", "Always increases temperature"],
          answerIndex: 1,
        },
      ],
    };

    const generic = [
      {
        q: "Spaced repetition helps by…",
        options: ["Remembering less", "Improving long-term recall", "Skipping practice", "Only using notes"],
        answerIndex: 1,
      },
      {
        q: "A review should be taken when it’s…",
        options: ["Random", "Due / scheduled", "Never", "Only after exams"],
        answerIndex: 1,
      },
    ];

    return bank[topicId] || generic;
  }

  function ensureModal() {
    const modal = document.getElementById("reviewModal");
    if (!modal) return null;
    return modal;
  }

  function renderQuiz({ topicId, topicLabel }) {
    const modal = ensureModal();
    if (!modal) return;

    const quiz = getReviewQuiz(topicId);
    const modalTitle = document.getElementById("reviewModalTitle");
    const container = document.getElementById("reviewQuizContainer");
    const msg = document.getElementById("reviewResultMessage");
    const submitBtn = document.getElementById("reviewSubmitBtn");

    if (modalTitle) modalTitle.textContent = `Review: ${topicLabel || topicId}`;
    if (container) {
      container.innerHTML = "";
      container.dataset.topicId = topicId;
    }
    if (msg) msg.textContent = "";

    if (!container) return;

    quiz.forEach((item, idx) => {
      const qWrap = document.createElement("div");
      qWrap.className = "review-question";
      qWrap.style.marginBottom = "20px";

      const h = document.createElement("div");
      h.className = "review-question-text";
      h.style.fontWeight = "bold";
      h.style.fontSize = "1rem";
      h.style.marginBottom = "10px";
      h.style.color = "var(--text-color)";
      h.textContent = `${idx + 1}. ${item.q}`;

      const optionsWrap = document.createElement("div");
      optionsWrap.className = "review-options";
      optionsWrap.style.display = "flex";
      optionsWrap.style.flexDirection = "column";
      optionsWrap.style.gap = "8px";

      item.options.forEach((opt, optIdx) => {
        const label = document.createElement("label");
        label.style.display = "flex";
        label.style.alignItems = "center";
        label.style.gap = "10px";
        label.style.padding = "10px 12px";
        label.style.borderRadius = "6px";
        label.style.background = "var(--progress-item-bg)";
        label.style.border = "1px solid var(--border-color)";
        label.style.cursor = "pointer";
        label.style.transition = "var(--theme-transition)";

        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = `review_q_${idx}`;
        radio.value = String(optIdx);
        radio.style.cursor = "pointer";

        label.appendChild(radio);
        label.appendChild(document.createTextNode(` ${opt}`));

        // Add visual feedback on click/hover
        radio.addEventListener("change", () => {
          optionsWrap.querySelectorAll("label").forEach(l => {
            l.style.borderColor = "var(--border-color)";
            l.style.background = "var(--progress-item-bg)";
          });
          if (radio.checked) {
            label.style.borderColor = "var(--accent-color)";
            label.style.background = "rgba(56, 189, 248, 0.08)";
          }
        });

        optionsWrap.appendChild(label);
      });

      qWrap.appendChild(h);
      qWrap.appendChild(optionsWrap);
      container.appendChild(qWrap);
    });

    if (submitBtn) submitBtn.disabled = false;

    modal.style.display = "block";
  }

  function closeModal() {
    const modal = document.getElementById("reviewModal");
    if (modal) modal.style.display = "none";
  }

  function readQuizAnswers() {
    const container = document.getElementById("reviewQuizContainer");
    if (!container) return { scorePct: 0, correctCount: 0, total: 0, answeredCount: 0 };

    const questions = Array.from(container.querySelectorAll(".review-question"));
    const total = questions.length;

    const topicId = container.dataset.topicId;
    const quiz = getReviewQuiz(topicId);

    let correctCount = 0;
    let answeredCount = 0;

    for (let i = 0; i < total; i++) {
      const qWrap = questions[i];
      const checked = qWrap.querySelector(`input[name="review_q_${i}"]:checked`);
      if (!checked) continue;
      answeredCount += 1;

      const picked = Number(checked.value);
      if (picked === quiz[i].answerIndex) correctCount += 1;
    }

    const scorePct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    return { scorePct, correctCount, total, answeredCount };
  }

  function start(topicId) {
    const topicsList = getTopicsList();
    const foundTopic = topicsList.find(t => t.id === topicId);
    const topicLabel = foundTopic ? foundTopic.label : topicId;

    const modal = ensureModal();
    const container = document.getElementById("reviewQuizContainer");
    if (container) container.dataset.topicId = topicId;

    renderQuiz({ topicId, topicLabel });

    const submitBtn = document.getElementById("reviewSubmitBtn");
    if (submitBtn) {
      submitBtn.onclick = function () {
        // Compute score and update summary
        const { scorePct, correctCount, total, answeredCount } = readQuizAnswers();
        const msg = document.getElementById("reviewResultMessage");
        if (msg) msg.textContent = `Score: ${correctCount}/${total} (${scorePct}%).`;

        // Render detailed per‑question results with an Ask button
        const container = document.getElementById("reviewQuizContainer");
        if (container) {
          container.innerHTML = "";
          const quiz = getReviewQuiz(topicId);
          quiz.forEach((item, idx) => {
            const qDiv = document.createElement("div");
            qDiv.className = "review-question-result";
            qDiv.style.marginBottom = "12px";

            const selected = document.querySelector(`input[name="review_q_${idx}"]:checked`);
            const userIdx = selected ? Number(selected.value) : null;
            const userAns = userIdx !== null ? item.options[userIdx] : "<em>No answer</em>";
            const correct = userIdx === item.answerIndex;

            qDiv.innerHTML = `
              <div><strong>Q${idx + 1}:</strong> ${item.q}</div>
              <div>Your answer: ${userAns} ${correct ? "✅" : "❌"}</div>
              <div>Correct answer: ${item.options[item.answerIndex]}</div>
            `;

            const askBtn = document.createElement("button");
            askBtn.textContent = "Ask about this question";
            askBtn.className = "action-btn";
            askBtn.style.marginTop = "6px";
            askBtn.onclick = () => {
              fetch("/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: `Help me understand this question: ${item.q}` })
              })
                .then(res => res.json())
                .then(data => {
                  alert(data.reply || "No reply");
                })
                .catch(err => {
                  console.error(err);
                  alert("Error contacting chatbot");
                });
            };
            qDiv.appendChild(askBtn);
            container.appendChild(qDiv);
          });
        }

        // Persist the review result
        recordReviewResult({ topicId, scorePct, answeredCount });

        // Disable button to prevent double submission
        submitBtn.disabled = true;
        setTimeout(() => {
          closeModal();
          window.dispatchEvent(new Event("review-saved"));
        }, 800);
      };
    }
  }

  // ─── Dashboard Render Logic ────────────────────────────────────────────────
  function initDashboard() {
    const dueListEl = document.getElementById("due-list");
    if (!dueListEl) return; // Not on review.html

    const schedule = loadSchedule();
    const today = _todayLocalISODate();
    const todayToken = _parseISODateToUTCStart(today);

    let progressMap = {};
    try {
      progressMap = JSON.parse(localStorage.getItem("learnsphere_progress")) || {};
    } catch {}

    const topicsList = getTopicsList();
    const dueTopics = [];
    const upcomingTopics = [];

    topicsList.forEach(topic => {
      const s = schedule[topic.id];
      const prog = progressMap[topic.id] || "not-started";

      if (s && s.nextReviewDate) {
        const nextToken = _parseISODateToUTCStart(s.nextReviewDate);
        if (todayToken >= nextToken) {
          dueTopics.push({ topic, schedule: s, isDue: true });
        } else {
          upcomingTopics.push({ topic, schedule: s, isDue: false });
        }
      } else {
        // Never reviewed: if completed or in-progress, consider it due today
        if (prog === "completed" || prog === "in-progress") {
          dueTopics.push({ topic, schedule: null, isDue: true });
        } else {
          upcomingTopics.push({ topic, schedule: null, isDue: false });
        }
      }
    });

    // Sort upcoming: scheduled ones first (sorted by soonest date), unscheduled last
    upcomingTopics.sort((a, b) => {
      if (a.schedule && b.schedule) {
        return _parseISODateToUTCStart(a.schedule.nextReviewDate) - _parseISODateToUTCStart(b.schedule.nextReviewDate);
      }
      if (a.schedule) return -1;
      if (b.schedule) return 1;
      return 0;
    });

    // Render Stats
    const statsDueEl = document.getElementById("stats-due-count");
    if (statsDueEl) statsDueEl.textContent = String(dueTopics.length);

    let totalScore = 0;
    let reviewedCount = 0;
    for (const id in schedule) {
      const s = schedule[id];
      if (s && typeof s.lastScorePct === "number" && s.lastReviewedAt) {
        totalScore += s.lastScorePct;
        reviewedCount += 1;
      }
    }
    const avgAccuracyEl = document.getElementById("stats-accuracy-average");
    if (avgAccuracyEl) {
      avgAccuracyEl.textContent = reviewedCount > 0 ? `${Math.round(totalScore / reviewedCount)}%` : "—";
    }

    const history = loadHistory();
    const totalReviewsEl = document.getElementById("stats-total-reviews");
    if (totalReviewsEl) totalReviewsEl.textContent = String(history.length);

    // Render Due Today List
    dueListEl.innerHTML = "";
    if (dueTopics.length === 0) {
      dueListEl.innerHTML = `
        <div class="empty-state">
          <span class="empty-state-icon">🎉</span>
          No reviews due today! Keep up the good work.
        </div>
      `;
    } else {
      dueTopics.forEach(({ topic, schedule: s }) => {
        const item = document.createElement("div");
        item.className = "review-item";
        
        let metaText = "Never reviewed";
        if (s && s.lastReviewedAt) {
          metaText = `Last reviewed: ${s.lastReviewedAt} (${s.lastScorePct}% score)`;
        }

        item.innerHTML = `
          <div class="item-details">
            <div class="item-title">${topic.label}</div>
            <div class="item-meta">
              <span class="badge-subject">${topic.subject}</span>
              <span>•</span>
              <span>${metaText}</span>
            </div>
          </div>
          <div class="item-actions">
            <button class="action-btn skip" data-id="${topic.id}" title="Postpone review by 2 days">Skip for now</button>
            <button class="action-btn start" data-id="${topic.id}">Review Now</button>
          </div>
        `;

        // Bind buttons
        item.querySelector(".action-btn.start").addEventListener("click", () => {
          start(topic.id);
        });
        item.querySelector(".action-btn.skip").addEventListener("click", () => {
          skipTopic(topic.id);
        });

        dueListEl.appendChild(item);
      });
    }

    // Render Upcoming List
    const upcomingListEl = document.getElementById("upcoming-list");
    if (upcomingListEl) {
      upcomingListEl.innerHTML = "";
      if (upcomingTopics.length === 0) {
        upcomingListEl.innerHTML = `
          <div class="empty-state">
            No reviews scheduled yet. Complete topics to start getting review sessions.
          </div>
        `;
      } else {
        upcomingTopics.forEach(({ topic, schedule: s }) => {
          const item = document.createElement("div");
          item.className = "review-item";
          
          let metaText = "Unscheduled — Start reviewing to build streak";
          let actionText = "Start Review";
          if (s && s.nextReviewDate) {
            const todayToken = _parseISODateToUTCStart(_todayLocalISODate());
            const nextToken = _parseISODateToUTCStart(s.nextReviewDate);
            const delta = nextToken - todayToken;
            const daysLeft = delta <= 0 ? "Today" : `${delta}d`;
            metaText = `Scheduled: Review in ${daysLeft} (${s.nextReviewDate})`;
            actionText = "Review Early";
          }

          item.innerHTML = `
            <div class="item-details">
              <div class="item-title">${topic.label}</div>
              <div class="item-meta">
                <span class="badge-subject">${topic.subject}</span>
                <span>•</span>
                <span>${metaText}</span>
              </div>
            </div>
            <div class="item-actions">
              <button class="action-btn start" style="background:var(--btn-secondary-bg); color:var(--text-color); border:1px solid var(--border-color);" data-id="${topic.id}">${actionText}</button>
            </div>
          `;

          item.querySelector(".action-btn.start").addEventListener("click", () => {
            start(topic.id);
          });

          upcomingListEl.appendChild(item);
        });
      }
    }

    // Render Timeline / History List
    const historyListEl = document.getElementById("history-list");
    if (historyListEl) {
      historyListEl.innerHTML = "";
      if (history.length === 0) {
        historyListEl.innerHTML = `
          <div class="empty-state" style="padding: 15px 0;">
            No reviews completed yet. Start review on a topic to see history.
          </div>
        `;
        historyListEl.style.borderLeft = "none";
        historyListEl.style.paddingLeft = "0";
      } else {
        historyListEl.style.borderLeft = "2px solid var(--border-color)";
        historyListEl.style.paddingLeft = "20px";
        history.forEach(item => {
          const found = topicsList.find(t => t.id === item.topicId);
          const label = found ? found.label : item.topicId;

          const event = document.createElement("div");
          event.className = "timeline-event";

          const pct = item.scorePct;
          let color = "var(--completed-color)";
          if (pct < 50) color = "#ef4444";
          else if (pct < 80) color = "var(--in-progress-color)";

          event.innerHTML = `
            <div class="event-time">${item.reviewedAt}</div>
            <div class="event-content">
              <div class="event-title">${label}</div>
              <div class="event-stats">
                <span>Score: <span class="event-score" style="color: ${color}">${pct}%</span></span>
                <span>Questions: ${item.answeredCount}</span>
              </div>
            </div>
          `;

          historyListEl.appendChild(event);
        });
      }
    }
  }

  // ─── DOM Hooks ─────────────────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", async () => {
    // Ensure we have the authoritative TOPICS registry from progress.js.
    // This prevents label/subject divergence when script load order fails.
    const topicsList = await waitForTopicsList();

    if (!topicsList) {
      // Render nothing rather than risking divergent metadata.
      // (Buttons also require TOPICS to label/subject correctly.)
      return;
    }

    initDashboard();

    // Check if query parameter `topic` is present (to auto-start quiz)
    const urlParams = new URLSearchParams(window.location.search);
    const startTopic = urlParams.get("topic");
    if (startTopic) {
      // Clear topic query parameter from address bar history without reloading
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);

      // Short delay to let animations complete
      setTimeout(() => {
        start(startTopic);
      }, 300);
    }
  });


  // Re-render dashboard whenever a review or skip happens
  window.addEventListener("review-saved", () => {
    initDashboard();
  });

  window.ReviewMode = {
    start,
    closeModal,
    skipTopic,
    initDashboard
  };
})();
