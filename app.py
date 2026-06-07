from __future__ import annotations

import json
import os
import random
import sqlite3
import threading
from datetime import datetime
from typing import Any
from urllib import error, request

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

if load_dotenv is not None:
    load_dotenv()

from flask import Flask, flash, redirect, render_template, request as flask_request, url_for, jsonify

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "64ad5b28c7dab742987a72c319705fb1099da41f0f1e2e1118cd7d6cd346eece")

DB_PATH = os.path.join(os.path.dirname(__file__), "gamify_life.db")

MOTIVATIONAL_SLOGANS = [
    "Focus on the process, not the outcome. Consistency wins.",
    "You don't need motivation, you need discipline.",
    "Every action you take is a vote for the person you want to become.",
    "Discipline compounds. 1% better every single day.",
    "The pain of discipline is temporary; the pain of regret is permanent.",
    "Subtract the noise. Focus on the high-leverage bottlenecks.",
    "Consistency beats talent. Show up every day.",
    "Your daily routine is your actual priority. Expose the leaks."
]


def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=20.0)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    with get_db() as conn:
        with open(schema_path, "r", encoding="utf-8") as f:
            conn.executescript(f.read())
        # Safe migration for goals (is_active column)
        try:
            conn.execute("ALTER TABLE goals ADD COLUMN is_active INTEGER DEFAULT 0")
        except sqlite3.OperationalError:
            pass  # column already exists
        # Safe migrations for user_profile columns
        try:
            conn.execute("ALTER TABLE user_profile ADD COLUMN name TEXT DEFAULT 'Explorer'")
        except sqlite3.OperationalError:
            pass
        try:
            conn.execute("ALTER TABLE user_profile ADD COLUMN age INTEGER")
        except sqlite3.OperationalError:
            pass
        try:
            conn.execute("ALTER TABLE user_profile ADD COLUMN birthdate TEXT")
        except sqlite3.OperationalError:
            pass
        try:
            conn.execute("ALTER TABLE user_profile ADD COLUMN focus_level TEXT DEFAULT 'Moderate'")
        except sqlite3.OperationalError:
            pass
        # Safe migration for tasks subtasks column
        try:
            conn.execute("ALTER TABLE tasks ADD COLUMN subtasks TEXT DEFAULT '[]'")
        except sqlite3.OperationalError:
            pass
        conn.commit()


# Initialize database schemas
init_db()


def get_profile():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT level, xp, streak, last_active, name, age, birthdate, focus_level FROM user_profile WHERE id = 1")
        row = cursor.fetchone()
        if row:
            d = dict(row)
            if not d.get("name"):
                d["name"] = "Explorer"
            return d
    return {"level": 1, "xp": 0, "streak": 0, "last_active": None, "name": "Explorer", "age": "", "birthdate": "", "focus_level": "Moderate"}


def update_streak(conn):
    cursor = conn.cursor()
    cursor.execute("SELECT streak, last_active FROM user_profile WHERE id = 1")
    row = cursor.fetchone()
    if row:
        streak = row["streak"]
        last_active_str = row["last_active"]
        today_str = datetime.utcnow().strftime("%Y-%m-%d")

        if not last_active_str:
            new_streak = 1
        else:
            try:
                last_active_date = datetime.strptime(last_active_str, "%Y-%m-%d").date()
                today_date = datetime.utcnow().date()
                diff = (today_date - last_active_date).days
                if diff == 1:
                    new_streak = streak + 1
                elif diff == 0:
                    new_streak = streak
                else:
                    new_streak = 1
            except Exception:
                new_streak = 1

        cursor.execute("UPDATE user_profile SET streak = ?, last_active = ? WHERE id = 1", (new_streak, today_str))


def update_xp_and_level(conn, xp_change: int) -> tuple[int, int, bool]:
    """Updates user XP, handles levels, and returns (new_level, new_xp, level_up_occurred)"""
    cursor = conn.cursor()
    cursor.execute("SELECT level, xp FROM user_profile WHERE id = 1")
    row = cursor.fetchone()
    if not row:
        return 1, 0, False

    level = row["level"]
    xp = row["xp"]

    new_xp = xp + xp_change
    level_up = False

    # Level up logic
    while new_xp >= 100:
        new_xp -= 100
        level += 1
        level_up = True

    # Level down logic
    while new_xp < 0:
        if level > 1:
            level -= 1
            new_xp += 100
            level_up = True
        else:
            new_xp = 0
            break

    cursor.execute("UPDATE user_profile SET level = ?, xp = ? WHERE id = 1", (level, new_xp))
    return level, new_xp, level_up


def get_activities() -> list[dict[str, Any]]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, duration_hours, type FROM daily_activities ORDER BY type, name")
        return [dict(row) for row in cursor.fetchall()]


def get_active_goals() -> list[dict[str, Any]]:
    """Return all active goals with their tasks. Falls back to latest goal if none active."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, goal_text, current_level, deadline, available_time, base_probability, current_probability, focus_score, rationale, generated_at FROM goals WHERE is_active = 1 ORDER BY id DESC")
        rows = cursor.fetchall()

        if not rows:
            # Fallback to the latest goal
            cursor.execute("SELECT id, goal_text, current_level, deadline, available_time, base_probability, current_probability, focus_score, rationale, generated_at FROM goals ORDER BY id DESC LIMIT 1")
            row = cursor.fetchone()
            if row:
                goal_id = row["id"]
                cursor.execute("UPDATE goals SET is_active = 1 WHERE id = ?", (goal_id,))
                conn.commit()
                rows = [row]

        active_goals = []
        for row in rows:
            goal_dict = dict(row)
            cursor.execute("SELECT id, action, why, when_time, xp_reward, probability_impact, is_completed, subtasks FROM tasks WHERE goal_id = ?", (goal_dict["id"],))
            plan = []
            for r in cursor.fetchall():
                task_dict = dict(r)
                try:
                    task_dict["subtasks"] = json.loads(task_dict.get("subtasks") or "[]")
                except (json.JSONDecodeError, TypeError):
                    task_dict["subtasks"] = []
                # Tag each task with the goal name for display
                task_dict["goal_text"] = goal_dict["goal_text"]
                plan.append(task_dict)
            goal_dict["plan"] = plan
            active_goals.append(goal_dict)
        return active_goals


def get_all_goals() -> list[dict[str, Any]]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, goal_text, base_probability, current_probability, focus_score, rationale, generated_at, is_active FROM goals ORDER BY id DESC")
        return [dict(row) for row in cursor.fetchall()]


def get_reviews() -> list[dict[str, Any]]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, rating, notes, created_at FROM daily_reviews ORDER BY id DESC LIMIT 10")
        return [dict(row) for row in cursor.fetchall()]


def build_prompt(goal: str, current_level: str, deadline: str, available_time: str, activities_str: str) -> str:
    return f"""You are a ruthless but helpful probability-based goal coach.

The user wants to achieve this goal:
{goal}

Current level:
{current_level}

Deadline:
{deadline}

Available time per day or week:
{available_time}

User's current daily routine & activities:
{activities_str}

Return JSON only with this shape:
{{
  "probability": "string percent estimate like 42%",
  "focus_score": "string percent estimate like 68%",
  "rationale": "one short paragraph analyzing their daily structure, identifying time leaks, and explaining how the plan fits into their available time",
  "plan": [
    {{
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
    }}
  ]
}}

