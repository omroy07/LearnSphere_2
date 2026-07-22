let canvas,
  ctx,
  angle = 0,
  animationId;

function startSimulation() {
  canvas = document.getElementById('atomCanvas');
  ctx = canvas.getContext('2d');

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw nucleus
    ctx.beginPath();
    ctx.arc(300, 200, 20, 0, 2 * Math.PI);
    ctx.fillStyle = '#FFD700';
    ctx.fill();

    // Orbit radius
    let orbits = [60, 100, 140];
    let colors = ['#00FFFF', '#FF69B4', '#7FFF00'];

    for (let i = 0; i < orbits.length; i++) {
      let radius = orbits[i];
      let electronX = 300 + radius * Math.cos(angle + i);
      let electronY = 200 + radius * Math.sin(angle + i);

      // Draw orbit
      ctx.beginPath();
      ctx.arc(300, 200, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = '#aaa';
      ctx.stroke();

      // Draw electron
      ctx.beginPath();
      ctx.arc(electronX, electronY, 8, 0, 2 * Math.PI);
      ctx.fillStyle = colors[i];
      ctx.fill();
    }

    angle += 0.03;
    animationId = requestAnimationFrame(draw);
  }

  draw();
}

function resetCanvas() {
  if (animationId) cancelAnimationFrame(animationId);
  let canvas = document.getElementById('atomCanvas');
  let ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function loadTheory() {
  document.getElementById('contentContainer').innerHTML = `
        <h2>Atomic Structure & Periodic Trends</h2>
        <p>Atoms consist of protons, neutrons, and electrons. The arrangement of electrons determines the chemical properties of an element. Periodic trends help predict element behavior.</p>
    `;
  document.getElementById('backButton').style.display = 'block';
  resetCanvas();
}

function loadAnimation() {
  document.getElementById('contentContainer').innerHTML = `
        <iframe src="https://www.youtube.com/embed/wGEV7JPReC8" allowfullscreen></iframe>
    `;
  document.getElementById('backButton').style.display = 'block';
  resetCanvas();
}

function loadFormulas() {
  document.getElementById('contentContainer').innerHTML = `
        <h2>Formulas & Derivations</h2>
        <p>Ionization Energy: <code>IE = E<sub>final</sub> - E<sub>initial</sub></code></p>
        <p>Atomic Radius trends: ↓ Group ⬆ Period</p>
    `;
  document.getElementById('backButton').style.display = 'block';
  resetCanvas();
}

function loadRealLifeExample() {
  document.getElementById('contentContainer').innerHTML = `
        <h2>Real-Life Example</h2>
        <p>Periodic trends help scientists design new materials, drugs, and understand chemical reactivity in industries.</p>
    `;
  document.getElementById('backButton').style.display = 'block';
  resetCanvas();
}

function loadInteractive() {
  document.getElementById('contentContainer').innerHTML = `
        <iframe src="https://phet.colorado.edu/sims/html/build-an-atom/latest/build-an-atom_en.html" allowfullscreen></iframe>
    `;
  document.getElementById('backButton').style.display = 'block';
  resetCanvas();
}

function restoreCanvas() {
  document.getElementById('contentContainer').innerHTML =
    `<canvas id="atomCanvas" width="600" height="400"></canvas>`;
  document.getElementById('backButton').style.display = 'none';
  startSimulation();
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
