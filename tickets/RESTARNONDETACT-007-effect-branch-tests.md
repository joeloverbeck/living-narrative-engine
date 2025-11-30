# RESTARNONDETACT-007: Restrain Effect Branch Tests

## Description
Add integration tests focused on the side effects of each outcome branch in `handle_restrain_target.rule.json`. Cover SUCCESS/CRITICAL_SUCCESS component additions and grabbing locks, FAILURE no-op behavior, and FUMBLE adding `positioning:fallen`. Follow patterns from `swingAtTargetFumbleWeaponDrop.test.js` for asserting dispatched operations/macros.

## Expected File List
- `tests/integration/mods/physical-control/restrainTargetEffectBranches.test.js` (Add)

## Out of Scope
- Outcome resolution configuration assertions (covered separately).
- Action discovery tests.
- Changes to gameplay content or rule JSON beyond what’s necessary to satisfy branch expectations.

## Acceptance Criteria
- SUCCESS/CRITICAL_SUCCESS test asserts additions of `positioning:being_restrained` to target and `positioning:restraining` to actor, regeneration calls for both entities, DISPATCH_PERCEPTIBLE_EVENT log/message alignment, and `LOCK_GRABBING` invocation with `count: 2` referencing target.
- FAILURE test asserts no new components/locks are applied and the failure message is dispatched/logged.
- FUMBLE test asserts `positioning:fallen` is added to actor only, with failure logging macro triggered.
- Commands: `npm run test:integration -- tests/integration/mods/physical-control/restrainTargetEffectBranches.test.js` passes; `npm run lint` passes.

### Invariants
- No modifications to existing components or macros; tests rely solely on current engine operations.
- Outcome messages remain identical to those defined in the rule; tests do not introduce alternative phrasings.
