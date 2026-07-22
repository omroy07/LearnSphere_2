const canvas = document.getElementById('opticsCanvas');
const ctx = canvas.getContext('2d');

const mirrorX = canvas.width / 2; // Mirror position in the center
const intersectionY = canvas.height / 2; // Point of incidence
let incidentAngle = 40; // Default incident angle
let normalRotation = -90; // Start rotation of normal from -90 degrees
let incidentProgress = 0; // Progress of the incident ray (0% to 100%)
let reflectionProgress = 0; // Progress of the reflected ray
let animationFrame;

// Function to draw the mirror
function drawMirror() {
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(50, intersectionY); // Start from left side
  ctx.lineTo(canvas.width - 50, intersectionY); // Extend to the right
  ctx.stroke();

  ctx.fillStyle = 'black';
  ctx.font = '14px Arial';
  ctx.fillText('Mirror', canvas.width / 2 - 30, intersectionY - 10); // Label the mirror
}

// Function to draw the rotating normal line
// function drawNormal() {
//     ctx.setLineDash([5, 5]); // Dotted line
//     ctx.strokeStyle = "blue";
//     ctx.lineWidth = 2;

//     const radian = (normalRotation * Math.PI) / 180;
//     const length = 80;
//     const startX = mirrorX;
//     const startY = intersectionY;
//     const endX = mirrorX + length * Math.cos(radian);
//     const endY = intersectionY + length * Math.sin(radian);

//     ctx.beginPath();
//     ctx.moveTo(startX, startY);
//     ctx.lineTo(endX, endY);
//     ctx.stroke();
//     ctx.setLineDash([]); // Reset to solid lines

//     ctx.fillStyle = "black";
//     ctx.fillText("Normal", endX + 5, endY);
// }
function drawNormal() {
  ctx.setLineDash([5, 5]); // Dotted line
  ctx.strokeStyle = 'blue';
  ctx.lineWidth = 2;

  const radian = (normalRotation * Math.PI) / 180;
  const length = 80;
  const startX = mirrorX;
  const startY = intersectionY;

  // Reverse direction: Make it extend upwards instead of downwards
  const endX = mirrorX - length * Math.cos(radian);
  const endY = intersectionY - length * Math.sin(radian);

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.setLineDash([]); // Reset to solid lines

  ctx.fillStyle = 'black';
  ctx.fillText('Normal', endX - 10, endY - 5); // Adjust label position
}

// Function to draw a ray
function drawRay(angle, color, label, progress, reverse = false) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  const radianAngle = (angle * Math.PI) / 180;
  const rayLength = 150 * progress; // Dynamic length based on progress
  const direction = reverse ? -1 : 1;

  const startX = mirrorX - direction * rayLength * Math.cos(radianAngle);
  const startY = intersectionY - rayLength * Math.sin(radianAngle);
  const endX = mirrorX;
  const endY = intersectionY;

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  ctx.fillStyle = 'black';
  ctx.fillText(label, startX + (reverse ? 10 : -70), startY);
}

// Function to animate the normal line rotation and the rays
function animateSimulation() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMirror();

  if (normalRotation < 90) {
    normalRotation += 2; // Rotate the normal line
  }
  drawNormal();

  if (incidentProgress < 1) {
    incidentProgress += 0.02; // Move the incident ray
  }
  drawRay(incidentAngle, 'blue', 'Incident Ray', incidentProgress);

  if (incidentProgress >= 1 && reflectionProgress < 1) {
    reflectionProgress += 0.02; // Move the reflected ray after full incident
  }
  drawRay(incidentAngle, 'green', 'Reflected Ray', reflectionProgress, true);

  ctx.fillStyle = 'black';
  ctx.fillText(`Angle of Incidence: ${incidentAngle.toFixed(1)}°`, 150, 30);
  ctx.fillText(`Angle of Reflection: ${incidentAngle.toFixed(1)}°`, 350, 30);

  if (normalRotation < 90 || reflectionProgress < 1) {
    animationFrame = requestAnimationFrame(animateSimulation);
  }
}

// Function to start animation
function startAnimation() {
  normalRotation = -90;
  incidentProgress = 0;
  reflectionProgress = 0;
  cancelAnimationFrame(animationFrame);
  animateSimulation();
}

// Function to reset everything
function resetCanvas() {
  cancelAnimationFrame(animationFrame);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMirror();
  drawNormal();
}

window.onload = resetCanvas;
