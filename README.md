# Probability Coach

A small Flask app that turns vague goals into a short, probability-based action plan.

## What it does

- Lets you add one goal, your current level, a deadline, and available time
- Uses your NVIDIA-compatible AI endpoint when configured
- Falls back to a local heuristic plan if no API key is set
- Keeps the latest analyses in session memory during the current run

## Run it

1. Install dependencies:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

2. Copy `.env.example` to `.env` and fill in your NVIDIA values.

3. Start the app:

```powershell
.\.venv\Scripts\python.exe app.py
```

4. Open the app at `http://127.0.0.1:5000`

## NVIDIA setup

Set these environment variables:

- `NVIDIA_API_KEY`
- `NVIDIA_MODEL` if you want a specific model name
- `NVIDIA_API_BASE_URL` if your endpoint is different from the default

The app sends an OpenAI-compatible `chat/completions` request, so it should be easy to point at your NVIDIA model once you have the right endpoint details.

## Next upgrades

- Save goals in a database
- Add daily check-ins and streaks
- Show real probability trends over time
- Let the AI generate a weekly plan and a fallback if the user misses days
