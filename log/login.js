/**
 * login.js — LearnSphere Authentication Logic
 *
 * Handles login, registration, and password reset via the Node.js auth API.
 * JWT tokens are stored in localStorage; passwords are never stored client-side.
 */

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const forgotForm = document.getElementById('forgotPasswordForm');
  const resetForm = document.getElementById('resetPasswordForm');
  const verifyBtn = document.getElementById('verifyEmailBtn');

  if (
    window.location.pathname.includes('login.html') &&
    window.authIsLoggedIn &&
    window.authIsLoggedIn()
  ) {
    window.location.href = '../home.html';
    return;
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();

      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const submitBtn = document.getElementById('loginSubmitBtn');

      if (!email || !password) {
        showError('Please fill in all fields.');
        return;
      }

      setLoading(submitBtn, true);

      try {
        const data = await window.authLogin(email, password);
        window.authSetSession(data.token, data.user);
        window.location.href = '../home.html';
      } catch (error) {
        showError(error.message || 'Login failed. Please try again.');
      } finally {
        setLoading(submitBtn, false);
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async e => {
      e.preventDefault();

      const fullname = document.getElementById('fullname').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const submitBtn = document.getElementById('registerSubmitBtn');

      if (!fullname || !email || !password) {
        showError('Please fill out all fields.');
        return;
      }

      if (password.length < 6) {
        showError('Password must be at least 6 characters.');
        return;
      }

      setLoading(submitBtn, true);

      try {
        const data = await window.authRegister(fullname, email, password);
        if (!data.email_verification_sent) {
          showError(data.error || 'Account created, but the verification email could not be sent.');
          return;
        }
        showSuccess(data.message || 'Account created. Check your email to verify your account, then log in.');
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 2000);
      } catch (error) {
        showError(error.message || 'Registration failed. Please try again.');
      } finally {
        setLoading(submitBtn, false);
      }
    });
  }

  if (forgotForm) {
    forgotForm.addEventListener('submit', async e => {
      e.preventDefault();

      const email = document.getElementById('email').value.trim();
      const submitBtn = document.getElementById('forgotSubmitBtn');

      if (!email) {
        showError('Please enter your email address.');
        return;
      }

      setLoading(submitBtn, true);

      try {
        const data = await window.authForgotPassword(email);
        showSuccess(data.message || 'A password reset link has been sent to your email.');
        forgotForm.reset();
      } catch (error) {
        showError(error.message || 'Unable to send reset link. Please try again.');
      } finally {
        setLoading(submitBtn, false);
      }
    });
  }

  if (resetForm) {
    const tokenInput = document.getElementById('resetToken');
    const urlToken = new URLSearchParams(window.location.search).get('token');
    if (tokenInput && urlToken) {
      tokenInput.value = urlToken;
    }

    resetForm.addEventListener('submit', async e => {
      e.preventDefault();

      const token = document.getElementById('resetToken').value.trim();
      const password = document.getElementById('password').value;
      const submitBtn = document.getElementById('resetSubmitBtn');

      if (!token || !password) {
        showError('Please fill in all fields.');
        return;
      }

      if (password.length < 6) {
        showError('Password must be at least 6 characters.');
        return;
      }

      setLoading(submitBtn, true);

      try {
        const data = await window.authResetPassword(token, password);
        showSuccess(data.message || 'Password reset successfully. Redirecting to login...');
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 2000);
      } catch (error) {
        showError(error.message || 'Unable to reset password. Please try again.');
      } finally {
        setLoading(submitBtn, false);
      }
    });
  }

  if (verifyBtn) {
    const urlToken = new URLSearchParams(window.location.search).get('token');
    if (!urlToken) {
      showError('No verification token found in the link.');
      return;
    }

    verifyBtn.addEventListener('click', async () => {
      setLoading(verifyBtn, true);

      try {
        const data = await window.authVerifyEmail(urlToken);
        showSuccess(data.message || 'Email verified successfully!');
        verifyBtn.style.display = 'none';
      } catch (error) {
        showError(error.message || 'Verification failed. The link may have expired.');
      } finally {
        setLoading(verifyBtn, false);
      }
    });
  }
});

function setLoading(button, isLoading) {
  if (!button) return;
  button.disabled = isLoading;
  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = 'Please wait...';
  } else if (button.dataset.originalText) {
    button.textContent = button.dataset.originalText;
  }
}

function showError(message) {
  const host = document.getElementById('auth-message');
  if (host) {
    host.className = 'auth-alert auth-alert--error';
    host.textContent = message;
    host.hidden = false;
    return;
  }

  let errorEl = document.getElementById('auth-error');
  if (!errorEl) {
    errorEl = document.createElement('p');
    errorEl.id = 'auth-error';
    errorEl.className = 'auth-alert auth-alert--error';
    errorEl.setAttribute('role', 'alert');
    const container = document.querySelector('.auth-container');
    if (container) container.prepend(errorEl);
  }
  errorEl.textContent = message;
  errorEl.hidden = false;

  const successEl = document.getElementById('auth-success');
  if (successEl) successEl.hidden = true;
}

function showSuccess(message) {
  const host = document.getElementById('auth-message');
  if (host) {
    host.className = 'auth-alert auth-alert--success';
    host.textContent = message;
    host.hidden = false;
    return;
  }

  let successEl = document.getElementById('auth-success');
  if (!successEl) {
    successEl = document.createElement('p');
    successEl.id = 'auth-success';
    successEl.className = 'auth-alert auth-alert--success';
    successEl.setAttribute('role', 'status');
    const container = document.querySelector('.auth-container');
    if (container) container.prepend(successEl);
  }
  successEl.textContent = message;
  successEl.hidden = false;

  const errorEl = document.getElementById('auth-error');
  if (errorEl) errorEl.hidden = true;
}
