# Caressing Bare Back Action Specification

## Overview

Introduce a new caressing interaction where the actor sensually touches the bare skin of the primary target's back. Existing caressing actions consistently require actors to be in closeness, reuse the purple visual palette, and tailor scope filters to the gesture being performed, so the new work should extend those conventions while ensuring the target's back is uncovered for true skin contact.【F:data/mods/caressing/actions/adjust_clothing.action.json†L2-L39】【F:data/mods/caressing/actions/caress_abdomen.action.json†L2-L39】【F:data/mods/caressing/actions/run_fingers_through_hair.action.json†L2-L18】

## Current Patterns and Constraints

- **Target scoping** – Clothing-aware gestures gate availability through scopes that first resolve close partners and then filter on clothing or posture, such as `caressing:close_actors_facing_each_other_with_torso_clothing`. Orientation-flexible gestures reuse `caressing:close_actors_facing_each_other_or_behind_target` so actors can interact while standing behind or face to face.【F:data/mods/caressing/scopes/close_actors_facing_each_other_with_torso_clothing.scope†L1-L8】【F:data/mods/caressing/scopes/close_actors_facing_each_other_or_behind_target.scope†L1-L8】
- **Uncovered anatomy checks** – Scopes that require exposed anatomy pair `hasPartOfType` with `not` `isSocketCovered`, ensuring the relevant socket is bare before surfacing the action, as seen in `sex-core:actor_kneeling_before_target_with_penis`. This is the precedent to follow for verifying bare skin on the target's back.【F:data/mods/sex-core/scopes/actor_kneeling_before_target_with_penis.scope†L1-L14】
- **Back socket coverage** – The humanoid slot library maps the `upper_back` and `lower_back` anatomy sockets used by garments and accessories; both sockets must be uncovered to guarantee full back exposure for caressing.【F:data/mods/anatomy/libraries/humanoid.slot-library.json†L123-L171】

## Scope Requirements

Create a new scope file `data/mods/caressing/scopes/close_actors_with_uncovered_back.scope` (final name may vary, but must be namespaced under `caressing:`) that:

1. Starts from the actor's `positioning:closeness.partners` array, matching the pattern used by other caressing proximity scopes.【F:data/mods/caressing/scopes/close_actors_facing_each_other_with_torso_clothing.scope†L3-L8】
2. Allows targets when either both actors face each other or the actor is positioned behind the target, mirroring the OR block in `close_actors_facing_each_other_or_behind_target`.【F:data/mods/caressing/scopes/close_actors_facing_each_other_or_behind_target.scope†L3-L8】
3. Adds `not` `isSocketCovered` checks for both `upper_back` and `lower_back` on each partner entity, guaranteeing bare skin by confirming neither socket is covered, following the uncovered anatomy approach used in the kneeling scope.【F:data/mods/sex-core/scopes/actor_kneeling_before_target_with_penis.scope†L3-L14】【F:data/mods/anatomy/libraries/humanoid.slot-library.json†L123-L171】
4. Includes brief documentation comments explaining the orientation flexibility and uncovered-back requirement for future maintainers.
5. Register the new scope inside `data/mods/caressing/mod-manifest.json` so it becomes available to the action discovery pipeline.

## Action Requirements

Author `data/mods/caressing/actions/caress_bare_back.action.json` with the standard caressing schema shape and values:

