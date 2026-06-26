const questions = [
    { difficulty: "easy", question: "What does Newton's First Law state?", options: ["F = ma", "Action = Reaction", "Objects stay in motion/rest unless acted on", "Momentum is conserved"], answer: "Objects stay in motion/rest unless acted on" },
    { difficulty: "easy", question: "Which force is required to change the state of motion of an object?", options: ["Friction", "Gravity", "Applied Force", "Centripetal Force"], answer: "Applied Force" },
    { difficulty: "medium", question: "Newton's Second Law states that force is equal to:", options: ["mass × acceleration", "mass × velocity", "momentum × time", "velocity × time"], answer: "mass × acceleration" },
    { difficulty: "medium", question: "What happens when two equal and opposite forces act on an object?", options: ["The object moves in the direction of the larger force", "The object accelerates", "The object remains in equilibrium", "The object gains momentum"], answer: "The object remains in equilibrium" },
    { difficulty: "medium", question: "According to Newton’s Third Law, what happens when you push on a wall?", options: ["The wall moves", "The wall exerts an equal force back on you", "No force is applied back", "Only you experience the force"], answer: "The wall exerts an equal force back on you" },
    { difficulty: "medium", question: "What is inertia?", options: ["The tendency of an object to resist a change in motion", "The force applied by a moving object", "The acceleration of an object due to gravity", "The energy stored in a moving object"], answer: "The tendency of an object to resist a change in motion" },
    { difficulty: "hard", question: "If an object's mass increases, what happens to the force required to accelerate it?", options: ["Increases", "Decreases", "Remains the same", "Depends on velocity"], answer: "Increases" },
    { difficulty: "hard", question: "Which of the following is an example of Newton’s Third Law?", options: ["A car accelerating when force is applied", "A book resting on a table", "A rocket launching by expelling gases", "An object staying at rest"], answer: "A rocket launching by expelling gases" }
];

let adaptiveQuiz = null;
let adaptiveSteps = [];
let currentStepIndex = 0;
let score = 0;
let selectedOption = null;
let userAnswers = [];
let userSelectionsByStep = [];

let lastFocusedEl = null;

function startAdaptiveSession() {
    // Determine starting difficulty from past topic accuracy.
    let startingDi = 1;
    try {
        if (window.quizProgress && typeof window.quizProgress.getTopicStats === "function") {
            const stats = window.quizProgress.getTopicStats("physics-nlm");
            const accuracy = stats?.questionsTotal > 0 ? stats.correctTotal / stats.questionsTotal : null;
            if (window.getStartingDifficultyFromAccuracy) {
                startingDi = window.getStartingDifficultyFromAccuracy({ accuracy });
            }
        }
    } catch (e) {
        // ignore
    }

    if (!window.createAdaptiveQuiz) {
        // Fallback: non-adaptive.
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

    // Fill initial first question.
    adaptiveSteps[0] = adaptiveQuiz.takeNext();
}


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

    questionData.options.forEach(option => {
        let btn = document.createElement("button");
        btn.classList.add("option");
        btn.type = "button";
        btn.textContent = option;

        btn.setAttribute("role", "radio");
        btn.setAttribute("aria-checked", "false");
        btn.onclick = () => selectOption(btn, option);

        optionsContainer.appendChild(btn);
    });

    selectedOption = null;

    const lastStep = adaptiveSteps.length - 1;
    document.getElementById("next-btn").disabled = true;
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

    // Update difficulty for subsequent questions.
    if (adaptiveQuiz) {
        adaptiveQuiz.updateDifficulty({ isCorrect });
        if (currentStepIndex + 1 < adaptiveSteps.length) {
            // Determine next question based on updated difficulty.
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
    // Keep the navigation simple: go back one step, do not re-run difficulty.
    currentStepIndex--;
    selectedOption = userSelectionsByStep[currentStepIndex] || null;
    loadQuestion();
}


function confirmSubmit() {
    lastFocusedEl = document.activeElement;
    document.getElementById("confirm-popup").style.display = "block";

    // Move focus to primary action
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
    currentStepIndex = 0;
    score = 0;
    selectedOption = null;
    userAnswers = new Array(adaptiveSteps.length).fill(null);
    userSelectionsByStep = new Array(adaptiveSteps.length).fill(null);

    document.getElementById("quiz-box").classList.remove("hidden");
    document.getElementById("result-box").classList.add("hidden");

    document.getElementById("progress-bar").style.width = "0%";

    // rebuild adaptive quiz session
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
    const startAt = window.__quizNlmStartedAt || finishAt;
    const timeTakenMs = Math.max(0, finishAt - startAt);

    try {
        if (window.quizProgress && typeof window.quizProgress.recordAttempt === 'function') {
            window.quizProgress.recordAttempt({
                topicId: "physics-nlm",
                score: totalScore,
                totalQuestions,
                correctCount,
                timeTakenMs,
                quizId: "quiz:nlm",
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


function updateProgressBar() {
    let progress = ((currentStepIndex + 1) / adaptiveSteps.length) * 100;
    document.getElementById("progress-bar").style.width = progress + "%";
}

function startAdaptiveSession() {
    // Determine starting difficulty from past topic accuracy.
    let startingDi = 1;
    try {
        if (window.quizProgress && typeof window.quizProgress.getTopicStats === 'function') {
            const stats = window.quizProgress.getTopicStats('physics-nlm');
            const accuracy = stats?.questionsTotal > 0 ? (stats.correctTotal / stats.questionsTotal) : null;
            if (window.getStartingDifficultyFromAccuracy) {
                startingDi = window.getStartingDifficultyFromAccuracy({ accuracy });
            }
        }
    } catch (e) {
        // ignore
    }

    if (!window.createAdaptiveQuiz) {
        // Fallback: non-adaptive.
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

    // Fill initial first question.
    adaptiveSteps[0] = adaptiveQuiz.takeNext();
    // Remaining questions will be determined as user answers.
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize accessibility utilities
    if (window.initQuizAccessibility) {
        window.initQuizAccessibility();
    }
    window.__quizNlmStartedAt = Date.now();
    document.getElementById('progress-bar').style.width = "0%";
    startAdaptiveSession();
    loadQuestion();
});
