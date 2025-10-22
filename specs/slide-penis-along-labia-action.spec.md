# Slide Penis Along Labia Sex Action Specification

## Overview

Expand the `sex-vaginal-penetration` mod's teasing repertoire with an explicit penis-on-labia interaction that complements existing foreplay actions such as breathing on or licking a penis and grinding clothed anatomy. These actions share a consistent purple visual palette, rely on closeness, and differ mainly in anatomical targeting, providing strong implementation templates for copy depth, required components, and schema usage.【F:data/mods/sex-penile-oral/actions/breathe_teasingly_on_penis.action.json†L1-L24】【F:data/mods/sex-penile-oral/actions/lick_glans.action.json†L1-L24】【F:data/mods/sex-dry-intimacy/actions/rub_pussy_against_penis_through_clothes.action.json†L1-L30】

The new interaction must keep the same Ember Touch visual scheme as `sex-penile-manual:pump_penis` while adjusting anatomical requirements to focus on an uncovered vagina. Its scope logic should mirror `sex-core:actors_with_penis_facing_each_other` for anatomy checks and kneeling exclusions, but add the orientation flexibility provided by `positioning:close_actors_facing_each_other_or_behind_target` so the action can trigger both face-to-face and when the actor is behind a forward-facing partner.【F:data/mods/sex-penile-manual/actions/pump_penis.action.json†L1-L24】【F:data/mods/sex-core/scopes/actors_with_penis_facing_each_other.scope†L1-L11】【F:data/mods/positioning/scopes/close_actors_facing_each_other_or_behind_target.scope†L1-L15】

## Scope Requirements

Author `data/mods/sex-vaginal-penetration/scopes/actors_with_uncovered_vagina_facing_each_other_or_target_facing_away.scope` to gate the new action. Base the file on the penis-facing scope and orientation mixin described above.

- Declare `sex-vaginal-penetration:actors_with_uncovered_vagina_facing_each_other_or_target_facing_away := actor.components.positioning:closeness.partners[][{ ... }]`.
- Inside the `and` array:
  - Require `{"hasPartOfType": [".", "vagina"]}`.
  - Require the target's vagina socket to be uncovered via `{"not": {"isSocketCovered": [".", "vagina"]}}`.
  - Add an `or` branch matching either `positioning:both-actors-facing-each-other` or `positioning:actor-is-behind-entity`, duplicating the structure from the positioning scope so the acting entity can align behind a partner who is facing away.
  - Copy the kneeling exclusions (`positioning:entity-kneeling-before-actor` and `positioning:actor-kneeling-before-entity`) to remain compatible with face-to-face standing or upright-from-behind play.
- Use scope comments explaining the uncovered requirement, orientation flexibility, and why kneeling is excluded, matching the documentation tone of the existing sex scopes.【F:data/mods/sex-core/scopes/actors_with_penis_facing_each_other.scope†L1-L11】【F:data/mods/positioning/scopes/close_actors_facing_each_other_or_behind_target.scope†L1-L15】

Register the new scope in `data/mods/sex-vaginal-penetration/mod-manifest.json` alongside the other scope entries for discoverability parity.

## Action Requirements

Implement `data/mods/sex-vaginal-penetration/actions/slide_penis_along_labia.action.json` using `sex-penile-manual:pump_penis` as the structural reference for metadata, component requirements, and palette consistency.【F:data/mods/sex-penile-manual/actions/pump_penis.action.json†L1-L24】

- `$schema`: `schema://living-narrative-engine/action.schema.json`.
- `id`: `sex-vaginal-penetration:slide_penis_along_labia`.
- `name`: `Slide Penis Along Labia`.
- `description`: Emphasize sliding the actor's penis along the target's bare labia while teasing arousal.
- `targets.primary`:
  - `scope`: `sex-vaginal-penetration:actors_with_uncovered_vagina_facing_each_other_or_target_facing_away`.
  - `placeholder`: `target`.
  - `description`: Clarify that the target must have an uncovered vagina that the actor can tease.
- `required_components.actor`: `["positioning:closeness"]` only—no kneeling, straddling, or other additions.
- `template`: **exactly** `slide your penis along {target}'s labia` as requested.
- `prerequisites`: empty array.
- `visual`: Copy the Ember Touch palette from `sex-penile-manual:pump_penis` (`#8a3b12` background, `#fff4e6` text, `#a04a1b` hover background, `#fffaf2` hover text).

Update the `sex-vaginal-penetration` manifest to include the new action file path so ModTestFixture auto-loads it during integration tests.

## Condition Requirements

Follow the established pattern (`sex-penile-manual:event-is-action-pump-penis`) and add `data/mods/sex-vaginal-penetration/conditions/event-is-action-slide-penis-along-labia.condition.json` with:

