const questions = [
    { question: "What is the law of reflection?", options: ["Angle of incidence = Angle of reflection", "Light bends towards the normal", "Light travels in a straight line", "Total internal reflection occurs"], answer: "Angle of incidence = Angle of reflection" },
    { question: "Which mirror always forms a virtual, upright, and diminished image?", options: ["Concave mirror", "Convex mirror", "Plane mirror", "Parabolic mirror"], answer: "Convex mirror" },
    { question: "What is the focal length of a plane mirror?", options: ["Infinity", "Zero", "Equal to the radius of curvature", "Equal to half of the radius of curvature"], answer: "Infinity" },
    { question: "What happens when light travels from a denser to a rarer medium at an angle greater than the critical angle?", options: ["Reflection", "Refraction", "Total internal reflection", "Diffraction"], answer: "Total internal reflection" },
    { question: "Which lens is used to correct myopia (nearsightedness)?", options: ["Convex lens", "Concave lens", "Cylindrical lens", "Bifocal lens"], answer: "Concave lens" }
];

let currentQuestionIndex = 0;
let score = 0;
let selectedOption = null;
let userAnswers = new Array(questions.length).fill(null);

let lastFocusedEl = null;

function getSrStatus() {
    return document.getElementById("sr-status");
}

function announce(message) {
    const el = getSrStatus();
    if (!el) return;
    el.textContent = message;
}


function loadQuestion() {
    lastFocusedEl = document.activeElement;

    let questionData = questions[currentQuestionIndex];
    document.getElementById("question").textContent = questionData.question;

    let optionsContainer = document.getElementById("options");
    optionsContainer.innerHTML = "";

    questionData.options.forEach((option) => {
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
    document.getElementById("next-btn").disabled = true;
    document.getElementById("prev-btn").disabled = currentQuestionIndex === 0;
    document.getElementById("submit-btn").classList.toggle("hidden", currentQuestionIndex !== questions.length - 1);
    document.getElementById("next-btn").classList.toggle("hidden", currentQuestionIndex === questions.length - 1);

    updateProgressBar();

    announce(`Question ${currentQuestionIndex + 1} of ${questions.length}. ${questionData.question}`);
}


function selectOption(button, option) {
    document.querySelectorAll(".option").forEach((btn) => {
        btn.classList.remove("selected");
        btn.setAttribute("aria-checked", "false");
    });

    button.classList.add("selected");
    button.setAttribute("aria-checked", "true");

    selectedOption = option;
    userAnswers[currentQuestionIndex] = option;
    document.getElementById("next-btn").disabled = false;

    announce(`Selected: ${option}`);
}


function nextQuestion() {
    if (!selectedOption) {
        showPopup();
        return;
    }

    if (selectedOption === questions[currentQuestionIndex].answer) {
        score++;
    }

    currentQuestionIndex++;
    if (currentQuestionIndex < questions.length) {
        loadQuestion();
    } else {
        showResults();
    }
}

function prevQuestion() {
    currentQuestionIndex--;
    loadQuestion();
}

function confirmSubmit() {
    document.getElementById("confirm-popup").style.display = "block";
}

function submitQuiz() {
    if (!selectedOption) {
        showPopup();
        return;
    }

    if (selectedOption === questions[currentQuestionIndex].answer) {
        score++;
    }

    document.getElementById("confirm-popup").style.display = "none";
    showResults();
}

function restartQuiz() {
    currentQuestionIndex = 0;
    score = 0;
    selectedOption = null;
    userAnswers.fill(null);

    document.getElementById("quiz-box").classList.remove("hidden");
    document.getElementById("result-box").classList.add("hidden");

    document.getElementById("progress-bar").style.width = "0%";

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
    announce("Warning: Please select an answer before proceeding.");
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
    document.getElementById("quiz-box").classList.add("hidden");
    document.getElementById("result-box").classList.remove("hidden");

    const heading = document.getElementById("result-heading");
    if (heading) heading.focus();

    let scoreText = `You scored <strong>${score}</strong> out of ${questions.length}! 🎉`;
    let feedbackHTML = "";


    questions.forEach((q, index) => {
        let userAnswer = userAnswers[index] || "No answer selected";
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

    announce(`Quiz completed. Score: ${score} out of ${questions.length}.`);
}


function updateProgressBar() {
    let progress = ((currentQuestionIndex + 1) / questions.length) * 100;
    document.getElementById("progress-bar").style.width = progress + "%";
}

function getOptionButtons() {
    return Array.from(document.querySelectorAll("#options .option"));
}

function moveOptionFocus(delta) {
    const options = getOptionButtons();
    if (options.length === 0) return;

    const active = document.activeElement;
    let idx = options.indexOf(active);
    if (idx === -1) {
        idx = selectedOption ? options.findIndex((b) => b.textContent === selectedOption) : 0;
        if (idx < 0) idx = 0;
    }

    const nextIdx = Math.max(0, Math.min(options.length - 1, idx + delta));
    options[nextIdx].focus();
}

document.addEventListener("keydown", (e) => {
    const quizBox = document.getElementById("quiz-box");
    if (!quizBox || quizBox.classList.contains("hidden")) return;

    const key = e.key;
    const options = getOptionButtons();
    const active = document.activeElement;
    const isOptionFocused = options.includes(active);

    // Close dialogs with Escape
    if (e.key === "Escape") {
        const popup = document.getElementById("popup");
        const confirmPopup = document.getElementById("confirm-popup");
        if (popup && popup.style.display !== "none" && !popup.classList.contains("hidden")) {
            e.preventDefault();
            closePopup();
            return;
        }
        if (confirmPopup && confirmPopup.style.display !== "none" && !confirmPopup.classList.contains("hidden")) {
            e.preventDefault();
            closeConfirmPopup();
            return;
        }
    }

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        moveOptionFocus(1);
        return;
    }

    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        moveOptionFocus(-1);
        return;
    }

    if (key === "Enter" || key === " ") {
        if (isOptionFocused) {
            e.preventDefault();
            const optionText = active.textContent;
            if (optionText) {
                selectOption(active, optionText);
            }
            return;
        }

        // If an option is already selected, Enter/Space activates the primary action
        if (selectedOption) {
            const submitHidden = document.getElementById("submit-btn").classList.contains("hidden");
            if (!submitHidden) {
                e.preventDefault();
                confirmSubmit();
            } else {
                const nextBtn = document.getElementById("next-btn");
                if (nextBtn && !nextBtn.disabled) {
                    e.preventDefault();
                    nextQuestion();
                }
            }
        }
    }
});

document.addEventListener("DOMContentLoaded", () => {
    // Initialize accessibility utilities
    if (window.initQuizAccessibility) {
        window.initQuizAccessibility();
    }
    document.getElementById("progress-bar").style.width = "0%";
    loadQuestion();

    setTimeout(() => {
        const firstOption = document.querySelector("#options .option");
        if (firstOption) firstOption.focus();
    }, 0);
});

