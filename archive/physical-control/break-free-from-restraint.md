# Break Free From Restraint (physical-control)

## Background
- `data/mods/physical-control/actions/restrain_target.action.json` plus `rules/handle_restrain_target.rule.json` create the restraining relationship: on success they add `positioning:being_restrained` to the target, `positioning:restraining` to the actor, and lock both grabbing appendages. The action is chance-based with a ratio contest (actor `skills:grappling_skill` vs target `skills:defense_skill`).
- The positioning components define the linkage: `being_restrained.component.json` stores `restraining_entity_id`, while `restraining.component.json` stores `restrained_entity_id` and an `initiated` flag. These IDs are the canonical thread we should use for any break-free logic rather than proximity scopes.
- Positioning scopes such as `actors_im_facing_away_from.scope` (filters facing-away targets within closeness) and `actor_im_straddling.scope` (resolves a single entity ID from component data) show the current patterns for target derivation. For breaking free we need a scope that mirrors the latter approach: pull the restraining entity ID directly from the actor’s `being_restrained` component instead of broad location sweeps.

## Goals
- Add a new physical-control action/rule pair that is the inverse of `restrain_target`: an actor who is restrained can attempt to break the restraint and free themselves.
- Action template: `break free from {target} ({chance}% chance)`.
- Acting actor must have `positioning:being_restrained` (required component). Primary target resolves to the restraining entity referenced by that component via a new scope in `data/mods/physical-control/scopes/`.
- Rule outcomes (non-deterministic):  
  - **CRITICAL_SUCCESS:** message `{actor} breaks free from {target}'s grip, and during the struggle, {target} falls to the ground.` Remove `positioning:being_restrained` from actor, remove `positioning:restraining` from target, add `positioning:fallen` to target.  
  - **SUCCESS:** message `{actor} breaks free from {target}'s grip.` Remove `positioning:being_restrained` from actor and `positioning:restraining` from target.  
  - **FAILURE** and **FUMBLE:** message `{actor} tries to break free from {target}'s grip, but fails to release themselves.` No component changes.  
  - In success paths, also unlock the target’s grabbing appendages that were locked when restraining (mirroring the `LOCK_GRABBING` usage in `handle_restrain_target`).
- Require comprehensive tests for action discoverability and rule behavior. Reuse patterns from existing restrain_target tests and other mod integration suites under `tests/integration/mods/`.

## Action: `physical-control:break_free_from_restraint`
- File: `data/mods/physical-control/actions/break_free_from_restraint.action.json`; add to manifest content list.
- `name`: “Break Free From Restraint”; `template` as above; `description`: short note about attempting to escape a restraint.
- `required_components.actor`: `["positioning:being_restrained"]` (no forbidden components by default).
- Targets: `primary.scope` is the new scope resolving the restraining entity; placeholder `target`. No secondary targets.
- Chance-based contest: mirror the restrain ratio setup but invert roles—actor uses `skills:defense_skill` (default 0 or 10?) and target uses `skills:grappling_skill` (default 10). Keep bounds and critical thresholds consistent with `restrain_target` unless balancing suggests a tweak; keep `generateCombinations: false` (single target from the scope).
- Visual/style: align with other physical-control actions (can reuse the same visual block from restrain_target for consistency).

## Scope: restraining entity resolver
- File: `data/mods/physical-control/scopes/restraining_entity_from_being_restrained.scope` (add to manifest content).
- Logic: given an actor, return a Set containing the entity ID found at `actor.components.positioning:being_restrained.restraining_entity_id` if that entity exists. If the actor lacks the component or the ID is missing/invalid, return an empty set.
- Follow the pattern of `actor_im_straddling.scope` (direct entity ID resolution) rather than proximity filters like `actors_im_facing_away_from.scope`.
- Guard rails: optionally confirm the referenced entity still has `positioning:restraining` pointing back to the actor; omit the target if the mutual link is broken.

## Condition
- File: `data/mods/physical-control/conditions/event-is-action-break-free-from-restraint.condition.json`; add to manifest.
- Logic: `event.payload.actionId === "physical-control:break_free_from_restraint"`.

## Rule: `rules/handle_break_free_from_restraint.rule.json`
- Event: `core:attempt_action` gated by the new condition.
- Pre-work: `GET_NAME` for actor/target, `QUERY_COMPONENT` for actor position (locationId for messaging), `RESOLVE_OUTCOME` using the chance configuration from the action (store as `breakFreeResult`).
- Shared variables: `locationId`, `perceptionType` = `action_target_general`, `targetId` = restraining entity.
- Outcome branches:  
  - **CRITICAL_SUCCESS:** remove `positioning:being_restrained` from actor; remove `positioning:restraining` from target; `UNLOCK_GRABBING` for target’s hands locked with actor’s ID; add `positioning:fallen` to target; regenerate descriptions for both; dispatch perceptible event with the critical-success message; end turn with success macro.  
  - **SUCCESS:** same removals and unlock, no fallen component; success message; regenerate descriptions; success macro.  
  - **FAILURE/FUMBLE:** no component changes; dispatch failure message; end turn with failure macro (use the same log message for both outcomes).  
  - Ensure idempotence when components are already missing (e.g., if the restraining entity removed the status mid-resolution) by skipping removals silently and logging the outcome text.

## Tests (add under `tests/integration/mods/physical-control/`)
- **Action discovery:** mirror `restrain_target_action_discovery.test.js` but for `break_free_from_restraint`. Cover:  
  - Action available when actor has `positioning:being_restrained` and the referenced restraining entity exists in the same test fixture.  
  - Action not offered when the actor lacks the component, or when the component points to a non-existent entity, or when the restraining entity no longer has `positioning:restraining` linking back.  
  - Scope returns exactly the restraining entity and no other actors in location.
- **Rule wiring:** analogous to `restrain_target_rule_validation.test.js` to assert `rule_id`, event/condition IDs, and that referenced files exist in the manifest.
- **Outcome behavior:** similar to `restrainTargetOutcomeResolution.test.js`. Validate per-outcome effects:  
  - Critical success removes both components, adds `positioning:fallen` to target, unlocks grabbing, and logs the critical message.  
  - Success removes both components and unlocks grabbing with the success message.  
  - Failure/Fumble leave components intact and share the failure message.  
  - Components/descriptions regenerate without throwing when components are absent (edge case coverage).  
  - Include energy/end-turn assertions consistent with existing macros if applicable.

## Implementation notes
- Update `data/mods/physical-control/mod-manifest.json` content arrays to include the new action, rule, condition, and scope.
- Reuse existing helper macros (`core:logSuccessOutcomeAndEndTurn`, `core:logFailureOutcomeAndEndTurn`) for parity with restrain_target. Keep perception type consistent (`action_target_general`).
- Keep schema IDs aligned with the positioning components; do not introduce new component schema for this feature. Use defaults from `being_restrained`/`restraining` when regenerating descriptions.
