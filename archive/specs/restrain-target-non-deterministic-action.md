# Non-Deterministic Restrain Action (physical-control)

## Background
- `data/mods/weapons/actions/swing_at_target.action.json` is the only chance-based action today. Its `handle_swing_at_target.rule.json` resolves an opposed skill contest (`skills:melee_skill` vs `skills:defense_skill`) with ratio formula and four outcomes (CRITICAL_SUCCESS, SUCCESS, FAILURE, FUMBLE).
- We need another non-deterministic action inside `data/mods/physical-control/` that models physically restraining another actor. The action must key off free grabbing appendages (use `anatomy:actor-has-two-free-grabbing-appendages`) and a new grappling skill versus the target’s defense skill (default 0 if absent).
- Successful restraining should add paired components to actor/target (similar to `positioning:hugging` / `positioning:being_hugged`) and consume both grabbing appendages.

## Deliverables
1) New action definition `data/mods/physical-control/actions/restrain_target.action.json` (name/description/template TBD) marked chance-based/opposed and gated by grabbing appendages & grappling skill.  
2) New rule `data/mods/physical-control/rules/handle_restrain_target.rule.json` + condition `event-is-action-restrain-target` wired to `core:attempt_action`, modeled on `handle_swing_at_target.rule.json` flat outcome handling.  
3) New skill component `data/mods/skills/components/grappling_skill.component.json`.  
4) New positioning components `data/mods/positioning/components/restraining.component.json` and `.../being_restrained.component.json` shaped after hugging/being_hugged.  
5) Mod manifest updates for `physical-control`, `skills`, and `positioning` to list the new assets.  
6) Integration tests covering action discoverability and rule behavior (including all four outcomes), following `tests/integration/mods/weapons/*swing*` patterns and `tests/integration/mods/physical-control/` conventions.

## Action: restrain_target (physical-control)
- `id`: `physical-control:restrain_target`; `name`: “Restrain Target”; `description`: “Attempt to physically restrain a target, preventing free movement.”
- `generateCombinations`: true.
- `required_components.actor`: include `skills:grappling_skill` (actor must know how to grapple). Consider also requiring `core:position` if rule needs location lookup (mirrors other phys-control rules).
- `prerequisites`: single entry using `anatomy:actor-has-two-free-grabbing-appendages` with failure message like “You need two free grabbing appendages to restrain someone.”
- `targets`: primary scope `core:actors_in_location` (`placeholder: "target"`). If a weapon is not needed, keep single target to simplify outcome logging.
- `chanceBased`: enabled, `contestType: "opposed"`, `formula: "ratio"`, bounds min/max copy swing_at_target (5/95).  
  - `actorSkill`: component `skills:grappling_skill`, property `value`, default 10.  
  - `targetSkill`: component `skills:defense_skill`, property `value`, default 0, `targetRole: "target"`.  
  - `outcomes`: thresholds same as swing (criticalSuccessThreshold 5, criticalFailureThreshold 95) unless otherwise required.
- Template: e.g., `restrain {target} ({chance}% chance)`. Message strings live in rule outcome handling.

## Components
- `skills:grappling_skill` (data/mods/skills/components/grappling_skill.component.json)  
  - Mirror structure of `skills:defense_skill`: integer `value` 0–100, default 0, description notes its use for physical grapples/restrains.
- `positioning:restraining` (actor state)  
  - Use hugging.component.json as shape guide. Required field for referenced target, e.g., `restrained_entity_id` (string with same pattern as hugging) plus optional `activityMetadata` mirroring hugging (template like `{actor} is restraining {target}`, targetRole `restrained_entity_id`, priority slightly above being_restrained). Add optional `initiated`/`consented` booleans if we want symmetry; keep additionalProperties false.
- `positioning:being_restrained` (target state)  
  - Mirror being_hugged.component.json: required `restraining_entity_id`, optional `consented`, `activityMetadata` (template `{actor} is restrained by {target}`, targetRole `restraining_entity_id`, priority a few points lower than restraining to maintain ordering). Pattern validation same as hugging components.

