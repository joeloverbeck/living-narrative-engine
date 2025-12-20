# BREMODSAWTHRBARBLO-005: Add saw through barred blocker action

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
