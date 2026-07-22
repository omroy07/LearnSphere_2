/**
 * login.js — LearnSphere Authentication Logic
 *
 * Handles login and registration form submission using localStorage.
 * Note: This is a client-side demo implementation. In production,
 * authentication must be handled server-side with hashed passwords
 * and proper session management.
 */

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');

  // BUG FIX: localStorage always returns strings, never booleans.
  // Previously: localStorage.getItem("isLoggedIn") === true  → always false
  // Fixed:      localStorage.getItem("isLoggedIn") === "true" → correct
  if (
    window.location.pathname.includes('login.html') &&
    localStorage.getItem('isLoggedIn') === 'true'
  ) {
    window.location.href = '../home.html';
    return; // Prevent further execution after redirect
  }

  // ── Login Form ──────────────────────────────────────────────────
  if (loginForm) {
    loginForm.addEventListener('submit', e => {
      e.preventDefault();

      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;

      if (!email || !password) {
        showError('Please fill in all fields.');
        return;
      }

      const storedUser = JSON.parse(localStorage.getItem('user'));

      if (storedUser && storedUser.email === email && storedUser.password === password) {
        localStorage.setItem('isLoggedIn', 'true'); // Store as string "true"
        window.location.href = '../home.html';
      } else {
        showError('Invalid email or password. Please try again.');
      }
    });
  }

  // ── Registration Form ────────────────────────────────────────────
  if (registerForm) {
    registerForm.addEventListener('submit', e => {
      e.preventDefault();

      const fullname = document.getElementById('fullname').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;

      if (!fullname || !email || !password) {
        showError('Please fill out all fields.');
        return;
      }

      if (password.length < 6) {
        showError('Password must be at least 6 characters.');
        return;
      }

      const user = { fullname, email, password };
      localStorage.setItem('user', JSON.stringify(user));

      // Show success before redirecting
      showSuccess('Account created! Redirecting to login...');
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1500);
    });
  }
});

/**
 * Displays an inline error message instead of using alert().
 * @param {string} message
 */
function showError(message) {
  let errorEl = document.getElementById('auth-error');
  if (!errorEl) {
    errorEl = document.createElement('p');
    errorEl.id = 'auth-error';
    errorEl.setAttribute('role', 'alert');
    errorEl.setAttribute('aria-live', 'assertive');
    errorEl.style.cssText = 'color:#ff6b6b;font-size:0.9rem;margin-top:10px;font-weight:bold;';
    const form = document.querySelector('form');
    if (form) form.appendChild(errorEl);
  }
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

/**
 * Displays an inline success message instead of using alert().
 * @param {string} message
 */
function showSuccess(message) {
  let successEl = document.getElementById('auth-success');
  if (!successEl) {
    successEl = document.createElement('p');
    successEl.id = 'auth-success';
    successEl.setAttribute('role', 'status');
    successEl.setAttribute('aria-live', 'polite');
    successEl.style.cssText = 'color:#66fcf1;font-size:0.9rem;margin-top:10px;font-weight:bold;';
    const form = document.querySelector('form');
    if (form) form.appendChild(successEl);
  }
  successEl.textContent = message;
  successEl.style.display = 'block';
}
