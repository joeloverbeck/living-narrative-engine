# RESTARNONDETACT-006: Restrain Outcome Resolution Tests

## Description
Add integration coverage mirroring `tests/integration/mods/weapons/swingAtTargetOutcomeResolution.test.js` to verify `handle_restrain_target.rule.json` outcome configuration and branching. Ensure RESOLVE_OUTCOME uses grappling vs defense skills with correct defaults, ratio formula bounds, and four IF branches with specified messages.

## Expected File List
- `tests/integration/mods/physical-control/restrainTargetOutcomeResolution.test.js` (Add)

## Out of Scope
- Component state/mutation assertions (handled by effect branch tests).
- Action discovery coverage.
- Changes to rule/action JSON outside of adjustments needed to satisfy tests (tests should target current spec intent).

## Acceptance Criteria
- Test asserts RESOLVE_OUTCOME parameters: `contestType: "opposed"`, `formula: "ratio"`, min/max 5/95, critical thresholds 5/95, actorSkill `skills:grappling_skill.value` default 10, targetSkill `skills:defense_skill.value` default 0 with `targetRole: "target"`.
- Test enumerates four IF branches keyed to CRITICAL_SUCCESS, SUCCESS, FAILURE, FUMBLE with the exact message strings from the spec.
- Commands: `npm run test:integration -- tests/integration/mods/physical-control/restrainTargetOutcomeResolution.test.js` passes; `npm run lint` passes.

### Invariants
- No modifications to existing weapons/physical-control integration tests aside from adding the new file.
- Rule/event IDs remain unchanged; test fixtures do not introduce new helper utilities.
