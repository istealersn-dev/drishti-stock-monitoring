---
paths:
  - packages/agent/**
---

# Agent Package Rules

## Non-negotiables (enforced at call site)
- Never place a market order. GTT orders only. No market order function should exist anywhere.
- Never place a new buy GTT without user approval via Slack interactive buttons.
- `DRISHTI_DRY_RUN` must be checked at the call site of every Upstox write call, not at the top of the file.
- LM Studio is the only LLM provider (`http://localhost:1234`). No calls to OpenAI, Anthropic, or any cloud API.
- Cap LM Studio context length at 8K for portfolio analysis prompts.
- SQLite is the only database. Do not introduce Postgres, Redis, or any external data store.

## Architecture
- All Upstox API, Slack, LM Studio, and SQLite I/O must go through a dedicated tool/service file. No inline fetch calls in agent logic.
- Zod schemas define the shape of every external API response. Parse, never cast.
- Errors from external services must be caught, logged to the `agent_logs` SQLite table, and never silently swallowed.

## Testing
- Every tool function must have at least one unit test.
- Agent decision logic must be tested with mocked tool responses.
- No test should make a real network call. Mock Upstox, LM Studio, and Slack at the boundary.
