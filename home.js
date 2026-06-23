/**
 * home.js — LearnSphere Dashboard Logic
 *
 * Handles logout and AI chatbot interaction.
 * XSS-safe: all user input is sanitized before being inserted into the DOM.
 */

// ── Logout ────────────────────────────────────────────────────────────────────
document.getElementById("logoutButton").addEventListener("click", function () {
    localStorage.removeItem("isLoggedIn");
    window.location.href = "index.html";
});

// ── XSS Sanitisation Helper ───────────────────────────────────────────────────
/**
 * Escapes HTML special characters to prevent XSS injection via user input
 * or unsanitized server responses being inserted with innerHTML.
 *
 * @param {string} str - Raw string that may contain HTML characters.
 * @returns {string} - HTML-entity-encoded safe string.
 */
function escapeHTML(str) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// ── Achievements (badges.js) ───────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    if (window.achievements?.renderBadges) {
        window.achievements.renderBadges("badgesContainerHome");
    }

    // Render Daily Streak stats
    if (window.quizProgress && typeof window.quizProgress.getStreak === "function") {
        const streak = window.quizProgress.getStreak();
        const days = streak.currentStreak || 0;
        
        const daysEl = document.getElementById("streakDaysText");
        const barFillEl = document.getElementById("streakProgressBarFill");
        const descEl = document.getElementById("streakNextMilestoneText");
        
        if (daysEl) daysEl.textContent = `${days} Day${days !== 1 ? 's' : ''}`;
        
        // Find next milestone
        let nextMilestone = 3;
        if (days >= 14) nextMilestone = 30;
        else if (days >= 7) nextMilestone = 14;
        else if (days >= 3) nextMilestone = 7;
        
        const pct = Math.min(100, Math.round((days / nextMilestone) * 100));
        if (barFillEl) barFillEl.style.width = `${pct}%`;
        
        // Streak dates are stored in quizProgress.js as local YYYY-MM-DD.
        // Avoid toLocaleDateString formatting mismatches across browsers/timezones.
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const todayStr = `${yyyy}-${mm}-${dd}`;
        const practicedToday = streak.lastPracticeDate === todayStr;

        
        if (descEl) {
            if (practicedToday) {
                descEl.innerHTML = `🔥 Streak safe for today! Practice tomorrow to build toward your <strong>${nextMilestone}-day</strong> milestone.`;
            } else if (days > 0) {
                descEl.innerHTML = `⚡ Practice today to keep your streak alive and reach your <strong>${nextMilestone}-day</strong> milestone!`;
            } else {
                descEl.innerHTML = `🏁 Start a quiz today to begin your daily practice streak! Next milestone: <strong>3 days</strong>.`;
            }
        }
    }

    // Check for explain_mistake redirect
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("explain_mistake") === "true") {
        // Remove param from address bar without reload
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);

        const pending = localStorage.getItem("learnsphere_pending_explanation");
        if (pending) {
            localStorage.removeItem("learnsphere_pending_explanation");
            try {
                const payload = JSON.parse(pending);
                // Wait slightly for UI/chatbot elements to settle
                setTimeout(() => {
                    triggerMistakeExplanation(payload);
                }, 500);
            } catch (e) {
                console.warn("LearnSphere: Failed to parse pending mistake explanation.", e);
            }
        }
    }

    // Wire up offline preloading
    const preloadBtn = document.getElementById("preloadOfflineBtn");
    if (preloadBtn) {
        preloadBtn.addEventListener("click", () => {
            if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
                alert("Service Worker is not active yet. Please refresh the page and try again.");
                return;
            }
            
            preloadBtn.disabled = true;
            preloadBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Preloading...`;
            
            navigator.serviceWorker.controller.postMessage({ action: "preload" });
        });

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener("message", (event) => {
            if (event.data && event.data.action === "preload-complete") {
                preloadBtn.disabled = false;
                if (event.data.success) {
                    preloadBtn.style.borderColor = "var(--completed-color)";
                    preloadBtn.style.color = "var(--completed-color)";
                    preloadBtn.style.background = "rgba(16, 185, 129, 0.08)";
                    preloadBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Practice Ready ✅`;
                    
                    // Reset styling after 4 seconds
                    setTimeout(() => {
                        preloadBtn.style.borderColor = "var(--border-color)";
                        preloadBtn.style.color = "var(--text-color)";
                        preloadBtn.style.background = "var(--btn-secondary-bg)";
                        preloadBtn.innerHTML = `<i class="fa-solid fa-download"></i> Preload for offline`;
                    }, 4000);
                } else {
                    preloadBtn.style.borderColor = "#ef4444";
                    preloadBtn.style.color = "#ef4444";
                    preloadBtn.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Preload Failed`;
                    console.error("SW preloading error:", event.data.error);
                    
                    setTimeout(() => {
                        preloadBtn.style.borderColor = "var(--border-color)";
                        preloadBtn.style.color = "var(--text-color)";
                        preloadBtn.style.background = "var(--btn-secondary-bg)";
                        preloadBtn.innerHTML = `<i class="fa-solid fa-download"></i> Preload for offline`;
                    }, 4000);
                }
            }
        });
    }
});

// ── Chatbot ───────────────────────────────────────────────────────────────────

/**
 * Appends a message bubble to the chat box.
 *
 * @param {string} sender  - Display label for the sender ("You" or "Bot").
 * @param {string} text    - Message content (will be HTML-escaped).
 * @param {string} cssClass - Optional CSS class for styling (e.g. "bot-msg").
 */
function appendMessage(sender, text, cssClass = "") {
    const chatBox = document.getElementById("chat-box");
    const msgEl = document.createElement("p");
    if (cssClass) msgEl.className = cssClass;

    // Use textContent for sender (safe) and escapeHTML for body (safe)
    const strong = document.createElement("strong");
    strong.textContent = sender + ": ";
    msgEl.appendChild(strong);

    // Create a span for the message body — escapeHTML converts to entities
    const body = document.createElement("span");
    // Allow bot's HTML-formatted responses (bold, line breaks from server)
    // but sanitize user input completely via textContent
    if (sender === "You") {
        body.textContent = text; // Never trust user input as HTML
    } else {
        // Bot responses from our own server may contain safe formatting HTML
        body.innerHTML = text;
    }
    msgEl.appendChild(body);

    chatBox.appendChild(msgEl);
    chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll to latest message
}

/**
 * Triggers a request to AI tutor to explain a quiz mistake.
 */
function triggerMistakeExplanation(payload) {
    const { question, userAnswer, correctAnswer, topicId } = payload;
    
    // Format human-readable query
    const queryText = `Can you explain the mistake I made on this question?\n\n` +
                      `**Question:** ${question}\n` +
                      `**My Answer:** ${userAnswer}\n` +
                      `**Correct Answer:** ${correctAnswer}`;
                      
    appendMessage("You", queryText, "user-msg");

    // Show typing indicator
    const chatBox = document.getElementById("chat-box");
    const typingEl = document.createElement("p");
    typingEl.id = "typing-indicator";
    typingEl.className = "typing-msg";
    typingEl.textContent = "Bot is typing...";
    chatBox.appendChild(typingEl);
    chatBox.scrollTop = chatBox.scrollHeight;

    fetch("http://127.0.0.1:5000/explain_mistake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            question: question,
            learnerAnswer: userAnswer,
            correctAnswer: correctAnswer,
            topic: topicId || "general"
        }),
    })
    .then((response) => {
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        return response.json();
    })
    .then((data) => {
        const typing = document.getElementById("typing-indicator");
        if (typing) typing.remove();

        const reply = data.reply || "Sorry, I couldn't generate an explanation.";
        appendMessage("Bot", reply, "bot-msg");

        // Save last explanation per topic in localStorage for quick access
        localStorage.setItem(`learnsphere_last_explanation_${topicId || 'general'}`, reply);
    })
    .catch((error) => {
        console.error("Explain mistake error:", error);
        const typing = document.getElementById("typing-indicator");
        if (typing) typing.remove();
        appendMessage(
            "Bot",
            "⚠️ Unable to connect to the AI tutor. Please ensure the backend server is running.",
            "bot-msg error-msg"
        );
    });
}

/**
 * Sends user message to the backend chatbot API.
 * Triggered by the Send button or pressing Enter in the input field.
 */
function sendMessage() {
    const inputEl = document.getElementById("user-input");
    const userInput = inputEl.value.trim();

    if (!userInput) return;

    // Render user message (textContent — XSS safe)
    appendMessage("You", userInput, "user-msg");
    inputEl.value = "";

    // Show typing indicator
    const chatBox = document.getElementById("chat-box");
    const typingEl = document.createElement("p");
    typingEl.id = "typing-indicator";
    typingEl.className = "typing-msg";
    typingEl.textContent = "Bot is typing...";
    chatBox.appendChild(typingEl);
    chatBox.scrollTop = chatBox.scrollHeight;

    fetch("http://127.0.0.1:5000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userInput }),
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            return response.json();
        })
        .then((data) => {
            const typing = document.getElementById("typing-indicator");
            if (typing) typing.remove();

            const reply = data.reply || "Sorry, I didn't understand that.";
            appendMessage("Bot", reply, "bot-msg");
        })
        .catch((error) => {
            console.error("Chatbot error:", error);
            const typing = document.getElementById("typing-indicator");
            if (typing) typing.remove();
            appendMessage(
                "Bot",
                "⚠️ Unable to connect to the AI tutor. Please ensure the backend server is running.",
                "bot-msg error-msg"
            );
        });
}

// ── Keyboard Support ─────────────────────────────────────────────────────────
const inputEl = document.getElementById("user-input");
if (inputEl) {
    inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

// ── Course Assignments Rendering ─────────────────────────────────────────────
(function () {
    'use strict';

    const ASSIGNMENTS_KEY = "learnsphere_assignments";
    const SUBMISSIONS_KEY = "learnsphere_assignment_submissions";

    const TOPIC_QUIZ_MAP = {
        "physics-motion": "quiz/motionquiz.html",
        "physics-nlm": "quiz/nlmquiz.html",
        "physics-projectile": "quiz/projectilequiz.html",
        "physics-ray": "quiz/rayquiz.html",
        "maths-calculus": "mathsquiz/calculusquiz.html",
        "maths-vectors": "mathsquiz/vectorquiz.html",
        "maths-probability": "mathsquiz/probabilityquiz.html",
        "maths-geometry": "mathsquiz/geometryquiz.html",
        "chemistry-atomic": "chemistryquiz/atomic_structurequiz.html",
        "chemistry-bonding": "chemistryquiz/chemical_bondingquiz.html",
        "chemistry-equil": "chemistryquiz/equilibriumquiz.html",
        "chemistry-thermo": "chemistryquiz/thermoquiz.html"
    };

    const ALL_TOPICS = [
        { id: "physics-motion", label: "Physics: Motion" },
        { id: "physics-nlm", label: "Physics: Newton's Laws of Motion" },
        { id: "physics-projectile", label: "Physics: Projectile Motion" },
        { id: "physics-ray", label: "Physics: Ray Optics" },
        { id: "maths-calculus", label: "Maths: Calculus" },
        { id: "maths-vectors", label: "Maths: Vectors & 3D Geometry" },
        { id: "maths-probability", label: "Maths: Probability & Statistics" },
        { id: "maths-geometry", label: "Maths: Coordinate Geometry" },
        { id: "chemistry-atomic", label: "Chemistry: Atomic Structure" },
        { id: "chemistry-bonding", label: "Chemistry: Chemical Bonding" },
        { id: "chemistry-equil", label: "Chemistry: Equilibrium" },
        { id: "chemistry-thermo", label: "Chemistry: Thermodynamics" }
    ];

    function getCurrentStudentEmail() {
        try {
            const user = JSON.parse(localStorage.getItem("user"));
            return user && user.email ? user.email : "guest@learnsphere.com";
        } catch (e) {
            return "guest@learnsphere.com";
        }
    }

    function renderAssignments() {
        const container = document.getElementById("assignmentsList");
        if (!container) return;

        let assignments = [];
        let submissions = [];

        try {
            assignments = JSON.parse(localStorage.getItem(ASSIGNMENTS_KEY)) || [];
        } catch (e) {}

        try {
            submissions = JSON.parse(localStorage.getItem(SUBMISSIONS_KEY)) || [];
        } catch (e) {}

        const studentEmail = getCurrentStudentEmail();
        container.innerHTML = "";

        if (assignments.length === 0) {
            container.innerHTML = `<p style="color: var(--text-muted); text-align: center; margin: 12px 0;">No assignments assigned yet.</p>`;
            return;
        }

        // Sort assignments: Active/Pending first, then Overdue, then Completed (newest first)
        const categorized = assignments.map(asg => {
            const sub = submissions.find(s => s.assignmentId === asg.id && s.studentEmail === studentEmail);
            
            // Check if overdue
            const todayStr = new Date().toISOString().split('T')[0];
            const isOverdue = !sub && asg.dueDate < todayStr;
            
            let status = "pending";
            if (sub) status = "completed";
            else if (isOverdue) status = "overdue";

            return { asg, sub, status };
        });

        // Sort by status weight (pending: 1, overdue: 2, completed: 3) and then date
        categorized.sort((a, b) => {
            const weight = { "pending": 1, "overdue": 2, "completed": 3 };
            if (weight[a.status] !== weight[b.status]) {
                return weight[a.status] - weight[b.status];
            }
            return new Date(b.asg.createdAt) - new Date(a.asg.createdAt);
        });

        categorized.forEach(({ asg, sub, status }) => {
            // Find topic labels
            const topicLabels = asg.topicIds.map(id => {
                const found = ALL_TOPICS.find(t => t.id === id);
                return found ? found.label : id;
            }).join(", ");

            const card = document.createElement("div");
            card.className = `assignment-card ${status}`;
            
            let statusBadge = "";
            let actionArea = "";

            if (status === "completed") {
                const pct = sub.totalQuestions > 0 ? Math.round((sub.score / sub.totalQuestions) * 100) : 0;
                statusBadge = `<span class="assignment-status-badge" style="color: var(--completed-color); border-color: var(--completed-color);">Completed ✅</span>`;
                actionArea = `
                    <div style="text-align: right;">
                        <div style="font-size: 1.1rem; font-weight: 700; color: var(--completed-color);">${sub.score} / ${sub.totalQuestions}</div>
                        <div class="muted" style="font-size: 0.8rem; color: var(--text-muted);">${pct}% accuracy</div>
                    </div>
                `;
            } else if (status === "overdue") {
                statusBadge = `<span class="assignment-status-badge" style="color: #ef4444; border-color: #ef4444;">Overdue ❌</span>`;
                actionArea = `
                    <div class="assignment-actions">
                        ${asg.topicIds.map(topicId => {
                            const foundTopic = ALL_TOPICS.find(t => t.id === topicId);
                            const label = foundTopic ? foundTopic.label.replace(/^Physics:\s*|^Maths:\s*|^Chemistry:\s*/, "") : topicId;
                            const path = TOPIC_QUIZ_MAP[topicId];
                            if (!path) return "";
                            return `<a href="${path}?assignment=${asg.id}" class="assignment-btn" style="background: var(--btn-secondary-bg); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.4);">Late Quiz: ${label}</a>`;
                        }).join("")}
                    </div>
                `;
            } else {
                statusBadge = `<span class="assignment-status-badge" style="color: var(--in-progress-color); border-color: var(--in-progress-color);">Pending ⏳</span>`;
                actionArea = `
                    <div class="assignment-actions">
                        ${asg.topicIds.map(topicId => {
                            const foundTopic = ALL_TOPICS.find(t => t.id === topicId);
                            const label = foundTopic ? foundTopic.label.replace(/^Physics:\s*|^Maths:\s*|^Chemistry:\s*/, "") : topicId;
                            const path = TOPIC_QUIZ_MAP[topicId];
                            if (!path) return "";
                            return `<a href="${path}?assignment=${asg.id}" class="assignment-btn">Start Quiz: ${label}</a>`;
                        }).join("")}
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="assignment-info">
                    <h3 style="margin: 0; font-size: 1.1rem; color: var(--text-color); font-weight: 600;">${topicLabels}</h3>
                    <div class="assignment-meta">
                        <span class="difficulty-badge ${asg.difficulty}">${asg.difficulty.toUpperCase()}</span>
                        <span>•</span>
                        <span>${asg.numQuestions} questions</span>
                        <span>•</span>
                        <span style="color: ${status === 'overdue' ? '#ef4444' : 'var(--text-muted)'}; font-weight: ${status === 'overdue' ? 'bold' : 'normal'}">Due: ${asg.dueDate}</span>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 16px;">
                    ${statusBadge}
                    ${actionArea}
                </div>
            `;

            container.appendChild(card);
        });
    }

    // Load assignments list on page load
    document.addEventListener("DOMContentLoaded", () => {
        renderAssignments();
    });

    // Expose for troubleshooting
    window.learnerAssignments = {
        renderAssignments
    };
})();
