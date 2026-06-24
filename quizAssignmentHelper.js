/**
 * quizAssignmentHelper.js
 * Automatically intercepts quiz completion for all 12 quizzes in LearnSphere.
 * - Handles assignment submission if ?assignment=<id> is in the URL.
 * - Automatically records practice attempts for non-motion/non-nlm quizzes.
 * - Triggers achievement unlocks and toast notifications.
 */
(function () {
    'use strict';

    const START_TIME = Date.now();

    function getStudentName() {
        try {
            const user = JSON.parse(localStorage.getItem("user"));
            return user && user.fullname ? user.fullname : "Guest Learner";
        } catch (e) {
            return "Guest Learner";
        }
    }

    function getStudentEmail() {
        try {
            const user = JSON.parse(localStorage.getItem("user"));
            return user && user.email ? user.email : "guest@learnsphere.com";
        } catch (e) {
            return "guest@learnsphere.com";
        }
    }

    function getTopicIdFromPath() {
        const path = window.location.pathname.toLowerCase();
        if (path.includes("motion")) return "physics-motion";
        if (path.includes("nlm")) return "physics-nlm";
        if (path.includes("projectile")) return "physics-projectile";
        if (path.includes("ray")) return "physics-ray";
        if (path.includes("calculus")) return "maths-calculus";
        if (path.includes("geometry")) return "maths-geometry";
        if (path.includes("probability")) return "maths-probability";
        if (path.includes("vector")) return "maths-vectors";
        if (path.includes("atomic")) return "chemistry-atomic";
        if (path.includes("bonding")) return "chemistry-bonding";
        if (path.includes("equilibrium")) return "chemistry-equil";
        if (path.includes("thermo")) return "chemistry-thermo";
        return null;
    }

    function recordSubmission(assignmentId, score, totalQuestions) {
        try {
            const submissions = JSON.parse(localStorage.getItem("learnsphere_assignment_submissions")) || [];
            const studentEmail = getStudentEmail();
            const existingIdx = submissions.findIndex(s => s.assignmentId === assignmentId && s.studentEmail === studentEmail);
            
            const newSubmission = {
                assignmentId: assignmentId,
                studentName: getStudentName(),
                studentEmail: studentEmail,
                score: score,
                totalQuestions: totalQuestions,
                timestamp: new Date().toISOString()
            };

            if (existingIdx !== -1) {
                submissions[existingIdx] = newSubmission;
            } else {
                submissions.push(newSubmission);
            }

            localStorage.setItem("learnsphere_assignment_submissions", JSON.stringify(submissions));
            console.log("LearnSphere: Assignment submission recorded successfully", newSubmission);
        } catch (e) {
            console.warn("LearnSphere: Failed to record assignment submission", e);
        }
    }

    function handleQuizCompletion(scoreVal, totalQsVal) {
        const urlParams = new URLSearchParams(window.location.search);
        const assignmentId = urlParams.get('assignment');

        const topicId = getTopicIdFromPath();
        const timeTakenMs = Date.now() - START_TIME;

        // 1. Record practice attempt if this quiz doesn't do it itself (motion and nlm quizzes do it themselves)
        if (topicId && topicId !== "physics-motion" && topicId !== "physics-nlm") {
            if (window.quizProgress && typeof window.quizProgress.recordAttempt === 'function') {
                const quizSubId = topicId.split("-")[1];
                window.quizProgress.recordAttempt({
                    topicId: topicId,
                    score: scoreVal,
                    totalQuestions: totalQsVal,
                    correctCount: scoreVal,
                    timeTakenMs: timeTakenMs,
                    quizId: "quiz:" + quizSubId
                });
                console.log(`LearnSphere: Practice attempt logged for topic: ${topicId}`);
            }
        }

        // 2. Record assignment submission if in assignment mode
        if (assignmentId) {
            recordSubmission(assignmentId, scoreVal, totalQsVal);
        }

        // 3. Trigger achievements check and show toast alerts for any newly unlocked badges
        setTimeout(() => {
            if (window.achievements && typeof window.achievements.checkAndNotify === 'function') {
                window.achievements.checkAndNotify();
            }
        }, 300);
    }

    function wrapShowResults(originalShowResults) {
        return function () {
            // Call original function first
            if (typeof originalShowResults === 'function') {
                originalShowResults.apply(this, arguments);
            }

            setTimeout(() => {
                let finalScore = null;
                let totalQs = null;

                // 1. Try to read from DOM (#score)
                const scoreEl = document.getElementById("score");
                if (scoreEl) {
                    const text = scoreEl.textContent;
                    const match = text.match(/scored\s+(\d+)\s+out of\s+(\d+)/i);
                    if (match) {
                        finalScore = parseInt(match[1], 10);
                        totalQs = parseInt(match[2], 10);
                    }
                }

                // 2. Fallback to global variables
                if (finalScore === null || isNaN(finalScore)) {
                    if (typeof window.score === 'number') {
                        finalScore = window.score;
                    } else if (typeof score === 'number') {
                        finalScore = score;
                    }
                }
                if (totalQs === null || isNaN(totalQs)) {
                    if (window.questions && Array.isArray(window.questions)) {
                        totalQs = window.questions.length;
                    } else if (window.adaptiveSteps && Array.isArray(window.adaptiveSteps)) {
                        totalQs = window.adaptiveSteps.length;
                    } else if (typeof questions !== 'undefined' && Array.isArray(questions)) {
                        totalQs = questions.length;
                    } else if (typeof adaptiveSteps !== 'undefined' && Array.isArray(adaptiveSteps)) {
                        totalQs = adaptiveSteps.length;
                    } else {
                        totalQs = 5;
                    }
                }

                if (finalScore !== null && !isNaN(finalScore)) {
                    handleQuizCompletion(finalScore, totalQs);
                    injectExplainMistakeButtons();
                    injectSessionSummary();
                } else {
                    console.warn("LearnSphere: Could not determine final score for submission / tracking.");
                }
            }, 100);
        };
    }

    function explainMistake(question, userAnswer, correctAnswer) {
        const topicId = getTopicIdFromPath();
        const payload = {
            question: question,
            userAnswer: userAnswer,
            correctAnswer: correctAnswer,
            topicId: topicId
        };
        localStorage.setItem("learnsphere_pending_explanation", JSON.stringify(payload));
        
        // Find path prefix
        const path = window.location.pathname;
        let prefix = "./";
        if (path.includes("/quiz/") || path.includes("/mathsquiz/") || path.includes("/chemistryquiz/") || path.includes("/sub/")) {
            prefix = "../";
        }
        window.location.href = prefix + "home.html?explain_mistake=true";
    }

    function injectExplainMistakeButtons() {
        const incorrectDivs = document.querySelectorAll("#score .incorrect, #score div.incorrect, .incorrect");
        incorrectDivs.forEach(div => {
            if (div.querySelector(".explain-mistake-btn")) return; // already injected

            const paragraphs = div.querySelectorAll("p");
            let question = "";
            let userAnswer = "";
            let correctAnswer = "";

            if (paragraphs.length > 0) {
                // First paragraph is usually the question
                question = paragraphs[0].textContent.replace(/^Q\d+:\s*/i, "").trim();
            }

            paragraphs.forEach(p => {
                if (p.textContent.toLowerCase().includes("your answer:")) {
                    const strong = p.querySelector("strong");
                    userAnswer = strong ? strong.textContent.trim() : p.textContent.replace(/your answer:/i, "").trim();
                }
                if (p.textContent.toLowerCase().includes("correct answer is:")) {
                    const strong = p.querySelector("strong");
                    correctAnswer = strong ? strong.textContent.trim() : p.textContent.replace(/the correct answer is:/i, "").trim();
                }
            });

            if (!question || !userAnswer || !correctAnswer) return;

            const btn = document.createElement("button");
            btn.className = "explain-mistake-btn";
            btn.type = "button";
            btn.innerHTML = `<i class="fa-solid fa-robot"></i> Ask AI to explain my mistake`;
            
            // Premium aesthetics styling
            btn.style.marginTop = "12px";
            btn.style.marginBottom = "8px";
            btn.style.padding = "8px 16px";
            btn.style.borderRadius = "6px";
            btn.style.border = "1px solid var(--accent-color)";
            btn.style.background = "rgba(56, 189, 248, 0.08)";
            btn.style.color = "var(--accent-color)";
            btn.style.fontWeight = "bold";
            btn.style.cursor = "pointer";
            btn.style.display = "inline-flex";
            btn.style.alignItems = "center";
            btn.style.gap = "8px";
            btn.style.fontSize = "0.88rem";
            btn.style.fontFamily = "inherit";
            btn.style.transition = "all 0.2s ease";

            btn.addEventListener("mouseenter", () => {
                btn.style.background = "var(--accent-color)";
                btn.style.color = "white";
                btn.style.transform = "scale(1.02)";
            });

            btn.addEventListener("mouseleave", () => {
                btn.style.background = "rgba(56, 189, 248, 0.08)";
                btn.style.color = "var(--accent-color)";
                btn.style.transform = "scale(1)";
            });

            btn.addEventListener("click", () => {
                explainMistake(question, userAnswer, correctAnswer);
            });

            // Insert before the last <hr> if present
            const hr = div.querySelector("hr");
            if (hr) {
                div.insertBefore(btn, hr);
            } else {
                div.appendChild(btn);
            }
        });
    }

    function init() {
        // Normalize questions (convert integer index answers to string options)
        if (window.questions && Array.isArray(window.questions)) {
            window.questions.forEach(q => {
                if (typeof q.answer === 'number' && Array.isArray(q.options)) {
                    q.answer = q.options[q.answer];
                }
            });
        }

        const topicId = getTopicIdFromPath();
        if (topicId) {
            injectStartScreenStyles();
            showStartScreen();
        }

        const originalShowResults = window.showResults;
        if (typeof originalShowResults === 'function') {
            window.showResults = wrapShowResults(originalShowResults);
            console.log("LearnSphere: Hooked into global showResults function.");
        } else {
            let checkCount = 0;
            const checkInterval = setInterval(() => {
                checkCount++;
                if (typeof window.showResults === 'function' && window.showResults !== window._wrappedShowResults) {
                    clearInterval(checkInterval);
                    
                    // Normalize dynamically loaded questions as well
                    if (window.questions && Array.isArray(window.questions)) {
                        window.questions.forEach(q => {
                            if (typeof q.answer === 'number' && Array.isArray(q.options)) {
                                q.answer = q.options[q.answer];
                            }
                        });
                    }

                    window.showResults = wrapShowResults(window.showResults);
                    window._wrappedShowResults = window.showResults;
                    console.log("LearnSphere: Hooked into dynamically loaded showResults function.");
                }
                if (checkCount > 30) clearInterval(checkInterval); // stop checking after 3s
            }, 100);
        }
    }

    function injectStartScreenStyles() {
        const style = document.createElement("style");
        style.textContent = `
            .quiz-start-card {
                background: #0f1115;
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 12px;
                padding: 24px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                text-align: center;
                max-width: 500px;
                margin: 40px auto;
            }
            .mode-option-card {
                background: rgba(255, 255, 255, 0.02);
                border: 1px solid rgba(255, 255, 255, 0.06);
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 16px;
                cursor: pointer;
                text-align: left;
                display: flex;
                align-items: center;
                gap: 12px;
                transition: all 0.2s ease;
            }
            .mode-option-card:hover {
                background: rgba(255, 255, 255, 0.04);
                border-color: rgba(102, 252, 241, 0.3);
            }
            .mode-option-card.selected {
                background: rgba(102, 252, 241, 0.06);
                border-color: #66fcf1;
            }
            .mode-radio {
                accent-color: #66fcf1;
                width: 18px;
                height: 18px;
            }
            .start-btn {
                background: #0284c7;
                color: #fff;
                border: none;
                border-radius: 8px;
                padding: 12px 24px;
                font-size: 1rem;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);
                width: 100%;
            }
            .start-btn:hover {
                transform: scale(1.02);
                background: #0369a1;
            }
        `;
        document.head.appendChild(style);
    }

    function showStartScreen() {
        const quizBox = document.getElementById("quiz-box");
        if (!quizBox) return;

        // Hide quiz box initially
        quizBox.style.display = "none";

        // Create start screen
        const startScreen = document.createElement("div");
        startScreen.id = "quiz-start-screen";
        startScreen.className = "quiz-start-card";

        const topicId = getTopicIdFromPath();
        let topicLabel = "Practice Quiz";
        if (window.quizProgress && topicId) {
            const t = window.quizProgress.QUIZ_TOPICS.find(x => x.id === topicId);
            if (t) topicLabel = t.label;
        }

        startScreen.innerHTML = `
            <h2 style="margin-top: 0; color: #fff; font-size: 1.6rem;">${topicLabel} 🎯</h2>
            <p class="muted" style="font-size: 0.9rem; margin-bottom: 24px; color: rgba(255,255,255,0.72)">Choose your quiz mode below to begin.</p>
            
            <div class="mode-option-card selected" id="standard-mode-card">
                <input type="radio" name="quiz-mode" id="mode-standard" class="mode-radio" checked style="cursor:pointer">
                <div style="flex: 1;">
                    <label for="mode-standard" style="font-weight: bold; color: #fff; cursor: pointer; display:block; margin-bottom: 4px;">Standard Mode</label>
                    <span style="font-size: 0.8rem; color: rgba(255,255,255,0.65);">Practice concepts in default difficulty progression.</span>
                </div>
            </div>
            
            <div class="mode-option-card" id="weakness-mode-card">
                <input type="radio" name="quiz-mode" id="mode-weakness" class="mode-radio" style="cursor:pointer">
                <div style="flex: 1;">
                    <label for="mode-weakness" style="font-weight: bold; color: #fff; cursor: pointer; display:block; margin-bottom: 4px;">Practice Mode: Weakness Focus</label>
                    <span style="font-size: 0.8rem; color: rgba(255,255,255,0.65);">Adapts questions dynamically to focus on your weakest concepts.</span>
                </div>
            </div>
            
            <button class="start-btn" id="start-quiz-action-btn" style="margin-top: 8px;">Start Quiz ➔</button>
        `;

        quizBox.parentNode.insertBefore(startScreen, quizBox);

        const stdCard = startScreen.querySelector("#standard-mode-card");
        const weakCard = startScreen.querySelector("#weakness-mode-card");
        const stdRadio = startScreen.querySelector("#mode-standard");
        const weakRadio = startScreen.querySelector("#mode-weakness");

        stdCard.addEventListener("click", () => {
            stdRadio.checked = true;
            stdCard.classList.add("selected");
            weakCard.classList.remove("selected");
        });

        weakCard.addEventListener("click", () => {
            weakRadio.checked = true;
            weakCard.classList.add("selected");
            stdCard.classList.remove("selected");
        });

        startScreen.querySelector("#start-quiz-action-btn").addEventListener("click", () => {
            const isWeakness = weakRadio.checked;
            window.isWeaknessFocusMode = isWeakness;

            startScreen.remove();
            quizBox.style.display = "";

            if (isWeakness) {
                if (window.questions && Array.isArray(window.questions) && window.quizProgress && typeof window.quizProgress.getQuestionWeaknessWeight === 'function') {
                    window.questions.sort((a, b) => {
                        const weightA = window.quizProgress.getQuestionWeaknessWeight(a);
                        const weightB = window.quizProgress.getQuestionWeaknessWeight(b);
                        return weightB - weightA;
                    });
                }
                if (typeof window.restartQuiz === 'function') {
                    window.restartQuiz();
                }
            }
        });
    }

    function injectSessionSummary() {
        const scoreEl = document.getElementById("score");
        if (!scoreEl) return;

        let resolvedQuestions = [];
        let resolvedAnswers = [];
        if (window.adaptiveSteps && window.adaptiveSteps.length > 0) {
            resolvedQuestions = window.adaptiveSteps;
            resolvedAnswers = window.userSelectionsByStep || [];
        } else if (window.questions && window.questions.length > 0) {
            resolvedQuestions = window.questions;
            resolvedAnswers = window.userAnswers || [];
        }

        const improvedSkills = new Set();
        resolvedQuestions.forEach((q, idx) => {
            const ans = resolvedAnswers[idx];
            if (ans !== undefined && ans !== null) {
                const correctOption = typeof q.answer === 'number' && Array.isArray(q.options) ? q.options[q.answer] : q.answer;
                const isCorrect = ans === correctOption;
                if (isCorrect) {
                    const taxonomy = window.quizProgress?.SKILL_TAXONOMY;
                    const tax = taxonomy ? taxonomy[q.question?.trim()] : null;
                    if (tax) {
                        improvedSkills.add(tax.label);
                    }
                }
            }
        });

        let nextRecText = "";
        let nextRecUrl = "";
        if (window.quizProgress && typeof window.quizProgress.getWeakestSkills === 'function') {
            const weak = window.quizProgress.getWeakestSkills({ limit: 1 });
            if (weak && weak.length > 0) {
                nextRecText = weak[0].label;
                nextRecUrl = weak[0].quizUrl;
            }
        }

        const summaryContainer = document.createElement("div");
        summaryContainer.className = "session-summary-card";
        summaryContainer.style.marginTop = "20px";
        summaryContainer.style.padding = "16px";
        summaryContainer.style.borderRadius = "12px";
        summaryContainer.style.background = "rgba(255, 255, 255, 0.03)";
        summaryContainer.style.border = "1px solid rgba(255, 255, 255, 0.08)";
        summaryContainer.style.textAlign = "left";

        let improvedHtml = "";
        if (improvedSkills.size > 0) {
            improvedHtml = `
                <h4 style="margin: 0 0 8px 0; color: #66fcf1; font-size: 1rem; display:flex; align-items:center; gap:6px;">
                    Concepts Improved
                </h4>
                <ul style="margin: 0 0 16px 0; padding-left: 20px; font-size: 0.9rem; line-height: 1.4; color: rgba(255,255,255,0.8);">
                    ${Array.from(improvedSkills).map(skill => `<li>${skill}</li>`).join("")}
                </ul>
            `;
        } else {
            improvedHtml = `
                <h4 style="margin: 0 0 16px 0; color: #ff5e5e; font-size: 1rem;">
                    No concepts improved this session. Keep practicing to level up!
                </h4>
            `;
        }

        let recHtml = "";
        if (nextRecText) {
            const path = window.location.pathname;
            let prefix = "./";
            if (path.includes("/quiz/") || path.includes("/mathsquiz/") || path.includes("/chemistryquiz/") || path.includes("/sub/")) {
                prefix = "../";
            }
            const practiceUrl = nextRecUrl ? prefix + nextRecUrl : "#";

            recHtml = `
                <h4 style="margin: 0 0 8px 0; color: var(--accent-color); font-size: 1rem; display:flex; align-items:center; gap:6px;">
                    Recommended Next Concept
                </h4>
                <p style="margin: 0 0 12px 0; font-size: 0.9rem; color: rgba(255,255,255,0.85);">
                    We recommend focusing on: <strong>${nextRecText}</strong>
                </p>
                ${nextRecUrl ? `
                    <a href="${practiceUrl}" style="
                        display: inline-block;
                        background: var(--accent-color);
                        color: #0f1115;
                        padding: 8px 16px;
                        border-radius: 6px;
                        text-decoration: none;
                        font-size: 0.85rem;
                        font-weight: bold;
                        transition: all 0.2s ease;
                    " onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1)'">
                        Practice Next Concept ➔
                    </a>
                ` : ""}
            `;
        }

        summaryContainer.innerHTML = improvedHtml + recHtml;
        scoreEl.appendChild(summaryContainer);
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