- `$schema`: `schema://living-narrative-engine/condition.schema.json`.
- `id`: `sex-vaginal-penetration:event-is-action-slide-penis-along-labia`.
- `description`: Note it checks for the new action.
- `logic`: Equality between `event.payload.actionId` and `sex-vaginal-penetration:slide_penis_along_labia`.

Remember to register the condition in the `sex-vaginal-penetration` manifest conditions array.【F:data/mods/sex-vaginal-penetration/conditions/event-is-action-slide-penis-along-labia.condition.json†L1-L10】

## Rule Requirements

Create `data/mods/sex-vaginal-penetration/rules/handle_slide_penis_along_labia.rule.json` modeled on the pump penis handler while adjusting target references. Reuse the same variable sequencing (`GET_NAME` actor, `GET_NAME` target, `QUERY_COMPONENT` actor position) before composing the log message.【F:data/mods/sex-dry-intimacy/rules/handle_rub_pussy_against_penis_through_clothes.rule.json†L1-L68】

- `rule_id`: `handle_slide_penis_along_labia`.
- `comment`: "Handles the 'sex-vaginal-penetration:slide_penis_along_labia' action. Dispatches descriptive text and ends the turn.".
- `event_type`: `core:attempt_action`.
- `condition`: `{ "condition_ref": "sex-vaginal-penetration:event-is-action-slide-penis-along-labia" }`.
- `actions` array:
  1. `GET_NAME` actor → `actorName`.
  2. `GET_NAME` target → `targetName`.
  3. `QUERY_COMPONENT` actor `core:position` → `actorPosition`.
  4. `SET_VARIABLE` `logMessage` to **exactly** `{context.actorName} slides their penis teasingly along {context.targetName}'s bare labia.`
  5. `SET_VARIABLE` `perceptionType` → `action_target_general`.
  6. `SET_VARIABLE` `locationId` → `{context.actorPosition.locationId}`.
  7. `SET_VARIABLE` `targetId` → `{event.payload.targetId}`.
  8. `{ "macro": "core:logSuccessAndEndTurn" }`.

Ensure both the perceptible event description and the successful action message hydrate to `{actor} slides their penis teasingly along {target}'s bare labia.` to fulfill the narrative requirement. Register the rule in the mod manifest.

## Testing Specification

Author comprehensive integration suites beneath `tests/integration/mods/sex-vaginal-penetration/`, using the existing penetration suites (`slide_penis_along_labia_action.test.js`, `slide_penis_along_labia_action_discovery.test.js`, etc.) as implementation references for fixtures, assertions, and anatomy builders.【F:tests/integration/mods/sex-vaginal-penetration/slide_penis_along_labia_action.test.js†L1-L180】【F:tests/integration/mods/sex-vaginal-penetration/slide_penis_along_labia_action_discovery.test.js†L1-L170】 Complement these with the updated methodologies in the Mod Testing Guide for builder orchestration and scenario presets.【F:docs/testing/mod-testing-guide.md†L1-L160】

1. **Action Discoverability** — `slide_penis_along_labia_action_discovery.test.js`
   - Load the new action via `ModTestFixture.forAction` and manually build the action index with the JSON artifact, mirroring the pattern used by other discovery suites.
   - Stub or implement a resolver for the new scope (if required) to confirm availability in both orientation scenarios: actors facing each other and the actor behind a target who is facing away.
   - Assert the action appears only when the target's vagina is present, uncovered, and the pair shares `positioning:closeness`. Include negative cases for covered vaginas, missing closeness, or kneeling conflicts.

2. **Rule Behavior** — `slide_penis_along_labia_action.test.js`
   - Use auto-loaded manifests to execute the action and verify the success and perceptible messages match `{actor} slides their penis teasingly along {target}'s bare labia.`
   - Confirm the rule ends the actor's turn, sets `perceptionType` to `action_target_general`, and maps `locationId`, `actorId`, and `targetId` to the acting pair.
   - Add regression coverage ensuring the rule does not trigger for other action IDs and behaves safely when entities are missing, matching the thoroughness of the pump penis rule tests.

Run `npm run test:integration` after implementing the action, scope, condition, rule, and tests to ensure all suites pass without regressions.

## Acceptance Criteria

- Scope enforces uncovered vagina anatomy plus dual-orientation positioning and is manifest-registered.
- Action JSON, condition, and rule exist with the prescribed IDs, template, palette, and messaging, and the manifest lists all new assets.
- Integration suites cover discoverability and rule execution (including success/perceptible parity) using the Test Module Pattern best practices.
- Full integration test run (`npm run test:integration`) succeeds, demonstrating comprehensive coverage for the new interaction.
