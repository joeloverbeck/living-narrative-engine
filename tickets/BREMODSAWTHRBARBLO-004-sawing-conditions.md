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
- npm run test:integration -- tests/integration/mods/breaching/saw_through_barred_blocker_action_discovery.test.js
- npm run validate:fast

## Invariants that must remain true
- Corroded check only evaluates target.blockers:corroded.
- Event condition only matches actionId breaching:saw_through_barred_blocker.
- No other condition files are modified.
