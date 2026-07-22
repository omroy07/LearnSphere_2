function loadTheory() {
  document.getElementById('contentArea').innerHTML = `
    <h3>Theory</h3>
    <p>Coordinate geometry involves representing geometric figures in a coordinate plane. Conic sections include circles, ellipses, parabolas, and hyperbolas derived from intersecting a plane with a cone.</p>`;
}

function loadAnimation() {
  document.getElementById('contentArea').innerHTML = `
    <h3>Animation</h3>
    <iframe width="560" height="315" src="https://www.youtube.com/embed/L_OedT2dqzw" frameborder="0" allowfullscreen></iframe>`;
}

function loadFormulas() {
  document.getElementById('contentArea').innerHTML = `
    <h3>Formulas</h3>
    <ul>
      <li>Distance between two points: √[(x₂ - x₁)² + (y₂ - y₁)²]</li>
      <li>Midpoint: ((x₁ + x₂)/2, (y₁ + y₂)/2)</li>
      <li>Slope: (y₂ - y₁)/(x₂ - x₁)</li>
      <li>Circle: (x - h)² + (y - k)² = r²</li>
      <li>Parabola: y² = 4ax or x² = 4ay</li>
      <li>Ellipse: (x²/a²) + (y²/b²) = 1</li>
      <li>Hyperbola: (x²/a²) - (y²/b²) = 1</li>
    </ul>`;
}

function loadRealLifeExample() {
  document.getElementById('contentArea').innerHTML = `
    <h3>Real-Life Example</h3>
    <p>GPS uses coordinate geometry to calculate the distance between two locations based on latitude and longitude.</p>`;
}

function loadInteractive() {
  document.getElementById('contentArea').innerHTML = `
    <h3>Interactive</h3>
    <p>Coming soon: Plot points, lines, and conic sections on a 2D graph!</p>`;
}

function loadDistanceCalculator() {
  document.getElementById('contentArea').innerHTML = `
    <h3>Distance Between Two Points</h3>
    <p>Enter coordinates of two points:</p>
    <label>X₁: <input type="number" id="x1"></label><br/>
    <label>Y₁: <input type="number" id="y1"></label><br/>
    <label>X₂: <input type="number" id="x2"></label><br/>
    <label>Y₂: <input type="number" id="y2"></label><br/><br/>
    <button class="button" onclick="calculateDistance()">Calculate</button>
    <p id="result"></p>`;
}

function calculateDistance() {
  const x1 = parseFloat(document.getElementById('x1').value);
  const y1 = parseFloat(document.getElementById('y1').value);
  const x2 = parseFloat(document.getElementById('x2').value);
  const y2 = parseFloat(document.getElementById('y2').value);
  const result = document.getElementById('result');

  if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) {
    result.textContent = 'Please enter valid coordinates.';
    return;
  }

  const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  result.textContent = `Distance = ${distance.toFixed(2)}`;
}

// Feedback Form Functions
function openFeedbackForm() {
  document.getElementById('feedbackPopup').classList.remove('hidden');
}

function closeFeedbackForm() {
  document.getElementById('feedbackPopup').classList.add('hidden');
}

function submitFeedback() {
  const feedback = document.getElementById('feedbackInput').value;
  alert('Thank you for your feedback: ' + feedback);
  closeFeedbackForm();
}
