const canvas = document.getElementById('simulationCanvas');
const ctx = canvas.getContext('2d');

let particles = [];
let animationId;
let temperature = 300; // Kelvin
let activationEnergy = 50; // kJ/mol
let reactionCount = 0;
let equilibriumState = 'Not started';

const numParticles = 100;

function updateDisplays() {
  document.getElementById('temperatureDisplay').innerText = temperature;
  document.getElementById('activationEnergyDisplay').innerText = activationEnergy;
  document.getElementById('reactionCount').innerText = reactionCount;
  document.getElementById('equilibriumInfo').innerText = `Equilibrium Status: ${equilibriumState}`;
}

function createParticle() {
  const speed = Math.sqrt(temperature) * (Math.random() * 0.5 + 0.5);
  const angle = Math.random() * 2 * Math.PI;
  return {
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: speed * Math.cos(angle),
    vy: speed * Math.sin(angle),
    color: 'orange',
    reacted: false,
  };
}

function generateParticles() {
  particles = [];
  for (let i = 0; i < numParticles; i++) {
    particles.push(createParticle());
  }
}

function drawParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = p.color;
    ctx.fill();
  });
}

function updateParticles() {
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;

    // Bounce off walls
    if (p.x <= 0 || p.x >= canvas.width) p.vx *= -1;
    if (p.y <= 0 || p.y >= canvas.height) p.vy *= -1;
  });

  // Check for reactions
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const p1 = particles[i];
      const p2 = particles[j];
      if (p1.reacted || p2.reacted) continue;

      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 10) {
        // Calculate relative speed
        const relVx = p1.vx - p2.vx;
        const relVy = p1.vy - p2.vy;
        const relSpeed = Math.sqrt(relVx * relVx + relVy * relVy);

        // Simple reaction condition based on relative speed and activation energy
        if (relSpeed > activationEnergy / 10) {
          p1.color = 'green';
          p2.color = 'green';
          p1.reacted = true;
          p2.reacted = true;
          reactionCount += 1;
          updateDisplays();
        }
      }
    }
  }
}

function animate() {
  updateParticles();
  drawParticles();
  animationId = requestAnimationFrame(animate);
}

function startSimulation() {
  resetSimulation();
  generateParticles();
  equilibriumState = 'At Equilibrium';
  updateDisplays();
  animate();
}

function resetSimulation() {
  cancelAnimationFrame(animationId);
  particles = [];
  reactionCount = 0;
  equilibriumState = 'Not started';
  updateDisplays();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function increaseTemperature() {
  temperature += 50;
  updateDisplays();
  particles.forEach(p => {
    const speed = Math.sqrt(temperature) * (Math.random() * 0.5 + 0.5);
    const angle = Math.random() * 2 * Math.PI;
    p.vx = speed * Math.cos(angle);
    p.vy = speed * Math.sin(angle);
  });
  equilibriumState = 'Shifted Right (Endothermic)';
  updateDisplays();
}

function decreaseTemperature() {
  if (temperature > 50) {
    temperature -= 50;
    updateDisplays();
    particles.forEach(p => {
      const speed = Math.sqrt(temperature) * (Math.random() * 0.5 + 0.5);
      const angle = Math.random() * 2 * Math.PI;
      p.vx = speed * Math.cos(angle);
      p.vy = speed * Math.sin(angle);
    });
    equilibriumState = 'Shifted Left (Exothermic)';
    updateDisplays();
  }
}

function increaseActivationEnergy() {
  activationEnergy += 10;
  updateDisplays();
}

function decreaseActivationEnergy() {
  if (activationEnergy > 10) {
    activationEnergy -= 10;
    updateDisplays();
  }
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

function loadTheory() {
  document.getElementById('theory').scrollIntoView({ behavior: 'smooth' });
}

function loadAnimation() {
  window.open('https://www.youtube.com/watch?v=0Gvmpg2yJQU', '_blank'); // Replace with your own
}

function loadFormulas() {
  window.open(
    'https://chem.libretexts.org/Bookshelves/Physical_and_Theoretical_Chemistry_Textbook_Maps',
    '_blank'
  );
}

function loadRealLifeExample() {
  alert(
    'Real-life example: Instant cold packs use endothermic reactions, absorbing heat to feel cold.'
  );
}

function loadInteractive() {
  window.open('https://phet.colorado.edu/en/simulations/category/chemistry', '_blank');
}

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
    alert('Please enter feedback before submitting.');
  }
}
