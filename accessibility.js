// accessibility.js - Core utilities for quiz accessibility and keyboard navigation
// ------------------------------------------------------------
// This script provides functions to initialize ARIA roles, manage focus, and handle
// keyboard shortcuts for quiz pages. It attaches its API to the global `window` object.

(function () {
  // Initialize accessibility for a quiz.
  function initQuizAccessibility({ containerId = 'quiz-box', optionsContainerId = 'options', statusId = 'sr-status' } = {}) {
    const container = document.getElementById(containerId);
    const optionsContainer = document.getElementById(optionsContainerId);
    const srStatus = document.getElementById(statusId);

    // Ensure the options container has proper ARIA role (radiogroup) if not already set.
    if (optionsContainer && !optionsContainer.getAttribute('role')) {
      optionsContainer.setAttribute('role', 'radiogroup');
    }

    // Attach a keydown listener for navigation shortcuts.
    document.addEventListener('keydown', (e) => handleKeyNavigation(e, optionsContainer, srStatus));

    return { container, optionsContainer, srStatus };
  }

  // Keyboard navigation handler.
  function handleKeyNavigation(event, optionsContainer, srStatus) {
    const KEY = {
      LEFT: 'ArrowLeft',
      RIGHT: 'ArrowRight',
      ENTER: 'Enter',
      SPACE: ' ',
      CTRL_ENTER: 'Enter',
    };

    const activeEl = document.activeElement;
    const isOption = activeEl && activeEl.classList && activeEl.classList.contains('option');

    if (event.key === KEY.LEFT && isOption) {
      focusPrevOption(activeEl);
      event.preventDefault();
      return;
    }
    if (event.key === KEY.RIGHT && isOption) {
      focusNextOption(activeEl);
      event.preventDefault();
      return;
    }
    if ((event.key === KEY.ENTER || event.key === KEY.SPACE) && isOption) {
      activeEl.click();
      event.preventDefault();
      return;
    }
    // Ctrl+Enter to submit current answer (if submit button is visible).
    if (event.key === KEY.CTRL_ENTER && event.ctrlKey) {
      const submitBtn = document.getElementById('submit-btn');
      if (submitBtn && !submitBtn.classList.contains('hidden')) {
        submitBtn.click();
        event.preventDefault();
      }
      return;
    }
  }

  function focusPrevOption(current) {
    const options = Array.from(document.querySelectorAll('.option'));
    const idx = options.indexOf(current);
    if (idx > 0) {
      options[idx - 1].focus();
      announceOptionChange(options[idx - 1]);
    }
  }

  function focusNextOption(current) {
    const options = Array.from(document.querySelectorAll('.option'));
    const idx = options.indexOf(current);
    if (idx < options.length - 1) {
      options[idx + 1].focus();
      announceOptionChange(options[idx + 1]);
    }
  }

  function announceOptionChange(optionEl) {
    const sr = document.getElementById('sr-status');
    if (sr) {
      sr.textContent = `Option ${optionEl.textContent.trim()} selected`;
    }
  }

  function announce(message) {
    const sr = document.getElementById('sr-status');
    if (sr) {
      sr.textContent = '';
      setTimeout(() => {
        sr.textContent = message;
      }, 0);
    }
  }

  // Detect reduced motion preference and add a class to the body.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.body.classList.add('prefers-reduced-motion');
  }
  // Detect high‑contrast preference (CSS Level 4 media query) and add a class.
  if (window.matchMedia('(prefers-contrast: more)').matches) {
    document.body.classList.add('high-contrast');
  }

  // Expose API globally.
  window.initQuizAccessibility = initQuizAccessibility;
  window.srAnnounce = announce;
})();
