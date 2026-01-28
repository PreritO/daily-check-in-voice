# Ralph Agent Instructions - Daily Check-In Agent

You are an autonomous coding agent working on the Daily Check-In Agent project. You MUST use the project's established workflow and specialized subagents.

## Project Context

This is a voice-driven daily standup bot with:
- **Backend**: FastAPI + SQLAlchemy + Supabase (PostgreSQL)
- **Frontend**: Next.js + React + Tailwind + Supabase client
- **Voice**: LiveKit Agents (to be implemented)

Working directory: The project root (`/Users/preritoberai/Desktop/projects/daily-check-in-agent`)

## CRITICAL: Use Project Workflow

This project has specialized commands and subagents in `.claude/`. You MUST use them:

### Specialized Subagents (Use These!)

Before implementing, delegate to the appropriate specialist:

| Story Type | Subagent to Use | Description |
|------------|-----------------|-------------|
| Database models, SQLAlchemy | `backend` | FastAPI, Pydantic, SQLAlchemy expert |
| API endpoints, routes | `backend` | Backend specialist |
| React components, pages | `frontend` | Next.js, React, Tailwind expert |
| LiveKit, voice pipeline | `voice-agent-architect` | Voice AI specialist |
| API design decisions | `api-designer` | REST API design expert |
| Slack/Notion integration | `integration-helper` | External API integrations |
| After implementation | `reviewer` | Code review, find bugs |

**How to use subagents**: Use the Task tool with the appropriate `subagent_type`.

### Quality Verification

After implementing each story, you MUST verify:

1. **Backend changes**:
   ```bash
   cd backend && uv run ruff check src/ && uv run ruff format src/ && uv run pytest tests/ -v
   ```

2. **Frontend changes**:
   ```bash
   cd frontend && npm run build
   ```

3. **Use the `reviewer` subagent** to check for bugs, security issues, and code quality.

## Your Task (Per Iteration)

1. **Read the PRD** at `scripts/ralph/prd.json`
2. **Read progress.txt** - check the Codebase Patterns section first
3. **Verify branch** - ensure you're on the correct branch from PRD `branchName`
4. **Pick the highest priority story** where `passes: false`
5. **Delegate to specialist subagent**:
   - Identify story type (backend/frontend/voice/integration)
   - Use Task tool with appropriate subagent_type
   - Let the specialist implement the code
6. **Run quality checks** (ruff, pytest, npm build)
7. **Use `reviewer` subagent** to verify the implementation
8. **If all checks pass**:
   - Commit with message: `feat: [Story ID] - [Story Title]`
   - Update PRD to set `passes: true`
   - Append progress to `scripts/ralph/progress.txt`

## Story Implementation Pattern

For each story, follow this pattern:

```
1. Analyze story requirements
2. Identify which subagent(s) to use
3. Delegate implementation to specialist subagent
4. Run verification checks
5. Use reviewer subagent to check quality
6. Fix any issues found
7. Commit and update PRD
```

## Subagent Delegation Examples

### Backend Story (e.g., "Create User model")
```
Use Task tool with:
- subagent_type: "backend"
- prompt: "Create SQLAlchemy User model in backend/src/models/user.py with fields: [details from story]. Follow existing patterns in the codebase. Export from __init__.py."
```

### Frontend Story (e.g., "Create dashboard layout")
```
Use Task tool with:
- subagent_type: "frontend"
- prompt: "Create dashboard layout in frontend/src/app/(dashboard)/layout.tsx with sidebar navigation. Use Tailwind CSS, follow existing patterns."
```

### After Implementation
```
Use Task tool with:
- subagent_type: "reviewer"
- prompt: "Review the changes made for [Story ID]. Check for bugs, security issues, and code quality. Verify it meets the acceptance criteria: [list criteria]"
```

## Project-Specific Commands

```bash
# Backend
cd backend
uv run ruff check src/                    # Lint
uv run ruff format src/                   # Format
uv run pytest tests/ -v                   # Test
uv run alembic upgrade head               # Run migrations
uv run alembic revision --autogenerate -m "description"  # Create migration

# Frontend
cd frontend
npm run build                             # Build (also typechecks)
npm run dev                               # Dev server
```

## Progress Report Format

APPEND to `scripts/ralph/progress.txt`:

```
## [Date/Time] - [Story ID]: [Story Title]
- **Subagent used**: [backend/frontend/voice-agent-architect/etc]
- **What was implemented**: [brief description]
- **Files changed**: [list files]
- **Verification**: ruff ✓ | pytest ✓ | build ✓ | reviewer ✓
- **Learnings for future iterations**:
  - [Pattern discovered]
  - [Gotcha encountered]
---
```

## Codebase Patterns (Read First!)

Check the `## Codebase Patterns` section at the TOP of `scripts/ralph/progress.txt` before starting. Add new patterns you discover.

Key patterns for this project:
- SQLAlchemy models go in `backend/src/models/` and must be imported in `__init__.py`
- API routes go in `backend/src/api/routes/` and must be registered in `__init__.py`
- Pydantic schemas go in `backend/src/api/schemas.py`
- Use `structlog` for logging, never `print()`
- Frontend API client is at `frontend/src/lib/api/client.ts`
- Use React Query hooks for data fetching in frontend

## Quality Requirements

- ALL commits must pass ruff check and pytest
- Frontend must build without errors (`npm run build`)
- Code must pass `reviewer` subagent review
- Follow existing code patterns
- Use type hints in Python
- Use TypeScript strict mode in frontend

## Stop Condition

After completing a user story, check if ALL stories have `passes: true`.

If ALL stories are complete and passing, reply with:
```
<promise>COMPLETE</promise>
```

If there are still stories with `passes: false`, end your response normally (next iteration will continue).

## Important Rules

1. **Work on ONE story per iteration**
2. **ALWAYS use subagents** - don't implement complex code directly
3. **ALWAYS run verification** before committing
4. **ALWAYS use reviewer** after implementation
5. **Commit frequently** with descriptive messages
6. **Document learnings** in progress.txt for future iterations
7. **If blocked**, document the issue and move to next story if possible
