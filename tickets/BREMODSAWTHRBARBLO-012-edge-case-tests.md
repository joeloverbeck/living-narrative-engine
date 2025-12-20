# BREMODSAWTHRBARBLO-012: Add edge case tests

Goal: add integration tests covering multi-target selection, state transitions, and boundary values.

# File list it expects to touch
- tests/integration/mods/breaching/edge_cases.test.js

# Out of scope
- Changes to action, rule, scope, or component definitions.
- Documentation updates.
- Unit tests for components.

# Acceptance criteria
## Specific tests that must pass
- npm run test:integration -- tests/integration/mods/breaching/edge_cases.test.js

## Invariants that must remain true
- Multiple valid targets remain discoverable and selectable.
- Blockers with progress > 0 stay excluded from discovery.
- Boundary values for craft skill and structural resistance behave consistently.