- `$schema`: `schema://living-narrative-engine/action.schema.json`.
- `id`: `caressing:caress_bare_back`.
- `name`: `Caress Bare Back`.
- `description`: One-sentence summary of sensually touching the target's bare back.
- `targets.primary`: Use the new uncovered-back scope with placeholder `primary` and description clarifying the exposed back requirement.
- `template`: **Exactly** `caress the bare skin of {primary}'s back` per design request.
- `required_components.actor`: `["positioning:closeness"]`, matching the rest of the caressing suite.【F:data/mods/caressing/actions/adjust_clothing.action.json†L19-L22】
- `forbidden_components`: Omit arrays to reflect that no additional blockers apply (leave empty objects or remove sections consistent with single-target caressing files). Compare with `run_fingers_through_hair.action.json` for minimal structure.【F:data/mods/caressing/actions/run_fingers_through_hair.action.json†L6-L15】
- `prerequisites`: Mirror the closeness prerequisite message used by other caressing actions unless an empty array is chosen; ensure messaging stays consistent across the mod.【F:data/mods/caressing/actions/caress_abdomen.action.json†L26-L33】
- `visual`: Reuse the standard purple color palette seen across the caressing actions for UI continuity.【F:data/mods/caressing/actions/adjust_clothing.action.json†L34-L38】
- Append the action ID to `data/mods/caressing/mod-manifest.json`.

## Rule Requirements

Follow the storytelling cadence established by `caressing:caress_abdomen` when implementing the new rule JSON:

1. Place the rule at `data/mods/caressing/rules/caress_bare_back.rule.json` (or `handle_caress_bare_back.rule.json` if matching the existing naming scheme).
2. `rule_id`: `handle_caress_bare_back` with a descriptive `comment`.
3. `event_type`: `core:attempt_action`.
4. `condition`: `{ "condition_ref": "caressing:event-is-action-caress-bare-back" }`, requiring a new condition file `data/mods/caressing/conditions/event-is-action-caress-bare-back.condition.json` mirroring existing patterns.
5. Action sequence:
   - `GET_NAME` for actor and primary target, storing `actorName` and `primaryName`.
   - `QUERY_COMPONENT` for the actor's `core:position` to retrieve `actorPosition.locationId`.
   - `SET_VARIABLE` `logMessage` to `{context.actorName} sensually caresses the bare skin of {context.primaryName}'s back.` exactly, ensuring both perceptible and success logs share the same text.
   - `SET_VARIABLE` `perceptionType` to `action_target_general`.
   - `SET_VARIABLE` `locationId` to `{context.actorPosition.locationId}`.
   - `SET_VARIABLE` `targetId` to `{event.payload.primaryId}`.
   - Invoke `{ "macro": "core:logSuccessAndEndTurn" }` to finish the turn, matching the abdomen rule flow.【F:data/mods/caressing/rules/caress_abdomen.rule.json†L2-L63】
6. Register the new rule and condition in the caressing manifest.

## Testing Requirements

Create comprehensive integration coverage under `tests/integration/mods/caressing/` using the Test Module Pattern described in the mod testing guide.【F:docs/testing/mod-testing-guide.md†L1-L138】 Build on existing caressing suites to validate both discoverability and rule execution.【F:tests/integration/mods/caressing/cup_chin_action_discovery.test.js†L1-L159】【F:tests/integration/mods/caressing/adjust_clothing_action.test.js†L1-L94】

1. **Action discoverability** – Add `caress_bare_back_action_discovery.test.js` that indexes the new action, injects custom scope resolver hooks if necessary, and proves availability when the target is either facing the actor or has the actor positioned behind them with an uncovered back. Include negative assertions for covered backs, missing closeness, or incorrect orientation.
2. **Rule behavior** – Add `caress_bare_back_action.test.js` ensuring the perceptible event and successful action messages both read `{actor} sensually caresses the bare skin of {primary}'s back.`, with correct `perceptionType`, `locationId`, `actorId`, and `targetId`. Confirm the rule only triggers for the specified `actionId` and ends the actor's turn, consistent with other caressing rule tests.
3. Run `npm run test:integration` locally and update documentation if any new helpers are introduced, respecting the repository policy that no PR should be opened until the suites pass.

## Acceptance Criteria

- New scope enforces closeness, orientation flexibility, and uncovered back sockets before exposing the target.
- Action, condition, and rule artifacts exist, validate against schemas, and share the standard caressing messaging and visual presentation.
- Mod manifest lists the new scope, action, condition, and rule to guarantee runtime registration.
- Integration suites demonstrate discoverability and rule execution using the latest mod testing methodology, with all integration tests passing.
