# BREMODSAWTHRBARBLO-004: Add sawing conditions

Goal: add conditions for corroded targets and event matching.

# File list it expects to touch
- data/mods/blockers/conditions/target-is-corroded.condition.json
- data/mods/breaching/conditions/event-is-action-saw-through-barred-blocker.condition.json

# Out of scope
- Any action or rule changes.
- Updates to scopes, components, manifests, or documentation.

# Acceptance criteria
## Specific tests that must pass
- npm run test:unit -- tests/unit/mods/blockers/conditions.test.js
- npm run test:unit -- tests/unit/mods/breaching/conditions.test.js
- npm run validate:fast

## Invariants that must remain true
- Corroded check only evaluates target.blockers:corroded.
- Event condition only matches actionId breaching:saw_through_barred_blocker.
- No other condition files are modified.

# Outcome
- Created `data/mods/blockers/conditions/target-is-corroded.condition.json` and `data/mods/breaching/conditions/event-is-action-saw-through-barred-blocker.condition.json`.
- Identified that the integration test `saw_through_barred_blocker_action_discovery.test.js` could not be run as the action doesn't exist yet.
- Replaced the integration test requirement with new unit tests `tests/unit/mods/blockers/conditions.test.js` and `tests/unit/mods/breaching/conditions.test.js`.
- Verified conditions against schema (used `logic` property instead of `expression`).
- All tests and validation passed.
