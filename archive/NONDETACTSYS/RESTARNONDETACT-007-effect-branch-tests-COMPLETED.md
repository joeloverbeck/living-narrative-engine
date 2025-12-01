# RESTARNONDETACT-007: Restrain Effect Branch Tests

## Scope Correction
`handle_restrain_target.rule.json` already implements the SUCCESS/CRITICAL_SUCCESS/FAILURE/FUMBLE side effects, and integration coverage for those branches lives in `tests/integration/mods/physical-control/restrain_target_rule_validation.test.js`. Work here is to keep that coverage aligned with the rule (adjusting the existing test file only if gaps are found), not to add a new effect-branch test file.

## Description
Ensure the integration test for `handle_restrain_target.rule.json` continues to assert the side effects and messaging for all four outcomes, matching the current rule shape. Update the rule only if a drift between expectations and implementation is uncovered.

## Expected File List
- `tests/integration/mods/physical-control/restrain_target_rule_validation.test.js` (verify/adjust for coverage)
- `data/mods/physical-control/rules/handle_restrain_target.rule.json` (only if test findings require alignment)

## Out of Scope
- Outcome resolution configuration assertions (covered separately).
- Action discovery tests.
- Changes to gameplay content or rule JSON beyond what’s necessary to satisfy branch expectations.

## Acceptance Criteria
- SUCCESS/CRITICAL_SUCCESS assertions cover adding `positioning:being_restrained` (target) and `positioning:restraining` (actor with `initiated: true`), regenerating descriptions for both entities, dispatch/log messaging, and `LOCK_GRABBING` with `actor_id: actor`, `count: 2`, `item_id` referencing the target.
- FAILURE assertions confirm no new components/locks are applied and the failure message is dispatched/logged with the failure macro.
- FUMBLE assertions confirm `positioning:fallen` is added to the actor only, with the failure logging macro and correct message.
- Commands: `npm run test:integration -- --runInBand tests/integration/mods/physical-control/restrain_target_rule_validation.test.js` passes; lint passes for touched files.

### Invariants
- No modifications to existing components or macros; tests rely solely on current engine operations.
- Outcome messages remain identical to those defined in the rule; tests do not introduce alternative phrasings.

## Status
Completed.

## Outcome
- Confirmed existing effect-branch coverage already lives in `tests/integration/mods/physical-control/restrain_target_rule_validation.test.js`; no new test file required.
- No rule changes were necessary because the current implementation matches the asserted side effects and messaging.
- Ran `npm run test:integration -- --runInBand tests/integration/mods/physical-control/restrain_target_rule_validation.test.js` successfully.
