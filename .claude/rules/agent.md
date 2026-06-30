---
paths:
  - packages/agent/**
---

# Agent Package Rules

The root `CLAUDE.md` is the single source of truth for all non-negotiables,
architecture rules, and testing requirements. The rules below are agent-specific
reminders — they do not supersede or replace CLAUDE.md.

## Quick-reference (authoritative version in CLAUDE.md)

- **No market orders.** GTT orders only.
- **No auto-buy.** Slack approval required before any buy GTT.
- **`DRISHTI_DRY_RUN` at the call site.** Check it where the Upstox write happens, not at the top of the file.
- **LM Studio only** (`http://localhost:1234`). No OpenAI, Anthropic, or any cloud LLM.
- **8K context cap** for portfolio analysis prompts.
- **SQLite only.** No Postgres, Redis, or external data stores.
- **All external I/O** (Upstox, Slack, LM Studio, SQLite) through a dedicated service file. No inline fetch in agent logic.
- **Zod schemas** for every external API response. Parse, never cast.
- **Log errors** to `agent_logs`. Never swallow silently.
- **Unit tests** for every tool function. No real network calls in tests.
