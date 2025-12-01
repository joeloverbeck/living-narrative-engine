# Context
- Modules: `data/mods/core/events/suggested_action.event.json` (payload schema), `src/turns/states/workflows/actionDecisionWorkflow.js` (emits LLM suggestion payloads via Safe/ValidatedEventDispatcher), schema/validation harness in `tests/unit/schemas/suggestedActionEvent.schema.test.js` and `tests/unit/turns/states/workflows/actionDecisionWorkflow.test.js`.
- Responsibility: carry LLM-suggested action metadata (speech, thoughts, structured notes) through the event bus with schema validation enforced by ValidatedEventDispatcher.

# Problem
- Failure: Production VED rejected `core:suggested_action` because `notes[*].subjectType` was present but the schema disallowed it (`additionalProperties` false, `subjectType` missing), causing dispatch to skip and downstream UI/state never receiving the event. Logged errors matched `/notes/0]: must NOT have additional properties`.
- Repro: Enhanced tests now cover this path (`tests/unit/schemas/suggestedActionEvent.schema.test.js`, `tests/unit/turns/states/workflows/actionDecisionWorkflow.test.js`), demonstrating schema rejection and payload emission.

# Truth sources
- JSON schemas: `data/schemas/common.schema.json` (structuredNote definition), `data/mods/core/events/suggested_action.event.json`.
- Workflow spec: `archive/specs/llm-suggested-action-robustness.md`, HUMINTHELOOLLM tickets under `archive/`.
- Event contract constants: `src/constants/eventIds.js`.
- Validation/dispatch contract: `src/events/validatedEventDispatcher.js`.

# Desired behavior
## Normal cases
- LLM suggestion payloads include actorId, clamped suggestedIndex, descriptor, and optional speech/thoughts/notes.
- Structured notes accept `subjectType` enumerated by the shared taxonomy and still allow legacy notes without it.
- ValidatedEventDispatcher loads schema and dispatches without warnings or skips.
## Edge cases
- `notes` may be `null`, empty array, or a mix of legacy (no subjectType) and typed entries.
- `suggestedIndex` may be `null` when no actions are available; descriptor may be `null`.
- Unknown schema temporarily unavailable: dispatcher logs debug and proceeds (when allowed).
## Failure modes (expected errors)
- If payload fails schema validation (e.g., additionalProperties), VED must log errors and skip dispatch; workflow should continue without crashing.
- Missing SafeEventDispatcher on context/handler logs a warning and continues.
## Invariants
- Event ID remains `core:suggested_action` and schema lives under `data/mods/core/events/`.
- Notes that include `subjectType` must conform to the shared enum; additional properties are rejected.
- Pending-flag lifecycle around suggestion emission always enters and clears (even on validation failure).
## API contracts
- Stable: event ID, payload shape (including optional notes.subjectType), workflow emission behavior, schema IDs (`core:suggested_action#payload`), subject type enum values.
## What is allowed to change
- Logging verbosity, timeout/prompt handling internals, optional fields remaining nullable, schema descriptions/examples.

# Testing plan
## Tests to update/add
- Keep `tests/unit/schemas/suggestedActionEvent.schema.test.js` aligned with schema changes (including subjectType and legacy notes).
- Ensure `tests/unit/turns/states/workflows/actionDecisionWorkflow.test.js` validates emitted payloads through ValidatedEventDispatcher with structured notes.
- Add a property-style test fuzzing notes arrays (with/without subjectType) against the payload schema.
## Regression/property tests
- VED integration test that fails when additionalProperties are introduced on notes.
- Workflow test asserting pending flag is cleared even when VED validation fails.
- Schema contract snapshot test ensuring `notes.items.properties` contains `subjectType` enum matching `SUBJECT_TYPE_ENUM_VALUES`.

## Archive Note
Completed via SUGACTSCHHARD-003: schema remains unchanged while property-based payload coverage was added to guard typed/legacy notes and nullable optionals.
