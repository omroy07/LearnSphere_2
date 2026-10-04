/**
 * assistant.js — LearnSphere AI Learning Assistant Client Controller
 */

(function () {
    "use strict";

    // API Base URL (proxied by Vite during dev or uses port 5000 directly)
    const API_BASE = window.location.origin;

    // DOM Elements
    const promptInput = document.getElementById("goalPrompt");
    const levelSelect = document.getElementById("learnerLevel");
    const timeframeSelect = document.getElementById("targetTimeframe");
    const hoursSelect = document.getElementById("weeklyHours");
    const generateBtn = document.getElementById("generateBtn");

    const loadingBox = document.getElementById("loadingBox");
    const loadingTicker = document.getElementById("loadingTicker");
    const errorBox = document.getElementById("errorBox");
    const errorMessage = document.getElementById("errorMessage");
    const emptyState = document.getElementById("emptyState");
    const resultsWrapper = document.getElementById("resultsWrapper");

    // Results Sub-containers
    const profilePillsContainer = document.getElementById("profilePillsContainer");
    const summaryText = document.getElementById("summaryText");
    const whyRecommendedText = document.getElementById("whyRecommendedText");
    const takeawaysGrid = document.getElementById("takeawaysGrid");
    const nextStepDetailed = document.getElementById("nextStepDetailed");
    const immediateNextStepText = document.getElementById("immediateNextStepText");
    const dagFlowTree = document.getElementById("dagFlowTree");
    const roadmapTimeline = document.getElementById("roadmapTimeline");
    const dagToggleTree = document.getElementById("dagToggleTree");
    const dagToggleTimeline = document.getElementById("dagToggleTimeline");
    const recommendedCoursesGrid = document.getElementById("recommendedCoursesGrid");
    const alternativePathsContainer = document.getElementById("alternativePathsContainer");

    // Chat Elements
    const chatContainer = document.getElementById("chatMessages");
    const chatInput = document.getElementById("chatInput");
    const chatSendBtn = document.getElementById("chatSendBtn");
    const suggestedChipsContainer = document.getElementById("suggestedChips");

    // Tab buttons & Views
    const tabRoadmap = document.getElementById("tabRoadmap");
    const tabCatalog = document.getElementById("tabCatalog");
    const tabHistory = document.getElementById("tabHistory");
    const assistantMainView = document.getElementById("assistantMainView");
    const catalogView = document.getElementById("catalogView");
    const historyView = document.getElementById("historyView");

    // Catalog elements
    const catalogSearchInput = document.getElementById("catalogSearch");
    const catalogTopicFilter = document.getElementById("catalogTopicFilter");
    const catalogDiffFilter = document.getElementById("catalogDiffFilter");
    const allCoursesGrid = document.getElementById("allCoursesGrid");
    const historyList = document.getElementById("historyList");

    let currentSessionId = "sess-" + Math.random().toString(36).substring(2, 9);
    let currentQueryId = null;
    let allCoursesData = [];

    // Loading Step Ticker Messages
    const tickerSteps = [
        "Analyzing your career ambition and skill profile...",
        "Querying LearnSphere's structured content database...",
        "Identifying prerequisite bridges and knowledge gaps...",
        "Computing semantic relevance and course progression...",
        "Synthesizing your personalized roadmap and immediate next step..."
    ];
    let tickerInterval = null;

    // --- Tab Switching ---
    function switchTab(activeTab) {
        [tabRoadmap, tabCatalog, tabHistory].forEach(t => t && t.classList.remove("active"));
        if (assistantMainView) assistantMainView.style.display = "none";
        if (catalogView) catalogView.style.display = "none";
        if (historyView) historyView.style.display = "none";

        if (activeTab === "roadmap") {
            if (tabRoadmap) tabRoadmap.classList.add("active");
            if (assistantMainView) assistantMainView.style.display = "block";
        } else if (activeTab === "catalog") {
            if (tabCatalog) tabCatalog.classList.add("active");
            if (catalogView) catalogView.style.display = "block";
            loadCatalogContent();
        } else if (activeTab === "history") {
            if (tabHistory) tabHistory.classList.add("active");
            if (historyView) historyView.style.display = "block";
            loadHistoryData();
        }
    }

    if (tabRoadmap) tabRoadmap.addEventListener("click", () => switchTab("roadmap"));
    if (tabCatalog) tabCatalog.addEventListener("click", () => switchTab("catalog"));
    if (tabHistory) tabHistory.addEventListener("click", () => switchTab("history"));

    // --- DAG Graph vs Timeline Switcher ---
    if (dagToggleTree && dagToggleTimeline && dagFlowTree && roadmapTimeline) {
        dagToggleTree.addEventListener("click", () => {
            dagToggleTree.classList.add("active");
            dagToggleTimeline.classList.remove("active");
            dagFlowTree.style.display = "flex";
            roadmapTimeline.style.display = "none";
        });

        dagToggleTimeline.addEventListener("click", () => {
            dagToggleTimeline.classList.add("active");
            dagToggleTree.classList.remove("active");
            dagFlowTree.style.display = "none";
            roadmapTimeline.style.display = "block";
        });
    }

    // --- Preset Prompt Chips ---
    document.querySelectorAll(".chip-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const promptText = btn.getAttribute("data-prompt");
            if (promptText && promptInput) {
                promptInput.value = promptText;
                promptInput.focus();
                // Auto submit for rapid demo evaluation
                submitGoalRequest();
            }
        });
    });

    // --- Start / Stop Loading ---
    function startLoading() {
        if (emptyState) emptyState.style.display = "none";
        if (resultsWrapper) resultsWrapper.style.display = "none";
        if (errorBox) errorBox.style.display = "none";
        if (loadingBox) {
            loadingBox.style.display = "block";
            loadingBox.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Generating Roadmap...`;
        }

        let stepIndex = 0;
        if (loadingTicker) loadingTicker.textContent = tickerSteps[0];
        if (tickerInterval) clearInterval(tickerInterval);
        tickerInterval = setInterval(() => {
            stepIndex = (stepIndex + 1) % tickerSteps.length;
            if (loadingTicker) loadingTicker.textContent = tickerSteps[stepIndex];
        }, 1200);
    }

    function stopLoading() {
        if (tickerInterval) {
            clearInterval(tickerInterval);
            tickerInterval = null;
        }
        if (loadingBox) loadingBox.style.display = "none";
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.innerHTML = `<i class="fa-solid fa-sparkles"></i> Generate Learning Roadmap`;
        }
    }

    function showError(msg) {
        stopLoading();
        if (errorMessage) errorMessage.textContent = msg || "An error occurred while generating your recommendation.";
        if (errorBox) errorBox.style.display = "block";
        if (resultsWrapper) resultsWrapper.style.display = "none";
    }

    // --- Submit Goal Request ---
    async function submitGoalRequest() {
        const query = promptInput ? promptInput.value.trim() : "";
        if (!query) {
            alert("Please describe your learning goal or current background.");
            if (promptInput) promptInput.focus();
            return;
        }

        const payload = {
            query: query,
            current_level: levelSelect ? levelSelect.value : "auto",
            target_timeframe: timeframeSelect ? timeframeSelect.value : "3 months",
            weekly_hours: hoursSelect ? parseInt(hoursSelect.value, 10) : 6
        };

        startLoading();

        try {
            const response = await fetch(`${API_BASE}/api/ai/recommend`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.detail || `Server returned status ${response.status}`);
            }

            const data = await response.json();
            stopLoading();
            renderRecommendations(data);
        } catch (err) {
            console.error("AI Recommendation error:", err);
            showError(`Failed to generate recommendation: ${err.message}. Please check that the AI backend is active.`);
        }
    }

    if (generateBtn) {
        generateBtn.addEventListener("click", submitGoalRequest);
    }

    if (promptInput) {
        promptInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                submitGoalRequest();
            }
        });
    }

    // --- Render Recommendations ---
    function renderRecommendations(data) {
        currentQueryId = data.query_id;

        // 1. Learner Profile Pills
        const p = data.learner_profile || {};
        if (profilePillsContainer) {
            profilePillsContainer.innerHTML = `
                <div class="profile-pill"><i class="fa-solid fa-bullseye"></i> Goal: <strong>${escapeHtml(p.target_role || "Developer")}</strong></div>
                <div class="profile-pill"><i class="fa-solid fa-layer-group"></i> Detected Level: <strong>${escapeHtml(p.current_level || "Beginner")}</strong></div>
                <div class="profile-pill"><i class="fa-regular fa-clock"></i> Target Pace: <strong>${escapeHtml(p.timeframe || "3 months")} (~${p.weekly_commitment_hours || 6} hrs/wk)</strong></div>
            `;
        }

        // 2. Summary & Structured Takeaways
        if (summaryText) summaryText.innerHTML = formatMarkdown(data.summary || "");
        if (whyRecommendedText) whyRecommendedText.innerHTML = formatMarkdown(data.why_recommended || "");
        renderTakeawaysGrid(data);

        // 3. Immediate Next Step
        renderNextStepDetailed(data);

        // 4. Interactive DAG Graph Roadmap
        renderDAGTree(data);

        // 5. Learning Sequence / Roadmap Timeline (Alternative View)
        if (roadmapTimeline) {
            roadmapTimeline.innerHTML = "";
            const seq = data.learning_sequence || [];
            seq.forEach((phase, idx) => {
                const phaseEl = document.createElement("div");
                phaseEl.className = "timeline-phase";
                phaseEl.innerHTML = `
                    <div class="phase-node">${phase.phase_number || (idx + 1)}</div>
                    <div class="phase-card">
                        <div class="phase-header">
                            <div class="phase-title">${escapeHtml(phase.phase_title)}</div>
                            <div class="phase-duration"><i class="fa-regular fa-calendar"></i> ~${phase.duration_weeks} weeks</div>
                        </div>
                        <div class="phase-details">${escapeHtml(phase.weekly_focus || "")}</div>
                        <div style="margin-bottom:8px; font-weight:600; color:var(--text-color); font-size:0.9rem;">
                            <i class="fa-solid fa-flag-checkered" style="color:var(--accent-color); margin-right:6px;"></i> ${escapeHtml(phase.milestone_goal || "")}
                        </div>
                        ${phase.actionable_project ? `
                            <div class="phase-project">
                                <i class="fa-solid fa-laptop-code"></i> Milestone Project: ${escapeHtml(phase.actionable_project)}
                            </div>
                        ` : ""}
                    </div>
                `;
                roadmapTimeline.appendChild(phaseEl);
            });
        }

        // 5. Recommended Course Cards
        recommendedCoursesGrid.innerHTML = "";
        const courses = data.recommended_courses || [];
        courses.forEach(c => {
            const card = document.createElement("div");
            card.className = "course-card";

            const diffClass = c.difficulty.toLowerCase() === "beginner" ? "diff-beginner"
                : (c.difficulty.toLowerCase() === "intermediate" ? "diff-intermediate" : "diff-advanced");

            const resourceBadges = (c.resource_types || []).map(r => `<span class="res-pill">${escapeHtml(r)}</span>`).join("");
            const topicsChips = (c.topics_covered || []).slice(0, 5).map(t => `<span class="res-pill"><i class="fa-solid fa-check" style="font-size:0.7rem; color:var(--accent-color);"></i> ${escapeHtml(t)}</span>`).join("");

            const modulesList = (c.learning_sequence || []).map(m => `
                <div class="module-item">
                    <div class="module-item-title">${escapeHtml(m.title)} (${escapeHtml(m.duration)})</div>
                    <div class="module-item-project"><i class="fa-solid fa-code"></i> ${escapeHtml(m.hands_on_project || m.summary)}</div>
                </div>
            `).join("");

            card.innerHTML = `
                <div>
                    <div class="course-top-badges">
                        <span class="badge-topic"><i class="fa-solid fa-tag"></i> ${escapeHtml(c.topic)}</span>
                        <span class="badge-diff ${diffClass}">${escapeHtml(c.difficulty)}</span>
                    </div>
                    <h3>${escapeHtml(c.title)}</h3>
                    <div class="course-meta">
                        <span><i class="fa-regular fa-clock"></i> ${escapeHtml(c.estimated_duration)}</span>
                        <span><i class="fa-solid fa-hourglass-half"></i> ${c.total_hours} hrs total</span>
                    </div>
                    <p>${escapeHtml(c.description)}</p>
                    
                    <div style="font-size:0.82rem; font-weight:600; color:var(--accent-color); margin-bottom:6px;">
                        <i class="fa-solid fa-circle-question"></i> Why Selected:
                    </div>
                    <div style="font-size:0.88rem; color:var(--text-color); margin-bottom:14px; background:rgba(255,255,255,0.04); padding:8px 12px; border-radius:8px;">
                        ${escapeHtml(c.why_relevant)}
                    </div>

                    <div style="font-size:0.82rem; font-weight:600; color:var(--text-muted); margin-bottom:6px;">Resource Formats:</div>
                    <div class="course-resource-pills">${resourceBadges}</div>

                    <div style="font-size:0.82rem; font-weight:600; color:var(--text-muted); margin-bottom:6px;">Key Topics Covered:</div>
                    <div class="course-resource-pills">${topicsChips}</div>

                    <button class="modules-toggle" type="button">
                        <span><i class="fa-solid fa-list-check"></i> View Curriculum Modules (${(c.learning_sequence || []).length})</span>
                        <i class="fa-solid fa-chevron-down toggle-arrow"></i>
                    </button>
                    <div class="modules-accordion">${modulesList}</div>

                    ${c.capstone_project && c.capstone_project.title ? `
                        <div class="capstone-box">
                            <strong><i class="fa-solid fa-trophy"></i> Capstone:</strong> ${escapeHtml(c.capstone_project.title)} — ${escapeHtml(c.capstone_project.description)}
                        </div>
                    ` : ""}
                </div>

                <div style="margin-top:16px;">
                    <button class="cta start-course-btn" style="width:100%; border:none; border-radius:10px; padding:10px;" data-course-id="${c.id}">
                        <i class="fa-solid fa-play"></i> Start Course
                    </button>
                </div>
            `;

            // Toggle modules accordion
            const toggleBtn = card.querySelector(".modules-toggle");
            const accordion = card.querySelector(".modules-accordion");
            const arrow = card.querySelector(".toggle-arrow");
            toggleBtn.addEventListener("click", () => {
                const isOpen = accordion.style.display === "block";
                accordion.style.display = isOpen ? "none" : "block";
                arrow.style.transform = isOpen ? "rotate(0deg)" : "rotate(180deg)";
            });

            // Start course action
            const startBtn = card.querySelector(".start-course-btn");
            startBtn.addEventListener("click", () => {
                alert(`Starting course: ${c.title}! Modules and interactive practice labs are now active in your learner queue.`);
            });

            recommendedCoursesGrid.appendChild(card);
        });

        // 6. Alternative Pathways
        if (alternativePathsContainer) {
            const alts = data.alternative_paths || [];
            if (alts.length > 0) {
                alternativePathsContainer.innerHTML = alts.map(a => `<li><i class="fa-solid fa-lightbulb" style="color:var(--accent-color); margin-right:8px;"></i>${escapeHtml(a)}</li>`).join("");
                alternativePathsContainer.parentElement.style.display = "block";
            } else {
                alternativePathsContainer.parentElement.style.display = "none";
            }
        }

        // Initialize Chat greeting
        initChatWithGreeting(data);

        // Display results
        if (resultsWrapper) {
            resultsWrapper.style.display = "block";
            resultsWrapper.scrollIntoView({ behavior: "smooth" });
        }
    }

    // --- Render Structured Takeaways Grid (No Monolithic Paragraphs) ---
    function renderTakeawaysGrid(data) {
        if (!takeawaysGrid) return;
        takeawaysGrid.innerHTML = "";

        const points = data.why_recommended_points || [];
        if (points.length > 0) {
            takeawaysGrid.innerHTML = points.map(pt => `
                <div class="takeaway-card">
                    <div class="takeaway-header">
                        <div class="takeaway-icon"><i class="fa-solid ${escapeHtml(pt.icon || "fa-check")}"></i></div>
                        <div class="takeaway-title">${escapeHtml(pt.title || "Strategic Fit")}</div>
                    </div>
                    <div class="takeaway-body">${escapeHtml(pt.description || "")}</div>
                </div>
            `).join("");
        } else if (data.why_recommended) {
            takeawaysGrid.innerHTML = `
                <div class="takeaway-card" style="grid-column: 1 / -1;">
                    <div class="takeaway-header">
                        <div class="takeaway-icon"><i class="fa-solid fa-bullseye"></i></div>
                        <div class="takeaway-title">Strategic Rationale & Pacing</div>
                    </div>
                    <div class="takeaway-body">${formatMarkdown(data.why_recommended)}</div>
                </div>
            `;
        }
    }

    // --- Render Immediate Next Step Detail Card ---
    function renderNextStepDetailed(data) {
        if (!immediateNextStepText) return;
        const ns = data.next_step_details;
        const actionTitle = ns ? (ns.action_item || ns.action_title || ns.module_title) : null;
        if (ns && actionTitle) {
            const course = ns.course_title || ns.course_name || "Primary Course";
            const estTime = ns.estimated_time || (ns.estimated_hours ? `~${ns.estimated_hours} Hours` : "1-2 Hours");
            const deliverable = ns.hands_on_project || ns.deliverable || "";
            immediateNextStepText.innerHTML = `
                <div style="font-size:1.15rem; font-weight:700; color:var(--text-color); margin-bottom:8px;">
                    ${escapeHtml(actionTitle)}
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:12px; margin-bottom:12px; font-size:0.88rem; color:var(--text-muted);">
                    <span><i class="fa-solid fa-book-bookmark" style="color:var(--accent-color);"></i> Target Course: <strong>${escapeHtml(course)}</strong></span>
                    <span><i class="fa-regular fa-clock" style="color:#f59e0b;"></i> Est. Time: <strong>${escapeHtml(estTime)}</strong></span>
                </div>
                ${deliverable ? `
                    <div style="background:rgba(56, 189, 248, 0.08); border-left:3px solid var(--accent-color); padding:10px 14px; border-radius:0 8px 8px 0; font-size:0.92rem; color:var(--text-color);">
                        <strong style="color:var(--accent-color);"><i class="fa-solid fa-code"></i> Concrete Action Deliverable:</strong>
                        <p style="margin:4px 0 0 0; line-height:1.4;">${escapeHtml(deliverable)}</p>
                    </div>
                ` : ""}
            `;
        } else {
            immediateNextStepText.innerHTML = formatMarkdown(data.immediate_next_step || "");
        }
    }

    // --- Render DAG Graph Roadmap Flow (Interactive Directed Acyclic Graph) ---
    function renderDAGTree(data) {
        if (!dagFlowTree) return;
        dagFlowTree.innerHTML = "";

        let nodes = (data.dag_graph && data.dag_graph.nodes) ? data.dag_graph.nodes : [];

        // Fallback: If no DAG graph nodes in payload, derive from primary course or sequence
        if (!nodes || nodes.length === 0) {
            if (data.recommended_courses && data.recommended_courses.length > 0 && data.recommended_courses[0].learning_sequence) {
                const course = data.recommended_courses[0];
                nodes = course.learning_sequence.map((mod, idx) => ({
                    id: `node-${idx + 1}`,
                    step_number: idx + 1,
                    title: mod.title,
                    category: idx === 0 ? "Foundational Gateway" : (idx === course.learning_sequence.length - 1 ? "Capstone Milestone" : "Core Architecture"),
                    duration: mod.duration || "1-2 weeks",
                    estimated_hours: 6,
                    summary: mod.summary || "",
                    hands_on_project: mod.hands_on_project || "",
                    skills_acquired: mod.topics || [],
                    prerequisites: idx > 0 ? [`node-${idx}`] : [],
                    unlocks: idx < course.learning_sequence.length - 1 ? [`node-${idx + 2}`] : [],
                    status: idx === 0 ? "in_progress" : "unlocked"
                }));
            } else if (data.learning_sequence && data.learning_sequence.length > 0) {
                nodes = data.learning_sequence.map((phase, idx) => ({
                    id: `node-${idx + 1}`,
                    step_number: phase.phase_number || (idx + 1),
                    title: phase.phase_title,
                    category: idx === 0 ? "Foundational Gateway" : (idx === data.learning_sequence.length - 1 ? "Capstone Milestone" : "Core Architecture"),
                    duration: `~${phase.duration_weeks || 2} weeks`,
                    estimated_hours: (phase.duration_weeks || 2) * 6,
                    summary: phase.weekly_focus || "",
                    hands_on_project: phase.actionable_project || phase.milestone_goal || "",
                    skills_acquired: [phase.milestone_goal || "Core Competency"],
                    prerequisites: idx > 0 ? [`node-${idx}`] : [],
                    unlocks: idx < data.learning_sequence.length - 1 ? [`node-${idx + 2}`] : [],
                    status: idx === 0 ? "in_progress" : "unlocked"
                }));
            }
        }

        if (!nodes || nodes.length === 0) {
            dagFlowTree.innerHTML = `<div style="text-align:center; padding:24px; color:var(--text-muted);">No roadmap nodes available.</div>`;
            return;
        }

        const totalNodes = nodes.length;

        // Top progress bar header
        const progressHeader = document.createElement("div");
        progressHeader.className = "dag-progress-header";
        progressHeader.style.cssText = "width:100%; max-width:820px; background:var(--card-bg); border:1px solid var(--card-border); border-radius:14px; padding:16px 22px; margin-bottom:28px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px; box-shadow:var(--card-shadow);";

        progressHeader.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:40px; height:40px; border-radius:50%; background:rgba(56, 189, 248, 0.15); color:var(--accent-color); display:flex; align-items:center; justify-content:center; font-size:1.15rem;">
                    <i class="fa-solid fa-route"></i>
                </div>
                <div>
                    <div style="font-weight:700; color:var(--text-color); font-size:1rem;">DAG Curriculum Mastery Track</div>
                    <div id="dagProgressText" style="font-size:0.84rem; color:var(--text-muted);">0 of ${totalNodes} milestones completed (0%)</div>
                </div>
            </div>
            <div style="min-width:220px; flex:1; max-width:280px;">
                <div style="width:100%; height:8px; background:rgba(255,255,255,0.08); border-radius:6px; overflow:hidden;">
                    <div id="dagProgressBar" style="width:0%; height:100%; background:linear-gradient(90deg, var(--accent-color), #10b981); transition:width 0.4s ease; border-radius:6px;"></div>
                </div>
            </div>
        `;
        dagFlowTree.appendChild(progressHeader);

        const completedSet = new Set();

        function updateProgress() {
            const count = completedSet.size;
            const pct = Math.round((count / totalNodes) * 100);
            const bar = document.getElementById("dagProgressBar");
            const txt = document.getElementById("dagProgressText");
            if (bar) bar.style.width = `${pct}%`;
            if (txt) txt.textContent = `${count} of ${totalNodes} milestones completed (${pct}%)`;
        }

        // Render nodes & directed connectors
        nodes.forEach((node, idx) => {
            const card = document.createElement("div");
            card.className = "dag-node-card";
            card.id = `dag-card-${node.id}`;

            const stepNum = node.phase || node.step_number || (typeof node.level === "number" ? node.level + 1 : idx + 1);
            const durationStr = node.duration_label || node.duration || "1-2 weeks";
            const topics = node.key_topics || node.skills_acquired || [];

            // Category style class
            let catClass = "cat-core";
            const cat = (node.category || "").toLowerCase();
            if (cat.includes("gateway") || cat.includes("foundation")) catClass = "cat-gateway";
            else if (cat.includes("pattern") || cat.includes("advanced")) catClass = "cat-pattern";
            else if (cat.includes("framework") || cat.includes("backend")) catClass = "cat-framework";
            else if (cat.includes("capstone") || cat.includes("milestone")) catClass = "cat-capstone";

            const skillsHtml = topics.map(s => `
                <span class="dag-topic-tag"><i class="fa-solid fa-code-commit" style="font-size:0.65rem; color:var(--accent-color); margin-right:4px;"></i>${escapeHtml(s)}</span>
            `).join("");

            const isFirst = idx === 0;
            const initialStatus = isFirst ? "Current Milestone" : (idx === totalNodes - 1 ? "Capstone Goal" : "Prerequisite Locked");
            const statusIcon = isFirst ? "fa-solid fa-bolt" : (idx === totalNodes - 1 ? "fa-solid fa-flag-checkered" : "fa-solid fa-arrow-down");
            const statusClass = isFirst ? "status-in-progress" : "";

            card.innerHTML = `
                <div class="dag-node-header">
                    <div class="dag-node-left">
                        <span class="dag-node-step">Milestone #${stepNum}</span>
                        <span class="dag-category-pill ${catClass}">${escapeHtml(node.category || "Core")}</span>
                    </div>
                    <div class="dag-status-indicator ${statusClass}" id="dag-status-${node.id}">
                        <i class="${statusIcon}"></i> <span>${initialStatus}</span>
                    </div>
                </div>

                <div class="dag-node-title">${escapeHtml(node.title)}</div>
                ${node.course_title ? `<div class="dag-node-course-sub"><i class="fa-solid fa-book-bookmark"></i> ${escapeHtml(node.course_title)}</div>` : ""}
                ${node.summary ? `<div style="font-size:0.92rem; color:var(--text-color); margin-bottom:12px; line-height:1.5;">${escapeHtml(node.summary)}</div>` : ""}

                ${skillsHtml ? `
                    <div style="font-size:0.8rem; font-weight:700; color:var(--text-muted); margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px;">Skills Acquired:</div>
                    <div class="dag-node-chips">${skillsHtml}</div>
                ` : ""}

                ${node.hands_on_project ? `
                    <div class="dag-project-box">
                        <i class="fa-solid fa-laptop-code" style="font-size:1.1rem; flex-shrink:0;"></i>
                        <div>
                            <span style="font-weight:700;">Hands-on Project:</span>
                            <span>${escapeHtml(node.hands_on_project)}</span>
                        </div>
                    </div>
                ` : ""}

                <div class="dag-node-footer">
                    <div class="dag-hours-pill">
                        <i class="fa-regular fa-clock" style="color:var(--accent-color);"></i>
                        <span>${escapeHtml(durationStr)} (~${node.estimated_hours || 6} hrs commitment)</span>
                    </div>
                    <button type="button" class="dag-toggle-complete-btn" data-node-id="${node.id}">
                        <i class="fa-regular fa-circle-check"></i>
                        <span>Mark Complete</span>
                    </button>
                </div>
            `;

            // Interactive completion toggle
            const btn = card.querySelector(".dag-toggle-complete-btn");
            btn.addEventListener("click", () => {
                const nodeId = node.id;
                const statusEl = card.querySelector(`#dag-status-${nodeId}`);
                if (completedSet.has(nodeId)) {
                    completedSet.delete(nodeId);
                    btn.classList.remove("is-done");
                    btn.innerHTML = `<i class="fa-regular fa-circle-check"></i> <span>Mark Complete</span>`;
                    card.style.borderColor = "";
                    card.style.background = "";
                    if (statusEl) {
                        statusEl.className = `dag-status-indicator ${isFirst ? "status-in-progress" : ""}`;
                        statusEl.innerHTML = `<i class="${statusIcon}"></i> <span>${initialStatus}</span>`;
                    }
                } else {
                    completedSet.add(nodeId);
                    btn.classList.add("is-done");
                    btn.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>Milestone Completed!</span>`;
                    card.style.borderColor = "rgba(16, 185, 129, 0.5)";
                    card.style.background = "linear-gradient(135deg, var(--card-bg) 80%, rgba(16, 185, 129, 0.08))";
                    if (statusEl) {
                        statusEl.className = "dag-status-indicator status-completed";
                        statusEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>Completed</span>`;
                    }
                }
                updateProgress();
            });

            dagFlowTree.appendChild(card);

            // Render connector to next milestone if not the final node
            if (idx < totalNodes - 1) {
                const connector = document.createElement("div");
                connector.className = "dag-connector";
                connector.innerHTML = `
                    <span class="dag-connector-label">unlocks milestone #${idx + 2}</span>
                    <div class="dag-connector-line"></div>
                    <div class="dag-connector-arrow"><i class="fa-solid fa-chevron-down"></i></div>
                `;
                dagFlowTree.appendChild(connector);
            }
        });
    }

    // --- Interactive Follow-up Chat ---
    function initChatWithGreeting(data) {
        if (!chatContainer) return;
        chatContainer.innerHTML = `
            <div class="chat-bubble assistant">
                Hello! I have created your personalized <strong>${escapeHtml(data.learner_profile.target_role || "learning")}</strong> roadmap.
                You can ask me anything about your pace, how to prepare for interviews, or how to tackle specific modules!
            </div>
        `;
    }

    async function sendChatMessage() {
        const msg = chatInput ? chatInput.value.trim() : "";
        if (!msg) return;

        // Append user bubble
        appendChatBubble("user", msg);
        if (chatInput) chatInput.value = "";

        // Typing indicator
        const typingEl = document.createElement("div");
        typingEl.className = "chat-bubble assistant";
        typingEl.id = "chatTypingIndicator";
        typingEl.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Thinking...`;
        chatContainer.appendChild(typingEl);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        try {
            const res = await fetch(`${API_BASE}/api/ai/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    session_id: currentSessionId,
                    message: msg,
                    context_query_id: currentQueryId
                })
            });

            const typing = document.getElementById("chatTypingIndicator");
            if (typing) typing.remove();

            if (!res.ok) throw new Error("Could not reach chat server");
            const data = await res.json();
            appendChatBubble("assistant", data.reply);

            // Render suggested prompt chips if available
            if (suggestedChipsContainer && data.suggested_prompts) {
                suggestedChipsContainer.innerHTML = data.suggested_prompts.map(p => `
                    <button class="chip-btn chat-suggestion-chip" data-msg="${escapeHtml(p)}">${escapeHtml(p)}</button>
                `).join("");

                suggestedChipsContainer.querySelectorAll(".chat-suggestion-chip").forEach(btn => {
                    btn.addEventListener("click", () => {
                        const nextMsg = btn.getAttribute("data-msg");
                        if (chatInput) chatInput.value = nextMsg;
                        sendChatMessage();
                    });
                });
            }
        } catch (err) {
            const typing = document.getElementById("chatTypingIndicator");
            if (typing) typing.remove();
            appendChatBubble("assistant", "Sorry, I encountered an issue replying. Please try again!");
        }
    }

    function appendChatBubble(role, text) {
        if (!chatContainer) return;
        const bubble = document.createElement("div");
        bubble.className = `chat-bubble ${role}`;
        bubble.innerHTML = formatMarkdown(text);
        chatContainer.appendChild(bubble);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    if (chatSendBtn) chatSendBtn.addEventListener("click", sendChatMessage);
    if (chatInput) {
        chatInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                sendChatMessage();
            }
        });
    }

    // --- Content Catalog Explorer ---
    async function loadCatalogContent() {
        if (!allCoursesGrid) return;
        allCoursesGrid.innerHTML = `<p style="color:var(--text-muted); grid-column:1/-1; text-align:center;">Loading content catalog...</p>`;

        try {
            const res = await fetch(`${API_BASE}/api/ai/content`);
            const data = await res.json();
            allCoursesData = data.courses || [];
            renderCatalogList(allCoursesData);
        } catch (err) {
            allCoursesGrid.innerHTML = `<p style="color:#f87171; grid-column:1/-1; text-align:center;">Failed to load catalog. Please ensure the backend server is running.</p>`;
        }
    }

    function renderCatalogList(courses) {
        if (!allCoursesGrid) return;
        allCoursesGrid.innerHTML = "";

        if (courses.length === 0) {
            allCoursesGrid.innerHTML = `<p style="color:var(--text-muted); grid-column:1/-1; text-align:center;">No courses found matching your filter criteria.</p>`;
            return;
        }

        courses.forEach(c => {
            const card = document.createElement("div");
            card.className = "course-card";
            const diffClass = c.difficulty.toLowerCase() === "beginner" ? "diff-beginner"
                : (c.difficulty.toLowerCase() === "intermediate" ? "diff-intermediate" : "diff-advanced");

            card.innerHTML = `
                <div>
                    <div class="course-top-badges">
                        <span class="badge-topic">${escapeHtml(c.topic)}</span>
                        <span class="badge-diff ${diffClass}">${escapeHtml(c.difficulty)}</span>
                    </div>
                    <h3>${escapeHtml(c.title)}</h3>
                    <div class="course-meta">
                        <span><i class="fa-regular fa-clock"></i> ${escapeHtml(c.estimated_duration)}</span>
                        <span><i class="fa-solid fa-hourglass-half"></i> ${c.total_hours} hrs</span>
                    </div>
                    <p>${escapeHtml(c.description)}</p>
                    <div style="font-size:0.84rem; color:var(--text-muted); margin-bottom:12px;">
                        <strong>Prerequisites:</strong> ${(c.prerequisites || []).join(", ") || "None"}
                    </div>
                </div>
                <button class="cta plan-with-course-btn" style="width:100%; border:none; border-radius:10px; padding:10px; margin-top:14px;" data-title="${escapeHtml(c.title)}" data-topic="${escapeHtml(c.topic)}">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> Plan Learning Path with this Course
                </button>
            `;

            card.querySelector(".plan-with-course-btn").addEventListener("click", () => {
                switchTab("roadmap");
                if (promptInput) {
                    promptInput.value = `I want to master ${c.topic} and build real-world projects with ${c.title}.`;
                    submitGoalRequest();
                }
            });

            allCoursesGrid.appendChild(card);
        });
    }

    // Filter listeners for Catalog
    function filterCatalog() {
        const query = (catalogSearchInput ? catalogSearchInput.value : "").toLowerCase();
        const topic = catalogTopicFilter ? catalogTopicFilter.value.toLowerCase() : "all";
        const diff = catalogDiffFilter ? catalogDiffFilter.value.toLowerCase() : "all";

        const filtered = allCoursesData.filter(c => {
            const matchesQuery = !query || c.title.toLowerCase().includes(query) || c.description.toLowerCase().includes(query) || (c.topics_covered || []).some(t => t.toLowerCase().includes(query));
            const matchesTopic = topic === "all" || c.topic.toLowerCase() === topic;
            const matchesDiff = diff === "all" || c.difficulty.toLowerCase() === diff;
            return matchesQuery && matchesTopic && matchesDiff;
        });

        renderCatalogList(filtered);
    }

    if (catalogSearchInput) catalogSearchInput.addEventListener("input", filterCatalog);
    if (catalogTopicFilter) catalogTopicFilter.addEventListener("change", filterCatalog);
    if (catalogDiffFilter) catalogDiffFilter.addEventListener("change", filterCatalog);

    // --- Load History Data ---
    async function loadHistoryData() {
        if (!historyList) return;
        historyList.innerHTML = `<p style="color:var(--text-muted); text-align:center;">Loading history...</p>`;

        try {
            const res = await fetch(`${API_BASE}/api/ai/history?limit=10`);
            const data = await res.json();
            const queries = data.history || [];

            if (queries.length === 0) {
                historyList.innerHTML = `<p style="color:var(--text-muted); text-align:center;">No past recommendations found yet. Try asking the assistant!</p>`;
                return;
            }

            historyList.innerHTML = "";
            queries.forEach(q => {
                const item = document.createElement("div");
                item.className = "history-item";
                const dateStr = q.created_at ? new Date(q.created_at).toLocaleString() : "";
                item.innerHTML = `
                    <div class="history-query"><i class="fa-solid fa-compass" style="color:var(--accent-color); margin-right:6px;"></i> "${escapeHtml(q.query_text)}"</div>
                    <div class="history-meta">Role: <strong>${escapeHtml(q.parsed_target_role || "Developer")}</strong> | Level: <strong>${escapeHtml(q.parsed_current_level || "Beginner")}</strong> | ${dateStr}</div>
                `;
                item.addEventListener("click", () => {
                    switchTab("roadmap");
                    if (promptInput) {
                        promptInput.value = q.query_text;
                        submitGoalRequest();
                    }
                });
                historyList.appendChild(item);
            });
        } catch (err) {
            historyList.innerHTML = `<p style="color:#f87171; text-align:center;">Failed to load history.</p>`;
        }
    }

    // --- Utility Helpers ---
    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatMarkdown(str) {
        if (!str) return "";
        let formatted = escapeHtml(str);
        // Bold: **text**
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        // Italic: *text*
        formatted = formatted.replace(/\*(.*?)\*/g, "<em>$1</em>");
        // Line breaks
        formatted = formatted.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>");
        return `<p>${formatted}</p>`;
    }

})();
