# LLMSUGACTROB-001 Event ID and schema alignment for suggested action

Status: Completed

## Reassessment

- The canonical ID is already `core:suggested_action` in code and definitions; no namespace drift remains.
- `ActionDecisionWorkflow` can emit `suggestedIndex: null` when there are no indexed actions, but the schema (and tests) currently require an integer ≥ 1, so VED would warn on that edge case.
- Tests only cover positive suggestedIndex payloads, missing the empty-actions path called out in `specs/llm-suggested-action-robustness.md`.

## Updated scope

- Keep the canonical ID as-is (`core:suggested_action`).
- Relax the payload schema to allow `suggestedIndex: null` for the no-available-actions edge case while keeping the integer ≥ 1 contract otherwise.
- Strengthen schema/workflow tests to accept the null case and assert the dispatcher sees a schema-compliant payload when no actions are available.

## File list

- src/constants/eventIds.js
- data/mods/core/events/suggested_action.event.json
- tests/unit/constants/eventIds.test.js
- tests/unit/schemas/suggestedActionEvent.schema.test.js
- tests/unit/turns/states/workflows/actionDecisionWorkflow.test.js

## Out of scope

- No changes to workflow logic or prompts; only identifiers and schema/fixtures.
- No UI updates or renderer behavior.

## Acceptance criteria

### Tests

- `npm run test -- tests/unit/constants/eventIds.test.js` passes (ID unchanged).
- `npm run test -- tests/unit/schemas/suggestedActionEvent.schema.test.js` validates the event definition, including the null-index edge case, without warnings.
- `npm run test -- tests/unit/turns/states/workflows/actionDecisionWorkflow.test.js` covers dispatch of the schema-compliant payload when no actions are available.

### Invariants

- Suggested-action event ID follows the `core:` namespace and matches the filename under `data/mods/core/events/`.
- Event schema stays compatible with `data/schemas/event.schema.json` contracts (no breaking required fields introduced) and permits `suggestedIndex: null` only when nothing is selectable.
- ValidatedEventDispatcher can locate and validate the definition for the emitted ID without logging missing-definition warnings, including when `suggestedIndex` is null.

## Outcome

- Confirmed ID already aligned; no identifier changes needed.
- Relaxed payload schema to allow `suggestedIndex: null` for the no-actions edge case and updated schema tests accordingly.
- Added workflow coverage to assert `core:suggested_action` dispatch with a null index and ensured pending-flag/reset behavior without prompting.