## Rule: handle_restrain_target
- Subscribe to `core:attempt_action` guarded by new condition `physical-control:event-is-action-restrain-target` (mirrors existing event-is-action-*.condition.json files).
- Early context setup: GET_NAME for actor/target, QUERY_COMPONENT for actor position (locationId), and RESOLVE_OUTCOME with grappling vs defense (default 10 vs 0) matching action chance settings. Store result as `restrainResult`.
- Common variables for end-turn macros: `locationId`, `perceptionType: action_target_general`, `targetId: {event.payload.targetId}`.
- Outcome branches (flat IF blocks like handle_swing_at_target):
  - CRITICAL_SUCCESS and SUCCESS (shared message): `{actor} restrains {target}, preventing them from moving freely.`  
    - ADD_COMPONENT to target: `positioning:being_restrained` with `restraining_entity_id: actorId`.  
    - ADD_COMPONENT to actor: `positioning:restraining` with `restrained_entity_id: targetId` (and any flags such as `initiated: true`).  
    - EXECUTE `LOCK_GRABBING` with `actor_id: actor`, `count: 2`, `target_entity_id: target` (occupies both grabbing appendages).  
    - DISPATCH_PERCEPTIBLE_EVENT with above message, actor/target IDs.  
    - SET_VARIABLE logMessage to same text; macro `core:logSuccessOutcomeAndEndTurn`.
  - FAILURE message: `{actor} attempts to restrain {target}, but {target} resists, remaining free to move.`  
    - No components or locks; dispatch/log failure message; macro `core:logFailureOutcomeAndEndTurn`.
  - FUMBLE message: `{actor} attempts to restrain {target}, but during the struggle, {actor} falls to the ground.`  
    - ADD_COMPONENT to actor: `positioning:fallen` (id `positioning:fallen.component.json` already exists).  
    - Dispatch/log message; macro `core:logFailureOutcomeAndEndTurn`.
- Include REGENERATE_DESCRIPTION calls for actor/target after component changes (as done in other phys-control rules) to keep activity summaries current.

## Mod & Content Wiring
- Update `data/mods/physical-control/mod-manifest.json` to register the new action, rule, and condition.
- Update `data/mods/skills/mod-manifest.json` to list `grappling_skill.component.json`.
- Update `data/mods/positioning/mod-manifest.json` to list `restraining` and `being_restrained` components.
- Add new condition file `data/mods/physical-control/conditions/event-is-action-restrain-target.condition.json` (id `physical-control:event-is-action-restrain-target`, equality check on action id like existing ones).

## Testing
- Add integration tests under `tests/integration/mods/physical-control/`:
  - Action discovery: verify `restrain_target.action.json` is discoverable when actor has `skills:grappling_skill` and passes `actor-has-two-free-grabbing-appendages`; absent otherwise. Follow structure of `swing_at_target_action_discovery.test.js` and existing phys-control discovery tests.
  - Outcome resolution: mirror `tests/integration/mods/weapons/swingAtTargetOutcomeResolution.test.js` to assert RESOLVE_OUTCOME config (grappling vs defense, default 0 target skill), four IF branches, and message strings.
  - Effect branches: specific tests to ensure SUCCESS/CRITICAL_SUCCESS add `being_restrained` to target, `restraining` to actor, and issue `LOCK_GRABBING` with `count: 2` referencing target; FAILURE adds nothing; FUMBLE adds `positioning:fallen` to actor. Use patterns from `swingAtTargetFumbleWeaponDrop.test.js` for branch assertions.
- Ensure tests import components/actions/rules via JSON assertions, not engine runtime. Keep coverage purely structural/behavioral in integration layer consistent with repo convention.

## Notes
- Treat `skills:defense_skill` as zero when absent (as in action defaults); no extra component creation needed on targets.
- Keep messaging identical for CRITICAL_SUCCESS and SUCCESS as requested; if localization templates are centralized later, consider reusing template strings from the rule to avoid divergence.
