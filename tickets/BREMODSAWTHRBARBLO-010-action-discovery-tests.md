# BREMODSAWTHRBARBLO-010: Add action discovery tests

Goal: add integration tests validating discovery and chance metadata for saw_through_barred_blocker.

# File list it expects to touch
- tests/integration/mods/breaching/saw_through_barred_blocker_action_discovery.test.js

# Out of scope
- Changes to action, scope, or condition definitions.
- Rule execution tests.
- Documentation updates.

# Acceptance criteria
## Specific tests that must pass
- npm run test:integration -- tests/integration/mods/breaching/saw_through_barred_blocker_action_discovery.test.js

## Invariants that must remain true
- Discovery requires a wielded abrasive sawing tool and a valid barred blocker target.
- Corroded modifier is reflected in chance metadata when present.
- No other breaching action discovery tests are altered.
