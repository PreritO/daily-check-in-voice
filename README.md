# Daily Check-In Agent

A voice-driven daily standup bot that calls you at scheduled times, conducts standup conversations, and posts summaries to Slack.

## Features

- **Dashboard**: View call history, trigger manual calls, manage schedules
- **Voice Agent**: LiveKit-powered standup conversations (STT → LLM → TTS)
- **Transcription**: Full conversation transcripts stored per call
- **AI Summaries**: Claude-generated summaries extracting yesterday/today/blockers
- **Slack Integration**: Post summaries directly to your Slack channel
- **Scheduling**: Cron-based scheduling for automated daily calls

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14+, React, Tailwind CSS, React Query |
| Backend | FastAPI, Python 3.12+, SQLAlchemy (async) |
| Database | Supabase (PostgreSQL) |
| Voice | LiveKit Agents (Silero VAD, Turn Detection) |
| AI | Anthropic Claude (summaries + conversation) |

## Quick Start

### Prerequisites

- Python 3.12+ with [uv](https://github.com/astral-sh/uv)
- Node.js 20+ with npm
- [Supabase](https://supabase.com) account (free tier works)
- [LiveKit Cloud](https://livekit.io) account (for voice calls)
- [Anthropic](https://anthropic.com) API key (for Claude)

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/daily-check-in-agent.git
cd daily-check-in-agent

# Backend
cd backend
uv sync
cp .env.example .env

# Frontend
cd ../frontend
npm install
cp .env.example .env.local
```

### 2. Configure Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Project Settings > Database** and copy the connection string
3. Go to **Project Settings > API** and copy the URL and keys

Edit `backend/.env`:
```env
# Change postgresql:// to postgresql+asyncpg://
SUPABASE_DB_URL=postgresql+asyncpg://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

SUPABASE_URL=https://[ref].supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Edit `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://[ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 3. Configure API Keys

Edit `backend/.env` with your API keys:
```env
# LiveKit (required for voice calls)
LIVEKIT_URL=wss://your-app.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret

# Anthropic (required for AI summaries)
ANTHROPIC_API_KEY=sk-ant-...

# Slack (optional - for posting summaries)
SLACK_BOT_TOKEN=xoxb-...
SLACK_CHANNEL_ID=C...
```

### 4. Run Database Migrations

```bash
cd backend
uv run alembic upgrade head
```

### 5. Start the App

**Terminal 1 - Backend API:**
```bash
cd backend
uv run uvicorn src.main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

**Terminal 3 - Voice Agent (optional, for voice calls):**
```bash
cd backend
uv run python -m livekit.agents.cli dev --watch src/agent/standup_agent.py
```

### 6. Open the Dashboard

Visit [http://localhost:3000](http://localhost:3000)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/users` | List users |
| POST | `/api/users` | Create user |
| GET | `/api/calls` | List calls (filter by `?user_id=`) |
| POST | `/api/calls/trigger` | Trigger a manual call |
| GET | `/api/calls/{id}` | Get call with transcripts and summary |
| POST | `/api/calls/{id}/summarize` | Generate AI summary for call |
| GET | `/api/schedules` | List schedules |
| POST | `/api/schedules` | Create schedule |
| POST | `/api/summaries/{id}/post-to-slack` | Post summary to Slack |

## Project Structure

```
daily-check-in-agent/
├── backend/
│   ├── src/
│   │   ├── api/routes/      # FastAPI route handlers
│   │   ├── models/          # SQLAlchemy models
│   │   ├── services/        # Business logic (summary, slack, livekit)
│   │   └── agent/           # LiveKit voice agent
│   ├── tests/               # pytest tests
│   └── alembic/             # Database migrations
├── frontend/
│   └── src/
│       ├── app/             # Next.js pages
│       │   └── (dashboard)/ # Dashboard routes
│       └── lib/api/         # API client and React Query hooks
└── scripts/ralph/           # Autonomous build system
```

## Testing

```bash
# Backend tests (46 tests)
cd backend
uv run pytest tests/ -v

# Backend linting
uv run ruff check src/

# Frontend build check
cd frontend
npm run build
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Dashboard    │────▶│   Backend API   │────▶│    Supabase     │
│    (Next.js)    │     │    (FastAPI)    │     │  (PostgreSQL)   │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
           ┌─────────────┐ ┌─────────┐ ┌─────────────┐
           │   LiveKit   │ │  Claude │ │    Slack    │
           │ Voice Agent │ │   API   │ │     API     │
           └─────────────┘ └─────────┘ └─────────────┘
```

## Standup Flow

1. **Schedule or Trigger**: User schedules a daily call or triggers manually
2. **Voice Call**: LiveKit agent conducts the standup conversation
3. **Transcription**: Full conversation is transcribed and stored
4. **Summary**: Claude generates a structured summary (yesterday/today/blockers)
5. **Slack**: Summary is posted to configured Slack channel

## Contributing

Contributions welcome! This project uses:
- [Boris Cherny's Claude Code Workflow](https://x.com/bcherny/status/2007179832300581177)
- [Ralph](https://github.com/snarktank/ralph) for autonomous development

## License

MIT License - see [LICENSE](LICENSE) for details.
