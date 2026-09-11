import os
import time
import html
from collections import defaultdict, deque

from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from dotenv import load_dotenv
import google.generativeai as genai

# Load the .env file (GEMINI_API_KEY, GEMINI_MODEL, etc.) before
# reading any environment variables so `cp .env.example .env` just works.
load_dotenv()

# -----------------------------
# Security: API key via env var
# -----------------------------
API_KEY = os.environ.get("GEMINI_API_KEY")

if not API_KEY:
    raise EnvironmentError(
        "GEMINI_API_KEY environment variable is not set. "
        "Set it before running the server."
    )

genai.configure(api_key=API_KEY)

# -----------------------------
# App setup
# -----------------------------
app = Flask(__name__, template_folder="templates", static_folder="static")
CORS(app)

# Create the model once at startup (cheaper than per request)
# gemini-2.5-flash is a current, widely-available default; override via GEMINI_MODEL.
MODEL_NAME = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
model = genai.GenerativeModel(MODEL_NAME)


# -----------------------------
# Input/output hardening
# -----------------------------
MAX_MESSAGE_CHARS = int(os.environ.get("CHAT_MAX_MESSAGE_CHARS", "2000"))

# Simple refusal/guardrail keywords (heuristic)
ABUSE_KEYWORDS = [
    # Prompt injection patterns
    "ignore previous",
    "disregard",
    "system prompt",
    "developer prompt",
    "jailbreak",
    "act as",
    "bypass",
    "reveal your instructions",
    # Harmful/illegal categories (basic)
    "how to build a bomb",
    "make a bomb",
    "poison",
    "suicide",
    "self-harm",
    "kill yourself",
    "kill someone",
    "murder",
    "steal",
    "credit card",
    "creditcard",
]


def format_response(text: str) -> str:
    """Return safe text for the frontend (no unsafe HTML)."""
    if text is None:
        return ""
    # Escape HTML to prevent XSS; preserve line breaks.
    return html.escape(text).replace("\n", "<br>").strip()


def looks_like_abuse(user_text: str) -> bool:
    t = (user_text or "").lower()
    return any(k in t for k in ABUSE_KEYWORDS)


# -----------------------------
# Rate limiting (per IP)
# In-memory sliding window.
# -----------------------------
RATE_LIMIT_WINDOW_SECONDS = int(os.environ.get("CHAT_RATE_LIMIT_WINDOW_SECONDS", "60"))
RATE_LIMIT_COUNT = int(os.environ.get("CHAT_RATE_LIMIT_COUNT", "10"))

# ip -> deque[timestamps]
_requests = defaultdict(deque)


def rate_limited(ip: str) -> bool:
    now = time.time()
    q = _requests[ip]

    # Drop old timestamps
    while q and (now - q[0]) > RATE_LIMIT_WINDOW_SECONDS:
        q.popleft()

    if len(q) >= RATE_LIMIT_COUNT:
        return True

    q.append(now)
    return False


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True)

    if not data or "message" not in data:
        return jsonify({"error": "No message provided"}), 400

    user_input = data["message"]

    if not isinstance(user_input, str):
        return jsonify({"error": "Message must be a string"}), 400

    user_input = user_input.strip()

    if not user_input:
        return jsonify({"error": "Message cannot be empty"}), 400

    if len(user_input) > MAX_MESSAGE_CHARS:
        return (
            jsonify({"error": f"Message too large (max {MAX_MESSAGE_CHARS} characters)."}),
            413,
        )

    # Rate limit per IP
    ip = request.headers.get("X-Forwarded-For", request.remote_addr) or "unknown"
    ip = ip.split(",")[0].strip()  # handle proxies lists

    if rate_limited(ip):
        return jsonify({"error": "Too many requests. Please try again later."}), 429

    # Basic abuse prevention / guardrails
    if looks_like_abuse(user_input):
        reply = (
            "I can’t help with that request. "
            "If you need help with a physics, maths, chemistry, or biology topic, tell me what concept you’re working on."
        )
        return jsonify({"reply": format_response(reply)})

    try:
        # Keep the model constrained to educational tutoring.
        system_guardrails = (
            "You are an educational tutor for Physics, Maths, Chemistry, and Biology. "
            "Be concise, step-by-step when useful, and avoid unsafe or illegal content. "
            "If the user asks for something unrelated, politely guide them back to learning topics."
        )

        # Structured prompt (reduces injection impact)
        prompt = f"{system_guardrails}\n\nUser message: {user_input}"

        response = model.generate_content(prompt)

        reply_text = ""
        if response and getattr(response, "candidates", None):
            cand0 = response.candidates[0] if response.candidates else None
            parts = getattr(getattr(cand0, "content", None), "parts", None)
            if parts and len(parts) > 0:
                reply_text = getattr(parts[0], "text", None) or ""

        if not reply_text:
            reply_text = "I’m not sure how to respond to that. Can you try rephrasing?"

        return jsonify({"reply": format_response(reply_text)})

    except Exception as e:
        # Log internally but don't expose raw exception to the client
        print(f"[ERROR] Chatbot error: {e}")
        return (
            jsonify({"reply": "An error occurred while processing your request. Please try again later."}),
            500,
        )


@app.route("/explain_mistake", methods=["POST"])
def explain_mistake():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "No data provided"}), 400

    question = data.get("question", "").strip()
    learner_answer = data.get("learnerAnswer", "").strip()
    correct_answer = data.get("correctAnswer", "").strip()
    topic = data.get("topic", "general").strip()

    if not question or not learner_answer or not correct_answer:
        return jsonify({"error": "Missing required fields (question, learnerAnswer, correctAnswer)"}), 400

    # Rate limit per IP
    ip = request.headers.get("X-Forwarded-For", request.remote_addr) or "unknown"
    ip = ip.split(",")[0].strip()

    if rate_limited(ip):
        return jsonify({"error": "Too many requests. Please try again later."}), 429

    try:
        # Structured prompt instructing the model to explain the concept and give a follow-up question
        system_prompt = (
            "You are an educational tutor for Physics, Maths, Chemistry, and Biology. "
            "A learner made a mistake on a quiz. Please provide a targeted explanation including:\n"
            "1. Why the selected answer is incorrect.\n"
            "2. What core concept this maps to, explained simply.\n"
            "3. One follow-up practice question (multiple choice) to test their understanding, "
            "with a clearly indicated answer key/rubric."
        )

        prompt = (
            f"{system_prompt}\n\n"
            f"Topic: {topic}\n"
            f"Question Text: {question}\n"
            f"Learner's Selected Answer: {learner_answer}\n"
            f"Correct Answer: {correct_answer}"
        )

        response = model.generate_content(prompt)

        reply_text = ""
        if response and getattr(response, "candidates", None):
            cand0 = response.candidates[0] if response.candidates else None
            parts = getattr(getattr(cand0, "content", None), "parts", None)
            if parts and len(parts) > 0:
                reply_text = getattr(parts[0], "text", None) or ""

        if not reply_text:
            reply_text = "I'm not sure how to explain this mistake. Let's review the main concept together."

        return jsonify({"reply": format_response(reply_text)})

    except Exception as e:
        print(f"[ERROR] Mistake explanation error: {e}")
        return (
            jsonify({"reply": "An error occurred while generating the explanation. Please try again later."}),
            500,
        )


if __name__ == "__main__":
    debug_mode = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=5000, debug=debug_mode)

