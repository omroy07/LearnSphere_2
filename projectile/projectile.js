const canvas = document.getElementById('projectileCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 500;
canvas.height = 300;

let x = 100;
let y = 150;
let velocityX = 4;
let velocityY = -8;
let gravity = 0.4;
let damping = 0.8; // Energy loss on bounce (ground and ceiling)
let wallDamping = 0.9; // Energy loss when hitting walls

function drawProjectile() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw enclosing boundary with curved edges
  ctx.fillStyle = '#008374'; // Dark green border
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, canvas.height, 20); // Rounded corners
  ctx.fill();

  // Draw inner area (simulation space)
  ctx.fillStyle = '#e0f7f5'; // Light blue background
  ctx.fillRect(5, 5, canvas.width - 10, canvas.height - 10);

  // Draw projectile (ball)
  ctx.fillStyle = '#ff5733'; // Orange ball
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fill();

  // Update position
  x += velocityX;
  y += velocityY;
  velocityY += gravity; // Apply gravity

  // Bounce off ground
  if (y >= canvas.height - 15) {
    y = canvas.height - 15;
    velocityY = -velocityY * damping; // Reduce speed on bounce
  }

  // Bounce off top
  if (y <= 15) {
    y = 15;
    velocityY = -velocityY * damping;
  }

  // Bounce off left and right walls
  if (x >= canvas.width - 15) {
    x = canvas.width - 15;
    velocityX = -velocityX * wallDamping; // Reduce speed when hitting walls
  }
  if (x <= 15) {
    x = 15;
    velocityX = -velocityX * wallDamping;
  }

  requestAnimationFrame(drawProjectile);
}

drawProjectile();
