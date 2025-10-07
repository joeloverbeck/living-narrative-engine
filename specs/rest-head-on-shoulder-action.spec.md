# Rest Head on Shoulder Affection Action Specification

## Overview

Extend the **affection** mod with a comforting head-rest interaction that mirrors the structure, scope usage, and presentation of existing closeness-based affection actions such as `affection:hold_hand`. Reuse the shared proximity scope `affection:close_actors_facing_each_other_or_behind_target` and duplicate the established purple visual palette to keep action discoverability consistent inside the mod's UI surface. 【F:data/mods/affection/actions/hold_hand.action.json†L2-L20】【F:data/mods/affection/scopes/close_actors_facing_each_other_or_behind_target.scope†L1-L8】

## Action Requirements

Create `data/mods/affection/actions/rest_head_on_shoulder.action.json`, following the schema and layout conventions demonstrated by the hold-hand action. 【F:data/mods/affection/actions/hold_hand.action.json†L2-L20】

- `$schema`: `schema://living-narrative-engine/action.schema.json`.
- `id`: `affection:rest_head_on_shoulder`.
- `name`: `Rest Head on Shoulder` (title case, concise, matches mod tone).
- `description`: Briefly describe leaning one's head on a companion's shoulder for comfort.
- `targets`: `affection:close_actors_facing_each_other_or_behind_target`.
- `required_components.actor`: `["positioning:closeness"]`.
- `template`: **exactly** `rest your head on {target}'s shoulder`.
- `forbidden_components.actor`: keep an empty array to mirror the existing affection action pattern unless future requirements dictate otherwise.
- `prerequisites`: empty array.
- `visual`: copy the background, text, hover background, and hover text colors from `affection:hold_hand` so the new card blends with other affection options. 【F:data/mods/affection/actions/hold_hand.action.json†L15-L20】

Remember to register the action file in `data/mods/affection/mod-manifest.json` alongside the other affection actions. 【F:data/mods/affection/mod-manifest.json†L23-L62】

## Condition Requirements

Add `data/mods/affection/conditions/event-is-action-rest-head-on-shoulder.condition.json` that checks `event.payload.actionId === 'affection:rest_head_on_shoulder'`, matching the structure of other action gate conditions in the mod. 【F:data/mods/affection/conditions/event-is-action-hold-hand.condition.json†L1-L7】 Include the condition inside the affection manifest's `conditions` array. 【F:data/mods/affection/mod-manifest.json†L51-L62】

## Rule Requirements

Implement `data/mods/affection/rules/handle_rest_head_on_shoulder.rule.json` based on the standard affection rule pipeline. Use the hold-hand rule as a reference for sequencing macro steps, context variable naming, and log handling. 【F:data/mods/affection/rules/handle_hold_hand.rule.json†L2-L53】

- `rule_id`: `handle_rest_head_on_shoulder`.
- `comment`: "Handles the 'affection:rest_head_on_shoulder' action. Dispatches descriptive text and ends the turn." (adjust wording only if required for clarity).
- `event_type`: `core:attempt_action`.
- `condition`: `{ "condition_ref": "affection:event-is-action-rest-head-on-shoulder" }`.
- Actions sequence:
  1. `GET_NAME` actor → `actorName`.
  2. `GET_NAME` target → `targetName`.
  3. `QUERY_COMPONENT` actor `core:position` → `actorPosition`.
  4. `SET_VARIABLE` `logMessage` to the exact string `{context.actorName} leans their head against {context.targetName}'s shoulder for comfort.`.
  5. `SET_VARIABLE` `perceptionType` to `action_target_general`.
  6. `SET_VARIABLE` `locationId` to `{context.actorPosition.locationId}`.
  7. `SET_VARIABLE` `targetId` to `{event.payload.targetId}`.
  8. `{ "macro": "core:logSuccessAndEndTurn" }`.

Ensure the successful action message and the perceptible event description both use the same sentence `"{actor} leans their head against {target}'s shoulder for comfort."` once templated with actor/target names, mirroring the parity verified in the hold-hand tests. 【F:tests/integration/mods/affection/hold_hand_action.test.js†L1-L117】 Include the new rule in the manifest's `rules` array.

## Testing Specification

Provide comprehensive integration coverage under `tests/integration/mods/affection/`, aligning with the depth of existing affection action suites. 【F:tests/integration/mods/affection/hold_hand_action.test.js†L1-L128】

1. **Action Discoverability** — Add `rest_head_on_shoulder_action_discovery.test.js` using `ModTestFixture.forAction('affection', 'affection:rest_head_on_shoulder')`. Validate:
   - Action metadata (id, name, template, targets, required components, and visual palette) matches the specification.
   - The action becomes available when the scope `affection:close_actors_facing_each_other_or_behind_target` is satisfied.
   - The action is unavailable when closeness or facing requirements fail, or when the actor lacks the `positioning:closeness` component.

2. **Rule Behavior** — Add `rest_head_on_shoulder_action.test.js` that loads the new rule and condition. Assert:
   - The successful action message equals `"Alice leans their head against Bob's shoulder for comfort."` (and adapts correctly to different names).
   - The perceptible event mirrors the same description, uses `perceptionType` `action_target_general`, and includes the correct `locationId`, `actorId`, and `targetId`.
   - The rule only fires when `actionId` is `affection:rest_head_on_shoulder`, ensuring no accidental triggers.
   - The turn-ending behavior remains consistent with other affection rules (a `core:turn_ended` event for the acting entity).

Run `npm run test:integration` after implementation to confirm the new suites and the existing integration tests all pass.

## Acceptance Criteria

- Action, condition, and rule JSON files are present, validated against their schemas, and wired into the affection manifest.
- Both success and perceptible messaging deliver the comfort sentence verbatim.
- Integration tests cover action discoverability scenarios and rule execution edge cases, passing alongside the existing affection suites.
- `npm run test:integration` reports success with the new tests enabled.
