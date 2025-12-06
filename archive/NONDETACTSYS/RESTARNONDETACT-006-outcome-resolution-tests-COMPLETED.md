# RESTARNONDETACT-006: Restrain Outcome Resolution Tests

# RESTARNONDETACT-006: Restrain Outcome Resolution Tests

## Status

Completed.

## Description

Add integration coverage mirroring `tests/integration/mods/weapons/swingAtTargetOutcomeResolution.test.js` to verify `handle_restrain_target.rule.json` outcome configuration and branching. RESOLVE_OUTCOME only accepts skill components/defaults + formula (contest type and thresholds come from the chanceBased action config), so assertions should target the parameters the operation actually exposes and pair them with the action’s chance config. Use the action’s primary target role (placeholder is `primary`) when checking target skill wiring.

## Updated Assumptions

- RESOLVE_OUTCOME builds an opposed contest automatically when a target skill is present; contest type, bounds, and thresholds are owned by the chanceBased action config, not the rule operation parameters.
- The action uses `primary` as the target role for chance-based resolution; there is no `target` role in the action definition.
- Existing effect-branch tests already cover component mutations; the new test focuses on outcome wiring and message strings.

## Expected File List

- `tests/integration/mods/physical-control/restrainTargetOutcomeResolution.test.js` (Add)

## Out of Scope

- Component state/mutation assertions (handled by existing effect branch tests).
- Action discovery coverage.
- Changes to rule/action JSON outside of adjustments needed to satisfy tests (tests should target current spec intent).

## Acceptance Criteria

- Test asserts RESOLVE_OUTCOME parameters available in the rule: `formula: "ratio"`, actorSkill `skills:grappling_skill` default 10, targetSkill `skills:defense_skill` default 0, and `result_variable: "restrainResult"`.
- Test asserts chance-based action config covers `contestType: "opposed"`, `formula: "ratio"`, bounds min/max 5/95, critical thresholds 5/95, actorSkill `skills:grappling_skill.value` default 10, targetSkill `skills:defense_skill.value` default 0 with `targetRole: "primary"`.
- Test enumerates four IF branches keyed to CRITICAL_SUCCESS, SUCCESS, FAILURE, FUMBLE with the exact message strings from the spec.
- Commands: `npm run test:integration -- tests/integration/mods/physical-control/restrainTargetOutcomeResolution.test.js` passes; `npm run lint` passes.

## Outcome

- Added `tests/integration/mods/physical-control/restrainTargetOutcomeResolution.test.js` to validate RESOLVE_OUTCOME wiring, action chance-based configuration (including bounds/thresholds), and all four outcome branch messages.
- No rule or content changes were required; only test coverage was added and ticket assumptions were corrected to match the current RESOLVE_OUTCOME capabilities and action target role.

### Invariants

- No modifications to existing weapons/physical-control integration tests aside from adding the new file.
- Rule/event IDs remain unchanged; test fixtures do not introduce new helper utilities.
