# RESTARNONDETACT-005: Restrain Action Discovery Tests

## Description
Add integration tests under `tests/integration/mods/physical-control/` verifying discoverability of `physical-control:restrain_target` based on prerequisites and required components. Mirror `swing_at_target_action_discovery.test.js` patterns: action available when actor has `skills:grappling_skill` and two free grabbing appendages; action absent when prerequisites fail or skill missing.

## Expected File List
- `tests/integration/mods/physical-control/restrainTargetActionDiscovery.test.js` (Add)

## Out of Scope
- Outcome resolution or effect branch tests (covered separately).
- Changes to action/rule/condition JSON; these tests should only read existing assets.
- Engine/runtime modifications outside the integration test harness utilities.

## Acceptance Criteria
- Tests assert action presence when actor meets requirements and absence when missing grappling skill or grabbing appendages.
- Uses existing integration helpers/fixtures consistent with other physical-control discovery tests; no new helper modules introduced.
- Commands: `npm run test:integration -- tests/integration/mods/physical-control/restrainTargetActionDiscovery.test.js` passes; `npm run lint` passes.

### Invariants
- No changes to other test suites or fixtures except the new file.
- Swing-at-target discovery tests remain unchanged and continue to pass.
