# BREMODSAWTHRBARBLO-011: Add rule execution tests

Goal: add integration tests for outcome handling in handle_saw_through_barred_blocker.

# File list it expects to touch
- tests/integration/mods/breaching/saw_through_barred_blocker_rule_execution.test.js

# Out of scope
- Changes to rule definitions or action configuration.
- Action discovery tests.
- Documentation updates.

# Acceptance criteria
## Specific tests that must pass
- npm run test:integration -- tests/integration/mods/breaching/saw_through_barred_blocker_rule_execution.test.js

## Invariants that must remain true
- Progress increments are 2 for critical success and 1 for success.
- Failure and fumble do not change progress.
- Fumble unwields and drops the tool at the actor's location and dispatches the correct event.
