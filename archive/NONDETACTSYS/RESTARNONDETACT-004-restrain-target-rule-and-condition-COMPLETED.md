# RESTARNONDETACT-004: Restrain Target Rule and Condition

## Status
Completed.

## Description
Implement runtime handling for the already-added `physical-control:restrain_target` action. Create the missing condition `physical-control:event-is-action-restrain-target` and a flat-outcome rule `handle_restrain_target.rule.json` (modeled on `handle_swing_at_target`) that resolves an opposed contest (grappling vs defense) and applies the restraining effects. Wire the physical-control manifest to include the new assets.

## Current Findings
- Action, skill, and positioning components already exist (`restrain_target.action.json`, `skills:grappling_skill`, `positioning:restraining` / `being_restrained`), and the mod manifest already references the action but **not** the rule/condition.
- No rule currently handles the restrain attempt; no condition subscribes to `core:attempt_action` for this action.
- Only action discovery coverage exists (`tests/integration/mods/physical-control/restrain_target_action_discovery.test.js`); rule behavior is untested.

## Scope (Updated)
- Add `event-is-action-restrain-target.condition.json` mirroring other phys-control `event-is-action-*` files (equality on `event.payload.actionId`).
- Add `handle_restrain_target.rule.json` subscribed to `core:attempt_action`, using actor/target naming, actor position lookup, and `RESOLVE_OUTCOME` (grappling default 10 vs defense default 0, ratio formula) stored as `restrainResult`.
- Outcome handling:
  - CRITICAL_SUCCESS/SUCCESS: add `positioning:being_restrained` to target and `positioning:restraining` (with `initiated: true`) to actor, lock two grabbing appendages against the target, regenerate actor/target descriptions, dispatch/log `{actor} restrains {target}, preventing them from moving freely.`, then `core:logSuccessOutcomeAndEndTurn`.
  - FAILURE: dispatch/log `{actor} attempts to restrain {target}, but {target} resists, remaining free to move.`, no component or lock changes, then `core:logFailureOutcomeAndEndTurn`.
  - FUMBLE: add `positioning:fallen` to actor only, dispatch/log `{actor} attempts to restrain {target}, but during the struggle, {actor} falls to the ground.`, then `core:logFailureOutcomeAndEndTurn`.
- Set shared variables for end-turn macros (`locationId` from actor position, `perceptionType: action_target_general`, `targetId: {event.payload.targetId}`) and reuse existing macros (`LOCK_GRABBING`, `DISPATCH_PERCEPTIBLE_EVENT`, description regeneration).
- Update `data/mods/physical-control/mod-manifest.json` to register the new rule and condition alongside the existing action entry.
- Add integration tests for the rule wiring/outcomes (mirroring swing-at-target rule coverage) since none exist yet; keep existing discovery test intact.

## Out of Scope
- Changing the restrain action JSON, grappling/positioning component schemas, or other mods.
- Introducing new macros or altering existing phys-control rules.

## Acceptance Criteria
- Condition equality check matches other phys-control event conditions.
- Rule resolves the opposed contest with defaults matching the action (10 vs 0), populates shared variables, and branches on CRITICAL_SUCCESS/SUCCESS/FAILURE/FUMBLE with the messages above.
- SUCCESS/CRITICAL_SUCCESS applies restraining/being_restrained components, locks two grabbing appendages against the target entity, and regenerates descriptions.
- FAILURE leaves state untouched; FUMBLE adds `positioning:fallen` to the actor only.
- Physical-control manifest lists the new rule and condition.
- Tests cover the new rule wiring and outcome effects; repository tests relevant to the change pass (`npm run validate:quick` and targeted integration tests for the restrain rule; lint may be scoped to touched files if full lint is noisy).

### Invariants
- Existing phys-control rules/conditions and swing-at-target handling stay unchanged.
- Reuse established macros (`LOCK_GRABBING`, `DISPATCH_PERCEPTIBLE_EVENT`, `core:logSuccessOutcomeAndEndTurn`, `core:logFailureOutcomeAndEndTurn`).

## Outcome
- Added `event-is-action-restrain-target.condition.json` and `handle_restrain_target.rule.json` wired to `core:attempt_action`, resolving grappling vs defense with flat CRITICAL_SUCCESS/SUCCESS/FAILURE/FUMBLE handling, appendage locking, description regeneration, and perceptible event logging.
- Updated `data/mods/physical-control/mod-manifest.json` to register the new rule and condition alongside the existing restrain action.
- Added `tests/integration/mods/physical-control/restrain_target_rule_validation.test.js` to cover condition wiring, outcome resolution parameters, branch side effects/messages, and manifest references.
- Commands run: `npx eslint tests/integration/mods/physical-control/restrain_target_rule_validation.test.js`; `npm run validate:quick`; `npm run test:single -- tests/integration/mods/physical-control/restrain_target_rule_validation.test.js` (targeted run without coverage thresholds after coverage-enabled subset run surfaced known global threshold enforcement).
