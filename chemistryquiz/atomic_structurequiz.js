const questions = [
  {
    question: 'Which of the following particles has a positive charge?',
    options: ['Proton', 'Neutron', 'Electron', 'Anion'],
    answer: 0,
  },
  {
    question: 'What is the trend in atomic radius as you move across a period from left to right?',
    options: ['Increases', 'Decreases', 'Remains the same', 'Increases then decreases'],
    answer: 1,
  },
  {
    question: 'Which element has the highest electronegativity?',
    options: ['Oxygen', 'Fluorine', 'Chlorine', 'Nitrogen'],
    answer: 1,
  },
  {
    question: 'What is the electron configuration of a neutral oxygen atom?',
    options: ['1s² 2s² 2p⁴', '1s² 2s² 2p⁶', '1s² 2s² 2p²', '1s² 2s² 2p³'],
    answer: 0,
  },
  {
    question:
      'Which of the following statements is true about elements in the same group of the periodic table?',
    options: [
      'They have the same number of core electrons',
      'They have similar valence electron configurations',
      'They have the same number of neutrons',
      'They have identical atomic masses',
    ],
    answer: 1,
  },
];

let currentQuestionIndex = 0;
let score = 0;
let selectedOption = null;
let userAnswers = new Array(questions.length).fill(null);

function loadQuestion() {
  let questionData = questions[currentQuestionIndex];
  document.getElementById('question').textContent = questionData.question;

  let optionsContainer = document.getElementById('options');
  optionsContainer.innerHTML = '';

  let fragment = document.createDocumentFragment();
  questionData.options.forEach(option => {
    let btn = document.createElement('button');
    btn.classList.add('option');
    btn.textContent = option;

    fragment.appendChild(btn);
  });
  optionsContainer.appendChild(fragment);

  selectedOption = null;
  document.getElementById('next-btn').disabled = true;
  document.getElementById('prev-btn').disabled = currentQuestionIndex === 0;
  document
    .getElementById('submit-btn')
    .classList.toggle('hidden', currentQuestionIndex !== questions.length - 1);
  document
    .getElementById('next-btn')
    .classList.toggle('hidden', currentQuestionIndex === questions.length - 1);

  updateProgressBar();
}

function selectOption(button, option) {
  document.querySelectorAll('.option').forEach(btn => btn.classList.remove('selected'));
  button.classList.add('selected');
  selectedOption = option;
  userAnswers[currentQuestionIndex] = option;
  document.getElementById('next-btn').disabled = false;
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
  document.getElementById('confirm-popup').style.display = 'block';
}

function submitQuiz() {
  if (!selectedOption) {
    showPopup();
    return;
  }

  if (selectedOption === questions[currentQuestionIndex].answer) {
    score++;
  }

  document.getElementById('confirm-popup').style.display = 'none';
  showResults();
}

function restartQuiz() {
  currentQuestionIndex = 0;
  score = 0;
  selectedOption = null;
  userAnswers.fill(null);

  document.getElementById('quiz-box').classList.remove('hidden');
  document.getElementById('result-box').classList.add('hidden');

  document.getElementById('progress-bar').style.width = '0%';

  loadQuestion();
}

function showPopup() {
  document.getElementById('popup').style.display = 'block';
}

function closePopup() {
  document.getElementById('popup').style.display = 'none';
}

function closeConfirmPopup() {
  document.getElementById('confirm-popup').style.display = 'none';
}

function showResults() {
  document.getElementById('quiz-box').classList.add('hidden');
  document.getElementById('result-box').classList.remove('hidden');

  let scoreText = `You scored <strong>${score}</strong> out of ${questions.length}! 🎉`;
  let feedbackHTML = '';

  questions.forEach((q, index) => {
    let userAnswer = userAnswers[index] || 'No answer selected';
    let isCorrect = userAnswer === q.answer;

    feedbackHTML += `
            <div class="${isCorrect ? 'correct' : 'incorrect'}">
                <p><strong>Q${index + 1}:</strong> ${q.question}</p>
                <p>Your answer: <strong class="${isCorrect ? 'correct-answer' : 'wrong-answer'}">${userAnswer}</strong></p>
                ${isCorrect ? `<p>✅ Correct!</p>` : `<p>❌ Incorrect! </p> <p class="correct-answer"> The correct answer is: <strong class="correct-answer">${q.answer}</strong></p>`}
                <hr>
            </div>
        `;
  });

  document.getElementById('score').innerHTML = scoreText + '<br><br>' + feedbackHTML;
}

function updateProgressBar() {
  let progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  document.getElementById('progress-bar').style.width = progress + '%';
}

document.addEventListener('DOMContentLoaded', () => {
  const optContainer = document.getElementById('options');
  if (optContainer && !optContainer.dataset.delegated) {
    optContainer.dataset.delegated = 'true';
    optContainer.addEventListener('click', e => {
      if (e.target.classList.contains('option')) {
        selectOption(e.target, e.target.textContent);
      }
    });
  }

  document.getElementById('progress-bar').style.width = '0%';
  loadQuestion();
});
