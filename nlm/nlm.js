const canvas = document.getElementById('nlmCanvas');
const ctx = canvas.getContext('2d');

let boxX = 150; // Box initial position
let personX = boxX - 30; // Person starts next to the box
let velocity = 0;
let force = 2;
let isAnimating = false;

// Draw the person with their hand on the box
function drawPerson(x, y) {
  ctx.fillStyle = 'black';

  // Head
  ctx.beginPath();
  ctx.arc(x + 10, y - 20, 10, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillRect(x, y - 10, 20, 30);

  // Legs
  ctx.fillRect(x + 5, y + 20, 5, 15);
  ctx.fillRect(x + 10, y + 20, 5, 15);

  // Right arm touching the box
  ctx.fillRect(x + 15, y, 20, 5);
}

// Draw the box
function drawBox(x, y) {
  ctx.fillStyle = 'blue';
  ctx.fillRect(x, y, 50, 50);

  // Draw force value above the box
  ctx.fillStyle = 'black';
  ctx.font = '16px Arial';
  ctx.fillText(`Force: ${force}N`, x + 5, y - 10);
}

// Draw the force arrow dynamically
function drawArrow(x) {
  ctx.strokeStyle = 'red';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - 30, 150);
  ctx.lineTo(x, 150);
  ctx.stroke();
}

// Start simulation
function startSimulation() {
  if (isAnimating) return;
  isAnimating = true;

  let acceleration = force * 0.02;

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawArrow(boxX + 50);
    drawPerson(personX, 140);
    drawBox(boxX, 125);

    velocity += acceleration;
    boxX += velocity;
    personX += velocity; // The person moves with the box

    if (boxX + 50 < canvas.width - 20) {
      requestAnimationFrame(animate);
    } else {
      isAnimating = false;
    }
  }
  animate();
}

// Reset simulation
function resetCanvas() {
  isAnimating = false;
  boxX = 150;
  personX = boxX - 30;
  velocity = 0;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawArrow(boxX + 50);
  drawPerson(personX, 140);
  drawBox(boxX, 125);
}

// Update force value from input
function updateForce(value) {
  force = parseFloat(value);
}
