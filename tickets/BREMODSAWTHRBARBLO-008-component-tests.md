# BREMODSAWTHRBARBLO-008: Add component validation tests

Goal: add unit tests covering progress_tracker, craft_skill, and allows_abrasive_sawing components.

# File list it expects to touch
- tests/unit/mods/breaching/components.test.js

# Out of scope
- Component schema changes.
- Integration or e2e tests.
- Any production data changes under data/mods/.

# Acceptance criteria
## Specific tests that must pass
- npm run test:unit -- tests/unit/mods/breaching/components.test.js

## Invariants that must remain true
- allows_abrasive_sawing remains a marker component (empty object only).
- progress_tracker accepts only non-negative integers with no upper bound.
- craft_skill enforces 0-100 bounds with default 10.
