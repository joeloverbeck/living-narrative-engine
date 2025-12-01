# HUMINTHELOOLLM-001: LLM Turn Gating and Pending Flag

**Summary:** Add a pending-approval gate for LLM-driven turns so suggested actions are held until a human confirms, and block processing/scheduling while pending.
**Status:** Completed

**Current state check:** The LLM path immediately transitions from `ActionDecisionWorkflow` to processing with no pending flag, no `llm:suggested_action` event, and no hook to reuse the existing prompt flow. Decision metadata does not retain the chosen index, and the tests only cover the pre-gating happy path.

## File list
- src/constants/eventIds.js (add canonical `llm:suggested_action`)
- src/utils/decisionResultUtils.js (preserve chosen index + actions for gating)
- src/turns/strategies/genericTurnStrategy.js (surface suggestion metadata)
- src/turns/states/workflows/actionDecisionWorkflow.js (insert pending gate + prompt reuse)
- src/turns/states/workflows/processingWorkflow.js (respect pending flag)
- tests/ (unit + integration coverage for the pending gate)

## Out of scope
- UI rendering of the suggestion callout or button preselection (current prompt adapter does not support preselection payloads).
- Telemetry/logging payloads or analytics wiring.
- Timeout/fallback policies for auto-accept/auto-wait.
- Changes to human (non-LLM) decision flows.

## Acceptance criteria
- Tests:
  - `npm run test:unit -- src/turns/states/workflows/actionDecisionWorkflow.test.js` covers: chosen index preserved, `llm:suggested_action` emitted once for LLM providers, prompt awaited before processing, pending flag cleared after submission or cancellation.
  - `npm run test:unit -- src/turns/states/workflows/processingWorkflow.test.js` covers: processing workflow bails when `isAwaitingExternalEvent` is true and resumes normally when cleared.
  - `npm run test:integration -- turns/llm-pending-gate.integration.test.js` simulates LLM decision -> pending gate -> submission path; asserts single execution, no processing while pending, and final action matches submitted index.
- Invariants:
  - Human/non-LLM turn strategies continue executing without the pending gate.
  - Speech/thought emission order stays unchanged relative to decision resolution (still dispatched once processing begins).
  - No processing workflow runs while `AwaitingExternalEvent`/pending is true.
  - Pending flag is cleared deterministically on submission or cancellation without leaking cross-turn state.

## Outcome
- Added `llm:suggested_action` as a canonical event ID and preserved chosen index/available actions on decision results to support gating.
- `ActionDecisionWorkflow` now sets a pending flag for LLM providers, emits the suggestion event, waits on the prompt flow, and only then records/executes the submitted action while keeping speech dispatch timing unchanged.
- `ProcessingWorkflow` bails when a turn is awaiting an external event, and new unit + integration tests lock the pending-gate behavior.
