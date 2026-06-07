/* ==========================================================================
   GAMIFY LIFE — CHAT.JS
   AI Coach slide-out drawer with warm conversational tone and LocalStorage integration
   ========================================================================== */

(function () {
  const fab = document.getElementById('chat-fab');
  const drawer = document.getElementById('chat-drawer');
  const closeBtn = document.getElementById('chat-close');
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  const body = document.getElementById('chat-body');

  if (!fab || !drawer) return;

  fab.addEventListener('click', () => {
    drawer.classList.add('open');
    renderChatHistory();
  });
  closeBtn.addEventListener('click', () => drawer.classList.remove('open'));

  // Local fallback response parser (mimics Python fallback_chat_response)
  function getLocalCoachResponse(userMessage) {
    const msg = userMessage.toLowerCase();
    const activeGoal = window.db.getActiveGoals()[0] || null;
    const tasks = activeGoal ? window.db.getTasksByGoalId(activeGoal.id) : [];
    const activities = window.db.getActivities();

    const unprodList = activities.filter(a => a.type === 'unproductive');
    const totalUnprodHours = unprodList.reduce((sum, a) => sum + parseFloat(a.duration_hours), 0);
    const prodList = activities.filter(a => a.type === 'productive');
    const prodHours = prodList.reduce((sum, a) => sum + parseFloat(a.duration_hours), 0);

    const pendingTasks = tasks.filter(t => t.is_completed !== 1);
    const completedTasks = tasks.filter(t => t.is_completed === 1);
    const highLeverageTasks = [...pendingTasks].sort((a, b) => b.probability_impact - a.probability_impact);

    // Prioritize quests
    if (msg.includes("priorit") || (msg.includes("what") && msg.includes("do")) || msg.includes("next") || msg.includes("quest") || msg.includes("task")) {
      if (!activeGoal) {
        return "**Coach Recommendation:** You do not have an active goal campaign. Go to the **Goals** tab and define a new campaign first, and I will help you prioritize your quests.";
      }
      if (pendingTasks.length === 0) {
        if (completedTasks.length > 0) {
          return "🎉 **All quests completed!** Outstanding work today. You have successfully cleared your active board and maximized today's probability growth. Make sure to submit your **Day-End Review** to claim your +15 XP bonus and lock in your daily streak!";
        } else {
          return "**Coach Recommendation:** You have no quests in your active plan. Go to the **Goals** tab and generate a new plan for your campaign.";
        }
      }
      
      let res = `### ⚡ Quest Prioritization Strategy\n\n`;
      res += `Based on your active goal — **${activeGoal.goal_text}** — here is your high-probability focus blueprint:\n\n`;
      res += `#### 🎯 1. Primary Objective (Highest Leverage)\n`;
      const topTask = highLeverageTasks[0];
      res += `**${topTask.action}**\n`;
      res += `- *Impact:* \`+${topTask.probability_impact}%\` success probability\n`;
      res += `- *Reward:* \`+${topTask.xp_reward} XP\`\n`;
      res += `- *Why:* ${topTask.why}\n`;
      res += `- *Schedule:* ${topTask.when_time}\n\n`;

      if (highLeverageTasks.length > 1) {
        res += `#### 🥈 2. Secondary Objectives (Do next)\n`;
        highLeverageTasks.slice(1, 3).forEach(t => {
          res += `- **${t.action}** (Impact: \`+${t.probability_impact}%\` | Reward: \`+${t.xp_reward} XP\`)\n`;
        });
        res += "\n";
      }

      if (totalUnprodHours > 0) {
        res += `#### ⚠️ Time Leak Warning\n`;
        res += `I see you have **${totalUnprodHours} hours** logged as unproductive time (${unprodList.map(a => `**${a.name}** (${a.duration_hours}h)`).join(', ')})\n`;
      }

      res += "\n\n```json\n";
      res += JSON.stringify({
        type: "proposed_task",
        action: "Do a deep-dive review of your biggest time leak",
        why: "Eliminating wasted time is the fastest way to accelerate progress.",
        when_time: "today",
        xp_reward: 20,
        probability_impact: 3.0,
        subtasks: [
          { text: "Identify your largest unproductive activity", done: false },
          { text: "Brainstorm one specific friction point to prevent it tomorrow", done: false }
        ]
      }, null, 2);
      res += "\n```\n";
      return res;
    }

    // Routine leaks
    if (msg.includes("leak") || msg.includes("routine") || msg.includes("activity") || msg.includes("schedule") || msg.includes("time")) {
      if (activities.length === 0) {
        return "**Coach Recommendation:** You haven't logged any daily activities yet! Go to the **Routine** tab and log what you did today (e.g. sleep, work, studying, social media) so I can audit your schedule.";
      }

      let res = "### 📅 Routine Audit & Leak Analysis\n\n";
      if (totalUnprodHours > 0) {
        res += `🔴 **Alert: Wasted Time Leak detected.** You logged **${totalUnprodHours} hours** of unproductive activities:\n`;
        unprodList.forEach(a => {
          res += `- **${a.name}**: ${a.duration_hours} hours\n`;
        });
        res += `\n*Action Plan:* Reallocate these unproductive leaks directly to your active goal quests. Eliminating these leaks is the lowest-hanging fruit to optimize your focus score.\n\n`;
      } else {
        res += "🟢 **Excellent schedule discipline!** You have 0 unproductive time leaks logged today. Keep this up.\n\n";
      }

      res += `🟢 **Productive Focus**: You have **${prodHours} hours** of productive work logged.\n`;
      const totalLogged = activities.reduce((sum, a) => sum + parseFloat(a.duration_hours), 0);
      const freeHours = Math.max(0.0, 24.0 - totalLogged);
      if (freeHours > 0) {
        res += `🟡 **Unaccounted Buffer**: You have **${freeHours.toFixed(1)} hours** of unaccounted time in your 24h schedule. Plan this time before it turns into an accidental leak!\n`;
      }
      return res;
    }

    // Success odds
    if (msg.includes("odds") || msg.includes("probability") || msg.includes("chance") || msg.includes("win")) {
      if (!activeGoal) {
        return "**Coach Recommendation:** You have no active goal campaign. Initiate a campaign to begin probability tracking.";
      }
      const sumImpact = pendingTasks.reduce((sum, t) => sum + parseFloat(t.probability_impact), 0);
      return (
        `### 📈 Success Probability Breakdown\n\n` +
        `Active Goal: **${activeGoal.goal_text}**\n` +
        `- **Current Probability:** \`${activeGoal.current_probability}\`\n` +
        `- **Baseline Probability:** \`${activeGoal.base_probability}\`\n` +
        `- **Focus Alignment Score:** \`${activeGoal.focus_score}\`\n\n` +
        `**How to improve your odds:**\n` +
        `Each completed quest on your quest log boosts your probability by its exact impact rate. ` +
        `Currently, there are **${pendingTasks.length} pending quests** which can add a combined total of ` +
        `\`+${sumImpact.toFixed(1)}%\` to your success odds. Complete them today!`
      );
    }

    // Learning / tips queries
    const isLearningQuery = ["how", "learn", "achieve", "tips", "tricks", "help", "study", "practice", "guide", "improve", "do i"].some(kw => msg.includes(kw));
    const hasTopicKeyword = ["japanese", "japan", "japn", "nihongo", "language", "lang", "laguage", "speak", "vocab", "word", "grammar", "talk", "write", "pronounce", "english", "spanish", "french", "german", "c++", "cpp", "coding", "python", "programming", "javascript", "rust", "code", "program", "develop", "html", "css", "software", "developer", "compil", "swim", "stroke", "pool", "breathing", "sprint", "run", "track", "fitness", "gym", "workout", "lift", "exercise", "training", "muscle", "weight", "cardio", "athlet"].some(kw => msg.includes(kw));

    if (isLearningQuery || hasTopicKeyword) {
      let topic = null;
      if (["japanese", "japan", "japn", "nihongo", "language", "lang", "laguage", "speak", "vocab", "word", "grammar", "talk", "write", "pronounce", "english", "spanish", "french", "german", "chinese", "korean"].some(kw => msg.includes(kw))) {
        topic = "language";
      } else if (["c++", "cpp", "coding", "python", "programming", "javascript", "rust", "code", "program", "develop", "html", "css", "software", "developer", "compil"].some(kw => msg.includes(kw))) {
        topic = "coding";
      } else if (msg.includes("swim")) {
        topic = "swimming";
      } else if (["sprint", "run", "track", "fitness", "gym", "workout", "lift", "exercise", "training", "muscle", "weight", "cardio", "athlet"].some(kw => msg.includes(kw))) {
        topic = "fitness";
      }

      if (!topic && activeGoal) {
        const gLower = activeGoal.goal_text.toLowerCase();
        if (["japanese", "japan", "japn", "nihongo", "language", "lang", "laguage", "speak", "vocab", "word", "grammar", "talk", "write", "pronounce", "english", "spanish", "french", "german", "chinese", "korean"].some(kw => gLower.includes(kw))) {
          topic = "language";
        } else if (["c++", "cpp", "coding", "python", "programming", "javascript", "rust", "code", "program", "develop", "html", "css", "software", "developer", "compil"].some(kw => gLower.includes(kw))) {
          topic = "coding";
        } else if (gLower.includes("swim")) {
          topic = "swimming";
        } else if (["sprint", "run", "track", "fitness", "gym", "workout", "lift", "exercise", "training", "muscle", "weight", "cardio", "athlet"].some(kw => gLower.includes(kw))) {
          topic = "fitness";
        }
      }

      if (!topic) topic = "general";

      if (topic === "language") {
        let res = `### 🗣️ Language & Japanese Mastery Blueprint\n\n`;
        res += `Learning a language like Japanese requires consistency, active recall, and immersion. Here are the core tips to accelerate your progress:\n\n`;
        res += `- **1. Space Repetition System (SRS)**: Use flashcard software like **Anki** daily. Flashcards help lock new Hiragana, Katakana, Kanji, and vocabulary into long-term memory via active recall.\n`;
        res += `- **2. Shadowing Technique**: Listen to native Japanese audio (podcasts, videos, or anime) and repeat what you hear immediately. This trains your pronunciation, accent, and listening speed.\n`;
        res += `- **3. Contextual Grammar**: Don't just memorize rules. Write 3-5 simple sentences daily using new grammar guides (like particles \`は\`, \`が\`, \`を\`) to build natural writing and speaking habits.\n`;
        res += `- **4. Graded Immersion**: Read graded Japanese stories or watch simple videos. Learning in context is much faster than memorizing lists.\n\n`;
        res += `I have compiled a relevant quest for you. Click **Add to Quests** below to add it to your daily priority list!\n\n`;
        res += `\`\`\`json\n`;
        res += JSON.stringify({
          type: "proposed_task",
          action: "Complete a 30-minute Japanese/Language study block",
          why: "Active recall flashcards and sentence composition build vocabulary and fluency.",
          when_time: "today",
          xp_reward: 20,
          probability_impact: 4.0,
          subtasks: [
            { text: "Review 15-20 flashcards on Anki or write down 10 new words", done: false },
            { text: "Spend 10 minutes shadowing sentences from a target audio resource", done: false },
            { text: "Write 3 simple sentences using a grammar concept you learned today", done: false }
          ]
        }, null, 2);
        res += `\n\`\`\`\n`;
        return res;
      } 
      else if (topic === "coding") {
        let res = `### 💻 Software Development & Coding Blueprint\n\n`;
        res += `Mastering coding requires hands-on writing, reading code, and structured problem-solving. Here are key optimization strategies:\n\n`;
        res += `- **1. Learn by Doing**: Do not just read tutorials. Build small, functional scripts or console projects from scratch to understand control flow, memory, or OOP.\n`;
        res += `- **2. Read Production Code**: Spend 15-20 minutes on GitHub looking at popular repositories in your target language. Reading production-grade architectures teaches clean code habits.\n`;
        res += `- **3. Solve Algorithmic Challenges**: Use platforms like LeetCode or HackerRank to practice algorithms. It sharpens your data structure choices and logic.\n`;
        res += `- **4. Read compiler errors**: When you encounter bugs or warnings, read the trace carefully. Explaining to yourself why a crash happened is the best teacher.\n\n`;
        res += `I have compiled a relevant quest for you. Click **Add to Quests** below to add it to your active quests!\n\n`;
        res += `\`\`\`json\n`;
        res += JSON.stringify({
          type: "proposed_task",
          action: "Complete a focused programming study block",
          why: "Writing custom programs and analyzing errors builds deep engineering logic.",
          when_time: "today",
          xp_reward: 20,
          probability_impact: 4.0,
          subtasks: [
            { text: "Write and run a short script demonstrating one specific language concept", done: false },
            { text: "Find and spend 15 minutes reading an open-source source file on GitHub", done: false },
            { text: "Solve one algorithm challenge on LeetCode/HackerRank", done: false }
          ]
        }, null, 2);
        res += `\n\`\`\`\n`;
        return res;
      }
      else if (topic === "swimming") {
        let res = `### 🏊 Swim Technique & Performance Blueprint\n\n`;
        res += `Swimming is highly technical; drag reduction beats raw muscle conditioning. Focus on these elements:\n\n`;
        res += `- **1. Efficiency Over Volume**: Focus on head position, body rotation, and early vertical forearm catches rather than just swimming longer.\n`;
        res += `- **2. Dedicated Drill Time**: Dedicate the first 25% of your pool time to technique drills (e.g., single-arm, catch-up, or kicking drills) to cement mechanics.\n`;
        res += `- **3. Video Feedback**: Have someone record your strokes. Seeing your body alignment and elbow positions in slow motion makes corrections instant.\n`;
        res += `- **4. Smooth Breathing**: Exhale continuously underwater. Holding your breath increases CO2 buildup and causes muscle fatigue.\n\n`;
        res += `I have compiled a stroke refinement quest for you. Click **Add to Quests** below to add it!\n\n`;
        res += `\`\`\`json\n`;
        res += JSON.stringify({
          type: "proposed_task",
          action: "Execute a stroke technique pool session",
          why: "Targeted drills and stroke alignment minimize water drag and elevate race efficiency.",
          when_time: "today",
          xp_reward: 20,
          probability_impact: 4.0,
          subtasks: [
            { text: "Warm up with 200m easy swim focusing on relaxed breathing", done: false },
            { text: "Complete 4x50m catch-up drills focusing on arm entry and glide", done: false },
            { text: "Review your session performance and log key technique feedback", done: false }
          ]
        }, null, 2);
        res += `\n\`\`\`\n`;
        return res;
      }
      else if (topic === "fitness") {
        let res = `### 🏋️ Athletic Performance & Fitness Blueprint\n\n`;
        res += `Improving your physical capacity requires strict consistency, form integrity, and recovery optimization:\n\n`;
        res += `- **1. Progressive Overload**: Always track your metrics (weights, times, reps). Force your muscles to adapt by increasing resistance or volume slightly over time.\n`;
        res += `- **2. Technique Over Weight**: Heavy lifting or fast running with poor form causes injury. Record sets or starting block setups to check body geometry.\n`;
        res += `- **3. Prioritize Recovery**: Muscle building and neurological adaptation happen during rest. Aim for 7-8 hours of sleep and adequate nutrition.\n`;
        res += `- **4. Dynamic Warmups**: Prime your joints and nervous system with dynamic movements (lunges, leg swings) rather than static stretching before exercise.\n\n`;
        res += `I have compiled a training quest for you. Click **Add to Quests** below to add it!\n\n`;
        res += `\`\`\`json\n`;
        res += JSON.stringify({
          type: "proposed_task",
          action: "Complete a structured strength or training session",
          why: "Systematic workouts with proper warmups ensure progression and prevent injury.",
          when_time: "today",
          xp_reward: 20,
          probability_impact: 4.0,
          subtasks: [
            { text: "Perform a 10-minute dynamic warmup sequence", done: false },
            { text: "Complete your main training routine, recording weights, times, or reps", done: false },
            { text: "Spend 5 minutes on targeted stretching and mobility post-workout", done: false }
          ]
        }, null, 2);
        res += `\n\`\`\`\n`;
        return res;
      }
      else {
        const gTitle = activeGoal ? activeGoal.goal_text : "your campaign";
        let res = `### 🎯 Strategic Coaching Blueprint for: **${gTitle}**\n\n`;
        res += `Achieving any major target requires breaking it down, focus, and deliberate practice. Here is your roadmap:\n\n`;
        res += `- **1. Map Out Your Learning Path**: Choose 2-3 top books, tutorials, or mentors. A clear sequence prevents decision fatigue and wasted time.\n`;
        res += `- **2. Deliberate Practice Blocks**: Set a 30-minute timer. Turn off your phone and concentrate entirely on studying or practicing. Active struggle is where growth happens.\n`;
        res += `- **3. Apply and Verify**: Never just read or watch. Immediately construct a summary, build a prototype, solve a problem, and verify it against a reference.\n`;
        res += `- **4. Weekly Retrospectives**: At the end of every week, write down what went well and what bottleneck held you back. Adjust next week's focus accordingly.\n\n`;
        res += `I have compiled a study/practice quest for you. Click **Add to Quests** below to add it to your priority board!\n\n`;
        res += `\`\`\`json\n`;
        res += JSON.stringify({
          type: "proposed_task",
          action: `Complete a focused learning/practice block for: ${gTitle.substring(0, 30)}`,
          why: "Deliberate focus and direct application are the highest-leverage actions to grow skill probability.",
          when_time: "today",
          xp_reward: 20,
          probability_impact: 4.0,
          subtasks: [
            { text: "Identify one key topic or concept you need to practice next", done: false },
            { text: "Study or practice it for 30 minutes with zero distractions", done: false },
            { text: "Write a short summary or create a basic project to test your knowledge", done: false }
          ]
        }, null, 2);
        res += `\n\`\`\`\n`;
        return res;
      }
    }

    // Default Greeting
    let res = `### 👋 Hello, I am your AI Discipline & Priority Coach!\n\n`;
    res += `I'm here to audit your schedule and prioritize your active quests. Here's what you can ask me:\n\n`;
    res += `- ⚡ **"Which tasks should I prioritize?"** - Get a personalized quest prioritization breakdown.\n`;
    res += `- 📅 **"Audit my routine leaks"** - Find time leaks in your daily logged activities and reclaim them.\n`;
    res += `- 📈 **"What are my success odds?"** - Analyze your current campaign success probability.\n\n`;
    res += `💡 *Tip: If you want tips or quests to help you learn a skill, just ask (e.g., "how do I learn Japanese?" or "give me tips for C++").*\n\n`;

    if (activeGoal) {
      res += `Active Campaign: **${activeGoal.goal_text}**\n`;
      res += `Pending Quests: **${pendingTasks.length}** | Completed: **${completedTasks.length}**`;
    } else {
      res += `*No active campaign. Go to the Goals tab to initiate one!*`;
    }
    return res;
  }

  // Client-side NVIDIA Chat completions request
  async function callNvidiaChatApi(apiKey, model, baseUrl, messages) {
    const activeGoal = window.db.getActiveGoals()[0] || null;
    const tasks = activeGoal ? window.db.getTasksByGoalId(activeGoal.id) : [];
    const activities = window.db.getActivities();
    const profile = window.db.getProfile();

    const activitiesStr = activities.map(a => `- ${a.name}: ${a.duration_hours} hours (${a.type})`).join('\n');
    const tasksStr = tasks.map(t => `- Quest: '${t.action}' | Why: ${t.why} | Reward: +${t.xp_reward} XP, +${t.probability_impact}% | Status: ${t.is_completed === 1 ? 'Completed' : 'Pending'}`).join('\n') || "No quests compiled.";
    const goalStr = activeGoal ? `Goal: ${activeGoal.goal_text}\n- Baseline Odds: ${activeGoal.base_probability}\n- Current Odds: ${activeGoal.current_probability}\n- Focus Score: ${activeGoal.focus_score}\n- Deadline: ${activeGoal.deadline}\n- Rationale: ${activeGoal.rationale}` : "No active goal campaign.";

    const systemPrompt = `You are a ruthless but highly effective probability-based discipline & task prioritization AI coach.
Your job is to guide the user in optimizing their daily actions, routines, and task priorities to maximize the probability of achieving their active goal.

Here is the user's current context:
[USER PROFILE]
- Level: ${profile.level || 1}
- Streak: ${profile.streak || 0} days

[ACTIVE CAMPAIGN]
${goalStr}

[DAILY QUESTS / TASKS]
${tasksStr}

[DAILY ROUTINE & ACTIVITIES]
${activitiesStr}

COACHING DIRECTIONS:
1. Always prioritize quests/tasks with HIGHER probability impact and higher relevance to their deadline.
2. Be direct, clear, and actionable. Avoid generic motivational fluff. Be ruthless about time leaks (Unproductive activities).
3. If they ask about priority, recommend exactly which task to focus on first, which to do next, and which ones to skip or deprioritize. Explain WHY in terms of probability odds and XP.
4. Keep your replies concise and easy to read. Use bullet points and bold text where appropriate.
5. Format your output using simple Markdown (bold text, numbered lists, bullet points).
6. CRITICAL: If the user asks for a new task, asks what they should do, or if you feel a new task would greatly benefit their active goal, you MUST propose ONE new task using the exact JSON format below inside a markdown code block. The chat UI will turn this into an interactive 'Add to Quests' button.
\`\`\`json
{
  "type": "proposed_task",
  "action": "Short actionable title",
  "why": "Why it helps the goal",
  "when_time": "today / this week / recurring",
  "xp_reward": 15,
  "probability_impact": 3.0,
  "subtasks": [
    {"text": "Concrete step 1", "done": false},
    {"text": "Concrete step 2", "done": false}
  ]
}
\`\`\`
`;

    const formattedMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
    ];

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        model: model || "z-ai/glm-5.1",
        messages: formattedMessages,
        temperature: 0.5,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  function parseAndRenderProposedTask(text) {
    const jsonRegex = /```json\n([\s\S]*?)\n```/;
    const match = text.match(jsonRegex);
    let htmlText = text;
    let proposedTask = null;

    if (match) {
      try {
        const jsonStr = match[1];
        const obj = JSON.parse(jsonStr);
        if (obj.type === 'proposed_task') {
          proposedTask = obj;
          htmlText = text.replace(match[0], '').trim();
        }
      } catch (e) {
        console.error("Failed to parse proposed task JSON:", e);
      }
    }

    let html = htmlText
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');

    if (proposedTask) {
      const widgetId = 'task-widget-' + Date.now();
      const taskJson = JSON.stringify(proposedTask).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
      
      html += `
        <div class="proposed-task-card" id="${widgetId}">
          <div class="proposed-task-header">✨ Suggested Quest</div>
          <div class="proposed-task-title">${proposedTask.action}</div>
          <div class="proposed-task-meta">
            <span class="quest-tag">${proposedTask.when_time}</span>
            <span class="quest-tag xp-tag">+${proposedTask.xp_reward} XP</span>
          </div>
          <button class="btn-add-task" onclick='window.addProposedTask(${taskJson}, "${widgetId}")'>
            Add to Quests
          </button>
        </div>
      `;
    }

    return html;
  }

  window.addProposedTask = function(taskObj, widgetId) {
    const widget = document.getElementById(widgetId);
    if (widget) {
      const btn = widget.querySelector('.btn-add-task');
      if (btn) {
        btn.textContent = "Adding...";
        btn.style.pointerEvents = "none";
        btn.style.opacity = "0.7";
      }
    }

    const activeGoals = window.db.getActiveGoals();
    if (activeGoals.length === 0) {
      alert("No active campaign found to add task to. Generate a campaign first!");
      return;
    }

    setTimeout(() => {
      window.db.addCustomTask(
        activeGoals[0].id,
        taskObj.action,
        taskObj.why,
        taskObj.when_time,
        taskObj.xp_reward,
        taskObj.probability_impact,
        taskObj.subtasks
      );

      if (widget) {
        widget.innerHTML = `<div class="proposed-task-success">✅ Task added!</div>`;
      }
      setTimeout(() => {
        window.renderQuests();
        window.updateHudStats();
      }, 500);
    }, 150);
  };

  function addBubble(text, isUser) {
    const wrap = document.createElement('div');
    wrap.className = `chat-bubble-wrap ${isUser ? 'user' : 'assistant'}`;
    let html = text;
    
    if (!isUser) {
      html = parseAndRenderProposedTask(text);
    } else {
      html = text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
    }
    
    wrap.innerHTML = `<div class="chat-bubble">${html}</div>`;
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  }

  function renderChatHistory() {
    body.innerHTML = '';
    
    // Welcome bubble
    const welcomeWrap = document.createElement('div');
    welcomeWrap.className = 'chat-bubble-wrap assistant';
    welcomeWrap.innerHTML = `<div class="chat-bubble">Hey there! 🌱 I'm your discipline coach. Ask me to audit your routine, prioritize your quests, or break down your success odds.</div>`;
    body.appendChild(welcomeWrap);

    const history = window.db.getChatHistory();
    history.forEach(msg => {
      addBubble(msg.content, msg.role === 'user');
    });
    body.scrollTop = body.scrollHeight;
  }

  async function send() {
    const text = input.value.trim();
    if (!text) return;

    addBubble(text, true);
    window.db.saveChatMessage('user', text);
    input.value = '';

    // Show thinking indicator
    const typing = document.createElement('div');
    typing.className = 'chat-bubble-wrap assistant';
    typing.innerHTML = '<div class="chat-bubble" style="opacity: 0.5;">Thinking…</div>';
    body.appendChild(typing);
    body.scrollTop = body.scrollHeight;

    const apiKey = localStorage.getItem('gl_api_key');
    const model = localStorage.getItem('gl_api_model') || 'z-ai/glm-5.1';
    const baseUrl = localStorage.getItem('gl_api_base_url') || 'https://integrate.api.nvidia.com/v1';

    try {
      let coachResponseText;
      if (apiKey) {
        // Run with API
        const history = window.db.getChatHistory();
        coachResponseText = await callNvidiaChatApi(apiKey, model, baseUrl, history);
      } else {
        // Instant local response
        coachResponseText = getLocalCoachResponse(text);
      }

      typing.remove();
      addBubble(coachResponseText, false);
      window.db.saveChatMessage('assistant', coachResponseText);
    } catch (e) {
      console.error("Chat API error. Falling back to local rules:", e);
      typing.remove();
      const localResponse = getLocalCoachResponse(text);
      addBubble(localResponse, false);
      window.db.saveChatMessage('assistant', localResponse);
    }
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keypress', e => { if (e.key === 'Enter') send(); });

  window.renderChatHistory = renderChatHistory;
})();
