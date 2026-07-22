const questions = [
  {
    question: 'Which of the following is NOT a state function in thermodynamics?',
    options: ['Enthalpy (H)', 'Entropy (S)', 'Work (W)', 'Internal Energy (U)'],
    answer: 2,
  },
  {
    question: 'According to the second law of thermodynamics, which statement is true?',
    options: [
      'Energy can be created or destroyed.',
      'Entropy of an isolated system always decreases.',
      'Heat flows spontaneously from a colder to a hotter body.',
      'Entropy of an isolated system always increases over time.',
    ],
    answer: 3,
  },
  {
    question: 'In the Arrhenius equation, what does the activation energy (Ea) represent?',
    options: [
      'The minimum energy required for a reaction to occur.',
      'The energy released during the reaction.',
      'The average kinetic energy of reactants.',
      'The change in enthalpy of the reaction.',
    ],
    answer: 0,
  },
  {
    question: 'How does a catalyst affect the rate of a chemical reaction?',
    options: [
      'It increases the activation energy.',
      'It decreases the activation energy.',
      'It increases the enthalpy change.',
      'It shifts the equilibrium position.',
    ],
    answer: 1,
  },
  {
    question: 'Which factor does NOT affect the rate of a chemical reaction?',
    options: [
      'Concentration of reactants',
      'Temperature',
      'Presence of a catalyst',
      'Color of the reactants',
    ],
    answer: 3,
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
