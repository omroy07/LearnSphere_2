// authApi.js — shared authentication API helper for LearnSphere.
// Auth runs on the Node.js server (see authConfig.js for AUTH_BASE_URL).

window.AUTH_BASE_URL = window.AUTH_BASE_URL || "http://127.0.0.1:5001";

window.authGetToken = function () {
  return localStorage.getItem("authToken");
};

window.authSetSession = function (token, user) {
  if (token) {
    localStorage.setItem("authToken", token);
  }
  if (user) {
    localStorage.setItem("user", JSON.stringify(user));
  }
  localStorage.setItem("isLoggedIn", "true");
};

window.authClearSession = function () {
  localStorage.removeItem("authToken");
  localStorage.removeItem("isLoggedIn");
  localStorage.removeItem("user");
};

window.authIsLoggedIn = function () {
  return Boolean(window.authGetToken()) && localStorage.getItem("isLoggedIn") === "true";
};

window.authFetch = async function (path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const token = window.authGetToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(window.AUTH_BASE_URL + path, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Server error: ${response.status}`);
  }

  return data;
};

window.authPost = function (path, payload) {
  return window.authFetch(path, {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
};

window.authRegister = function (name, email, password) {
  return window.authPost("/api/auth/register", { name, email, password });
};

window.authLogin = function (email, password) {
  return window.authPost("/api/auth/login", { email, password });
};

window.authLogout = async function () {
  try {
    if (window.authGetToken()) {
      await window.authPost("/api/auth/logout", {});
    }
  } catch (error) {
    console.warn("LearnSphere: logout request failed, clearing local session.", error);
  } finally {
    window.authClearSession();
  }
};

window.authForgotPassword = function (email) {
  return window.authPost("/api/auth/forgot-password", { email });
};

window.authResetPassword = function (token, password) {
  return window.authPost("/api/auth/reset-password", { token, password });
};

window.authVerifyEmail = function (token) {
  return window.authFetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
};
