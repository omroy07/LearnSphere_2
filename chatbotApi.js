// chatbotApi.js — shared AI Tutor API helper used by home.js and review.js.
// Posts JSON to <CHATBOT_BASE_URL>/<path> and resolves with the parsed body.
// Throws an Error on HTTP errors so callers can show a friendly message.
window.chatbotPost = async function (path, payload) {
  const response = await fetch(window.CHATBOT_BASE_URL + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Server error: ${response.status}`);
  }

  return data;
};