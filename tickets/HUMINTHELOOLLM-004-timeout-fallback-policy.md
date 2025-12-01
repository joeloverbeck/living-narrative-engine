# HUMINTHELOOLLM-004: Timeout and Fallback Policy for Pending LLM Suggestions

**Summary:** Add configurable timeout handling for pending LLM suggestions with policies `autoAccept`, `autoWait`, or `noop`, including guardrails and logging of the chosen path.

## File list
- src/turns/states/workflows/actionDecisionWorkflow.js (timer/timeout handling only)
- src/turns/states/workflows/processingWorkflow.js (resume flow on timeout)
- src/config/ (new or updated settings/config surface for fallback policy)
- tests/ (unit/integration coverage for timeout behavior)

## Out of scope
- UI changes beyond reflecting the resolved action; no new callout styling here.
- Telemetry schema changes (covered separately).
- Core gating/prompt dispatch implementations outside the timeout path.
- Any changes to human turn timeouts or unrelated timers.

## Acceptance criteria
- Tests:
  - `npm run test:unit -- src/turns/states/workflows/actionDecisionWorkflow.test.js` (updated) covers starting/canceling timeout, policy selection, and single execution of fallback.
  - `npm run test:integration -- turns/llm-timeout.integration.test.js` (new) simulates pending LLM suggestion with no submission, verifies policy outcomes (`autoAccept` uses suggestion, `autoWait` uses wait/idle, `noop` leaves pending and warns) and ensures only one processing execution.
- Invariants:
  - Timeout is opt-in/configurable and defaults to disabled unless explicitly enabled.
  - No duplicate processing or stale pending flag after timeout resolution.
  - Timeout behavior does not apply to human/non-LLM turns.
  - Policy decisions are logged or exposed for debugging without blocking turn progression.
