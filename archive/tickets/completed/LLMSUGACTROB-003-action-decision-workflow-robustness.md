# LLMSUGACTROB-003 ActionDecisionWorkflow suggested-action robustness
Status: Completed

## Reassessment
- Clamping, pending-flag handling, timeout policies, and the canonical `core:suggested_action` ID are already implemented and covered by existing unit tests.
- The remaining gap is resilience when the prompt layer itself throws (e.g., `PlayerPromptService.prompt` rejects) or when event dispatch errors bubble up; these currently tear down the turn instead of falling back to the LLM action.
- Schema/ID alignment is fine, but there is no workflow-level test that routes the generated payload through a real `ValidatedEventDispatcher` with the suggested-action schema loaded.

## Updated scope
- Keep existing clamping, pending-flag, and timeout behaviors intact.
- Catch prompt-service submission failures and event dispatch errors, log once per decision, and continue with the LLM action path (pending flag cleared).
- Add workflow coverage that exercises a `ValidatedEventDispatcher` loaded with `core:suggested_action` to confirm the emitted payload validates.

## File list
- src/turns/states/workflows/actionDecisionWorkflow.js
- tests/unit/turns/states/workflows/actionDecisionWorkflow.test.js
- (optionally) shared test fixtures/mocks used by the workflow tests

## Out of scope
- No DI wiring changes (handled separately).
- No UI renderer updates.
- No telemetry schema changes beyond necessary logging fields.

## Acceptance criteria
### Tests
- `npm run test:single -- tests/unit/turns/states/workflows/actionDecisionWorkflow.test.js` covers: prompt service throwing/rejecting, clamping/no-available-actions path (already present), timeout policy behavior, pending-flag cleanup, and validated dispatch of `core:suggested_action` via `ValidatedEventDispatcher`.
- Workflow-generated payloads validate against the suggested-action schema when passed through `ValidatedEventDispatcher` in tests.

### Invariants
- Pending flag is set before awaiting user input and always cleared in `finally` regardless of errors/timeouts.
- Suggested index is clamped to available actions (or null when none) and logged when correction occurs.
- Workflow catches prompt-service errors, logs once per decision, and proceeds with the LLM action without crashing.
- Suggested-action event uses the canonical `core:` ID and payload matches schema.

## Outcome
- Hardened `ActionDecisionWorkflow` to catch prompt submission and suggested-action dispatch failures, logging once and continuing with the LLM action while clearing pending flags.
- Added workflow unit tests for prompt rejections, dispatch failures, and validation through a real `ValidatedEventDispatcher` loaded with the suggested-action schema.
- Acceptance verified via `npm run test:single -- tests/unit/turns/states/workflows/actionDecisionWorkflow.test.js`.
