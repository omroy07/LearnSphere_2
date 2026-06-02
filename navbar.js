/**
 * navbar.js — LearnSphere Shared Navigation Controller
 *
 * Provides hamburger menu toggle with:
 *   - Animated open/close (CSS class toggling)
 *   - ARIA accessibility (aria-expanded, aria-label)
 *   - Escape key support
 *   - Auto-close on nav link click (for SPA-like behaviour)
 *
 * USAGE: Include in any page that has the standard LearnSphere navbar:
 *   <script src="navbar.js"></script>   (root-level pages)
 *   <script src="../navbar.js"></script> (sub-directory pages)
 *
 * REQUIRED HTML STRUCTURE:
 *   <button class="hamburger" id="hamburgerBtn" ...>
 *     <span></span><span></span><span></span>
 *   </button>
 *   <nav id="navMenu">
 *     <ul>...</ul>
 *   </nav>
 *
 * Previously this logic was duplicated as inline <script> in every page.
 */

(function () {
    "use strict";

    function initNavbar() {
        const hamburgerBtn = document.getElementById("hamburgerBtn");
        const navMenu = document.getElementById("navMenu");

        if (!hamburgerBtn || !navMenu) return; // Page doesn't use this navbar pattern

        // ── Toggle open/close ────────────────────────────────────────────────
        hamburgerBtn.addEventListener("click", () => {
            const isOpen = navMenu.classList.toggle("is-open");
            hamburgerBtn.classList.toggle("is-open", isOpen);
            hamburgerBtn.setAttribute("aria-expanded", String(isOpen));
        });

        // ── Close when a nav link is clicked ────────────────────────────────
        navMenu.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", closeMenu);
        });

        // ── Close on Escape key ──────────────────────────────────────────────
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && navMenu.classList.contains("is-open")) {
                closeMenu();
                hamburgerBtn.focus(); // Return focus to trigger element
            }
        });

        // ── Close on outside click ───────────────────────────────────────────
        document.addEventListener("click", (e) => {
            const navbar = hamburgerBtn.closest(".navbar");
            if (navbar && !navbar.contains(e.target) && navMenu.classList.contains("is-open")) {
                closeMenu();
            }
        });

        function closeMenu() {
            navMenu.classList.remove("is-open");
            hamburgerBtn.classList.remove("is-open");
            hamburgerBtn.setAttribute("aria-expanded", "false");
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initNavbar);
    } else {
        initNavbar();
    }
})();
