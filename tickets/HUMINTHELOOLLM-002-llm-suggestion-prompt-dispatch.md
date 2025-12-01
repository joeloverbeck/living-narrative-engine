# HUMINTHELOOLLM-002: LLM Suggestion Prompt Dispatch

**Summary:** Route LLM action suggestions through the existing prompt dispatch flow, emitting `llm:suggested_action` and preloading `PLAYER_TURN_PROMPT_ID` with suggested selection data.

## File list
- src/turns/prompting/promptCoordinator.js
- src/turns/adapters/eventBusPromptAdapter.js
- src/turns/strategies/genericTurnStrategy.js (prompt dispatch hook only)
- tests/ (new unit coverage for prompt dispatch and event payload shape)

## Out of scope
- UI rendering or styling of the suggestion callout.
- Pending gating logic beyond dispatching events (covered in HUMINTHELOOLLM-001).
- Timeout/fallback behavior.
- Telemetry/logging for suggestions or overrides.

## Acceptance criteria
- Tests:
  - `npm run test:unit -- src/turns/prompting/promptCoordinator.test.js` (new/updated) asserts: `llm:suggested_action` emitted with actorId, suggestedIndex, suggestedActionDescriptor, and optional speech/thoughts/notes; dispatches `PLAYER_TURN_PROMPT_ID` with suggested preselection data.
  - `npm run test:unit -- src/turns/adapters/eventBusPromptAdapter.test.js` (new/updated) verifies prompt adapter routes LLM suggestion payload through the bus without duplicate emissions and tolerates clamped indexes.
- Invariants:
  - Existing human prompt dispatch and event names remain unchanged.
  - No duplicate prompt dispatch for a single LLM decision.
  - Missing/invalid suggested indexes do not throw; prompt still renders with safe defaults.
  - Event payload includes only intended fields and no PII leakage.
