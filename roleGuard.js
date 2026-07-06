/**
 * roleGuard.js — Centralized Role-Based Access Control (RBAC) Guard
 *
 * Implements client-side views/actions gating, testing overrides,
 * and a blueprint for server-side verification.
 */
(function () {
  const ROLE_STORAGE_KEY = "learnsphere_user_role_override"; // For local testing overrides

  function getUser() {
    try {
      const u = localStorage.getItem("user");
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  }

  function getCurrentRole() {
    // 1. Allow testing override
    const override = localStorage.getItem(ROLE_STORAGE_KEY);
    if (override) return override;

    // 2. Read from user object
    const user = getUser();
    return user && user.role ? user.role : "learner";
  }

  function setRoleOverride(role) {
    if (role) {
      localStorage.setItem(ROLE_STORAGE_KEY, role);
    } else {
      localStorage.removeItem(ROLE_STORAGE_KEY);
    }
  }

  // Permission rules for pages (matching against location.pathname)
  const PAGE_RULES = {
    "teachers.html": ["teacher"],
    "teacher_analytics.html": ["teacher"],
    "parents.html": ["parent"],
    "my_progress.html": ["learner"],
    "review.html": ["learner"],
    "learnerassignments.html": ["learner", "teacher"],
  };

  // Permission rules for actions
  const ACTION_RULES = {
    "create_class": ["teacher"],
    "build_assignment": ["teacher"],
    "export_progress": ["learner", "parent", "teacher"],
    "submit_quiz": ["learner"],
    "clear_progress": ["learner"],
    "manage_sync": ["learner"],
  };

  function hasPageAccess(pathname) {
    const filename = pathname.split("/").pop().toLowerCase() || "index.html";
    if (filename === "" || filename === "index.html" || filename === "home.html") {
      return true; // public or main landing page
    }
    
    // Find matching rule
    for (const [page, roles] of Object.entries(PAGE_RULES)) {
      if (filename.includes(page.toLowerCase())) {
        const currentRole = getCurrentRole();
        return roles.includes(currentRole);
      }
    }
    return true; // default public
  }

  function hasPermission(action) {
    const roles = ACTION_RULES[action];
    if (!roles) return true; // action not guarded
    return roles.includes(getCurrentRole());
  }

  function checkPageAccess() {
    if (typeof window === "undefined") return;
    const pathname = window.location.pathname;
    if (!hasPageAccess(pathname)) {
      console.warn(`Access Denied to ${pathname} for role ${getCurrentRole()}`);
      
      const isNested = pathname.includes("/log/") || 
                       pathname.includes("/quiz/") || 
                       pathname.includes("/sub/") || 
                       pathname.includes("/chemistryquiz/") || 
                       pathname.includes("/mathsquiz/");
      const redirectUrl = isNested ? "../home.html?error=unauthorized" : "home.html?error=unauthorized";
      window.location.href = redirectUrl;
    }
  }

  function gateAction(action, fn) {
    return function (...args) {
      if (!hasPermission(action)) {
        const err = `Unauthorized action: ${action} is not allowed for role ${getCurrentRole()}`;
        console.error(err);
        alert(err);
        throw new Error(err);
      }
      return fn.apply(this, args);
    };
  }

  /**
   * Server-Side Plan / Verification Stub
   * Since this application is client-side only, this helper serves as the architecture blueprint
   * for server-side role validation. In production, roles are validated by verifying a JWT
   * payload signature containing the user's role claim on every backend API request.
   */
  async function validateRoleOnServer(action, token) {
    if (!token) {
      return { success: false, error: "No token provided" };
    }
    // Blueprint for server request:
    // const response = await fetch('/api/verify-permission', {
    //   method: 'POST',
    //   headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ action })
    // });
    // return response.json();
    return { success: true, mocked: true, action, role: getCurrentRole() };
  }

  const roleGuard = {
    getCurrentRole,
    getUser,
    setRoleOverride,
    hasPageAccess,
    hasPermission,
    checkPageAccess,
    gateAction,
    validateRoleOnServer,
    PAGE_RULES,
    ACTION_RULES
  };

  if (typeof window !== "undefined") {
    window.roleGuard = roleGuard;
    // Auto execute page check if loaded in browser
    checkPageAccess();
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = roleGuard;
  }
})();
