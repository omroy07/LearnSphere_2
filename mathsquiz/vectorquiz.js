const questions = [
  {
    question: "What is the dot product of two perpendicular vectors?",
    options: ["0", "1", "Infinity", "Undefined"],
    answer: 0
  },
  {
    question: "Which of the following is a scalar quantity?",
    options: ["Vector product", "Dot product", "Cross product", "Position vector"],
    answer: 1
  },
  {
    question: "If a vector has components (3, 4, 0), what is its magnitude?",
    options: ["5", "7", "12", "25"],
    answer: 0
  },
  {
    question: "The cross product of two parallel vectors is:",
    options: ["Zero vector", "Unit vector", "Scalar", "Undefined"],
    answer: 0
  },
  {
    question: "In 3D space, how many components does a vector have?",
    options: ["1", "2", "3", "4"],
    answer: 2
  }
];

let currentQuestionIndex = 0;
let score = 0;
let selectedOption = null;
let userAnswers = new Array(questions.length).fill(null);

function getCorrectAnswer(questionData) {
    return typeof questionData.answer === "number"
        ? questionData.options[questionData.answer]
        : questionData.answer;
}

function isAnswerCorrect(questionData, answer) {
    return answer === getCorrectAnswer(questionData);
}

function calculateScore() {
    return questions.reduce((total, questionData, index) => {
        return total + (isAnswerCorrect(questionData, userAnswers[index]) ? 1 : 0);
    }, 0);
}

function loadQuestion() {
    let questionData = questions[currentQuestionIndex];
    document.getElementById("question").textContent = questionData.question;

    let optionsContainer = document.getElementById("options");
    optionsContainer.innerHTML = "";

    questionData.options.forEach(option => {
        let btn = document.createElement("button");
        btn.classList.add("option");
        btn.textContent = option;
        btn.onclick = () => selectOption(btn, option);
        optionsContainer.appendChild(btn);
    });

    selectedOption = null;
    document.getElementById("next-btn").disabled = true;
    document.getElementById("prev-btn").disabled = currentQuestionIndex === 0;
    document.getElementById("submit-btn").classList.toggle("hidden", currentQuestionIndex !== questions.length - 1);
    document.getElementById("next-btn").classList.toggle("hidden", currentQuestionIndex === questions.length - 1);

    updateProgressBar();
}

function selectOption(button, option) {
    document.querySelectorAll(".option").forEach(btn => btn.classList.remove("selected"));
    button.classList.add("selected");
    selectedOption = option;
    userAnswers[currentQuestionIndex] = option;
    document.getElementById("next-btn").disabled = false;
}

function nextQuestion() {
    if (!selectedOption) {
        showPopup();
        return;
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
}

function showPopup() {
    document.getElementById("popup").style.display = "block";
}

function closePopup() {
    document.getElementById("popup").style.display = "none";
}

function closeConfirmPopup() {
    document.getElementById("confirm-popup").style.display = "none";
}

function showResults() {
    document.getElementById("quiz-box").classList.add("hidden");
    document.getElementById("result-box").classList.remove("hidden");
    score = calculateScore();

    let scoreText = `You scored <strong>${score}</strong> out of ${questions.length}! 🎉`;
    let feedbackHTML = "";

    questions.forEach((q, index) => {
        let userAnswer = userAnswers[index] || "No answer selected";
        let isCorrect = isAnswerCorrect(q, userAnswer);

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
}

function updateProgressBar() {
    let progress = ((currentQuestionIndex + 1) / questions.length) * 100;
    document.getElementById("progress-bar").style.width = progress + "%";
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("progress-bar").style.width = "0%";
    loadQuestion();
});
