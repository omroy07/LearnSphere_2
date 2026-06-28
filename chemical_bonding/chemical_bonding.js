function loadTheory() {
  const content = `
    <h2>Theory: Chemical Bonding</h2>
    <p>Atoms bond to achieve stability. The main types of bonds are:</p>
    <ul>
      <li><b>Ionic Bonding:</b> Transfer of electrons between atoms.</li>
      <li><b>Covalent Bonding:</b> Sharing of electrons between atoms.</li>
      <li><b>Metallic Bonding:</b> Free electrons shared in a metal lattice.</li>
    </ul>
    <p>Molecular geometry is the 3D arrangement of atoms in a molecule, influenced by bonding and lone pairs.</p>
  `;
  document.getElementById('contentContainer').innerHTML = content;
}

function loadAnimation() {
  // Opens PhET simulation of molecule shapes in a new tab
  window.open("https://phet.colorado.edu/en/simulation/molecule-shapes", "_blank");
}

function loadFormulas() {
  const content = `
    <h2>Common Molecular Shapes</h2>
    <ul>
      <li><b>Linear:</b> CO<sub>2</sub></li>
      <li><b>Bent:</b> H<sub>2</sub>O</li>
      <li><b>Trigonal Planar:</b> BF<sub>3</sub></li>
      <li><b>Tetrahedral:</b> CH<sub>4</sub></li>
    </ul>
  `;
  document.getElementById('contentContainer').innerHTML = content;
}

function loadRealLifeExample() {
  const content = `
    <h2>Real-Life Example</h2>
    <p>Water (H<sub>2</sub>O) has a bent shape due to two lone pairs on oxygen, which affects its molecular geometry and properties.</p>
    <iframe width="100%" height="300" src="https://www.youtube.com/embed/DOS2Yz3X7C8" title="Water molecule geometry" frameborder="0" allowfullscreen></iframe>
  `;
  document.getElementById('contentContainer').innerHTML = content;
}

function loadInteractive() {
  // Opens an interactive 3D molecule viewer in a new tab
  window.open("https://chemapps.stolaf.edu/jmol/jmol.php", "_blank");
}

function openFeedbackForm() {
  document.getElementById("feedbackPopup").style.display = "block";
}

function closeFeedbackForm() {
  document.getElementById("feedbackPopup").style.display = "none";
}

function submitFeedback() {
  const feedback = document.getElementById("feedbackInput").value.trim();
  if (feedback) {
    alert("Thank you for your feedback! 😊\n\n" + feedback);
    document.getElementById("feedbackInput").value = "";
    closeFeedbackForm();
  } else {
    alert("Please enter your feedback before submitting.");
  }
}

const canvas = document.getElementById('moleculeCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;

const centerX = canvas ? canvas.width / 2 : 0;
const centerY = canvas ? canvas.height / 2 : 0;

// Draw central atom (Carbon)
function drawCentralAtom() {
  if (!ctx) return;

  ctx.beginPath();
  ctx.arc(centerX, centerY, 20, 0, 2 * Math.PI);
  ctx.fillStyle = '#333';
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = '16px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('C', centerX, centerY);
}

// Draw surrounding atoms (Hydrogen)
function drawHydrogenAtoms() {
  if (!ctx) return;

  const radius = 100;
  const angles = [0, 90, 180, 270]; // Degrees

  angles.forEach(angle => {
    const rad = angle * (Math.PI / 180);
    const x = centerX + radius * Math.cos(rad);
    const y = centerY + radius * Math.sin(rad);

    // Draw bond
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(x, y);
    ctx.stroke();

    // Draw hydrogen atom
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, 2 * Math.PI);
    ctx.fillStyle = '#999';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', x, y);
  });
}

// Initialize drawing
drawCentralAtom();
drawHydrogenAtoms();
