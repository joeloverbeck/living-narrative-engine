# BREMODSAWTHRBARBLO-012: Add edge case tests

Goal: add integration tests covering multi-target selection, state transitions, and boundary values.

# Assumptions & scope updates (reconciled with current code)
- Action discovery in the test env returns candidate actions only; it does not expose per-target combinations. Multi-target coverage will assert scope resolution returns multiple valid targets and the action remains discoverable with multiple targets available.
- `breaching:abrasive_sawing_tools` resolves from `items:inventory` (no wielding requirement).
- The rule runs on `core:attempt_action` and uses `RESOLVE_OUTCOME`; progress updates are `ADD_COMPONENT`/`MODIFY_COMPONENT` increments (not `RESOLVE_CHANCE_BASED_ACTION`).
- Chance boundary behavior is governed by `ProbabilityCalculatorService` default bounds (min 5, max 95); tests will validate clamping via `ChanceCalculationService`.

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

# Outcome
- Added integration edge case coverage for multi-target scope availability, progress-driven exclusion, fumble tool state, and chance clamping.
- Clarified discovery limitations and chance bounds; no runtime code changes required.

# Status
- Completed
