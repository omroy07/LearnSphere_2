const questions = [
    { difficulty: "easy", question: "What is the SI unit of speed?", options: ["m/s", "km/h", "m/s²", "N"], answer: "m/s" },
    { difficulty: "easy", question: "What causes an object to accelerate?", options: ["Mass", "Force", "Friction", "Temperature"], answer: "Force" },
    { difficulty: "medium", question: "Which of these is a scalar quantity?", options: ["Velocity", "Acceleration", "Displacement", "Speed"], answer: "Speed" },
    { difficulty: "medium", question: "What does Newton's First Law state?", options: ["F = ma", "Action = Reaction", "Objects stay in motion/rest unless acted on", "Momentum is conserved"], answer: "Objects stay in motion/rest unless acted on" },
    { difficulty: "hard", question: "What is the formula for acceleration?", options: ["v/t", "d/t", "Δv/t", "F/m"], answer: "Δv/t" }
];

let adaptiveQuiz = null;
let adaptiveSteps = [];
let currentStepIndex = 0;
let score = 0;
let selectedOption = null;
let userSelectionsByStep = [];
let lastFocusedEl = null;


function getSrStatus() {
    return document.getElementById("sr-status");
}

function announce(message) {
    const el = getSrStatus();
    if (!el) return;
    el.textContent = message;
}

function focusMainResultHeading() {
    const heading = document.getElementById("result-title");
    if (heading) heading.focus();
}

function currentQuestion() {
    return adaptiveSteps[currentStepIndex];
}

function loadQuestion() {
    lastFocusedEl = document.activeElement;

    const questionData = currentQuestion();
    if (!questionData) return;

    document.getElementById("question").textContent = questionData.question;

    let optionsContainer = document.getElementById("options");
    optionsContainer.innerHTML = "";

    let fragment = document.createDocumentFragment();
    questionData.options.forEach(option => {
        let btn = document.createElement("button");
        btn.classList.add("option");
        btn.type = "button";
        btn.textContent = option;

        btn.setAttribute("role", "radio");
        btn.setAttribute("aria-checked", "false");

        

        fragment.appendChild(btn);
    });
    optionsContainer.appendChild(fragment);

    selectedOption = userSelectionsByStep[currentStepIndex] || null;

    // Reflect selected option back into UI if navigating back.
    if (selectedOption) {
        document.querySelectorAll(".option").forEach(btn => {
            const t = btn.textContent;
            if (t === selectedOption) {
                btn.classList.add("selected");
                btn.setAttribute("aria-checked", "true");
            }
        });
    }

    const lastStep = adaptiveSteps.length - 1;
    document.getElementById("next-btn").disabled = !selectedOption;
    document.getElementById("prev-btn").disabled = currentStepIndex === 0;
    document.getElementById("submit-btn").classList.toggle("hidden", currentStepIndex !== lastStep);
    document.getElementById("next-btn").classList.toggle("hidden", currentStepIndex === lastStep);

    updateProgressBar();

    announce(`Question ${currentStepIndex + 1} of ${adaptiveSteps.length}. ${questionData.question}`);
}


function selectOption(button, option) {
    document.querySelectorAll(".option").forEach(btn => {
        btn.classList.remove("selected");
        btn.setAttribute("aria-checked", "false");
    });

    button.classList.add("selected");
    button.setAttribute("aria-checked", "true");

    selectedOption = option;

    userSelectionsByStep[currentStepIndex] = option;

    document.getElementById("next-btn").disabled = false;
    announce(`Selected: ${option}`);
}

function nextQuestion() {
    if (!selectedOption) {
        showPopup();
        return;
    }

    const q = currentQuestion();
    const isCorrect = selectedOption === q.answer;
    if (isCorrect) score++;

    userAnswers[currentStepIndex] = isCorrect;

    announce(isCorrect ? "Correct answer." : "Incorrect answer.");

    if (adaptiveQuiz) {
        adaptiveQuiz.updateDifficulty({ isCorrect });
        if (currentStepIndex + 1 < adaptiveSteps.length) {
            adaptiveSteps[currentStepIndex + 1] = adaptiveQuiz.takeNext();
        }
    }

    currentStepIndex++;
    if (currentStepIndex < adaptiveSteps.length) {
        loadQuestion();
    } else {
        showResults();
    }
}

function prevQuestion() {
    currentStepIndex--;
    selectedOption = userSelectionsByStep[currentStepIndex] || null;
    loadQuestion();
}


function confirmSubmit() {
    lastFocusedEl = document.activeElement;
    document.getElementById("confirm-popup").style.display = "block";

    const yesBtn = document.getElementById("confirm-yes");
    if (yesBtn) yesBtn.focus();
}

function submitQuiz() {
    if (!selectedOption) {
        showPopup();
        return;
    }

    const isCorrect = selectedOption === questions[currentQuestionIndex].answer;
    if (isCorrect) score++;

    announce(isCorrect ? "Correct answer." : "Incorrect answer.");

    document.getElementById("confirm-popup").style.display = "none";
    showResults();
}

function restartQuiz() {
    // reset adaptive session state
    currentStepIndex = 0;
    score = 0;
    selectedOption = null;
    userAnswers = new Array(adaptiveSteps.length).fill(null);
    userSelectionsByStep = new Array(adaptiveSteps.length).fill(null);

    document.getElementById("quiz-box").classList.remove("hidden");
    document.getElementById("result-box").classList.add("hidden");

    document.getElementById("progress-bar").style.width = "0%";

    startAdaptiveSession();
    loadQuestion();

    setTimeout(() => {
        const firstOption = document.querySelector("#options .option");
        if (firstOption) firstOption.focus();
    }, 0);
}


