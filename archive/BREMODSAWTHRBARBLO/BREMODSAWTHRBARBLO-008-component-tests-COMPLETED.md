# BREMODSAWTHRBARBLO-008: Add component validation tests

Goal: ensure unit coverage exists for progress_tracker, craft_skill, and allows_abrasive_sawing component schemas, adding only missing tests.

## Reassessed assumptions
- progress_tracker and craft_skill already have schema tests in their mod folders.
- allows_abrasive_sawing does not have a schema test yet.
- craft_skill default value (10) is not currently asserted in tests.

# File list it expects to touch
- tests/unit/mods/core/components/progressTracker.component.test.js
- tests/unit/mods/skills/components/craftSkill.component.test.js
- tests/unit/mods/breaching/components/allowsAbrasiveSawing.component.test.js

# Out of scope
- Component schema changes.
- Integration or e2e tests.
- Any production data changes under data/mods/.

# Acceptance criteria
## Specific tests that must pass
- npm run test:unit -- tests/unit/mods/core/components/progressTracker.component.test.js tests/unit/mods/skills/components/craftSkill.component.test.js tests/unit/mods/breaching/components/allowsAbrasiveSawing.component.test.js

## Invariants that must remain true
- allows_abrasive_sawing remains a marker component (empty object only).
- progress_tracker accepts only non-negative integers with no upper bound.
- craft_skill enforces 0-100 bounds with default 10.

## Status
Completed

## Outcome
- Added a marker-component schema test for breaching:allows_abrasive_sawing.
- Added an explicit craft_skill default value assertion; progress_tracker tests already covered required behavior.
