// equilibrium.js

let canvas, ctx;
let molecules = [];
let animationId;
let equilibriumState = 'Not started';

// Initialize the simulation
function initializeSimulation() {
  canvas = document.getElementById('equilibriumCanvas');
  ctx = canvas.getContext('2d');
  updateEquilibriumInfo();
}

// Start the simulation
function startSimulation() {
  equilibriumState = 'At Equilibrium';
  generateMolecules();
  animate();
  updateEquilibriumInfo();
}

// Reset the simulation
function resetSimulation() {
  cancelAnimationFrame(animationId);
  molecules = [];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  equilibriumState = 'Not started';
  updateEquilibriumInfo();
}

// Generate initial molecules
function generateMolecules() {
  molecules = [];
  for (let i = 0; i < 50; i++) {
    molecules.push(createMolecule('A'));
    molecules.push(createMolecule('B'));
  }
  for (let i = 0; i < 50; i++) {
    molecules.push(createMolecule('C'));
  }
}

// Create a molecule object
function createMolecule(type) {
  return {
    type: type,
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
    color: getColor(type),
  };
}

// Get color based on molecule type
function getColor(type) {
  switch (type) {
    case 'A':
      return 'red';
    case 'B':
      return 'blue';
    case 'C':
      return 'green';
    default:
      return 'white';
  }
}

// Animate the molecules
function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  molecules.forEach(molecule => {
    molecule.x += molecule.vx;
    molecule.y += molecule.vy;

    // Bounce off walls
    if (molecule.x <= 0 || molecule.x >= canvas.width) molecule.vx *= -1;
    if (molecule.y <= 0 || molecule.y >= canvas.height) molecule.vy *= -1;

    // Draw molecule
    ctx.beginPath();
    ctx.arc(molecule.x, molecule.y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = molecule.color;
    ctx.fill();
  });

  animationId = requestAnimationFrame(animate);
}

// Update equilibrium information display
function updateEquilibriumInfo() {
  document.getElementById('equilibriumInfo').innerText = `Equilibrium Status: ${equilibriumState}`;
}

// Simulate changes based on Le Chatelier’s Principle
function increaseConcentration() {
  molecules.push(createMolecule('A'));
  molecules.push(createMolecule('B'));
  equilibriumState = 'Shifted Right (More Products)';
  updateEquilibriumInfo();
}

function decreaseConcentration() {
  molecules = molecules.filter(
    mol => (mol.type !== 'A' && mol.type !== 'B') || Math.random() > 0.5
  );
  equilibriumState = 'Shifted Left (More Reactants)';
  updateEquilibriumInfo();
}

function increaseTemperature() {
  // Assuming endothermic reaction
  molecules.push(createMolecule('C'));
  equilibriumState = 'Shifted Right (Endothermic)';
  updateEquilibriumInfo();
}

function decreaseTemperature() {
  // Assuming endothermic reaction
  molecules = molecules.filter(mol => mol.type !== 'C' || Math.random() > 0.5);
  equilibriumState = 'Shifted Left (Exothermic)';
  updateEquilibriumInfo();
}

function increasePressure() {
  // Simplified: remove some gas molecules to simulate pressure increase
  molecules = molecules.filter((_, index) => index % 2 === 0);
  equilibriumState = 'Shifted to Side with Fewer Gas Molecules';
  updateEquilibriumInfo();
}

function decreasePressure() {
  // Simplified: add more gas molecules to simulate pressure decrease
  for (let i = 0; i < 10; i++) {
    molecules.push(createMolecule('A'));
    molecules.push(createMolecule('B'));
    molecules.push(createMolecule('C'));
  }
  equilibriumState = 'Shifted to Side with More Gas Molecules';
  updateEquilibriumInfo();
}

// Load theory content
function loadTheory() {
  alert(
    'Theory:\n\nChemical equilibrium occurs when the rate of the forward reaction equals the rate of the reverse reaction, resulting in constant concentrations of reactants and products. Le Chatelier’s Principle states that if a dynamic equilibrium is disturbed by changing the conditions, the position of equilibrium moves to counteract the change.'
  );
}

// Load animation content
function loadAnimation() {
  alert(
    'Animation:\n\nObserve how molecules interact and shift in response to changes in concentration, temperature, and pressure, illustrating the dynamic nature of chemical equilibrium.'
  );
}

// Load formulas content
function loadFormulas() {
  alert(
    'Formulas:\n\n1. Equilibrium Constant (K_eq):\n   K_eq = [Products]^coefficients / [Reactants]^coefficients\n\n2. Gibbs Free Energy:\n   ΔG = -RT ln K_eq\n\n3. Le Chatelier’s Principle:\n   Predicts the shift in equilibrium position in response to changes in concentration, temperature, or pressure.'
  );
}

// Load real-life example content
function loadRealLifeExample() {
  alert(
    'Real-Life Example:\n\nThe Haber process for synthesizing ammonia (NH₃) from nitrogen (N₂) and hydrogen (H₂) is an application of chemical equilibrium principles. Adjusting temperature and pressure conditions shifts the equilibrium to favor ammonia production.'
  );
}

// Load interactive content
function loadInteractive() {
  alert(
    'Interactive:\n\nUse the buttons provided to simulate changes in concentration, temperature, and pressure. Observe how these changes affect the equilibrium state, demonstrating Le Chatelier’s Principle in action.'
  );
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
