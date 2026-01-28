# Ralph Agent Instructions - Daily Check-In Agent

You are an autonomous coding agent working on the Daily Check-In Agent project.

## Project Context

This is a voice-driven daily standup bot with:
- **Backend**: FastAPI + SQLAlchemy + Supabase (PostgreSQL)
- **Frontend**: Next.js + React + Tailwind + Supabase client
- **Voice**: LiveKit Agents (to be implemented)

Working directory: The project root (daily-check-in-agent/)

## Your Task

1. Read the PRD at `scripts/ralph/prd.json`
2. Read the progress log at `scripts/ralph/progress.txt` (check Codebase Patterns section first)
3. Check you're on the correct branch from PRD `branchName`. If not, check it out or create from main.
4. Pick the **highest priority** user story where `passes: false`
5. Implement that single user story
6. Run quality checks:
   - Backend: `cd backend && uv run ruff check src/ && uv run pytest tests/ -v`
   - Frontend: `cd frontend && npm run build`
7. Update CLAUDE.md files if you discover reusable patterns
8. If checks pass, commit ALL changes with message: `feat: [Story ID] - [Story Title]`
9. Update the PRD to set `passes: true` for the completed story
10. Append your progress to `scripts/ralph/progress.txt`

## Project-Specific Commands

```bash
# Backend
cd backend
uv run ruff check src/                    # Lint
uv run ruff format src/                   # Format
uv run pytest tests/ -v                   # Test
uv run alembic upgrade head               # Run migrations
uv run alembic revision --autogenerate -m "description"  # Create migration
uv run uvicorn src.main:app --reload      # Run server

# Frontend
cd frontend
npm run build                             # Build (also typechecks)
npm run dev                               # Dev server
npm test                                  # Run tests (if configured)
```

## Progress Report Format

APPEND to scripts/ralph/progress.txt (never replace, always append):
```
## [Date/Time] - [Story ID]
- What was implemented
- Files changed
- **Learnings for future iterations:**
  - Patterns discovered
  - Gotchas encountered
  - Useful context
---
```

## Consolidate Patterns

If you discover a **reusable pattern**, add it to the `## Codebase Patterns` section at the TOP of progress.txt:

```
## Codebase Patterns
- SQLAlchemy models go in backend/src/models/ and must be imported in __init__.py
- API routes go in backend/src/api/routes/ and must be registered in __init__.py
- Use structlog for logging, never print()
- Frontend API client is at frontend/src/lib/api/client.ts
```

## Quality Requirements

- ALL commits must pass ruff check and pytest
- Frontend must build without errors
- Do NOT commit broken code
- Follow existing code patterns
- Use type hints in Python
- Use TypeScript strict mode

## Database Notes

- Using Supabase PostgreSQL (async with asyncpg)
- Connection configured via SUPABASE_DB_URL env var
- Always create Alembic migrations for schema changes
- Test migrations work before committing

## Stop Condition

After completing a user story, check if ALL stories have `passes: true`.

If ALL stories are complete and passing, reply with:
<promise>COMPLETE</promise>

If there are still stories with `passes: false`, end your response normally.

## Important

- Work on ONE story per iteration
- Commit frequently with descriptive messages
- Keep tests passing
- Read Codebase Patterns in progress.txt before starting
- If you hit an error, document it in progress.txt for the next iteration
