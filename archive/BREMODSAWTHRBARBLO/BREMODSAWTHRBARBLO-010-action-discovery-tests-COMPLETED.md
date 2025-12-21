# BREMODSAWTHRBARBLO-010: Add action discovery tests

Goal: complete integration tests validating discovery behavior and chanceBased metadata for saw_through_barred_blocker, using the existing test file.

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
- Discovery requires an abrasive sawing tool in inventory and a valid barred blocker target.
- Corroded modifier is represented in the action's chanceBased metadata.
- No other breaching action discovery tests are altered.

# Notes on current implementation
- The abrasive sawing tool scope resolves against `items:inventory.items` rather than wielded equipment.
- The action definition uses `targets.primary.scope`/`targets.secondary.scope` and `required_components`.

## Status
Completed

## Outcome
- Updated action discovery tests to validate chanceBased metadata and clarified inventory-based tool discovery.
- Added a negative discovery case for non-sawing inventory tools while keeping the existing discovery gate coverage.
