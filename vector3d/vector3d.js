let scene, camera, renderer;
let vectorGroup;

function init() {
  const canvas = document.getElementById('vectorCanvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x001f3f);

  camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
  camera.position.set(5, 5, 10);
  camera.lookAt(0, 0, 0);

  // Add ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);

  // Add axes helper
  const axesHelper = new THREE.AxesHelper(5);
  scene.add(axesHelper);

  // Group to hold vectors
  vectorGroup = new THREE.Group();
  scene.add(vectorGroup);

  animate();
}

function addVector() {
  // Generate a random vector
  const x = Math.random() * 4 - 2;
  const y = Math.random() * 4 - 2;
  const z = Math.random() * 4 - 2;
  const dir = new THREE.Vector3(x, y, z).normalize();
  const length = Math.sqrt(x * x + y * y + z * z);
  const hex = Math.random() * 0xffffff;

  const arrowHelper = new THREE.ArrowHelper(dir, new THREE.Vector3(0, 0, 0), length, hex);
  vectorGroup.add(arrowHelper);
}

function resetScene() {
  // Remove all vectors
  while (vectorGroup.children.length > 0) {
    vectorGroup.remove(vectorGroup.children[0]);
  }
}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

// Initialize the scene
init();

// Function to load content dynamically
function loadContent(section) {
  const contentArea = document.getElementById('contentArea');
  let content = '';

  switch (section) {
    case 'theory':
      content = `
        <h2>Theory</h2>
        <p>Vectors are quantities that have both magnitude and direction. In 3D geometry, vectors are represented by coordinates (x, y, z) and are fundamental in describing physical quantities like force, velocity, and displacement.</p>
      `;
      break;
    case 'animation':
      content = `
        <h2>Animation</h2>
        <p>Below is an animation demonstrating vector addition:</p>
        <iframe src="vector_animation.html" width="100%" height="400px" frameborder="0"></iframe>
      `;
      break;
    case 'formulas':
      content = `
        <h2>Formula & Derivation</h2>
        <p><strong>Vector Addition:</strong> <em>𝐴 + 𝐵 = (A<sub>x</sub> + B<sub>x</sub>, A<sub>y</sub> + B<sub>y</sub>, A<sub>z</sub> + B<sub>z</sub>)</em></p>
        <p><strong>Dot Product:</strong> <em>𝐴 · 𝐵 = A<sub>x</sub>B<sub>x</sub> + A<sub>y</sub>B<sub>y</sub> + A<sub>z</sub>B<sub>z</sub></em></p>
        <p><strong>Cross Product:</strong> <em>𝐴 × 𝐵 = (A<sub>y</sub>B<sub>z</sub> - A<sub>z</sub>B<sub>y</sub>, A<sub>z</sub>B<sub>x</sub> - A<sub>x</sub>B<sub>z</sub>, A<sub>x</sub>B<sub>y</sub> - A<sub>y</sub>B<sub>x</sub>)</em></p>
      `;
      break;
    case 'realLife':
      content = `
        <h2>Real-Life Example</h2>
        <p>In aviation, pilots use vectors to determine the direction and speed of an aircraft, considering wind speed and direction to navigate accurately.</p>
      `;
      break;
    case 'interactive':
      content = `
        <h2>Interactive</h2>
        <p>Use the simulation below to explore vector operations:</p>
        <iframe src="vector_simulation.html" width="100%" height="400px" frameborder="0"></iframe>
      `;
      break;
    default:
      content = `<p>Content not found.</p>`;
  }

  contentArea.innerHTML = content;
}

// Function to open the feedback form
function openFeedbackForm() {
  document.getElementById('feedbackPopup').classList.remove('hidden');
}

// Function to close the feedback form
function closeFeedbackForm() {
  document.getElementById('feedbackPopup').classList.add('hidden');
}

// Function to submit feedback
function submitFeedback() {
  const feedback = document.getElementById('feedbackInput').value;
  if (feedback.trim() === '') {
    alert('Please enter your feedback before submitting.');
    return;
  }

  // Here you can add code to send the feedback to a server or API
  // For demonstration, we'll just log it to the console
  console.log('User Feedback:', feedback);

  // Clear the textarea and close the popup
  document.getElementById('feedbackInput').value = '';
  closeFeedbackForm();
  alert('Thank you for your feedback!');
}
