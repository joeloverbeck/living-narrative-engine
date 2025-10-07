# Push Target Playfully Affection Action Specification

## Overview

Introduce a playful shove interaction in the **affection** mod that mirrors the structure and tone of the existing `ruffle_hair_playfully` implementation. Reuse the shared proximity scope `affection:close_actors_facing_each_other_or_behind_target` and keep the warm, light-hearted presentation already established for affection actions. 【F:data/mods/affection/actions/ruffle_hair_playfully.action.json†L1-L17】【F:data/mods/affection/scopes/close_actors_facing_each_other_or_behind_target.scope†L1-L7】

## Action Requirements

Create `data/mods/affection/actions/push_target_playfully.action.json` by following the patterns used in other affection actions. 【F:data/mods/affection/actions/ruffle_hair_playfully.action.json†L1-L17】【F:data/mods/affection/actions/brush_hand.action.json†L1-L20】

- `$schema`: `schema://living-narrative-engine/action.schema.json`
- `id`: `affection:push_target_playfully`
- `name`: `Push target playfully`
- `description`: Briefly explain the playful shove in a friendly, affectionate tone.
- `targets`: `affection:close_actors_facing_each_other_or_behind_target`
- `required_components.actor`: `["positioning:closeness"]` (no additional requirements unless discoverability tests uncover a need).
- `template`: **exactly** `push {target} playfully`.
- `prerequisites`: keep empty array unless later design work specifies otherwise.
- `visual`: Copy the affection palette (`backgroundColor` `#6a1b9a`, `textColor` `#f3e5f5`, `hoverBackgroundColor` `#8e24aa`, `hoverTextColor` `#ffffff`). 【F:data/mods/affection/actions/ruffle_hair_playfully.action.json†L9-L16】

Remember to register the new action file in `data/mods/affection/mod-manifest.json` alongside the other affection actions. 【F:data/mods/affection/mod-manifest.json†L25-L44】

## Condition Requirements

Add `data/mods/affection/conditions/event-is-action-push-target-playfully.condition.json` mirroring the structure of other action filter conditions (check `event.payload.actionId` against the new action ID). 【F:data/mods/affection/conditions/event-is-action-ruffle-hair-playfully.condition.json†L1-L8】 Include the condition file in the affection manifest `conditions` array.

## Rule Requirements

Implement `data/mods/affection/rules/handle_push_target_playfully.rule.json` based on the standard affection rule flow. 【F:data/mods/affection/rules/handle_ruffle_hair_playfully.rule.json†L1-L34】【F:data/mods/affection/rules/brush_hand.rule.json†L1-L33】

- `rule_id`: `handle_push_target_playfully`.
- `comment`: Follow existing phrasing ("Handles the 'affection:push_target_playfully' action...").
- `event_type`: `core:attempt_action`.
- `condition`: `{ "condition_ref": "affection:event-is-action-push-target-playfully" }`.
- Actions sequence:
  1. `GET_NAME` actor → `actorName`.
  2. `GET_NAME` target → `targetName`.
  3. `QUERY_COMPONENT` actor `core:position` → `actorPosition`.
  4. `SET_VARIABLE` `logMessage` to **exact** string: `{actor} pushes {target} playfully.` rendered as `"{context.actorName} pushes {context.targetName} playfully."`.
  5. `SET_VARIABLE` `perceptionType`: `action_target_general`.
  6. `SET_VARIABLE` `locationId`: `{context.actorPosition.locationId}`.
  7. `SET_VARIABLE` `targetId`: `{event.payload.targetId}`.
  8. `{ "macro": "core:logSuccessAndEndTurn" }`.

Ensure both the perceptible event description and the successful action message use the exact sentence `{actor} pushes {target} playfully.` 【F:data/mods/affection/rules/handle_ruffle_hair_playfully.rule.json†L21-L32】 Add the rule file to the manifest `rules` array.

## Testing Specification

Create comprehensive integration coverage under `tests/integration/mods/affection/` mirroring existing affection test suites. 【F:tests/integration/mods/affection/ruffle_hair_playfully_action_discovery.test.js†L1-L88】【F:tests/integration/mods/affection/ruffle_hair_playfully_action.test.js†L1-L81】

1. **Action Discoverability** — Add `push_target_playfully_action_discovery.test.js` using `ModTestFixture.forAction('affection', 'affection:push_target_playfully')`. Validate:
   - Action JSON metadata (id, template, targets, required components, visual palette).
   - Availability when actors are close and facing/positioned according to `affection:close_actors_facing_each_other_or_behind_target`.
   - Inavailability scenarios when closeness or facing requirements are violated.
2. **Rule Behavior** — Add `push_target_playfully_action.test.js` to execute the rule and assert:
   - Successful action and perceptible event messages both equal `{actor} pushes {target} playfully.`
   - A perceptible event is emitted with `targetId` pointing at the intended target and the expected `perceptionType`.
   - No unexpected events occur (use `assertOnlyExpectedEvents` if appropriate).

Run `npm run test:integration` to confirm the new suites and existing tests pass.

## Acceptance Criteria

- Action, condition, and rule JSON files follow affection patterns and schema requirements.
- Manifest lists the new resources, enabling mod discovery.
- Integration tests cover both discoverability and rule behavior for the new action.
- Successful run of `npm run test:integration` after implementation.