Rules:
- Focus on actions that increase probability the most.
- Be specific and practical. Adjust tasks to fit the user's available time based on their daily routine analysis.
- Prefer training, feedback, repetition, recovery, and measurement.
- Allocate realistic XP reward (between 10 and 30) and probability_impact (between 2.0 and 6.0) for each task based on effort and impact.
- CRITICAL: The tasks and subtasks MUST be highly specific to the actual goal topic (e.g. if the goal is about C++, tasks must be about C++ syntax, projects, or reading C++ code; if sprinting, tasks must be about 100m dashes, warmups, blocks, etc.). Do not generate generic self-help or vague tasks.
- Each action MUST have a "subtasks" array with 3 to 5 specific, concrete, actionable steps that break the action into a checklist. These should be very clear and immediately doable (not vague). For example, instead of "practice more", say "Do 3 sets of 10 reps of X drill" or "Read chapter 5 of Y book and take 1-page notes".
- Do not give motivation speech.
- Keep the plan short and high leverage.
"""


def parse_json_response(text: str) -> dict[str, Any]:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON found in AI response")
    return json.loads(text[start : end + 1])


def call_nvidia_api(goal: str, current_level: str, deadline: str, available_time: str, activities_str: str) -> dict[str, Any]:
    api_key = os.environ.get("NVIDIA_API_KEY")
    model = os.environ.get("NVIDIA_MODEL", "z-ai/glm-5.1")
    base_url = os.environ.get("NVIDIA_API_BASE_URL", "https://integrate.api.nvidia.com/v1")

    if not api_key:
        return fallback_analysis(goal, current_level, deadline, available_time, activities_str)

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You are a probability-based goal coach."},
            {"role": "user", "content": build_prompt(goal, current_level, deadline, available_time, activities_str)},
        ],
        "temperature": 0.4,
        "max_tokens": 800,
    }

    api_request = request.Request(
        f"{base_url.rstrip('/')}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )

    try:
        with request.urlopen(api_request, timeout=3.0) as response:
            data = json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        raise RuntimeError(f"AI request failed with HTTP {exc.code}") from exc
    except error.URLError as exc:
        raise RuntimeError(f"AI request failed: {exc.reason}") from exc

    content = data["choices"][0]["message"]["content"]
    parsed = parse_json_response(content)
    
    plan = parsed.get("plan", [])
    for item in plan:
        if "xp_reward" not in item:
            item["xp_reward"] = 15
        else:
            try:
                item["xp_reward"] = int(item["xp_reward"])
            except:
                item["xp_reward"] = 15
                
        if "probability_impact" not in item:
            item["probability_impact"] = 3.0
        else:
            try:
                item["probability_impact"] = float(item["probability_impact"])
            except:
                item["probability_impact"] = 3.0

        # Parse subtasks: convert string list to list of {text, done} dicts
        raw_subtasks = item.get("subtasks", [])
        if isinstance(raw_subtasks, list):
            item["subtasks"] = [{"text": str(s), "done": False} for s in raw_subtasks if s]
        else:
            item["subtasks"] = []

    return {
        "goal": goal,
        "current_level": current_level,
        "deadline": deadline,
        "available_time": available_time,
        "plan": plan,
        "probability": parsed.get("probability", "Unknown"),
        "focus_score": parsed.get("focus_score", "Unknown"),
        "rationale": parsed.get("rationale", ""),
        "provider": f"NVIDIA / {model}",
        "generated_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
    }


def fallback_analysis(goal: str, current_level: str, deadline: str, available_time: str, activities_str: str) -> dict[str, Any]:
    lower_goal = goal.lower()
    if "swim" in lower_goal:
        plan = [
            {
                "action": "Record 3 technique clips this week",
                "why": "Video feedback quickly exposes stroke, breathing, and body-position errors.",
                "when": "this week",
                "xp_reward": 25,
                "probability_impact": 5.0,
                "subtasks": [
                    {"text": "Set up a waterproof phone mount or ask a friend to record", "done": False},
                    {"text": "Record one clip of freestyle stroke from the side", "done": False},
                    {"text": "Record one clip of breathing technique from the front", "done": False},
                    {"text": "Watch all 3 clips and note 2 specific flaws to fix", "done": False}
                ]
            },
            {
                "action": "Do 2 focused drill sessions before full-speed sets",
                "why": "Drills build the exact movement patterns that raise race efficiency.",
                "when": "recurring",
                "xp_reward": 20,
                "probability_impact": 4.0,
                "subtasks": [
                    {"text": "Warm up with 200m easy swim", "done": False},
                    {"text": "Do 4x50m catch-up drill focusing on hand entry", "done": False},
                    {"text": "Do 4x50m single-arm drill alternating sides", "done": False},
                    {"text": "Finish with 2x100m at race pace to apply drill learnings", "done": False}
                ]
            },
            {
                "action": "Track sleep, recovery, and pool attendance",
                "why": "Consistency compounds and usually beats random hard sessions.",
                "when": "today",
                "xp_reward": 15,
                "probability_impact": 3.0,
                "subtasks": [
                    {"text": "Log last night's sleep hours and quality (1-5)", "done": False},
                    {"text": "Rate today's muscle soreness (1-5) in a notes app", "done": False},
                    {"text": "Mark today's pool session as attended or skipped", "done": False}
                ]
            },
        ]
        probability = "38%"
        focus_score = "71%"
        rationale = "Swimming performance improves fastest when you attack technique, consistency, and recovery together instead of just doing more volume."
    elif any(kw in lower_goal for kw in ["c++", "cpp", "coding", "python", "programming", "javascript", "rust", "html", "css", "software", "develop", "code"]):
        plan = [
            {
                "action": "Complete a 45-minute focused coding session",
                "why": "Consistent, hands-on coding is required to master syntax, memory management, and problem-solving.",
                "when": "today",
                "xp_reward": 20,
                "probability_impact": 4.0,
                "subtasks": [
                    {"text": "Pick one specific concept related to your goal", "done": False},
                    {"text": "Write a small program that uses only that concept", "done": False},
                    {"text": "Compile and run the program successfully", "done": False},
                    {"text": "Fix any compiler warnings, bugs, or style issues", "done": False}
                ]
            },
            {
                "action": "Read and analyze open-source code",
                "why": "Reading production-level code teaches you standard practices and advanced patterns.",
                "when": "this week",
                "xp_reward": 15,
                "probability_impact": 3.0,
                "subtasks": [
                    {"text": "Find a popular open-source repository on GitHub related to your technology stack", "done": False},
                    {"text": "Spend 20 minutes reading the source code of one specific class or module", "done": False},
                    {"text": "Write down 3 new syntax features or architectural patterns you observed", "done": False}
                ]
            },
            {
                "action": "Solve 2 algorithmic challenges",
                "why": "Algorithms test your fundamental understanding of data structures and problem solving.",
                "when": "recurring",
                "xp_reward": 25,
                "probability_impact": 4.5,
                "subtasks": [
                    {"text": "Log into LeetCode, HackerRank, or a similar platform", "done": False},
                    {"text": "Complete one 'Easy' string manipulation or array problem", "done": False},
                    {"text": "Complete one 'Medium' problem focusing on efficiency", "done": False}
                ]
            }
        ]
        probability = "45%"
        focus_score = "80%"
        rationale = f"Mastering development for '{goal}' requires a strict balance of learning new concepts, reading existing codebases, and relentless problem-solving."
    elif any(kw in lower_goal for kw in ["japanese", "japan", "japn", "nihongo", "language", "lang", "laguage", "speak", "vocab", "word", "grammar", "talk", "write", "pronounce", "english", "spanish", "french", "german", "chinese", "korean"]):
        plan = [
            {
                "action": "Learn and practice core vocabulary and characters",
                "why": "Expanding your vocabulary and mastering the writing system is the baseline for language comprehension.",
                "when": "today",
                "xp_reward": 20,
                "probability_impact": 4.0,
                "subtasks": [
                    {"text": "Study 10 new vocabulary words or writing characters (Hiragana/Katakana/Kanji/etc.)", "done": False},
                    {"text": "Do 15 minutes of flashcard review using an app like Anki or Duolingo", "done": False},
                    {"text": "Write down the new words in a notebook and say them aloud to practice pronunciation", "done": False}
                ]
            },
            {
                "action": "Practice language listening or reading comprehension",
                "why": "Active immersion builds pattern recognition and natural flow of the language.",
                "when": "this week",
                "xp_reward": 20,
                "probability_impact": 3.5,
                "subtasks": [
                    {"text": "Listen to a target language podcast or watch a short video for 15 minutes", "done": False},
                    {"text": "Identify and note down 3-5 words or phrases you did not understand", "done": False},
                    {"text": "Look up their meanings and write down one example sentence for each", "done": False}
                ]
            },
            {
                "action": "Construct and verify simple grammar sentences",
                "why": "Applying vocabulary to sentence structures builds active composition and communication skills.",
                "when": "recurring",
                "xp_reward": 25,
                "probability_impact": 4.5,
                "subtasks": [
                    {"text": "Select a simple grammar structure (e.g., basic particle usage or tenses)", "done": False},
                    {"text": "Write 5 custom sentences using that grammar structure", "done": False},
                    {"text": "Double-check your sentences against a grammar reference or learning community", "done": False}
                ]
            }
        ]
        probability = "42%"
        focus_score = "78%"
        rationale = f"Language learning for '{goal}' relies heavily on daily vocabulary retention, active composition, and passive immersion to build natural comprehension."
    elif any(kw in lower_goal for kw in ["sprint", "run", "track", "fitness", "gym", "workout", "lift", "exercise", "training", "muscle", "weight"]):
        plan = [
            {
                "action": "Execute a high-intensity workout or interval session",
                "why": "Physical capacity increases through progressive overload and high effort intervals, not static routines.",
                "when": "this week",
                "xp_reward": 25,
                "probability_impact": 5.0,
                "subtasks": [
                    {"text": "Perform a full 15-minute dynamic warmup to prevent injury", "done": False},
                    {"text": "Execute your planned training sets or interval sprints at high effort", "done": False},
                    {"text": "Take adequate recovery time between sets/intervals", "done": False},
                    {"text": "Record your times, reps, or weights and note any form breakdowns", "done": False}
                ]
            },
            {
                "action": "Film and analyze your exercise technique",
                "why": "Form and efficiency dictate long-term progress and prevent injuries.",
                "when": "today",
                "xp_reward": 20,
                "probability_impact": 4.0,
                "subtasks": [
                    {"text": "Set up a phone camera to record a set or movement sequence", "done": False},
                    {"text": "Perform 3 reps or starts focusing purely on technique", "done": False},
                    {"text": "Review the footage to check body angles, alignment, and execution", "done": False}
                ]
            },
            {
                "action": "Perform a target strength and mobility session",
                "why": "Force production and flexibility are the primary drivers of athletic performance.",
                "when": "recurring",
                "xp_reward": 20,
                "probability_impact": 3.5,
                "subtasks": [
                    {"text": "Complete 4 sets of compound lifts or bodyweight exercises", "done": False},
                    {"text": "Perform 3 sets of explosive plyometric movements or core work", "done": False},
                    {"text": "Stretch primary muscle groups and hip flexors thoroughly post-workout", "done": False}
                ]
            }
        ]
        probability = "40%"
        focus_score = "75%"
        rationale = f"Athletic performance for '{goal}' relies on explosive force, perfect technique, and consistency. This plan prioritizes structured workouts and form analysis."
    else:
        short_goal = goal[:40] + "..." if len(goal) > 40 else goal
        plan = [
            {
                "action": f"Research resources and plan a study path for: {short_goal}",
                "why": "Having a clear set of resources and a weekly outline prevents procrastination and keeps learning structured.",
                "when": "today",
                "xp_reward": 15,
                "probability_impact": 3.0,
                "subtasks": [
                    {"text": f"Find 2-3 top-rated learning resources (books, tutorials, or guides) for '{short_goal}'", "done": False},
                    {"text": "Draft a simple learning sequence or topic outline for this month", "done": False},
                    {"text": "Set up a clean study environment with all necessary tools ready", "done": False}
                ]
            },
            {
                "action": f"Complete a 30-minute focused study or practice session on: {short_goal}",
                "why": "Relentless, distraction-free practice builds direct skill competence over time.",
                "when": "recurring",
                "xp_reward": 20,
                "probability_impact": 4.0,
                "subtasks": [
                    {"text": "Select the first topic or technique from your outline", "done": False},
                    {"text": "Set a 30-minute timer and eliminate all notifications/distractions", "done": False},
                    {"text": "Actively practice or study that topic for the entire 30 minutes", "done": False},
                    {"text": "Write 2-3 bullet points in a study log explaining the main takeaways", "done": False}
                ]
            },
            {
                "action": f"Apply and test your knowledge on: {short_goal}",
                "why": "Active application of concepts cements knowledge and highlights areas needing review.",
                "when": "this week",
                "xp_reward": 20,
                "probability_impact": 3.5,
                "subtasks": [
                    {"text": "Create a mini-project, solve a problem, or write an analysis applying what you learned", "done": False},
                    {"text": "Check your output against a reliable reference or answer key", "done": False},
                    {"text": "List 1-2 specific points to review or practice further in the next session", "done": False}
                ]
            },
        ]
        probability = "35%"
        focus_score = "70%"
        rationale = f"Improving in '{short_goal}' is most effective when you outline a sequence of study, focus on distraction-free practice sessions, and immediately apply what you learn."

    return {
        "goal": goal,
        "current_level": current_level,
        "deadline": deadline,
        "available_time": available_time,
        "plan": plan,
        "probability": probability,
        "focus_score": focus_score,
        "rationale": rationale,
        "provider": "Local fallback",
        "generated_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
    }


def fallback_chat_response(user_message: str, active_goal: dict[str, Any] | None, tasks: list[dict[str, Any]], activities: list[dict[str, Any]]) -> str:
    msg = user_message.lower()
    
    # Analyze routine for leaks
    unprod_list = [a for a in activities if a["type"] == "unproductive"]
    total_unprod_hours = sum(a["duration_hours"] for a in unprod_list)
    prod_list = [a for a in activities if a["type"] == "productive"]
    
    # Analyze quests
    pending_tasks = [t for t in tasks if not t["is_completed"]]
    completed_tasks = [t for t in tasks if t["is_completed"]]
    
    # Sort pending tasks by probability impact (high leverage)
    high_leverage_tasks = sorted(pending_tasks, key=lambda x: x.get("probability_impact", 0.0), reverse=True)
    
    # 1. Check if the user is asking how to learn/achieve/improve or tips/tricks, or mentions specific topics
    is_learning_query = any(kw in msg for kw in ["how", "learn", "achieve", "tips", "tricks", "help", "study", "practice", "guide", "improve", "do i"])
    has_topic_keyword = any(kw in msg for kw in ["japanese", "japan", "japn", "nihongo", "language", "lang", "laguage", "speak", "vocab", "word", "grammar", "talk", "write", "pronounce", "english", "spanish", "french", "german", "chinese", "korean", "c++", "cpp", "coding", "python", "programming", "javascript", "rust", "code", "program", "develop", "html", "css", "software", "developer", "compil", "swim", "stroke", "pool", "breathing", "sprint", "run", "track", "fitness", "gym", "workout", "lift", "exercise", "training", "muscle", "weight", "cardio", "athlet"])
    
    if is_learning_query or has_topic_keyword:
        # Determine the topic
        topic = None
        
        # Check user message keywords first
        if any(kw in msg for kw in ["japanese", "japan", "japn", "nihongo", "language", "lang", "laguage", "speak", "vocab", "word", "grammar", "talk", "write", "pronounce", "english", "spanish", "french", "german", "chinese", "korean"]):
            topic = "language"
        elif any(kw in msg for kw in ["c++", "cpp", "coding", "python", "programming", "javascript", "rust", "code", "program", "develop", "html", "css", "software", "developer", "compil"]):
            topic = "coding"
        elif any(kw in msg for kw in ["swim", "stroke", "pool", "breathing"]):
            topic = "swimming"
        elif any(kw in msg for kw in ["sprint", "run", "track", "fitness", "gym", "workout", "lift", "exercise", "training", "muscle", "weight", "cardio", "athlet"]):
            topic = "fitness"
        
        # If no topic keyword in message, try active goal text
        if not topic and active_goal:
            goal_text_lower = active_goal["goal_text"].lower()
            if any(kw in goal_text_lower for kw in ["japanese", "japan", "japn", "nihongo", "language", "lang", "laguage", "speak", "vocab", "word", "grammar", "talk", "write", "pronounce", "english", "spanish", "french", "german", "chinese", "korean"]):
                topic = "language"
            elif any(kw in goal_text_lower for kw in ["c++", "cpp", "coding", "python", "programming", "javascript", "rust", "code", "program", "develop", "html", "css", "software", "developer", "compil"]):
                topic = "coding"
            elif any(kw in goal_text_lower for kw in ["swim", "stroke", "pool", "breathing"]):
                topic = "swimming"
            elif any(kw in goal_text_lower for kw in ["sprint", "run", "track", "fitness", "gym", "workout", "lift", "exercise", "training", "muscle", "weight", "cardio", "athlet"]):
                topic = "fitness"
        
        # Fall back to general if no topic found
        if not topic:
            topic = "general"
            
        if topic == "language":
            res = (
                "### 🗣️ Language & Japanese Mastery Blueprint\n\n"
                "Learning a language like Japanese requires consistency, active recall, and immersion. Here are the core tips to accelerate your progress:\n\n"
                "- **1. Space Repetition System (SRS)**: Use flashcard software like **Anki** daily. Flashcards help lock new Hiragana, Katakana, Kanji, and vocabulary into long-term memory via active recall.\n"
                "- **2. Shadowing Technique**: Listen to native Japanese audio (podcasts, videos, or anime) and repeat what you hear immediately. This trains your pronunciation, accent, and listening speed.\n"
                "- **3. Contextual Grammar**: Don't just memorize rules. Write 3-5 simple sentences daily using new grammar guides (like particles `は`, `が`, `を`) to build natural writing and speaking habits.\n"
                "- **4. Graded Immersion**: Read graded Japanese stories or watch simple videos. Learning in context is much faster than memorizing lists.\n\n"
                "I have compiled a relevant quest for you. Click **Add to Quests** below to add it to your daily priority list!"
            )
            res += "\n\n"
            res += "```json\n"
            res += "{\n"
            res += '  "type": "proposed_task",\n'
            res += '  "action": "Complete a 30-minute Japanese/Language study block",\n'
            res += '  "why": "Active recall flashcards and sentence composition build vocabulary and fluency.",\n'
            res += '  "when_time": "today",\n'
            res += '  "xp_reward": 20,\n'
            res += '  "probability_impact": 4.0,\n'
            res += '  "subtasks": [\n'
            res += '    {"text": "Review 15-20 flashcards on Anki or write down 10 new words", "done": false},\n'
            res += '    {"text": "Spend 10 minutes shadowing sentences from a target audio resource", "done": false},\n'
            res += '    {"text": "Write 3 simple sentences using a grammar concept you learned today", "done": false}\n'
            res += '  ]\n'
            res += "}\n"
            res += "```\n"
            return res
            
        elif topic == "coding":
            res = (
                "### 💻 Software Development & Coding Blueprint\n\n"
                "Mastering coding requires hands-on writing, reading code, and structured problem-solving. Here are key optimization strategies:\n\n"
                "- **1. Learn by Doing**: Do not just read tutorials. Build small, functional scripts or console projects from scratch to understand control flow, memory, or OOP.\n"
                "- **2. Read Production Code**: Spend 15-20 minutes on GitHub looking at popular repositories in your target language. Reading production-grade architectures teaches clean code habits.\n"
                "- **3. Solve Algorithmic Challenges**: Use platforms like LeetCode or HackerRank to practice algorithms. It sharpens your data structure choices and logic.\n"
                "- **4. Read compiler errors**: When you encounter bugs or warnings, read the trace carefully. Explaining to yourself why a crash happened is the best teacher.\n\n"
                "I have compiled a relevant quest for you. Click **Add to Quests** below to add it to your active quests!"
            )
            res += "\n\n"
            res += "```json\n"
            res += "{\n"
            res += '  "type": "proposed_task",\n'
            res += '  "action": "Complete a focused programming study block",\n'
            res += '  "why": "Writing custom programs and analyzing errors builds deep engineering logic.",\n'
            res += '  "when_time": "today",\n'
            res += '  "xp_reward": 20,\n'
            res += '  "probability_impact": 4.0,\n'
            res += '  "subtasks": [\n'
            res += '    {"text": "Write and run a short script demonstrating one specific language concept", "done": false},\n'
            res += '    {"text": "Find and spend 15 minutes reading an open-source source file on GitHub", "done": false},\n'
            res += '    {"text": "Solve one algorithm challenge on LeetCode/HackerRank", "done": false}\n'
            res += '  ]\n'
            res += "}\n"
            res += "```\n"
            return res
            
        elif topic == "swimming":
            res = (
                "### 🏊 Swim Technique & Performance Blueprint\n\n"
                "Swimming is highly technical; drag reduction beats raw muscle conditioning. Focus on these elements:\n\n"
                "- **1. Efficiency Over Volume**: Focus on head position, body rotation, and early vertical forearm catches rather than just swimming longer.\n"
                "- **2. Dedicated Drill Time**: Dedicate the first 25% of your pool time to technique drills (e.g., single-arm, catch-up, or kicking drills) to cement mechanics.\n"
                "- **3. Video Feedback**: Have someone record your strokes. Seeing your body alignment and elbow positions in slow motion makes corrections instant.\n"
                "- **4. Smooth Breathing**: Exhale continuously underwater. Holding your breath increases CO2 buildup and causes muscle fatigue.\n\n"
                "I have compiled a stroke refinement quest for you. Click **Add to Quests** below to add it!"
            )
            res += "\n\n"
            res += "```json\n"
            res += "{\n"
            res += '  "type": "proposed_task",\n'
            res += '  "action": "Execute a stroke technique pool session",\n'
            res += '  "why": "Targeted drills and stroke alignment minimize water drag and elevate race efficiency.",\n'
            res += '  "when_time": "today",\n'
            res += '  "xp_reward": 20,\n'
            res += '  "probability_impact": 4.0,\n'
            res += '  "subtasks": [\n'
            res += '    {"text": "Warm up with 200m easy swim focusing on relaxed breathing", "done": false},\n'
            res += '    {"text": "Complete 4x50m catch-up drills focusing on arm entry and glide", "done": false},\n'
            res += '    {"text": "Review your session performance and log key technique feedback", "done": false}\n'
            res += '  ]\n'
            res += "}\n"
            res += "```\n"
            return res
            
        elif topic == "fitness":
            res = (
                "### 🏋️ Athletic Performance & Fitness Blueprint\n\n"
                "Improving your physical capacity requires strict consistency, form integrity, and recovery optimization:\n\n"
                "- **1. Progressive Overload**: Always track your metrics (weights, times, reps). Force your muscles to adapt by increasing resistance or volume slightly over time.\n"
                "- **2. Technique Over Weight**: Heavy lifting or fast running with poor form causes injury. Record sets or starting block setups to check body geometry.\n"
                "- **3. Prioritize Recovery**: Muscle building and neurological adaptation happen during rest. Aim for 7-8 hours of sleep and adequate nutrition.\n"
                "- **4. Dynamic Warmups**: Prime your joints and nervous system with dynamic movements (lunges, leg swings) rather than static stretching before exercise.\n\n"
                "I have compiled a training quest for you. Click **Add to Quests** below to add it!"
            )
            res += "\n\n"
            res += "```json\n"
            res += "{\n"
            res += '  "type": "proposed_task",\n'
            res += '  "action": "Complete a structured strength or training session",\n'
            res += '  "why": "Systematic workouts with proper warmups ensure progression and prevent injury.",\n'
            res += '  "when_time": "today",\n'
            res += '  "xp_reward": 20,\n'
            res += '  "probability_impact": 4.0,\n'
            res += '  "subtasks": [\n'
            res += '    {"text": "Perform a 10-minute dynamic warmup sequence", "done": false},\n'
            res += '    {"text": "Complete your main training routine, recording weights, times, or reps", "done": false},\n'
            res += '    {"text": "Spend 5 minutes on targeted stretching and mobility post-workout", "done": false}\n'
            res += '  ]\n'
            res += "}\n"
            res += "```\n"
            return res
            
        else:
            # General goal tips
            goal_title = active_goal["goal_text"] if active_goal else "your campaign"
            res = (
                f"### 🎯 Strategic Coaching Blueprint for: **{goal_title}**\n\n"
                "Achieving any major target requires breaking it down, focus, and deliberate practice. Here is your roadmap:\n\n"
                "- **1. Map Out Your Learning Path**: Choose 2-3 top books, tutorials, or mentors. A clear sequence prevents decision fatigue and wasted time.\n"
                "- **2. Deliberate Practice Blocks**: Set a 30-minute timer. Turn off your phone and concentrate entirely on studying or practicing. Active struggle is where growth happens.\n"
                "- **3. Apply and Verify**: Never just read or watch. Immediately construct a summary, build a prototype, solve a problem, and verify it against a reference.\n"
                "- **4. Weekly Retrospectives**: At the end of every week, write down what went well and what bottleneck held you back. Adjust next week's focus accordingly.\n\n"
                "I have compiled a study/practice quest for you. Click **Add to Quests** below to add it to your priority board!"
            )
            res += "\n\n"
            res += "```json\n"
            res += "{\n"
            res += '  "type": "proposed_task",\n'
            res += f'  "action": "Complete a focused learning/practice block for: {goal_title[:30]}",\n'
            res += '  "why": "Deliberate focus and direct application are the highest-leverage actions to grow skill probability.",\n'
            res += '  "when_time": "today",\n'
            res += '  "xp_reward": 20,\n'
            res += '  "probability_impact": 4.0,\n'
            res += '  "subtasks": [\n'
            res += '    {"text": "Identify one key topic or concept you need to practice next", "done": false},\n'
            res += '    {"text": "Study or practice it for 30 minutes with zero distractions", "done": false},\n'
            res += '    {"text": "Write a short summary or create a basic project to test your knowledge", "done": false}\n'
            res += '  ]\n'
            res += "}\n"
            res += "```\n"
            return res

    elif "priorit" in msg or ("what" in msg and "do" in msg) or "next" in msg or "quest" in msg or "task" in msg:
        if not active_goal:
            return (
                "**Coach Recommendation:** You do not have an active goal campaign. "
                "Go to the **Goal Manager** tab and define a new campaign first, and I will help you prioritize your quests."
            )
        if not pending_tasks:
            if completed_tasks:
                return (
                    "🎉 **All quests completed!** Outstanding work today. "
                    "You have successfully cleared your active board and maximized today's probability growth. "
                    "Make sure to submit your **Day-End Review** to claim your +15 XP bonus and lock in your daily streak!"
                )
            else:
                return (
                    "**Coach Recommendation:** You have no quests in your active plan. "
                    "Go to the **Goal Manager** tab and generate a new plan for your campaign."
                )
        
        # We have pending tasks. Recommend based on priority
        res = f"### ⚡ Quest Prioritization Strategy\n\n"
        res += "Based on your active goal — **" + active_goal["goal_text"] + "** — here is your high-probability focus blueprint:\n\n"
        
        res += f"#### 🎯 1. Primary Objective (Highest Leverage)\n"
        top_task = high_leverage_tasks[0]
        res += f"**{top_task['action']}**\n"
        res += f"- *Impact:* `+{top_task['probability_impact']}%` success probability\n"
        res += f"- *Reward:* `+{top_task['xp_reward']} XP`\n"
        res += f"- *Why:* {top_task['why']}\n"
        res += f"- *Schedule:* {top_task['when_time']}\n\n"
        
        if len(high_leverage_tasks) > 1:
            res += f"#### 🥈 2. Secondary Objectives (Do next)\n"
            for t in high_leverage_tasks[1:3]:
                res += f"- **{t['action']}** (Impact: `+{t['probability_impact']}%` | Reward: `+{t['xp_reward']} XP`)\n"
            res += "\n"
            
        if total_unprod_hours > 0:
            res += f"#### ⚠️ Time Leak Warning\n"
            res += f"I see you have **{total_unprod_hours} hours** logged as unproductive time ("
            res += ", ".join([f"**{a['name']}** ({a['duration_hours']}h)" for a in unprod_list])
            res += "\n"
        
        # Propose an interactive task
        res += "\n\n"
        res += "```json\n"
        res += '{\n'
        res += '  "type": "proposed_task",\n'
        res += '  "action": "Do a deep-dive review of your biggest time leak",\n'
        res += '  "why": "Eliminating wasted time is the fastest way to accelerate progress.",\n'
        res += '  "when_time": "today",\n'
        res += '  "xp_reward": 20,\n'
        res += '  "probability_impact": 3.0,\n'
        res += '  "subtasks": [\n'
        res += '    {"text": "Identify your largest unproductive activity", "done": false},\n'
        res += '    {"text": "Brainstorm one specific friction point to prevent it tomorrow", "done": false}\n'
        res += '  ]\n'
        res += '}\n'
        res += "```\n"
            
        return res
        
    elif "leak" in msg or "routine" in msg or "activity" in msg or "schedule" in msg or "time" in msg:
        if not activities:
            return (
                "**Coach Recommendation:** You haven't logged any daily activities yet! "
                "Go to the **Routine Tracker** tab and log what you did today (e.g. sleep, work, studying, social media) so I can audit your schedule."
            )
        
        res = "### 📅 Routine Audit & Leak Analysis\n\n"
        if total_unprod_hours > 0:
            res += f"🔴 **Alert: Wasted Time Leak detected.** You logged **{total_unprod_hours} hours** of unproductive activities:\n"
            for a in unprod_list:
                res += f"- **{a['name']}**: {a['duration_hours']} hours\n"
            res += f"\n*Action Plan:* Reallocate these unproductive leaks directly to your active goal quests. Eliminating these leaks is the lowest-hanging fruit to optimize your focus score.\n\n"
        else:
            res += "🟢 **Excellent schedule discipline!** You have 0 unproductive time leaks logged today. Keep this up.\n\n"
            
        prod_hours = sum(a["duration_hours"] for a in prod_list)
        res += f"🟢 **Productive Focus**: You have **{prod_hours} hours** of productive work logged.\n"
        
        # Calculate free time
        total_logged = sum(a["duration_hours"] for a in activities)
        free_hours = max(0.0, 24.0 - total_logged)
        if free_hours > 0:
            res += f"🟡 **Unaccounted Buffer**: You have **{free_hours:.1f} hours** of unaccounted time in your 24h schedule. Plan this time before it turns into an accidental leak!\n"
            
        return res
        
    elif "odds" in msg or "probability" in msg or "chance" in msg or "win" in msg:
        if not active_goal:
            return "**Coach Recommendation:** You have no active goal campaign. Initiate a campaign to begin probability tracking."
            
        return (
            f"### 📈 Success Probability Breakdown\n\n"
            f"Active Goal: **{active_goal['goal_text']}**\n"
            f"- **Current Probability:** `{active_goal['current_probability']}`\n"
            f"- **Baseline Probability:** `{active_goal['base_probability']}`\n"
            f"- **Focus Alignment Score:** `{active_goal['focus_score']}`\n\n"
            f"**How to improve your odds:**\n"
            f"Each completed quest on your quest log boosts your probability by its exact impact rate. "
            f"Currently, there are **{len(pending_tasks)} pending quests** which can add a combined total of "
            f"`+{sum(t['probability_impact'] for t in pending_tasks):.1f}%` to your success odds. Complete them today!"
        )
        
    else:
        # Default greeting or general advice
        res = (
            "### 👋 Hello, I am your AI Discipline & Priority Coach!\n\n"
            "I'm here to audit your schedule and prioritize your active quests. Here's what you can ask me:\n\n"
            "- ⚡ **\"Which tasks should I prioritize?\"** - Get a personalized quest prioritization breakdown.\n"
            "- 📅 **\"Audit my routine leaks\"** - Find time leaks in your daily logged activities and reclaim them.\n"
            "- 📈 **\"What are my success odds?\"** - Analyze your current campaign success probability.\n\n"
            "💡 *Tip: If you want tips or quests to help you learn a skill, just ask (e.g., \"how do I learn Japanese?\" or \"give me tips for C++\").*\n\n"
        )
        if active_goal:
            res += f"Active Campaign: **{active_goal['goal_text']}**\n"
            res += f"Pending Quests: **{len(pending_tasks)}** | Completed: **{len(completed_tasks)}**"
        else:
            res += "*No active campaign. Go to the Goal Manager tab to initiate one!*"
            
        return res


def call_nvidia_chat_api(messages: list[dict[str, str]], active_goal: dict[str, Any] | None, tasks: list[dict[str, Any]], activities: list[dict[str, Any]], profile: dict[str, Any]) -> str:
    api_key = os.environ.get("NVIDIA_API_KEY")
    model = os.environ.get("NVIDIA_MODEL", "z-ai/glm-5.1")
    base_url = os.environ.get("NVIDIA_API_BASE_URL", "https://integrate.api.nvidia.com/v1")

    if not api_key:
        return fallback_chat_response(messages[-1]["content"] if messages else "", active_goal, tasks, activities)

    # Build context for the AI
    activities_str = "\n".join([f"- {a['name']}: {a['duration_hours']} hours ({a['type']})" for a in activities]) if activities else "No daily activities logged."
    
    tasks_str = ""
    if tasks:
        for t in tasks:
            status = "Completed" if t["is_completed"] else "Pending"
            tasks_str += f"- Quest: '{t['action']}' | Why: {t['why']} | Schedule: {t['when_time']} | Rewards: +{t['xp_reward']} XP, +{t['probability_impact']}% Prob | Status: {status}\n"
    else:
        tasks_str = "No quests compiled for active goal."

    goal_str = "No active goal campaign."
    if active_goal:
        goal_str = (
            f"Goal: {active_goal['goal_text']}\n"
            f"- Baseline Success Odds: {active_goal['base_probability']}\n"
            f"- Current Success Odds: {active_goal['current_probability']}\n"
            f"- Focus Score: {active_goal['focus_score']}\n"
            f"- Deadline: {active_goal['deadline']}\n"
            f"- Available Time: {active_goal['available_time']}\n"
            f"- Rationale: {active_goal['rationale']}"
        )

    system_prompt = f"""You are a ruthless but highly effective probability-based discipline & task prioritization AI coach.
