-- SQLite Database Schema for Gamify Life (Probability Coach)

CREATE TABLE IF NOT EXISTS user_profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    streak INTEGER DEFAULT 0,
    last_active TEXT
);

CREATE TABLE IF NOT EXISTS daily_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    duration_hours REAL NOT NULL,
    type TEXT CHECK(type IN ('productive', 'neutral', 'unproductive')) NOT NULL
);

CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_text TEXT NOT NULL,
    current_level TEXT,
    deadline TEXT,
    available_time TEXT,
    base_probability TEXT,
    current_probability TEXT,
    focus_score TEXT,
    rationale TEXT,
    generated_at TEXT,
    is_active INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id INTEGER,
    action TEXT NOT NULL,
    why TEXT,
    when_time TEXT,
    xp_reward INTEGER DEFAULT 10,
    probability_impact REAL DEFAULT 3.0,
    is_completed INTEGER DEFAULT 0,
    FOREIGN KEY(goal_id) REFERENCES goals(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS daily_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rating INTEGER NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- Seed profile if empty
INSERT INTO user_profile (id, level, xp, streak, last_active)
SELECT 1, 1, 0, 0, NULL
WHERE NOT EXISTS (SELECT 1 FROM user_profile WHERE id = 1);
