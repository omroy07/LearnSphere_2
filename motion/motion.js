document.addEventListener('DOMContentLoaded', function () {
  let canvas = document.getElementById('motionCanvas');
  let ctx = canvas.getContext('2d');

  function initializeCanvas() {
    canvas = document.getElementById('motionCanvas');
    ctx = canvas.getContext('2d');

    if (!canvas || !ctx) {
      console.error('Canvas initialization failed.');
      return;
    }

    canvas.width = 500;
    canvas.height = 300;

    drawObstacle();
    drawBall();
  }

  // Object properties
  let ball = { x: 50, y: 150, radius: 10, velocity: 2, mass: 1 };
  let obstacle = { x: 350, y: 130, width: 40, height: 40, velocity: 0, mass: 3 };

  let animation;
  let motionActive = false;

  // Draw Ball
  function drawBall() {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'red';
    ctx.fill();
    ctx.closePath();
  }

  // Draw Obstacle
  function drawObstacle() {
    ctx.fillStyle = 'blue';
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
  }

  // Clear Canvas
  function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // Collision Detection
  function checkCollision() {
    return (
      ball.x + ball.radius >= obstacle.x &&
      ball.y >= obstacle.y &&
      ball.y <= obstacle.y + obstacle.height
    );
  }

  // Update Function
  function update() {
    clearCanvas();
    drawObstacle();
    drawBall();

    if (!checkCollision()) {
      ball.x += ball.velocity;
    } else {
      let impactForce = (ball.velocity * ball.mass) / obstacle.mass;
      ball.velocity = 0;
      obstacle.velocity = impactForce * 5;
    }

    if (obstacle.velocity > 0) {
      obstacle.x += obstacle.velocity;
      obstacle.velocity *= 0.9;
    }

    animation = requestAnimationFrame(update);
  }

  // Start Motion
  window.startMotion = function () {
    if (!motionActive) {
      motionActive = true;
      animation = requestAnimationFrame(update);
    }
  };

  // Reset Simulation
  window.resetSimulation = function () {
    cancelAnimationFrame(animation);
    ball.x = 50;
    ball.velocity = 2;
    obstacle.x = 350;
    obstacle.velocity = 0;
    motionActive = false;
    clearCanvas();
    drawObstacle();
    drawBall();
  };

  // Restore Simulation when clicking "Back"
  window.restoreSimulation = function () {
    document.getElementById('videoContainer').innerHTML = `<canvas id="motionCanvas"></canvas>`;
    document.getElementById('backButton').style.display = 'none';

    setTimeout(() => {
      initializeCanvas();
      startMotion();
    }, 100);
  };

  // Initial Draw
  initializeCanvas();
});
