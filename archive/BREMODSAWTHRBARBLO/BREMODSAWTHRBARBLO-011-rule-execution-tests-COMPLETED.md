# BREMODSAWTHRBARBLO-011: Add rule execution tests

Goal: update/add integration assertions for outcome handling in handle_saw_through_barred_blocker to match the current rule/action schema.

# File list it expects to touch
- tests/integration/mods/breaching/saw_through_barred_blocker_rule_execution.test.js

# Out of scope
- Changes to rule definitions or action configuration.
- Action discovery tests.
- Documentation updates.

# Acceptance criteria
## Specific tests that must pass
- npm run test:integration -- tests/integration/mods/breaching/saw_through_barred_blocker_rule_execution.test.js

## Invariants that must remain true (aligned with current rule schema)
- Rule triggers on `core:attempt_action` with condition ref `breaching:event-is-action-saw-through-barred-blocker`.
- Outcome resolution uses `RESOLVE_OUTCOME` (ratio) with `skills:craft_skill` vs `blockers:structural_resistance`.
- Progress increments are 2 for critical success and 1 for success via add/modify component operations.
- Failure and fumble do not add or modify progress.
- Fumble unwields and drops the tool at `{context.actorPosition.locationId}` and emits a perceptible event (auditory alternate description present).

# Status
Completed.

# Outcome
- Updated rule execution test assertions to align with the existing rule schema (perception type, progress/no-progress handling, fumble drop parameters) without changing rule/action data.
