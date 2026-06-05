import os
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import google.generativeai as genai

# Load API Key securely from environment variable
# Never hardcode secrets in source code.
# Set your key with: export GEMINI_API_KEY="your_key_here"  (Linux/Mac)
#                    set GEMINI_API_KEY=your_key_here        (Windows)
API_KEY = os.environ.get("GEMINI_API_KEY")

if not API_KEY:
    raise EnvironmentError(
        "GEMINI_API_KEY environment variable is not set. "
        "Please set it before running the application. "
        "See .env.example for guidance."
    )

genai.configure(api_key=API_KEY)

app = Flask(__name__, template_folder="templates", static_folder="static")
CORS(app)


def format_response(text):
    """Formats chatbot response for better readability."""
    # Safely convert markdown-like bold to HTML
    formatted_text = text.replace("**", "<b>").replace("*", "</b>").replace("\n", "<br>")
    return formatted_text.strip()


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True)

    if not data or "message" not in data:
        return jsonify({"error": "No message provided"}), 400

    user_input = data["message"]

    if not user_input or not user_input.strip():
        return jsonify({"error": "Message cannot be empty"}), 400

    try:
        model = genai.GenerativeModel("gemini-1.5-pro")
        response = model.generate_content(user_input)

        if response and response.candidates:
            reply = format_response(response.candidates[0].content.parts[0].text)
        else:
            reply = "I'm not sure how to respond to that. Can you try rephrasing?"

    except Exception as e:
        # Log internally but don't expose raw exception to the client
        print(f"[ERROR] Chatbot error: {e}")
        return jsonify({"reply": "An error occurred while processing your request. Please try again later."}), 500

    return jsonify({"reply": reply})


if __name__ == "__main__":
    # Disable debug mode in production
    debug_mode = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    app.run(debug=debug_mode)
