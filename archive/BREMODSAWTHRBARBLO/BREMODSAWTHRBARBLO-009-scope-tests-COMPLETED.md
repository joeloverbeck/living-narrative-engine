# BREMODSAWTHRBARBLO-009: Add scope resolution tests

Goal: add integration tests for sawable_barred_blockers and abrasive_sawing_tools scopes.

# File list it expects to touch
- tests/integration/mods/breaching/scopes.test.js

# Out of scope
- Changes to scope definitions or any production data.
- Action discovery or rule execution tests.
- Documentation updates.

# Acceptance criteria
## Specific tests that must pass
- npm run test:integration -- tests/integration/mods/breaching/scopes.test.js

## Invariants that must remain true
- sawable_barred_blockers includes only barred blockers with structural_resistance and no progress or progress value 0.
- abrasive_sawing_tools includes only inventory items referenced by the actor with breaching:allows_abrasive_sawing (no wielded requirement in scope).
- No other integration suites are modified.

## Status
Completed

## Outcome
- Updated the abrasive_sawing_tools invariant to match the inventory-based scope behavior.
- Added missing scope exclusions for non-barred and non-resistant blockers; no production data changes were needed.
