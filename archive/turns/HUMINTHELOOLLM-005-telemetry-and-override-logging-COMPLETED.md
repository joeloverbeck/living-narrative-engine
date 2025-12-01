# HUMINTHELOOLLM-005: Telemetry and Override Logging for LLM Suggestions

**Status:** Completed

**Scope update:** The engine already clamps and stores LLM suggestion metadata inside `ActionDecisionWorkflow` and emits `llm:suggested_action` once, but it does **not** log any end-of-cycle telemetry (final index/override/timeout) or invalid suggestion corrections. Pending gating currently toggles `setAwaitingExternalEvent` silently (only TurnContext debug), and there is no telemetry folder or existing integration suite for this path. Tests only cover gating/timeouts, not telemetry content.

## File list (updated)
- src/turns/states/workflows/actionDecisionWorkflow.js (telemetry/logging hooks for LLM suggestion resolution and invalid index corrections)
- src/turns/strategies/genericTurnStrategy.js (pending block/unblock traces are absent; add lightweight logging here or in workflow)
- src/turns/providers/llmDecisionProvider.js (surface invalid index warnings if inputs are out of range)
- logging utilities (reuse existing loggers; no dedicated telemetry module exists)
- tests/ (unit + targeted integration to cover the new logging)

## Out of scope
- UI surfacing of telemetry or debug data.
- Changing gating/prompt flow behavior itself (no new state machines or control flow changes).
- Analytics backend/schema migrations; telemetry stays local to logs/event bus.
- Configurable timeout policies (already handled via `llmTimeout.config`).

## Acceptance criteria (corrected)
- Tests:
  - `npm run test:unit -- src/turns/states/workflows/actionDecisionWorkflow.test.js` updated to assert structured telemetry/logging that includes actorId, suggestedIndex, finalIndex (submitted or timeout), override boolean, timeout policy flag, and invalid-index corrections without leaking speech/thought text.
  - New targeted integration test under `tests/integration/turns/` exercising the LLM pending gate end-to-end and verifying a single telemetry/log call per cycle (with pending block/unblock traces and timeout path when applicable).
- Invariants:
  - Telemetry/log statements do not include PII or prompt content; they stick to ids, indexes, booleans, and policies.
  - Logging occurs exactly once per suggestion cycle; no duplicates across submission/timeout paths.
  - Adding telemetry does not alter decision data/control flow and preserves existing events (e.g., `llm:suggested_action`).
  - Pending gate still blocks/re-enables actor processing and now emits debug traces for set/unset.

## Outcome
- Added structured debug telemetry inside `ActionDecisionWorkflow` for LLM suggestions (actorId, suggestedIndex, finalIndex, override flag, timeout policy/flag, and corrected indexes) plus warnings when indexes are clamped.
- Added pending gate debug traces when the external-event flag is set/cleared; no new telemetry module introduced.
- Covered telemetry and timeout paths with updated unit suite and new integration test `tests/integration/turns/llm-suggestion-telemetry.integration.test.js` to ensure single emission per cycle and sanitized payloads.
