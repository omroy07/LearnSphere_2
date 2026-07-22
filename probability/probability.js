function loadTheory() {
  document.getElementById('contentArea').innerHTML = `
    <h3>Theory</h3>
    <p>Probability is the measure of the likelihood of an event occurring. Statistics is the science of collecting, analyzing, and interpreting data.</p>`;
}

function loadAnimation() {
  document.getElementById('contentArea').innerHTML = `
    <h3>Animation</h3>
    <iframe src="https://www.youtube.com/embed/Uc-sBpdhHdg" allowfullscreen></iframe>`;
}

function loadFormulas() {
  document.getElementById('contentArea').innerHTML = `
    <h3>Formulas</h3>
    <ul>
      <li>P(E) = Number of favorable outcomes / Total outcomes</li>
      <li>Mean = Σx / n</li>
      <li>Variance = Σ(x - μ)² / n</li>
      <li>Standard Deviation = √Variance</li>
    </ul>`;
}

function loadRealLifeExample() {
  document.getElementById('contentArea').innerHTML = `
    <h3>Real-Life Example</h3>
    <p>The probability of rolling a 6 on a fair die is 1/6.</p>`;
}

function loadInteractive() {
  document.getElementById('contentArea').innerHTML = `
    <h3>Interactive Simulation</h3>
    <p>Coming soon: Try simulating a coin toss and dice rolls!</p>`;
}

function loadProbabilityCalculator() {
  document.getElementById('contentArea').innerHTML = `
    <h3>Probability Calculator</h3>
    <p>Calculate simple probability:</p>
    <label>Total outcomes: <input id="total" type="number" /></label><br/>
    <label>Favorable outcomes: <input id="favorable" type="number" /></label><br/>
    <button class="button" onclick="calculateProbability()">Calculate</button>
    <p id="result"></p>`;
}

function calculateProbability() {
  const total = parseFloat(document.getElementById('total').value);
  const favorable = parseFloat(document.getElementById('favorable').value);
  const result = document.getElementById('result');

  if (isNaN(total) || isNaN(favorable) || total <= 0 || favorable < 0) {
    result.textContent = 'Please enter valid numbers.';
    return;
  }

  const probability = favorable / total;
  result.textContent = `Probability: ${probability.toFixed(4)} (${(probability * 100).toFixed(2)}%)`;
}

// Feedback Handling
function openFeedbackForm() {
  document.getElementById('feedbackPopup').classList.remove('hidden');
}

function closeFeedbackForm() {
  document.getElementById('feedbackPopup').classList.add('hidden');
}

function submitFeedback() {
  const input = document.getElementById('feedbackInput').value;
  alert('Thanks for your feedback: ' + input);
  closeFeedbackForm();
}
