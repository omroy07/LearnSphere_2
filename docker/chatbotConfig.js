// Container override for chatbotConfig.js — the browser must use the same
// origin as the nginx proxy (which forwards /chat and /explain_mistake to the
// chatbot container), NOT the client's own 127.0.0.1:5000.
window.CHATBOT_BASE_URL = window.CHATBOT_BASE_URL || "";