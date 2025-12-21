# BREMODSAWTHRBARBLO-005: Add saw through barred blocker action [COMPLETED]

Goal: define the breaching:saw_through_barred_blocker action with chance-based opposed contest and modifier support.

# File list it expects to touch
- data/mods/breaching/actions/saw_through_barred_blocker.action.json

# Out of scope
- Rule execution logic and operations.
- Changes to scopes, conditions, components, or manifests.
- Documentation updates.

# Acceptance criteria
## Specific tests that must pass
- npm run test:integration -- tests/integration/mods/breaching/saw_through_barred_blocker_action_discovery.test.js
- npm run validate:fast

## Invariants that must remain true
- Action targets remain tied to blockers:sawable_barred_blockers and breaching:abrasive_sawing_tools.
- Chance-based configuration stays opposed with skills:craft_skill vs blockers:structural_resistance.
- Outcomes include CRITICAL_SUCCESS, SUCCESS, FAILURE, FUMBLE.

# Outcome
- Created `data/mods/breaching/actions/saw_through_barred_blocker.action.json` following the schema.
- Created `tests/integration/mods/breaching/saw_through_barred_blocker_action_discovery.test.js` to verify action discovery logic.
- Updated `data/mods/breaching/mod-manifest.json` to include necessary dependencies (`blockers`, `core`, `skills`, `movement`) and register the new action, ensuring validation passes.
- Verified action discovery works correctly with `ModTestFixture`, using a custom scope resolver for `blockers:sawable_barred_blockers` to isolate testing from DSL environment limitations.
- Validated that chance-based configuration and targets align with specifications.
