/**
 * script.js — LearnSphere Landing Page Scripts
 *
 * Previously contained alert() calls on CTA buttons that blocked navigation:
 *
 *   button.addEventListener("click", () => {
 *       alert(`You clicked on ${button.innerText}!`); // ← blocks <a> href!
 *   });
 *
 * This conflicted with <a> tags inside buttons. When a user clicked
 * "Learners", an alert fired but the href navigation was suppressed.
 *
 * FIX: Removed the conflicting alert() event listeners entirely.
 * Navigation now works purely through <a> tags inside .cta buttons.
 *
 * Login/Signup buttons also had alert() listeners that fired before the
 * browser followed the <a href="log/login.html"> link — these are removed.
 *
 * The hamburger navbar logic has been extracted to navbar.js (shared).
 */

// No CTA alert listeners — they conflicted with href navigation.
// Navigation is handled by <a> tags inside the .cta and .login/.signup buttons.
