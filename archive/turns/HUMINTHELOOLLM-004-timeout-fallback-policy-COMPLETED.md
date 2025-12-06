# HUMINTHELOOLLM-004: Timeout and Fallback Policy for Pending LLM Suggestions

**Summary:** The LLM gate already dispatches `llm:suggested_action`, sets `awaitingExternalEvent`, and waits on the prompt. There is currently _no_ timeout or fallback policy. Add an opt-in timeout for pending LLM suggestions with policies `autoAccept`, `autoWait`, or `noop`, keeping logging and single-processing guarantees.
**Status:** Completed

## Current state and gaps

- `src/turns/states/workflows/actionDecisionWorkflow.js` handles the LLM pending gate (clamps suggestion, emits `LLM_SUGGESTED_ACTION_ID`, waits on `getPlayerPromptService`, clears the awaiting flag). No timer or config hook exists.
- `src/turns/states/workflows/processingWorkflow.js` already bails out if the context is awaiting an external event; no timeout resume path is wired.
- Tests in place: `tests/unit/turns/states/workflows/actionDecisionWorkflow.test.js` and `tests/integration/turns/llm-pending-gate.integration.test.js` cover the basic pending gate but not timeout/fallback behavior.

## Scope

- Add a configurable timeout (disabled by default) for pending LLM suggestions, with policies:
  - `autoAccept`: auto-submit the suggested/clamped index.
  - `autoWait`: prefer a “wait/idle” action if available; otherwise fall back to the suggested index.
  - `noop`: log a warning and continue waiting without resolving.
- Expose the setting via a config module under `src/config/` and consume it in `ActionDecisionWorkflow`; ensure only one processing execution and proper cleanup of the awaiting flag.
- Extend unit/integration coverage to prove timeout handling, policy selection, and logging/metadata of the chosen path.

## File list

- src/turns/states/workflows/actionDecisionWorkflow.js (timeout handling and metadata)
- src/config/ (new timeout/fallback setting surfaced for LLM pending gate)
- tests/unit/turns/states/workflows/actionDecisionWorkflow.test.js (add timeout coverage)
- tests/integration/turns/llm-timeout.integration.test.js (new) or extend existing LLM pending gate integration to exercise the timeout path

## Out of scope

- UI changes beyond reflecting the resolved action; no new callout styling here.
- Telemetry schema changes (covered separately).
- Core gating/prompt dispatch implementations outside the timeout path.
- Any changes to human turn timeouts or unrelated timers.

## Acceptance criteria

- Tests:
  - `npm run test:unit -- tests/unit/turns/states/workflows/actionDecisionWorkflow.test.js` covers starting/canceling timeout, policy selection, and single execution of fallback.
  - `npm run test:integration -- tests/integration/turns/llm-timeout.integration.test.js` (or equivalent updated integration) simulates a pending LLM suggestion with no submission, verifies policy outcomes (`autoAccept` uses suggestion, `autoWait` uses wait/idle or falls back), `noop` keeps waiting and warns, and ensures only one processing execution.
- Invariants:
  - Timeout is opt-in/configurable and defaults to disabled unless explicitly enabled.
  - No duplicate processing or stale pending flag after timeout resolution.
  - Timeout behavior does not apply to human/non-LLM turns.
  - Policy decisions are logged or exposed for debugging without blocking turn progression.

## Outcome

- Added `src/config/llmTimeout.config.js` to expose an opt-in timeout policy (`autoAccept`, `autoWait`, `noop`) with wait-action hints and sensible defaults (disabled).
- `ActionDecisionWorkflow` now races prompt submission against the configured timeout, applies the chosen policy (including optional wait-action selection), cancels prompts on auto resolutions, and records timeout metadata without affecting non-LLM turns.
- Expanded unit coverage for policy behavior and added `tests/integration/turns/llm-timeout.integration.test.js` to lock the auto-accept/auto-wait/noop flows and pending-flag cleanup.
