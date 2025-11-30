# RESTARNONDETACT-004: Restrain Target Rule and Condition

## Description
Implement handling for the restrain action, including a new condition `physical-control:event-is-action-restrain-target` subscribed to `core:attempt_action`, and a flat-outcome rule `handle_restrain_target.rule.json` patterned after `handle_swing_at_target`. Rule must resolve opposed outcome (grappling vs defense), branch on CRITICAL_SUCCESS/SUCCESS/FAILURE/FUMBLE with specified messages, add/remove components, lock grabbing appendages, regenerate descriptions, and dispatch perceptible events/logging macros. Update the physical-control mod manifest to register the rule and condition.

## Expected File List
- `data/mods/physical-control/conditions/event-is-action-restrain-target.condition.json` (Add)
- `data/mods/physical-control/rules/handle_restrain_target.rule.json` (Add)
- `data/mods/physical-control/mod-manifest.json` (Modify: register rule and condition)

## Out of Scope
- Action definition JSON (handled separately).
- New positioning/skill components or their manifests.
- Test creation.

## Acceptance Criteria
- Condition checks equality against `physical-control:restrain_target` in event payload, consistent with other phys-control `event-is-action-*` conditions.
- Rule subscribes to `core:attempt_action`, sets up actor/target names, location lookup, and RESOLVE_OUTCOME defaults (actor grappling default 10, target defense default 0) matching action JSON thresholds.
- SUCCESS/CRITICAL_SUCCESS branch: adds `positioning:being_restrained` to target and `positioning:restraining` to actor, locks two grabbing appendages against target, regenerates descriptions, dispatches/logs message `{actor} restrains {target}, preventing them from moving freely.`, and ends turn via `core:logSuccessOutcomeAndEndTurn` macro.
- FAILURE branch: logs/displays `{actor} attempts to restrain {target}, but {target} resists, remaining free to move.` with no component or lock changes; ends turn via failure macro.
- FUMBLE branch: logs/displays `{actor} attempts to restrain {target}, but during the struggle, {actor} falls to the ground.` and adds `positioning:fallen` to actor only; ends turn via failure macro.
- Regenerate descriptions for actor/target after component mutations as done in other phys-control rules.
- Commands: `npm run lint` and `npm run validate:quick` pass.

### Invariants
- Swing-at-target and other existing phys-control rules/conditions remain unchanged.
- No new macros introduced; reuse existing `LOCK_GRABBING`, `DISPATCH_PERCEPTIBLE_EVENT`, and logging/end-turn macros.