Your job is to guide the user in optimizing their daily actions, routines, and task priorities to maximize the probability of achieving their active goal.

Here is the user's current context:
[USER PROFILE]
- Level: {profile.get('level', 1)}
- Streak: {profile.get('streak', 0)} days

[ACTIVE CAMPAIGN]
{goal_str}

[DAILY QUESTS / TASKS]
{tasks_str}

[DAILY ROUTINE & ACTIVITIES]
{activities_str}

COACHING DIRECTIONS:
1. Always prioritize quests/tasks with HIGHER probability impact and higher relevance to their deadline.
2. Be direct, clear, and actionable. Avoid generic motivational fluff. Be ruthless about time leaks (Unproductive activities).
3. If they ask about priority, recommend exactly which task to focus on first, which to do next, and which ones to skip or deprioritize. Explain WHY in terms of probability odds and XP.
4. Keep your replies concise and easy to read. Use bullet points and bold text where appropriate.
5. Format your output using simple Markdown (bold text, numbered lists, bullet points).
6. CRITICAL: If the user asks for a new task, asks what they should do, or if you feel a new task would greatly benefit their active goal, you MUST propose ONE new task using the exact JSON format below inside a markdown code block. The chat UI will turn this into an interactive 'Add to Quests' button.
```json
{{
  "type": "proposed_task",
  "action": "Short actionable title",
  "why": "Why it helps the goal",
  "when_time": "today / this week / recurring",
  "xp_reward": 15,
  "probability_impact": 3.0,
  "subtasks": [
    {{"text": "Concrete step 1", "done": false}},
    {{"text": "Concrete step 2", "done": false}}
  ]
}}
```
"""

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt}
        ] + messages,
        "temperature": 0.5,
        "max_tokens": 1000,
    }

    api_request = request.Request(
        f"{base_url.rstrip('/')}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )

    try:
        with request.urlopen(api_request, timeout=3.0) as response:
            data = json.loads(response.read().decode("utf-8"))
        return data["choices"][0]["message"]["content"]
    except Exception as exc:
        print(f"NVIDIA Chat API failed: {exc}. Falling back to local heuristics.")
        user_msg = messages[-1]["content"] if messages else ""
        return fallback_chat_response(user_msg, active_goal, tasks, activities)


@app.get("/")
def index() -> str:
    profile = get_profile()
    activities = get_activities()
    active_goals = get_active_goals()
    goals = get_all_goals()
    reviews = get_reviews()

    # Merge all tasks from all active goals into a single flat list
    all_tasks = []
    for ag in active_goals:
        all_tasks.extend(ag.get("plan", []))

    # Time calculations
    productive_hours = sum(a["duration_hours"] for a in activities if a["type"] == "productive")
    unproductive_hours = sum(a["duration_hours"] for a in activities if a["type"] == "unproductive")
    neutral_hours = sum(a["duration_hours"] for a in activities if a["type"] == "neutral")
    total_logged = productive_hours + unproductive_hours + neutral_hours
    free_hours = max(0.0, 24.0 - total_logged)

    time_analysis = {
        "productive": round(productive_hours, 1),
        "unproductive": round(unproductive_hours, 1),
        "neutral": round(neutral_hours, 1),
        "free": round(free_hours, 1),
        "total_logged": round(total_logged, 1),
        "effective_time": round(productive_hours + (free_hours * 0.5), 1),
    }

    # Calculate suggestion based on logged active hours
    total_active = productive_hours + unproductive_hours
    if total_active == 0:
        suggested_focus = "Moderate"
        suggestion_reason = "Log some routine activities to get a tailored suggestion."
    else:
        prod_ratio = productive_hours / total_active
        if prod_ratio >= 0.7:
            suggested_focus = "Laser Focused"
            suggestion_reason = f"Excellent! {round(prod_ratio * 100)}% of your logged active time is productive."
        elif prod_ratio >= 0.4:
            suggested_focus = "Moderate"
            suggestion_reason = f"Balanced. {round(prod_ratio * 100)}% of your logged active time is productive."
        else:
            suggested_focus = "Needs Realignment"
            suggestion_reason = f"Alert! Only {round(prod_ratio * 100)}% of your logged active time is productive. Reduce wasted hours."

    # Slogan picker
    slogan = random.choice(MOTIVATIONAL_SLOGANS)

    # Active tab query parameter read in templates
    active_tab = flask_request.args.get("tab", "dashboard")

    return render_template(
        "index.html",
        profile=profile,
        activities=activities,
        active_goals=active_goals,
        all_tasks=all_tasks,
        goals=goals,
        reviews=reviews,
        time_analysis=time_analysis,
        slogan=slogan,
        active_tab=active_tab,
        suggested_focus=suggested_focus,
        suggestion_reason=suggestion_reason
    )


@app.post("/api/profile/save")
def save_profile() -> Any:
    name = flask_request.form.get("name", "Explorer").strip()
    age = flask_request.form.get("age", "").strip()
    birthdate = flask_request.form.get("birthdate", "").strip()
    focus_level = flask_request.form.get("focus_level", "Moderate").strip()

    age_val = None
    if age:
        try:
            age_val = int(age)
        except ValueError:
            pass

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE user_profile SET name = ?, age = ?, birthdate = ?, focus_level = ? WHERE id = 1",
            (name, age_val, birthdate, focus_level)
        )
        conn.commit()

    return jsonify({"success": True, "name": name, "age": age_val, "birthdate": birthdate, "focus_level": focus_level})


@app.get("/api/profile/suggestion")
def profile_suggestion() -> Any:
    activities = get_activities()
    productive_hours = sum(a["duration_hours"] for a in activities if a["type"] == "productive")
    unproductive_hours = sum(a["duration_hours"] for a in activities if a["type"] == "unproductive")
    
    total_active = productive_hours + unproductive_hours
    if total_active == 0:
        suggested_focus = "Moderate"
        suggestion_reason = "Log some routine activities to get a tailored suggestion."
    else:
        prod_ratio = productive_hours / total_active
        if prod_ratio >= 0.7:
            suggested_focus = "Laser Focused"
            suggestion_reason = f"Excellent! {round(prod_ratio * 100)}% of your logged active time is productive."
        elif prod_ratio >= 0.4:
            suggested_focus = "Moderate"
            suggestion_reason = f"Balanced. {round(prod_ratio * 100)}% of your logged active time is productive."
        else:
            suggested_focus = "Needs Realignment"
            suggestion_reason = f"Alert! Only {round(prod_ratio * 100)}% of your logged active time is productive. Reduce wasted hours."

    return jsonify({
        "suggested_focus": suggested_focus,
        "suggestion_reason": suggestion_reason
    })


def generate_and_save_goal(goal: str, current_level: str, deadline: str, available_time: str, activities_str: str):
    try:
        analysis = call_nvidia_api(goal, current_level, deadline, available_time, activities_str)
    except Exception as exc:
        print(f"NVIDIA API failed ({exc}). Falling back to local heuristic analysis.")
        analysis = fallback_analysis(goal, current_level, deadline, available_time, activities_str)
        analysis["provider"] = "Local fallback (NVIDIA API failed)"

    try:
        # Save to database
        with get_db() as conn:
            cursor = conn.cursor()
            # New goals are added as active without deactivating others
            
            cursor.execute(
                """INSERT INTO goals 
                   (goal_text, current_level, deadline, available_time, base_probability, current_probability, focus_score, rationale, generated_at, is_active) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)""",
                (
                    analysis["goal"],
                    analysis["current_level"],
                    analysis["deadline"],
                    analysis["available_time"],
                    analysis["probability"],
                    analysis["probability"], # initially current = base
                    analysis["focus_score"],
                    analysis["rationale"],
                    analysis["generated_at"]
                )
            )
            goal_id = cursor.lastrowid

            # Save tasks
            for task in analysis["plan"]:
                subtasks_json = json.dumps(task.get("subtasks", []))
                cursor.execute(
                    """INSERT INTO tasks 
                       (goal_id, action, why, when_time, xp_reward, probability_impact, is_completed, subtasks) 
                       VALUES (?, ?, ?, ?, ?, ?, 0, ?)""",
                    (
                        goal_id,
                        task["action"],
                        task["why"],
                        task["when"],
                        task["xp_reward"],
                        task["probability_impact"],
                        subtasks_json
                    )
                )
            conn.commit()
    except Exception as exc:
        print(f"Failed to save goal: {exc}")


@app.post("/analyze")
def analyze() -> Any:
    goal = flask_request.form.get("goal", "").strip()
    current_level = flask_request.form.get("current_level", "").strip()
    deadline = flask_request.form.get("deadline", "").strip()
    available_time = flask_request.form.get("available_time", "").strip()

    if not goal:
        flash("Add a goal first so the coach has something specific to work on.", "error")
        return redirect(url_for("index", tab="goals"))

    if not current_level:
        current_level = "Not specified"
    if not deadline:
        deadline = "Not specified"
    if not available_time:
        available_time = "Not specified"

    # Fetch daily activities structure for prompt context
    activities = get_activities()
    activities_list = [f"- {a['name']}: {a['duration_hours']} hours ({a['type']})" for a in activities]
    activities_str = "\n".join(activities_list) if activities_list else "No daily activities logged yet."

    # Execute generation synchronously
    generate_and_save_goal(goal, current_level, deadline, available_time, activities_str)

    flash("Campaign successfully initiated!", "success")
    return redirect(url_for("index", tab="dashboard"))


@app.post("/api/activity")
def add_activity() -> Any:
    name = flask_request.form.get("name", "").strip()
    duration = flask_request.form.get("duration", "").strip()
    act_type = flask_request.form.get("type", "").strip()

    if not name or not duration or not act_type:
        flash("Please fill in all activity details.", "error")
        return redirect(url_for("index", tab="routine"))

    try:
        dur_val = float(duration)
        if dur_val <= 0 or dur_val > 24:
            raise ValueError()
    except ValueError:
        flash("Duration must be a valid number of hours between 0 and 24.", "error")
        return redirect(url_for("index", tab="routine"))

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT SUM(duration_hours) FROM daily_activities")
        total = cursor.fetchone()[0] or 0.0
        if total + dur_val > 24.0:
            flash(f"Cannot log more than 24 hours (Current total logged: {total}h).", "error")
            return redirect(url_for("index", tab="routine"))

        cursor.execute(
            "INSERT INTO daily_activities (name, duration_hours, type) VALUES (?, ?, ?)",
            (name, dur_val, act_type)
        )
        conn.commit()

    flash("Daily activity logged successfully.", "success")
    return redirect(url_for("index", tab="routine"))


@app.post("/api/activity/delete/<int:activity_id>")
def delete_activity(activity_id: int) -> Any:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM daily_activities WHERE id = ?", (activity_id,))
        conn.commit()
    flash("Daily activity removed.", "success")
    return redirect(url_for("index", tab="routine"))


@app.post("/api/goal/activate/<int:goal_id>")
def activate_goal(goal_id: int) -> Any:
    with get_db() as conn:
        cursor = conn.cursor()
        # Check current state
        cursor.execute("SELECT is_active FROM goals WHERE id = ?", (goal_id,))
        row = cursor.fetchone()
        if not row:
            flash("Goal not found.", "error")
            return redirect(url_for("index", tab="goals"))

        if row["is_active"]:
            # Deactivate this goal
            cursor.execute("UPDATE goals SET is_active = 0 WHERE id = ?", (goal_id,))
            conn.commit()
            flash("Campaign deactivated.", "success")
        else:
            # Activate this goal (without deactivating others)
            cursor.execute("UPDATE goals SET is_active = 1 WHERE id = ?", (goal_id,))
            conn.commit()
            flash("Campaign activated!", "success")
    return redirect(url_for("index", tab="goals"))


@app.post("/api/goal/delete/<int:goal_id>")
def delete_goal(goal_id: int) -> Any:
    with get_db() as conn:
        cursor = conn.cursor()
        # Delete associated tasks first
        cursor.execute("DELETE FROM tasks WHERE goal_id = ?", (goal_id,))
        # Delete the goal itself
        cursor.execute("DELETE FROM goals WHERE id = ?", (goal_id,))
        conn.commit()
    flash("Campaign and all associated quests deleted successfully.", "success")
    return redirect(url_for("index", tab="goals"))


@app.post("/api/review")
def submit_review() -> Any:
    rating = flask_request.form.get("rating", "").strip()
    notes = flask_request.form.get("notes", "").strip()

    if not rating:
        flash("Please select a rating to review.", "error")
        return redirect(url_for("index", tab="review"))

    try:
        rating_val = int(rating)
        if rating_val < 1 or rating_val > 5:
            raise ValueError()
    except ValueError:
        flash("Rating must be between 1 and 5.", "error")
        return redirect(url_for("index", tab="review"))

    today_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO daily_reviews (rating, notes, created_at) VALUES (?, ?, ?)",
            (rating_val, notes, today_str)
        )
        new_level, new_xp, level_up = update_xp_and_level(conn, 15)
        conn.commit()

    flash("Day-End Review logged! +15 XP rewarded.", "success")
    return redirect(url_for("index", tab="review"))


@app.post("/api/task/complete")
def complete_task() -> Any:
    try:
        data = flask_request.get_json()
        task_id = int(data.get("task_id"))
        is_completed = bool(data.get("is_completed"))
    except Exception:
        return jsonify({"success": False, "error": "Invalid request payload"}), 400

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT goal_id, xp_reward, probability_impact, is_completed, subtasks FROM tasks WHERE id = ?", (task_id,))
        task = cursor.fetchone()
        if not task:
            return jsonify({"success": False, "error": "Task not found"}), 404

        if task["is_completed"] == (1 if is_completed else 0):
            profile = get_profile()
            cursor.execute("SELECT current_probability FROM goals WHERE id = ?", (task["goal_id"],))
            goal_prob = cursor.fetchone()["current_probability"]
            # Return current subtasks state
            try:
                subtasks = json.loads(task["subtasks"] or "[]")
            except (json.JSONDecodeError, TypeError):
                subtasks = []
            return jsonify({
                "success": True,
                "xp_added": 0,
                "level_up": False,
                "new_level": profile["level"],
                "new_xp": profile["xp"],
                "new_streak": profile["streak"],
                "new_probability": goal_prob,
                "subtasks": subtasks
            })

        cursor.execute("UPDATE tasks SET is_completed = ? WHERE id = ?", (1 if is_completed else 0, task_id))

        # Also mark all subtasks as done/undone when the main quest is toggled
        try:
            subtasks = json.loads(task["subtasks"] or "[]")
        except (json.JSONDecodeError, TypeError):
            subtasks = []
        for st in subtasks:
            st["done"] = is_completed
        cursor.execute("UPDATE tasks SET subtasks = ? WHERE id = ?", (json.dumps(subtasks), task_id))

        xp_diff = task["xp_reward"] if is_completed else -task["xp_reward"]
        prob_diff = task["probability_impact"] if is_completed else -task["probability_impact"]

        new_level, new_xp, level_up = update_xp_and_level(conn, xp_diff)
        if is_completed:
            update_streak(conn)

        cursor.execute("SELECT base_probability, current_probability FROM goals WHERE id = ?", (task["goal_id"],))
        goal = cursor.fetchone()
        if goal:
            base_str = goal["base_probability"]
            curr_str = goal["current_probability"]

            def parse_prob(s):
                try:
                    return float(s.replace("%", "").strip())
                except:
                    return 50.0

            base_val = parse_prob(base_str)
            curr_val = parse_prob(curr_str)

            new_val = curr_val + prob_diff
            new_val = max(base_val, min(100.0, new_val))
            new_str = f"{new_val:.1f}%"

            cursor.execute("UPDATE goals SET current_probability = ? WHERE id = ?", (new_str, task["goal_id"]))
        else:
            new_str = "Unknown"

        conn.commit()

    profile = get_profile()
    return jsonify({
        "success": True,
        "xp_added": xp_diff,
        "level_up": level_up,
        "new_level": new_level,
        "new_xp": new_xp,
        "new_streak": profile["streak"],
        "new_probability": new_str,
        "subtasks": subtasks
    })


@app.post("/api/task/add")
def add_task() -> Any:
    """Add a new task directly to the active goal (used by AI Coach suggestions)."""
    try:
        data = flask_request.get_json()
        action = data.get("action", "").strip()
        if not action:
            return jsonify({"success": False, "error": "Action title is required"}), 400
        
        why = data.get("why", "")
        when_time = data.get("when_time", "today")
        xp_reward = int(data.get("xp_reward", 15))
        probability_impact = float(data.get("probability_impact", 2.0))
        subtasks = data.get("subtasks", [])
    except Exception:
        return jsonify({"success": False, "error": "Invalid request payload"}), 400

    with get_db() as conn:
        cursor = conn.cursor()
        
        # Get active goal
        cursor.execute("SELECT id FROM goals WHERE is_active = 1")
        active = cursor.fetchone()
        if not active:
            return jsonify({"success": False, "error": "No active goal found to add task to"}), 400
            
        goal_id = active["id"]
        subtasks_json = json.dumps(subtasks)
        
        cursor.execute(
            """INSERT INTO tasks 
               (goal_id, action, why, when_time, xp_reward, probability_impact, is_completed, subtasks) 
               VALUES (?, ?, ?, ?, ?, ?, 0, ?)""",
            (goal_id, action, why, when_time, xp_reward, probability_impact, subtasks_json)
        )
        task_id = cursor.lastrowid
        conn.commit()

    return jsonify({
        "success": True,
        "task_id": task_id,
        "message": "Task added successfully"
    })


@app.post("/api/subtask/toggle")
def toggle_subtask() -> Any:
    """Toggle an individual subtask. If all subtasks become done, auto-complete the parent quest.
    If a subtask is unchecked and the parent was done, auto-uncomplete the parent."""
    try:
        data = flask_request.get_json()
        task_id = int(data.get("task_id"))
        subtask_index = int(data.get("subtask_index"))
        is_done = bool(data.get("is_done"))
    except Exception:
        return jsonify({"success": False, "error": "Invalid request payload"}), 400

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, goal_id, xp_reward, probability_impact, is_completed, subtasks FROM tasks WHERE id = ?", (task_id,))
        task = cursor.fetchone()
        if not task:
            return jsonify({"success": False, "error": "Task not found"}), 404

        try:
            subtasks = json.loads(task["subtasks"] or "[]")
        except (json.JSONDecodeError, TypeError):
            subtasks = []

        if subtask_index < 0 or subtask_index >= len(subtasks):
            return jsonify({"success": False, "error": "Invalid subtask index"}), 400

        subtasks[subtask_index]["done"] = is_done
        cursor.execute("UPDATE tasks SET subtasks = ? WHERE id = ?", (json.dumps(subtasks), task_id))

        # Check if all subtasks are now done
        all_done = all(st.get("done", False) for st in subtasks) if subtasks else False
        was_completed = bool(task["is_completed"])

        xp_diff = 0
        prob_diff = 0.0
        level_up = False
        new_level = 0
        new_xp = 0

        if all_done and not was_completed:
            # Auto-complete the parent quest
            cursor.execute("UPDATE tasks SET is_completed = 1 WHERE id = ?", (task_id,))
            xp_diff = task["xp_reward"]
            prob_diff = task["probability_impact"]
            new_level, new_xp, level_up = update_xp_and_level(conn, xp_diff)
            update_streak(conn)
        elif not all_done and was_completed:
            # Auto-uncomplete the parent quest
            cursor.execute("UPDATE tasks SET is_completed = 0 WHERE id = ?", (task_id,))
            xp_diff = -task["xp_reward"]
            prob_diff = -task["probability_impact"]
            new_level, new_xp, level_up = update_xp_and_level(conn, xp_diff)

        # Update goal probability if there was a change
        new_str = "Unknown"
        if prob_diff != 0:
            cursor.execute("SELECT base_probability, current_probability FROM goals WHERE id = ?", (task["goal_id"],))
            goal = cursor.fetchone()
            if goal:
                def parse_prob(s):
                    try:
                        return float(s.replace("%", "").strip())
                    except:
                        return 50.0
                base_val = parse_prob(goal["base_probability"])
                curr_val = parse_prob(goal["current_probability"])
                new_val = curr_val + prob_diff
                new_val = max(base_val, min(100.0, new_val))
                new_str = f"{new_val:.1f}%"
                cursor.execute("UPDATE goals SET current_probability = ? WHERE id = ?", (new_str, task["goal_id"]))
            else:
                new_str = "Unknown"
        else:
            cursor.execute("SELECT current_probability FROM goals WHERE id = ?", (task["goal_id"],))
            gp = cursor.fetchone()
            new_str = gp["current_probability"] if gp else "Unknown"

        conn.commit()

    profile = get_profile()
    quest_completed = all_done and not was_completed
    quest_uncompleted = not all_done and was_completed
    return jsonify({
        "success": True,
        "subtasks": subtasks,
        "quest_completed": quest_completed,
        "quest_uncompleted": quest_uncompleted,
        "xp_added": xp_diff,
        "level_up": level_up,
        "new_level": profile["level"],
        "new_xp": profile["xp"],
        "new_streak": profile["streak"],
        "new_probability": new_str
    })


@app.get("/api/chat/history")
def chat_history() -> Any:
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT role, content FROM chat_messages ORDER BY id ASC")
            messages = [dict(row) for row in cursor.fetchall()]
        return jsonify({"success": True, "messages": messages})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@app.post("/api/chat")
def chat_send() -> Any:
    try:
        data = flask_request.get_json()
        user_message = data.get("message", "").strip()
    except Exception:
        return jsonify({"success": False, "error": "Invalid request payload"}), 400

    if not user_message:
        return jsonify({"success": False, "error": "Message content is empty"}), 400

    today_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # 1. Insert user message in database
            cursor.execute(
                "INSERT INTO chat_messages (role, content, created_at) VALUES ('user', ?, ?)",
                (user_message, today_str)
            )
            
            # 2. Retrieve last 10 messages for conversation context
            cursor.execute("SELECT role, content FROM chat_messages ORDER BY id DESC LIMIT 10")
            db_messages = [dict(row) for row in cursor.fetchall()]
            db_messages.reverse() # get chronological order
            
            # 3. Gather database context for the AI
            # Get profile
            cursor.execute("SELECT level, xp, streak, last_active FROM user_profile WHERE id = 1")
            profile_row = cursor.fetchone()
            profile = dict(profile_row) if profile_row else {"level": 1, "xp": 0, "streak": 0}
            
            # Get activities
            cursor.execute("SELECT name, duration_hours, type FROM daily_activities ORDER BY type, name")
            activities = [dict(row) for row in cursor.fetchall()]
            
            # Get all active goals and their tasks
            cursor.execute("SELECT id, goal_text, current_level, deadline, available_time, base_probability, current_probability, focus_score, rationale, generated_at FROM goals WHERE is_active = 1")
            goal_rows = cursor.fetchall()
            active_goal = None
            tasks = []
            
            if goal_rows:
                # Use first active goal as primary for the AI context
                active_goal = dict(goal_rows[0])
                # Gather tasks from ALL active goals
                for grow in goal_rows:
                    cursor.execute("SELECT id, action, why, when_time, xp_reward, probability_impact, is_completed FROM tasks WHERE goal_id = ?", (grow["id"],))
                    tasks.extend([dict(row) for row in cursor.fetchall()])
            else:
                # Fallback to get latest goal if no is_active is set
                cursor.execute("SELECT id, goal_text, current_level, deadline, available_time, base_probability, current_probability, focus_score, rationale, generated_at FROM goals ORDER BY id DESC LIMIT 1")
                goal_row = cursor.fetchone()
                if goal_row:
                    active_goal = dict(goal_row)
                    cursor.execute("SELECT id, action, why, when_time, xp_reward, probability_impact, is_completed FROM tasks WHERE goal_id = ?", (active_goal["id"],))
                    tasks = [dict(row) for row in cursor.fetchall()]

            # 4. Request response from AI
            assistant_response = call_nvidia_chat_api(db_messages, active_goal, tasks, activities, profile)
            
            # 5. Insert assistant response in database
            cursor.execute(
                "INSERT INTO chat_messages (role, content, created_at) VALUES ('assistant', ?, ?)",
                (assistant_response, today_str)
            )
            
            conn.commit()

        return jsonify({
            "success": True,
            "message": {
                "role": "assistant",
                "content": assistant_response
            }
        })
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@app.post("/api/chat/clear")
def chat_clear() -> Any:
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM chat_messages")
            conn.commit()
        return jsonify({"success": True})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@app.get("/health")
def health() -> tuple[str, int]:
    return "ok", 200


if __name__ == "__main__":
    app.run(debug=True)
