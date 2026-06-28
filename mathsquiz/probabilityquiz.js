const questions = [
  {
    question: "If the mean of a dataset is 50 and the standard deviation is 5, what is the coefficient of variation?",
    options: ["10%", "5%", "100%", "50%"],
    answer: 0
  },
  {
    question: "What is the probability of getting exactly one head when two fair coins are tossed?",
    options: ["1/4", "1/2", "3/4", "1"],
    answer: 1
  },
  {
    question: "Which measure of central tendency is most affected by extreme values?",
    options: ["Mean", "Median", "Mode", "None of the above"],
    answer: 0
  },
  {
    question: "A letter is chosen at random from the word 'STATISTICS'. What is the probability of selecting a vowel?",
    options: ["1/10", "2/10", "3/10", "4/10"],
    answer: 2
  },
  {
    question: "In a normal distribution, approximately what percentage of data lies within one standard deviation from the mean?",
    options: ["68%", "95%", "99.7%", "50%"],
    answer: 0
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
