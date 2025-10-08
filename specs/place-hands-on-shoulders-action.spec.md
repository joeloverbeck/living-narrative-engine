# Place Hands on Shoulders Affection Action Specification

## Overview

Design a new **affection** mod interaction where an actor places both hands on the target's shoulders, mirroring the structure and presentation of the existing waist-touch action. Reuse the proximity scope `affection:close_actors_facing_each_other_or_behind_target` so it slots into the same availability window as other close-contact gestures, and copy the purple visual palette from `affection:place_hand_on_waist` to keep the UI consistent. 【F:data/mods/affection/actions/place_hand_on_waist.action.json†L2-L20】【F:data/mods/affection/scopes/close_actors_facing_each_other_or_behind_target.scope†L1-L8】

## Action Requirements

Author `data/mods/affection/actions/place_hands_on_shoulders.action.json` using the waist action as the implementation template. 【F:data/mods/affection/actions/place_hand_on_waist.action.json†L2-L20】

- `$schema`: `schema://living-narrative-engine/action.schema.json`.
- `id`: `affection:place_hands_on_shoulders`.
- `name`: `Place Hands on Shoulders` (title case, concise).
- `description`: Briefly describe resting both hands on someone's shoulders in an affectionate gesture.
- `targets`: `affection:close_actors_facing_each_other_or_behind_target`.
- `required_components.actor`: `["positioning:closeness"]` with no other required components.
- `template`: **exactly** `place your hands on {target}'s shoulders`.
- `forbidden_components.actor`: keep the empty array pattern from the waist action unless future constraints arise. 【F:data/mods/affection/actions/place_hand_on_waist.action.json†L9-L13】
- `prerequisites`: empty array.
- `visual`: duplicate `backgroundColor`, `textColor`, `hoverBackgroundColor`, and `hoverTextColor` from `affection:place_hand_on_waist` so all affection cards share the same styling. 【F:data/mods/affection/actions/place_hand_on_waist.action.json†L15-L20】

Register the new action file inside `data/mods/affection/mod-manifest.json` with the other affection actions. 【F:data/mods/affection/mod-manifest.json†L23-L62】

## Condition Requirements

Create `data/mods/affection/conditions/event-is-action-place-hands-on-shoulders.condition.json` that asserts `event.payload.actionId` equals `affection:place_hands_on_shoulders`, matching the established pattern used by the waist condition file. 【F:data/mods/affection/conditions/event-is-action-place-hand-on-waist.condition.json†L1-L7】 Include the condition in the affection manifest's `conditions` list. 【F:data/mods/affection/mod-manifest.json†L51-L62】

## Rule Requirements

Implement `data/mods/affection/rules/place_hands_on_shoulders.rule.json` (or equivalently named with the `handle_` prefix) by following the standard affection action flow. Base the structure on the waist rule for consistency in step ordering, variable naming, and macros. 【F:data/mods/affection/rules/place_hand_on_waist.rule.json†L2-L44】

- `rule_id`: `handle_place_hands_on_shoulders`.
- `comment`: "Handles the 'affection:place_hands_on_shoulders' action. Dispatches descriptive text and ends the turn."
- `event_type`: `core:attempt_action`.
- `condition`: `{ "condition_ref": "affection:event-is-action-place-hands-on-shoulders" }`.
- Actions sequence:
  1. `GET_NAME` actor → `actorName`.
  2. `GET_NAME` target → `targetName`.
  3. `QUERY_COMPONENT` actor `core:position` → `actorPosition`.
  4. `SET_VARIABLE` `logMessage` to **exactly** `{context.actorName} places their hands on {context.targetName}'s shoulders.`.
  5. `SET_VARIABLE` `perceptionType` to `action_target_general`.
  6. `SET_VARIABLE` `locationId` to `{context.actorPosition.locationId}`.
  7. `SET_VARIABLE` `targetId` to `{event.payload.targetId}`.
  8. `{ "macro": "core:logSuccessAndEndTurn" }`.

Ensure both the perceptible event and successful action messages surfaced to players are the identical sentence `{actor} places their hands on {target}'s shoulders.` when hydrated. Mirror the waist rule's use of shared messaging variables so the text appears in the action log and perceptible event payload without divergence. 【F:data/mods/affection/rules/place_hand_on_waist.rule.json†L19-L44】 Remember to register the rule in the manifest's `rules` array. 【F:data/mods/affection/mod-manifest.json†L56-L62】

## Testing Specification

Add comprehensive integration coverage beneath `tests/integration/mods/affection/`, following the depth of existing affection action suites. 【F:tests/integration/mods/affection/place_hand_on_waist_action.test.js†L1-L153】

1. **Action Discoverability** — Introduce `place_hands_on_shoulders_action_discovery.test.js` that loads `affection:place_hands_on_shoulders` via `ModTestFixture.forAction`. Validate:
   - Metadata (id, template, targets, required components, and visual palette) matches this specification.
   - The action becomes available when the `affection:close_actors_facing_each_other_or_behind_target` scope conditions are satisfied and the actor has `positioning:closeness`.
   - The action is unavailable when closeness is missing, when actors are not within the scope, or when additional conflicting components would normally block the waist action.

2. **Rule Behavior** — Add `place_hands_on_shoulders_action.test.js` that loads the new rule and condition. Assert:
   - The successful action message equals `"Alice places their hands on Bob's shoulders."` (and adapts to other names).
   - The perceptible event message mirrors the exact same sentence and uses `perceptionType` `action_target_general` with correct `locationId`, `actorId`, and `targetId`.
   - The rule only fires for `actionId` `affection:place_hands_on_shoulders`, preventing accidental triggers.
   - The macro terminates the actor's turn, yielding a `core:turn_ended` event as in other affection rules.

Run `npm run test:integration` after implementation to confirm all integration suites, including the new tests, pass successfully.

## Acceptance Criteria

- Action, condition, and rule JSON artifacts exist, validate against their schemas, and are registered in the affection manifest.
- Messaging parity is maintained: both perceptible and successful logs use the identical shoulders sentence.
- Integration tests cover discoverability scenarios and rule execution edge cases, all passing under the full integration suite.
- `npm run test:integration` reports success with the new shoulders interaction enabled.
