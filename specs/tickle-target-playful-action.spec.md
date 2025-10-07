# Tickle Target Playfully Affection Action Specification

## Overview

Introduce a playful tickling interaction in the **affection** mod that mirrors the tonal and structural patterns used by existing affectionate gestures. Reuse the shared proximity scope `affection:close_actors_facing_each_other_or_behind_target` and the established affection color palette to maintain consistency with actions such as `affection:ruffle_hair_playfully`. 【F:data/mods/affection/actions/ruffle_hair_playfully.action.json†L1-L17】【F:data/mods/affection/scopes/close_actors_facing_each_other_or_behind_target.scope†L1-L7】

## Action Requirements

Create `data/mods/affection/actions/tickle_target_playfully.action.json` following the affection action schema conventions. 【F:data/mods/affection/actions/ruffle_hair_playfully.action.json†L1-L17】【F:data/mods/affection/actions/brush_hand.action.json†L1-L20】

- `$schema`: `schema://living-narrative-engine/action.schema.json`
- `id`: `affection:tickle_target_playfully`
- `name`: `Tickle target playfully`
- `description`: Highlight the light-hearted tickling gesture in a warm, friendly tone.
- `targets`: `affection:close_actors_facing_each_other_or_behind_target` (reuse the close-actors scope shared by playful affection actions).
- `required_components.actor`: `["positioning:closeness"]` to ensure the participants are in intimate range.
- `template`: **exactly** `tickle {target}`.
- `prerequisites`: keep as an empty array.
- `visual`: Copy the affection palette values (`backgroundColor` `#6a1b9a`, `textColor` `#f3e5f5`, `hoverBackgroundColor` `#8e24aa`, `hoverTextColor` `#ffffff`). 【F:data/mods/affection/actions/ruffle_hair_playfully.action.json†L9-L16】

Register the new action inside `data/mods/affection/mod-manifest.json` alongside the other affection actions. 【F:data/mods/affection/mod-manifest.json†L19-L45】

## Condition Requirements

Add `data/mods/affection/conditions/event-is-action-tickle-target-playfully.condition.json` mirroring the existing action filter pattern that checks `event.payload.actionId` for the new action ID. Include the condition file in the affection manifest `conditions` array. 【F:data/mods/affection/conditions/event-is-action-ruffle-hair-playfully.condition.json†L1-L8】【F:data/mods/affection/mod-manifest.json†L46-L63】

## Rule Requirements

Implement `data/mods/affection/rules/handle_tickle_target_playfully.rule.json` using the standard affection rule flow. 【F:data/mods/affection/rules/handle_ruffle_hair_playfully.rule.json†L1-L34】【F:data/mods/affection/rules/brush_hand.rule.json†L1-L33】

- `rule_id`: `handle_tickle_target_playfully` with a comment matching the existing phrasing style (“Handles the 'affection:tickle_target_playfully' action...” ).
- `event_type`: `core:attempt_action`.
- `condition`: `{ "condition_ref": "affection:event-is-action-tickle-target-playfully" }`.
- Action sequence:
  1. `GET_NAME` actor → `actorName`.
  2. `GET_NAME` target → `targetName`.
  3. `QUERY_COMPONENT` actor `core:position` → `actorPosition`.
  4. `SET_VARIABLE` `logMessage` to the exact string `{context.actorName} drives a playful tickle up {context.targetName}'s sides.`.
  5. `SET_VARIABLE` `perceptionType`: `action_target_general`.
  6. `SET_VARIABLE` `locationId`: `{context.actorPosition.locationId}`.
  7. `SET_VARIABLE` `targetId`: `{event.payload.targetId}`.
  8. `{ "macro": "core:logSuccessAndEndTurn" }`.

Both the perceptible event description and the successful action message must use the exact sentence `{actor} drives a playful tickle up {target}'s sides.` to match the rule output. 【F:data/mods/affection/rules/handle_ruffle_hair_playfully.rule.json†L21-L33】 Remember to add the rule file to the manifest `rules` array. 【F:data/mods/affection/mod-manifest.json†L33-L45】

## Testing Specification

Create comprehensive integration coverage in `tests/integration/mods/affection/` mirroring the existing affection suites for action discovery and execution. 【F:tests/integration/mods/affection/ruffle_hair_playfully_action_discovery.test.js†L1-L116】【F:tests/integration/mods/affection/ruffle_hair_playfully_action.test.js†L1-L64】

1. **Action Discoverability** — Add `tickle_target_playfully_action_discovery.test.js` using `ModTestFixture.forAction('affection', 'affection:tickle_target_playfully')`. Validate:
   - Action JSON metadata (id, template, targets, required components, affection palette).
   - Availability when actors are close and facing/positioned per `affection:close_actors_facing_each_other_or_behind_target`.
   - Inavailability scenarios when closeness or facing requirements are violated.

2. **Rule Behavior** — Add `tickle_target_playfully_action.test.js` to execute the new rule and assert:
   - The successful action and perceptible event messages both equal `{actor} drives a playful tickle up {target}'s sides.`.
   - The perceptible event emits `perceptionType` `action_target_general`, carries the acting location, and targets the intended entity ID.
   - The event log contains only the expected success/perception events (reuse existing helper assertions if available).

Run `npm run test:integration` after implementation to confirm all integration suites pass.

## Acceptance Criteria

- Action, condition, and rule JSON files follow affection schemas and naming conventions.
- Manifest includes the new resources so the mod loads the tickle interaction.
- Integration tests cover action discoverability and rule behavior with the specified narrative message.
- `npm run test:integration` succeeds after the new content and tests are added.
