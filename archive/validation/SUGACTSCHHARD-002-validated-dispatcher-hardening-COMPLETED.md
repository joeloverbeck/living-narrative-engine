# SUGACTSCHHARD-002: Harden ValidatedEventDispatcher flow for suggested_action emissions

## Assumptions check

- ValidatedEventDispatcher coverage currently lives in `tests/unit/events/validatedEventDispatcher.warnings.test.js` and `tests/unit/events/validatedEventDispatcher.emitEventResilience.test.js`; there is no `validatedEventDispatcher.test.js` suite.
- `ActionDecisionWorkflow` dispatches `core:suggested_action` without `allowSchemaNotFound`, so missing schemas log warnings rather than the debug-only path described in the spec.

## Goal

Ensure `core:suggested_action` dispatches behave correctly when schemas are missing or payloads fail validation: log at debug when schema unavailable (when allowed), skip dispatch on validation errors without leaving the pending flag set, and keep workflow telemetry intact.

## File list

- src/events/validatedEventDispatcher.js
- src/turns/states/workflows/actionDecisionWorkflow.js
- tests/unit/turns/states/workflows/actionDecisionWorkflow.test.js
- tests/unit/events/validatedEventDispatcher.warnings.test.js (extend as needed)

## Out of scope

- Changing event bus implementations or SafeEventDispatcher wiring elsewhere
- Modifying schema definitions themselves (handled in SUGACTSCHHARD-001)
- Broad logging refactors beyond the suggested_action pathway

## Acceptance criteria

- **Tests:**
  - `npm run test:single -- tests/unit/turns/states/workflows/actionDecisionWorkflow.test.js`
  - `npm run test:single -- tests/unit/events/validatedEventDispatcher.warnings.test.js`
- **Invariants:**
  - Pending flag for LLM suggestions always clears even when validation fails or schemas are temporarily unavailable
  - Invalid payloads do not reach the EventBus; valid payloads still dispatch
  - Unknown/missing schema scenarios emit debug-level diagnostics rather than warnings when explicitly allowed

## Status

Completed

## Outcome

- Adjusted `core:suggested_action` dispatching to allow schema-not-found scenarios to log at debug, aligning workflow behavior with the hardening spec without broad logging changes.
- Added unit coverage ensuring pending flags clear and telemetry stays intact even when validated dispatch returns false, and updated existing expectations to include the schema-not-found allowance.
