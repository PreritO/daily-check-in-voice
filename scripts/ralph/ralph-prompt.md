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

Use subagents in this order for each story:

#### Step 1: ARCHITECT (Always First)
Before ANY implementation, use the `architect` subagent to:
- Analyze existing codebase patterns
- Identify the right approach for this story
- Ensure consistency with existing code
- Plan file structure and dependencies

#### Step 2: SPECIALIST (Implementation)
Delegate implementation to the appropriate specialist:

| Story Type | Subagent to Use | Description |
|------------|-----------------|-------------|
| Database models, SQLAlchemy | `backend` | FastAPI, Pydantic, SQLAlchemy expert |
| API endpoints, routes | `backend` | Backend specialist |
| React components, pages | `frontend` | Next.js, React, Tailwind expert |
| LiveKit, voice pipeline | `voice-agent-architect` | Voice AI specialist |
| API design decisions | `api-designer` | REST API design expert |
| Slack/Notion integration | `integration-helper` | External API integrations |

#### Step 3: SIMPLIFIER (When Needed)
After implementation, use `simplifier` subagent if:
- Code is overly complex or hard to understand
- There's duplicated logic that could be extracted
- The implementation feels "heavy" for what it does
- Patterns don't match the rest of the codebase

The simplifier will refactor for clarity while preserving functionality.

#### Step 4: REVIEWER (Always Last)
Always use `reviewer` subagent to:
- Check for bugs and edge cases
- Identify security issues
- Verify code quality
- Ensure acceptance criteria are met

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

For each story, follow this EXACT pattern:

```
1. Read story requirements and acceptance criteria
2. ARCHITECT: Use architect subagent to analyze patterns and plan approach
3. SPECIALIST: Delegate implementation to appropriate specialist (backend/frontend/etc)
4. VERIFY: Run quality checks (ruff, pytest, npm build)
5. SIMPLIFIER: If code is complex, use simplifier to refactor
6. REVIEWER: Use reviewer subagent to check for bugs/security/quality
7. FIX: Address any issues found by reviewer
8. COMMIT: Commit changes and update PRD
```

**DO NOT skip steps 2 (architect) or 6 (reviewer) - they ensure code quality.**

## Subagent Delegation Examples

### Example: Backend Story (e.g., "Create User model")

**Step 1 - Architect:**
```
Use Task tool with:
- subagent_type: "architect"
- prompt: "Analyze the codebase patterns for database models. I need to create a User model.
  Check: backend/src/models/ for existing patterns, how models are exported in __init__.py,
  what base classes are used, naming conventions. Return the recommended approach."
```

**Step 2 - Backend Specialist:**
```
Use Task tool with:
- subagent_type: "backend"
- prompt: "Create SQLAlchemy User model in backend/src/models/user.py with fields: [details].
  Follow the patterns identified by architect: [paste architect recommendations].
  Export from __init__.py."
```

**Step 3 - Simplifier (if needed):**
```
Use Task tool with:
- subagent_type: "simplifier"
- prompt: "Review backend/src/models/user.py. Simplify if there's unnecessary complexity.
  Keep it consistent with other models in the codebase."
```

**Step 4 - Reviewer:**
```
Use Task tool with:
- subagent_type: "reviewer"
- prompt: "Review the User model implementation for US-001. Check for:
  - Bugs and edge cases
  - Security issues (e.g., sensitive field exposure)
  - Code quality and consistency
  - Acceptance criteria: [list from story]"
```

### Example: Frontend Story (e.g., "Create dashboard layout")

**Step 1 - Architect:**
```
Use Task tool with:
- subagent_type: "architect"
- prompt: "Analyze frontend patterns. I need to create a dashboard layout.
  Check: frontend/src/app/ for existing layouts, component patterns, Tailwind usage.
  Return recommended approach for the layout structure."
```

**Step 2 - Frontend Specialist:**
```
Use Task tool with:
- subagent_type: "frontend"
- prompt: "Create dashboard layout in frontend/src/app/(dashboard)/layout.tsx.
  Follow architect recommendations: [paste]. Include sidebar navigation, responsive design."
```

**Step 3 - Reviewer:**
```
Use Task tool with:
- subagent_type: "reviewer"
- prompt: "Review the dashboard layout for US-013. Verify accessibility,
  responsive design, and consistency with project patterns."
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
- **Subagents used**:
  - architect: [pattern/approach identified]
  - specialist: [backend/frontend/voice-agent-architect/etc]
  - simplifier: [used/not needed] - [what was simplified if used]
  - reviewer: [issues found and fixed]
- **What was implemented**: [brief description]
- **Files changed**: [list files]
- **Verification**: ruff ✓ | pytest ✓ | build ✓
- **Learnings for future iterations**:
  - [Pattern discovered by architect]
  - [Gotcha encountered]
  - [Simplification applied]
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
2. **ALWAYS start with architect** - understand patterns before coding
3. **ALWAYS use specialist subagents** - don't implement complex code directly
4. **Use simplifier when needed** - keep code clean and consistent
5. **ALWAYS end with reviewer** - catch bugs before committing
6. **ALWAYS run verification** (ruff, pytest, build) before committing
7. **Commit frequently** with descriptive messages
8. **Document learnings** in progress.txt for future iterations
9. **If blocked**, document the issue and move to next story if possible

## Subagent Flow Summary

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  ARCHITECT  │ ──▶ │ SPECIALIST  │ ──▶ │ SIMPLIFIER  │ ──▶ │  REVIEWER   │
│  (patterns) │     │ (implement) │     │ (if needed) │     │  (quality)  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                    │
                                                                    ▼
                                                            ┌─────────────┐
                                                            │   COMMIT    │
                                                            └─────────────┘
```
