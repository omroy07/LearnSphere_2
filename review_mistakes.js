(function () {
  const MISSED_KEY = "learnsphere_review_missed_v1";

  function _todayLocalISODate() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function _safeParse(json, fallback) {
    try {
      return JSON.parse(json) || fallback;
    } catch {
      return fallback;
    }
  }

  function loadMissedMap() {
    return _safeParse(localStorage.getItem(MISSED_KEY), {});
  }

  function saveMissedMap(m) {
    try {
      localStorage.setItem(MISSED_KEY, JSON.stringify(m));
    } catch (e) {
      console.warn("LearnSphere: could not save missed map", e);
    }
  }

  function getTopicIdFromQuery() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("topic") || urlParams.get("topicId") || null;
  }

  function buildExplainText(question) {
    if (!question) return "";
    if (typeof question.explanation === "string" && question.explanation.trim()) return question.explanation.trim();
    if (typeof question.explanation === "function") return question.explanation();
    return "";
  }

  function getReviewQuizBankForTopic(topicId) {
    if (window.ReviewMode && typeof window.ReviewMode.__getReviewQuizBank === "function") {
      return window.ReviewMode.__getReviewQuizBank(topicId);
    }
    return null;
  }

  function getMissedQids(topicId) {
    const map = loadMissedMap();
    const entry = map[topicId];
    const qids = entry && Array.isArray(entry.missedQids) ? entry.missedQids : [];
    return qids;
  }

  function setMissedQids(topicId, missedQids) {
    const map = loadMissedMap();
    map[topicId] = {
      ...(map[topicId] || {}),
      missedQids: Array.isArray(missedQids) ? missedQids : [],
      updatedAt: Date.now(),
    };
    saveMissedMap(map);
  }

  function renderList({ topicId, missedQids }) {
    const listEl = document.getElementById("rm-list");
    const totalEl = document.getElementById("rm-total-missed");
    const topicLabelEl = document.getElementById("rm-topic-label");

    if (totalEl) totalEl.textContent = String(missedQids.length);
    if (topicLabelEl) topicLabelEl.textContent = topicId || "—";

    if (!listEl) return;
    listEl.innerHTML = "";

    if (!topicId || missedQids.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <span class="empty-state-icon">🔎</span>
          No missed questions found for this topic.
        </div>
      `;
      return;
    }

    const quizBank = getReviewQuizBankForTopic(topicId) || [];

    // quizBank items expected to have __qid
    const byQid = new Map();
    quizBank.forEach((q) => {
      if (q && typeof q.__qid === "string") byQid.set(q.__qid, q);
    });

    missedQids.forEach((qid, idx) => {
      const q = byQid.get(qid);
      const qText = q?.q || "(Question text unavailable)";
      const correctIndex = typeof q?.answerIndex === "number" ? q.answerIndex : null;
      const correctText =
        correctIndex !== null && Array.isArray(q?.options) ? q.options[correctIndex] : "";

      const item = document.createElement("div");
      item.className = "review-mistake-item";

      item.innerHTML = `
        <div class="review-mistake-q">${idx + 1}. ${qText}</div>
        <div class="review-mistake-meta">
          <span>Correct answer: <strong>${correctText || "—"}</strong></span>
        </div>
        ${q?.explanation ? `<div class="review-mistake-expl">${q.explanation}</div>` : ``}
      `;

      listEl.appendChild(item);
    });
  }

  function initRetryMode({ topicId }) {
    const retryBtn = document.getElementById("rm-retryBtn");
    const retryBtnEnabled = !!retryBtn;

    if (!retryBtnEnabled) return;

    const missedQids = getMissedQids(topicId);
    retryBtn.disabled = missedQids.length === 0;

    retryBtn.addEventListener("click", () => {
      if (!window.ReviewMode || typeof window.ReviewMode.start !== "function") return;

      // Start the review modal in retry-only mode.
      // We pass retryQids; ReviewMode.start will render only missed questions.
      window.ReviewMode.start(topicId, { retryQids: missedQids });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const topicId = getTopicIdFromQuery();

    const missedQids = getMissedQids(topicId);

    renderList({ topicId, missedQids });
    initRetryMode({ topicId });

    const retryBtn = document.getElementById("rm-retryBtn");
    if (retryBtn && missedQids.length > 0) retryBtn.disabled = false;

    // Listen for retry completion: ReviewMode should clear missed after successful retry.
    window.addEventListener("review-mistakes-retried", () => {
      const latestMissed = getMissedQids(topicId);
      renderList({ topicId, missedQids: latestMissed });
      initRetryMode({ topicId });
    });
  });

})();

