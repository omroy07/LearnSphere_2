// Function to load Theory content
function loadTheory() {
  const content = `
    <h2>Theory</h2>
    <p>Calculus is the mathematical study of continuous change. It has two major branches:</p>
    <ul>
      <li><strong>Limits:</strong> Understanding the behavior of functions as they approach specific points.</li>
      <li><strong>Derivatives:</strong> Measuring the rate at which a quantity changes.</li>
      <li><strong>Integrals:</strong> Calculating the accumulation of quantities and areas under curves.</li>
    </ul>
  `;
  document.getElementById('contentArea').innerHTML = content;
}

// Function to load Animation content
function loadAnimation() {
  const content = `
    <h2>Animation</h2>
    <p>Visualize how the derivative represents the slope of a function at a point:</p>
    <iframe src="https://phet.colorado.edu/sims/html/calculus-grapher/latest/calculus-grapher_en.html" width="100%" height="400px" frameborder="0"></iframe>
  `;
  document.getElementById('contentArea').innerHTML = content;
}

// Function to load Formulas and Derivations
function loadFormulas() {
  const content = `
    <h2>Formulas & Derivations</h2>
    <p><strong>Limit Definition of Derivative:</strong></p>
    <p>f'(x) = lim<sub>h→0</sub> [f(x+h) - f(x)] / h</p>
    <p><strong>Basic Integration Formula:</strong></p>
    <p>∫x<sup>n</sup> dx = x<sup>n+1</sup> / (n+1) + C, where n ≠ -1</p>
  `;
  document.getElementById('contentArea').innerHTML = content;
}

// Function to load Real-Life Examples
function loadRealLifeExample() {
  const content = `
    <h2>Real-Life Example</h2>
    <p>Calculus is used in various fields:</p>
    <ul>
      <li><strong>Physics:</strong> Calculating motion, forces, and energy.</li>
      <li><strong>Economics:</strong> Determining cost and revenue functions.</li>
      <li><strong>Biology:</strong> Modeling population growth and decay.</li>
    </ul>
  `;
  document.getElementById('contentArea').innerHTML = content;
}

// Function to load Interactive content
function loadInteractive() {
  const content = `
    <h2>Interactive Simulation</h2>
    <p>Explore the relationship between functions and their derivatives:</p>
    <iframe src="https://phet.colorado.edu/sims/html/calculus-grapher/latest/calculus-grapher_en.html" width="100%" height="400px" frameborder="0"></iframe>
  `;
  document.getElementById('contentArea').innerHTML = content;
}

// Function to open Feedback Form
function openFeedbackForm() {
  document.getElementById('feedbackPopup').classList.remove('hidden');
}

// Function to close Feedback Form
function closeFeedbackForm() {
  document.getElementById('feedbackPopup').classList.add('hidden');
}

// Function to submit Feedback
function submitFeedback() {
  const feedback = document.getElementById('feedbackInput').value;
  if (feedback.trim() === '') {
    alert('Please enter your feedback before submitting.');
    return;
  }
  // Here, you can implement the logic to send feedback to a server or email
  alert('Thank you for your feedback!');
  document.getElementById('feedbackInput').value = '';
  closeFeedbackForm();
}

// calculus.js

// Load Derivative Calculator UI
function loadDerivativeCalculator() {
  const content = `
    <h2>🧮 Derivative Calculator</h2>
    <p>Enter a function of x (e.g. <code>x*x</code>, <code>Math.sin(x)</code>) and a value of x:</p>
    <input id="funcInput" placeholder="e.g. x*x or Math.sin(x)" style="width: 80%; padding: 8px;" />
    <br><br>
    x = <input type="number" id="xValue" value="1" style="width: 100px; padding: 5px;" />
    <br><br>
    <button class="button" onclick="calculateDerivative()">Calculate Derivative</button>
    <div id="derivativeResult" style="margin-top: 20px; font-weight: bold; font-size: 1.2rem;"></div>
  `;
  document.getElementById('contentArea').innerHTML = content;
}

// Calculate derivative using numerical method (finite difference)
function calculateDerivative() {
  const funcInput = document.getElementById('funcInput').value.trim();
  const x = parseFloat(document.getElementById('xValue').value);
  const h = 0.0001;

  if (!funcInput) {
    document.getElementById('derivativeResult').innerText = 'Please enter a function!';
    return;
  }

  try {
    // Create a function from user input
    const f = new Function('x', `return ${funcInput};`);

    // Compute numerical derivative f'(x) ≈ [f(x+h) - f(x)] / h
    const derivative = (f(x + h) - f(x)) / h;

    // Show result rounded to 5 decimals
    document.getElementById('derivativeResult').innerText = `f'(${x}) ≈ ${derivative.toFixed(5)}`;
  } catch (err) {
    // If the user input causes an error (syntax, etc.)
    document.getElementById('derivativeResult').innerText =
      '❌ Invalid function! Use valid JS math functions (e.g., Math.sin(x), x*x)';
  }
}

// Placeholder functions for other buttons
function loadTheory() {
  document.getElementById('contentArea').innerHTML =
    '<h2>📖 Theory</h2><p>Calculus theory content goes here.</p>';
}
function loadAnimation() {
  document.getElementById('contentArea').innerHTML =
    '<h2>🎞️ Animation</h2><p>Animation will show here.</p>';
}
function loadFormulas() {
  document.getElementById('contentArea').innerHTML =
    '<h2>✏️ Formula & Derivation</h2><p>Formulas and derivations go here.</p>';
}
function loadRealLifeExample() {
  document.getElementById('contentArea').innerHTML =
    '<h2>🌍 Real-Life Example</h2><p>Real-life applications of calculus.</p>';
}
function loadInteractive() {
  document.getElementById('contentArea').innerHTML =
    '<h2>🎮 Interactive</h2><p>Interactive activities will appear here.</p>';
}

// Feedback Popup functions (simple show/hide)
function openFeedbackForm() {
  document.getElementById('feedbackPopup').classList.remove('hidden');
}
function closeFeedbackForm() {
  document.getElementById('feedbackPopup').classList.add('hidden');
}
function submitFeedback() {
  const feedback = document.getElementById('feedbackInput').value.trim();
  if (feedback) {
    alert('Thank you for your feedback!');
    document.getElementById('feedbackInput').value = '';
    closeFeedbackForm();
  } else {
    alert('Please write some feedback before submitting.');
  }
}
