/* ==========================================================================
   GAMIFY LIFE — GOAL-GENERATOR.JS
   Client-side Goal Plan Generator & NVIDIA LLM API Integration
   ========================================================================== */

(function () {
  // Local fallback analyzer (matches Python fallback_analysis)
  function getLocalFallbackPlan(goal, currentLevel, deadline, availableTime) {
    const lowerGoal = goal.toLowerCase();
    let plan = [];
    let probability = "32%";
    let focusScore = "66%";
    let rationale = "";

    const shortGoal = goal.length > 40 ? goal.substring(0, 40) + "..." : goal;

    if (lowerGoal.includes("swim")) {
      plan = [
        {
          action: "Record 3 technique clips this week",
          why: "Video feedback quickly exposes stroke, breathing, and body-position errors.",
          when: "this week",
          xp_reward: 25,
          probability_impact: 5.0,
          subtasks: [
            "Set up a waterproof phone mount or ask a friend to record",
            "Record one clip of freestyle stroke from the side",
            "Record one clip of breathing technique from the front",
            "Watch all 3 clips and note 2 specific flaws to fix"
          ]
        },
        {
          action: "Do 2 focused drill sessions before full-speed sets",
          why: "Drills build the exact movement patterns that raise race efficiency.",
          when: "recurring",
          xp_reward: 20,
          probability_impact: 4.0,
          subtasks: [
            "Warm up with 200m easy swim",
            "Do 4x50m catch-up drill focusing on hand entry",
            "Do 4x50m single-arm drill alternating sides",
            "Finish with 2x100m at race pace to apply drill learnings"
          ]
        },
        {
          action: "Track sleep, recovery, and pool attendance",
          why: "Consistency compounds and usually beats random hard sessions.",
          when: "today",
          xp_reward: 15,
          probability_impact: 3.0,
          subtasks: [
            "Log last night's sleep hours and quality (1-5)",
            "Rate today's muscle soreness (1-5) in a notes app",
            "Mark today's pool session as attended or skipped"
          ]
        }
      ];
      probability = "38%";
      focusScore = "71%";
      rationale = "Swimming performance improves fastest when you attack technique, consistency, and recovery together instead of just doing more volume.";
    } 
    else if (["c++", "cpp", "coding", "python", "programming", "javascript", "rust", "code", "program", "develop", "html", "css", "software", "developer", "compil"].some(kw => lowerGoal.includes(kw))) {
      plan = [
        {
          action: "Complete a 45-minute focused coding session",
          why: "Consistent, hands-on coding is required to master syntax, memory management, and problem-solving.",
          when: "today",
          xp_reward: 20,
          probability_impact: 4.0,
          subtasks: [
            "Pick one specific concept related to your goal",
            "Write a small program that uses only that concept",
            "Compile and run the program successfully",
            "Fix any compiler warnings, bugs, or style issues"
          ]
        },
        {
          action: "Read and analyze open-source code",
          why: "Reading production-level code teaches you standard practices and advanced patterns.",
          when: "this week",
          xp_reward: 15,
          probability_impact: 3.0,
          subtasks: [
            "Find a popular open-source repository on GitHub related to your technology stack",
            "Spend 20 minutes reading the source code of one specific class or module",
            "Write down 3 new syntax features or architectural patterns you observed"
          ]
        },
        {
          action: "Solve 2 algorithmic challenges",
          why: "Algorithms test your fundamental understanding of data structures and problem solving.",
          when: "recurring",
          xp_reward: 25,
          probability_impact: 4.5,
          subtasks: [
            "Log into LeetCode, HackerRank, or a similar platform",
            "Complete one 'Easy' string manipulation or array problem",
            "Complete one 'Medium' problem focusing on efficiency"
          ]
        }
      ];
      probability = "45%";
      focusScore = "80%";
      rationale = `Mastering development for '${goal}' requires a strict balance of learning new concepts, reading existing codebases, and relentless problem-solving.`;
    } 
    else if (["japanese", "japan", "japn", "nihongo", "language", "lang", "laguage", "speak", "vocab", "word", "grammar", "talk", "write", "pronounce", "english", "spanish", "french", "german", "chinese", "korean"].some(kw => lowerGoal.includes(kw))) {
      plan = [
        {
          action: "Learn and practice core vocabulary and characters",
          why: "Expanding your vocabulary and mastering the writing system is the baseline for language comprehension.",
          when: "today",
          xp_reward: 20,
          probability_impact: 4.0,
          subtasks: [
            "Study 10 new vocabulary words or writing characters (Hiragana/Katakana/Kanji/etc.)",
            "Do 15 minutes of flashcard review using an app like Anki or Duolingo",
            "Write down the new words in a notebook and say them aloud to practice pronunciation"
          ]
        },
        {
          action: "Practice language listening or reading comprehension",
          why: "Active immersion builds pattern recognition and natural flow of the language.",
          when: "this week",
          xp_reward: 20,
          probability_impact: 3.5,
          subtasks: [
            "Listen to a target language podcast or watch a short video for 15 minutes",
            "Identify and note down 3-5 words or phrases you did not understand",
            "Look up their meanings and write down one example sentence for each"
          ]
        },
        {
          action: "Construct and verify simple grammar sentences",
          why: "Applying vocabulary to sentence structures builds active composition and communication skills.",
          when: "recurring",
          xp_reward: 25,
          probability_impact: 4.5,
          subtasks: [
            "Select a simple grammar structure (e.g., basic particle usage or tenses)",
            "Write 5 custom sentences using that grammar structure",
            "Double-check your sentences against a grammar reference or learning community"
          ]
        }
      ];
      probability = "42%";
      focusScore = "78%";
      rationale = `Language learning for '${goal}' relies heavily on daily vocabulary retention, active composition, and passive immersion to build natural comprehension.`;
    } 
    else if (["sprint", "run", "track", "fitness", "gym", "workout", "lift", "exercise", "training", "muscle", "weight", "cardio", "athlet"].some(kw => lowerGoal.includes(kw))) {
      plan = [
        {
          action: "Execute a high-intensity workout or interval session",
          why: "Physical capacity increases through progressive overload and high effort intervals, not static routines.",
          when: "this week",
          xp_reward: 25,
          probability_impact: 5.0,
          subtasks: [
            "Perform a full 15-minute dynamic warmup to prevent injury",
            "Execute your planned training sets or interval sprints at high effort",
            "Take adequate recovery time between sets/intervals",
            "Record your times, reps, or weights and note any form breakdowns"
          ]
        },
        {
          action: "Film and analyze your exercise technique",
          why: "Form and efficiency dictate long-term progress and prevent injuries.",
          when: "today",
          xp_reward: 20,
          probability_impact: 4.0,
          subtasks: [
            "Set up a phone camera to record a set or movement sequence",
            "Perform 3 reps or starts focusing purely on technique",
            "Review the footage to check body angles, alignment, and execution"
          ]
        },
        {
          action: "Perform a target strength and mobility session",
          why: "Force production and flexibility are the primary drivers of athletic performance.",
          when: "recurring",
          xp_reward: 20,
          probability_impact: 3.5,
          subtasks: [
            "Complete 4 sets of compound lifts or bodyweight exercises",
            "Perform 3 sets of explosive plyometric movements or core work",
            "Stretch primary muscle groups and hip flexors thoroughly post-workout"
          ]
        }
      ];
      probability = "40%";
      focusScore = "75%";
      rationale = `Athletic performance for '${goal}' relies on explosive force, perfect technique, and consistency. This plan prioritizes structured workouts and form analysis.`;
    } 
    else {
      plan = [
        {
          action: `Research resources and plan a study path for: ${shortGoal}`,
          why: "Having a clear set of resources and a weekly outline prevents procrastination and keeps learning structured.",
          when: "today",
          xp_reward: 15,
          probability_impact: 3.0,
          subtasks: [
            `Find 2-3 top-rated learning resources (books, tutorials, or guides) for '${shortGoal}'`,
            "Draft a simple learning sequence or topic outline for this month",
            "Set up a clean study environment with all necessary tools ready"
          ]
        },
        {
          action: `Complete a 30-minute focused study or practice session on: ${shortGoal}`,
          why: "Relentless, distraction-free practice builds direct skill competence over time.",
          when: "recurring",
          xp_reward: 20,
          probability_impact: 4.0,
          subtasks: [
            "Select the first topic or technique from your outline",
            "Set a 30-minute timer and eliminate all notifications/distractions",
            "Actively practice or study that topic for the entire 30 minutes",
            "Write 2-3 bullet points in a study log explaining the main takeaways"
          ]
        },
        {
          action: `Apply and test your knowledge on: ${shortGoal}`,
          why: "Active application of concepts cements knowledge and highlights areas needing review.",
          when: "this week",
          xp_reward: 20,
          probability_impact: 3.5,
          subtasks: [
            "Create a mini-project, solve a problem, or write an analysis applying what you learned",
            "Check your output against a reliable reference or answer key",
            "List 1-2 specific points to review or practice further in the next session"
          ]
        }
      ];
      probability = "35%";
      focusScore = "70%";
      rationale = `Improving in '${shortGoal}' is most effective when you outline a sequence of study, focus on distraction-free practice sessions, and immediately apply what you learn.`;
    }

    return {
      goal: goal,
      current_level: currentLevel || "Not specified",
      deadline: deadline || "Not specified",
      available_time: availableTime || "Not specified",
      plan: plan,
      probability: probability,
      focus_score: focusScore,
      rationale: rationale,
      provider: "Local fallback"
    };
  }

  // OpenAI-compatible Chat Completions call client side
  async function callNvidiaApi(apiKey, model, baseUrl, goal, currentLevel, deadline, availableTime, activitiesStr) {
    const prompt = `You are a ruthless but helpful probability-based goal coach.

The user wants to achieve this goal:
${goal}

Current level:
${currentLevel}

Deadline:
${deadline}

Available time per day or week:
${availableTime}

User's current daily routine & activities:
${activitiesStr}

Return JSON only with this shape:
{
  "probability": "string percent estimate like 42%",
  "focus_score": "string percent estimate like 68%",
  "rationale": "one short paragraph analyzing their daily structure, identifying time leaks, and explaining how the plan fits into their available time",
  "plan": [
    {
      "action": "short action title",
      "why": "why it improves odds",
      "when": "today / this week / recurring",
      "xp_reward": 15,
      "probability_impact": 4.0,
      "subtasks": [
        "specific step 1 to complete this action",
        "specific step 2 to complete this action",
        "specific step 3 to complete this action"
      ]
    }
  ]
}

Rules:
- Focus on actions that increase probability the most.
- Be specific and practical. Adjust tasks to fit the user's available time based on their daily routine analysis.
- Prefer training, feedback, recovery, and measurement.
- Allocate realistic XP reward (between 10 and 30) and probability_impact (between 2.0 and 6.0) for each task based on effort and impact.
- CRITICAL: The tasks and subtasks MUST be highly specific to the actual goal topic (e.g. if the goal is about C++, tasks must be about C++ syntax, projects, or reading C++ code; if sprinting, tasks must be about 100m dashes, warmups, blocks, etc.). Do not generate generic self-help or vague tasks.
- Each action MUST have a "subtasks" array with 3 to 5 specific, concrete, actionable steps that break the action into a checklist. These should be very clear and immediately doable (not vague).
- Do not give motivation speech.
- Keep the plan short and high leverage.`;

    const payload = {
      model: model || "z-ai/glm-5.1",
      messages: [
        { role: "system", content: "You are a probability-based goal coach." },
        { role: "user", content: prompt }
      ],
      temperature: 0.4,
      max_tokens: 800
    };

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.choices[0].message.content;

    // Parse JSON
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("No JSON found in AI response");
    }
    const parsed = JSON.parse(text.substring(start, end + 1));
    parsed.provider = `NVIDIA / ${model}`;
    return parsed;
  }

  // Primary Generate function called by UI
  async function generateGoalPlan(goal, currentLevel, deadline, availableTime) {
    const apiKey = localStorage.getItem('gl_api_key');
    const model = localStorage.getItem('gl_api_model') || 'z-ai/glm-5.1';
    const baseUrl = localStorage.getItem('gl_api_base_url') || 'https://integrate.api.nvidia.com/v1';

    // Format routine context for LLM prompt
    const activities = window.db.getActivities();
    const activitiesStr = activities.map(a => `- ${a.name}: ${a.duration_hours} hours (${a.type})`).join('\n');

    if (!apiKey) {
      // Direct local fallback
      return getLocalFallbackPlan(goal, currentLevel, deadline, availableTime);
    }

    try {
      // Attempt API Call
      const result = await callNvidiaApi(apiKey, model, baseUrl, goal, currentLevel, deadline, availableTime, activitiesStr);
      return {
        goal: goal,
        current_level: currentLevel || "Not specified",
        deadline: deadline || "Not specified",
        available_time: availableTime || "Not specified",
        plan: result.plan,
        probability: result.probability || "Unknown",
        focus_score: result.focus_score || "Unknown",
        rationale: result.rationale || "",
        provider: result.provider
      };
    } catch (e) {
      console.warn("NVIDIA LLM API failed. Falling back to local heuristics:", e);
      const fallback = getLocalFallbackPlan(goal, currentLevel, deadline, availableTime);
      fallback.provider = "Local fallback (NVIDIA API failed)";
      return fallback;
    }
  }

  // Export globally
  window.goalGenerator = {
    generateGoalPlan
  };
})();
