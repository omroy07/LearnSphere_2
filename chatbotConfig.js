// chatbotConfig.js — where the AI Tutor backend lives.
// Default keeps the documented local workflow working (Flask on 127.0.0.1:5000).
// For same-origin deployments (Vite dev proxy or the nginx container proxy),
// set CHATBOT_BASE_URL before this script loads, or override it in the
// container build (see docker/chatbotConfig.js).
window.CHATBOT_BASE_URL = window.CHATBOT_BASE_URL || "http://127.0.0.1:5000";