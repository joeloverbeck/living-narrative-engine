# HUMINTHELOOLLM-005: Telemetry and Override Logging for LLM Suggestions

**Summary:** Capture telemetry for each LLM suggestion, including actorId, suggestedIndex, finalIndex, override boolean, invalid-index corrections, timeout path, and pending-block debug traces.

## File list
- src/turns/states/workflows/actionDecisionWorkflow.js (emit suggestion/override telemetry hooks)
- src/turns/strategies/genericTurnStrategy.js (log pending block/unblock traces)
- src/turns/providers/llmDecisionProvider.js (invalid index warnings)
- src/telemetry/ or logging utilities (wherever action/turn events are recorded)
- tests/ (unit/integration coverage for telemetry content)

## Out of scope
- UI surfacing of telemetry or debug data.
- Changes to gating/prompt flow behavior itself (no new state machines).
- Analytics backend/schema migrations beyond adding the needed event fields.
- Configurable timeout policies (handled in HUMINTHELOOLLM-004).

## Acceptance criteria
- Tests:
  - `npm run test:unit -- src/turns/states/workflows/actionDecisionWorkflow.test.js` (updated) asserts telemetry/logging emits suggested action, override flag, timeout boolean, and invalid-index corrections.
  - `npm run test:integration -- telemetry/llm-suggestion-logging.integration.test.js` (new) verifies end-to-end event payloads include actorId, suggestedIndex, finalIndex, override flag, timeout path, and block/unblock traces with no duplicates.
- Invariants:
  - Telemetry payloads do not include PII or sensitive prompt content.
  - Logging occurs exactly once per suggestion cycle; no duplicate events across submission/timeout paths.
  - Adding telemetry does not alter control flow or mutate decision data used by processing.
  - Existing telemetry channels remain compatible and do not regress human turn logs.