function showPopup() {
    lastFocusedEl = document.activeElement;
    document.getElementById("popup").style.display = "block";

    const okBtn = document.getElementById("popup-ok");
    if (okBtn) okBtn.focus();
}

function closePopup() {
    document.getElementById("popup").style.display = "none";
    if (lastFocusedEl && typeof lastFocusedEl.focus === "function") lastFocusedEl.focus();
}

function closeConfirmPopup() {
    document.getElementById("confirm-popup").style.display = "none";
    if (lastFocusedEl && typeof lastFocusedEl.focus === "function") lastFocusedEl.focus();
}

function showResults() {
    const finishAt = Date.now();
    const totalQuestions = adaptiveSteps.length;
    const totalScore = score;
    const correctCount = score;
    const startAt = window.__quizMotionStartedAt || finishAt;
    const timeTakenMs = Math.max(0, finishAt - startAt);

    try {
        if (window.quizProgress && typeof window.quizProgress.recordAttemptCanonical === 'function' && window.quizModel && typeof window.quizModel.buildCanonicalAttemptFromLegacyGlobals === 'function') {
            const canonical = window.quizModel.buildCanonicalAttemptFromLegacyGlobals({
                topicId: "physics-motion",
                quizId: "quiz:motion",
                questionType: "mcq-single",
                startedAt: window.__quizMotionStartedAt || null,
                finishedAt: finishAt,
                timeTakenMs,
            });
            canonical.attempt.startedAt = window.__quizMotionStartedAt || null;
            canonical.attempt.finishedAt = finishAt;
            window.quizProgress.recordAttemptCanonical(canonical);
        } else if (window.quizProgress && typeof window.quizProgress.recordAttempt === 'function') {
            window.quizProgress.recordAttempt({
                topicId: "physics-motion",
                score: totalScore,
                totalQuestions,
                correctCount,
                timeTakenMs,
                quizId: "quiz:motion",
            });
        }
    } catch (e) {
        console.warn("LearnSphere: Failed to record quiz progress", e);
    }

    document.getElementById("quiz-box").classList.add("hidden");
    document.getElementById("result-box").classList.remove("hidden");

    let scoreText = `You scored <strong>${totalScore}</strong> out of ${totalQuestions}! 🎉`;
    let feedbackHTML = "";

    adaptiveSteps.forEach((q, index) => {
        let userAnswer = userSelectionsByStep[index] || "No answer selected";
        let isCorrect = userAnswer === q.answer;

        feedbackHTML += `
            <div class="${isCorrect ? "correct" : "incorrect"}">
                <p><strong>Q${index + 1}:</strong> ${q.question}</p>
                <p>Your answer: <strong class="${isCorrect ? "correct-answer" : "wrong-answer"}">${userAnswer}</strong></p>
                ${isCorrect ? `<p>✅ Correct!</p>` : `<p>❌ Incorrect! </p> <p class="correct-answer"> The correct answer is: <strong class="correct-answer">${q.answer}</strong></p>`}
                <hr>
            </div>
        `;
    });

    document.getElementById("score").innerHTML = scoreText + "<br><br>" + feedbackHTML;

    announce(`Quiz completed. Score: ${totalScore} out of ${totalQuestions}.`);
    focusMainResultHeading();
}


function startAdaptiveSession() {
    let startingDi = 1;
    try {
        if (window.quizProgress && typeof window.quizProgress.getTopicStats === "function") {
            const stats = window.quizProgress.getTopicStats("physics-motion");
            const accuracy = stats?.questionsTotal > 0 ? stats.correctTotal / stats.questionsTotal : null;
            if (window.getStartingDifficultyFromAccuracy) {
                startingDi = window.getStartingDifficultyFromAccuracy({ accuracy });
            }
        }
    } catch (e) {
        // ignore
    }

    if (!window.createAdaptiveQuiz) {
        adaptiveQuiz = null;
        adaptiveSteps = questions.map(q => ({ ...q }));
        currentStepIndex = 0;
        userAnswers = new Array(adaptiveSteps.length).fill(null);
        userSelectionsByStep = new Array(adaptiveSteps.length).fill(null);
        return;
    }

    adaptiveQuiz = window.createAdaptiveQuiz({ questions, startingDifficultyIndex: startingDi });
    adaptiveSteps = new Array(questions.length).fill(null);
    currentStepIndex = 0;
    userAnswers = new Array(questions.length).fill(null);
    userSelectionsByStep = new Array(questions.length).fill(null);

    adaptiveSteps[0] = adaptiveQuiz.takeNext();
}

document.addEventListener('DOMContentLoaded', () => {
    const optContainer = document.getElementById("options");
    if (optContainer && !optContainer.dataset.delegated) {
        optContainer.dataset.delegated = "true";
        optContainer.addEventListener("click", (e) => {
            if (e.target.classList.contains("option")) {
                selectOption(e.target, e.target.textContent);
            }
        });
    }

    window.__quizMotionStartedAt = Date.now();
    // Initialize accessibility utilities
    if (window.initQuizAccessibility) {
        window.initQuizAccessibility();
    }
    document.getElementById('progress-bar').style.width = "0%";
    startAdaptiveSession();
    loadQuestion();
});
