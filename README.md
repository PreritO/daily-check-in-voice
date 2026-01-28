# Daily Check-In Agent

A voice-driven daily standup bot that calls you at scheduled times, conducts standup conversations, and posts summaries to Slack or Notion.

## Features

- **Scheduled Voice Calls**: Receive calls at your configured time
- **Natural Conversation**: AI-powered standup questions with voice interaction
- **Transcription**: Real-time speech-to-text transcription
- **Smart Summaries**: AI-generated summaries of your standup
- **Integrations**: Post to Slack channels or Notion pages
- **Custom Questions**: Add your own standup questions
- **Dashboard**: View call history, schedule calls, manage settings

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React, Tailwind CSS, shadcn/ui |
| Backend | FastAPI, Python 3.10+, SQLAlchemy |
| Voice | LiveKit Agents (STT + LLM + TTS pipeline) |
| Database | PostgreSQL |
| Scheduler | APScheduler |

## Getting Started

### Prerequisites

- Python 3.10+ with [uv](https://github.com/astral-sh/uv)
- Node.js 20+ with pnpm
- PostgreSQL (or Docker)
- LiveKit Cloud account (or self-hosted)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/daily-check-in-agent.git
   cd daily-check-in-agent
   ```

2. **Set up the backend**
   ```bash
   cd backend
   uv sync
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Set up the frontend**
   ```bash
   cd frontend
   pnpm install
   ```

4. **Start the database**
   ```bash
   docker-compose up -d postgres
   ```

5. **Run migrations**
   ```bash
   cd backend
   uv run alembic upgrade head
   ```

6. **Start the services**
   ```bash
   # Terminal 1: Backend
   cd backend && uv run uvicorn src.main:app --reload

   # Terminal 2: Frontend
   cd frontend && pnpm dev

   # Terminal 3: Voice Agent
   cd backend && uv run python src/agent/main.py dev
   ```

### Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# LiveKit
LIVEKIT_API_KEY=your_key
LIVEKIT_API_SECRET=your_secret
LIVEKIT_URL=wss://your-project.livekit.cloud

# AI Services
ANTHROPIC_API_KEY=sk-ant-...
ASSEMBLYAI_API_KEY=...
CARTESIA_API_KEY=...

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/checkin

# Optional Integrations
SLACK_BOT_TOKEN=xoxb-...
NOTION_API_KEY=secret_...
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Dashboard    │────▶│   Backend API   │────▶│    Database     │
│    (Next.js)    │     │    (FastAPI)    │     │  (PostgreSQL)   │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  LiveKit Agent  │
                        │ STT → LLM → TTS │
                        └─────────────────┘
```

## Usage

1. **Schedule a standup**: Use the dashboard to set your daily standup time
2. **Receive the call**: At the scheduled time, you'll receive a voice call
3. **Have a conversation**: Answer the standup questions naturally
4. **Review the summary**: Check Slack/Notion for your posted update


## Contributing

Contributions are welcome! Please read our contributing guidelines and submit PRs.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [LiveKit](https://livekit.io) for the voice agent framework
- [Anthropic](https://anthropic.com) for Claude