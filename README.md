# 🌿 Gamify Life

> A warm, premium gamified productivity journal and probability-based discipline coach. Turn your abstract ambitions into concrete quests, manage your daily schedule, and cultivate a living digital garden as you build consistency.

---

## ✨ Key Features

### 1. 🎯 Campaign (Goal) Manager
- Define new goal campaigns with target deadlines, current starting levels, and available weekly hours.
- Generates a custom **Probability Plan** with detailed subtask checklists.
- Uses local fallback heuristic engines or external LLM API configurations.
- Plans automatically calculate baseline success odds and dynamic probability boosts per task.

### 2. 🗣️ AI Discipline & Priority Coach (Chat)
- Context-aware slide-out chat assistant accessible via the dashboard.
- Identifies user inquiries and generates **Mastery Blueprints** with customized study strategies (e.g. Space Repetition Systems/Anki recommendations for languages, practice programs for coding).
- Suggests interactive quests inside the chat that can be instantly appended to your daily quest board with a single **"Add to Quests"** click.

### 3. ⏱️ Daily Routine Tracker & Time Ring
- Log your daily activities categorized as **Productive**, **Neutral**, or **Unproductive**.
- Dynamic **24h Time Ring** chart visualizes your daily schedule.
- Identifies unaccounted buffers and flags unproductive time leaks, enabling the coach to run routine audits.

### 4. 🌱 Living Garden Canvas
- An interactive, custom-drawn HTML5 Canvas garden displayed on your dashboard.
- The garden grows and blossoms in real-time based on the percentage of quests you complete daily—blooming into a fully flowered garden when you clear your quest log.

### 5. 🌙 Evening Wind-down Review & Levels
- End your day with a reflection journal and a 1-to-5 discipline rating.
- Claim bonus XP on daily check-ins to grow your level and maintain your daily streak count.

---

## 🛠️ Tech Stack

- **Backend**: Python, Flask, SQLite3 (for local persistence and message history).
- **Frontend**: HTML5, Vanilla JavaScript, CSS3 (Glassmorphism, animations, SVG drawing).
- **AI Integrations**: OpenAI-compatible API endpoints (configurable for local engines or external LLM services).

---

## 🚀 Getting Started

### 1. Installation

Set up a virtual environment and install the required dependencies:

```powershell
# Create a virtual environment
python -m venv .venv

# Activate the virtual environment (Windows)
.\.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configuration

Copy the example environment file:

```powershell
cp .env.example .env
```

To run the app **instantly with 0ms latency**, keep the `NVIDIA_API_KEY` line commented out in your `.env`. The app will automatically utilize the high-quality local fallback engine. To connect an external LLM, uncomment the line and insert your API key:

```env
# Comment out to run locally with zero latency:
# NVIDIA_API_KEY=your_key_here
NVIDIA_MODEL=z-ai/glm-5.1
NVIDIA_API_BASE_URL=https://integrate.api.nvidia.com/v1
FLASK_SECRET_KEY=some_random_secret_key
```

### 3. Running the App

Start the Flask server:

```powershell
python app.py
```

Open your browser and navigate to `http://127.0.0.1:5000`.

---

## 📂 Project Structure

- `app.py`: Core Flask application backend, SQLite database connectors, local fallback logic, and API endpoints.
- `schema.sql`: Database schema definition for profiles, activities, campaigns, tasks, reviews, and chat history.
- `templates/index.html`: Fully structured dashboard template with tab layouts, chat drawer, and forms.
- `static/css/`: Modular styling system separating animations, layout, components, and the garden theme.
- `static/js/`: Modular frontend client scripts:
  - `clock.js`: ambient top-bar time & greetings.
  - `quests.js`: quest completions and subtask updates.
  - `chat.js`: messages rendering and interactive quest integration.
  - `garden.js`: canvas flower animations.
  - `time-ring.js`: time ring rendering.
