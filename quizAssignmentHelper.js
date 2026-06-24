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

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
