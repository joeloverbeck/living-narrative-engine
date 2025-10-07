# Link Arms Affection Action Specification

## Overview

Introduce a new **affection** mod action that mirrors the structure, scope usage, and presentation of `affection:hold_hand`, leveraging the shared proximity scope and purple UI palette to keep discoverability consistent within the affection suite. 【F:data/mods/affection/actions/hold_hand.action.json†L2-L20】【F:data/mods/affection/scopes/close_actors_facing_each_other_or_behind_target.scope†L1-L8】

## Action Requirements

Create `data/mods/affection/actions/link_arms.action.json`, following the schema and layout conventions demonstrated by the hold-hand action. 【F:data/mods/affection/actions/hold_hand.action.json†L2-L20】

- `$schema`: `schema://living-narrative-engine/action.schema.json`.
- `id`: `affection:link_arms`.
- `name`: `Link Arms` (title case, concise, affectionate tone).
- `description`: Capture the actor gently looping their arm with the target in a close, supportive gesture.
- `targets`: `affection:close_actors_facing_each_other_or_behind_target`.
- `required_components.actor`: `["positioning:closeness"]`.
- `template`: **exactly** `link arms with {target}`.
- `forbidden_components.actor`: leave as an empty array, matching the existing affection action baseline.
- `prerequisites`: empty array.
- `visual`: copy the background, text, hover background, and hover text colors from `affection:hold_hand` to maintain UI consistency. 【F:data/mods/affection/actions/hold_hand.action.json†L15-L20】

Register the action inside `data/mods/affection/mod-manifest.json` alongside other affection actions to ensure it is discoverable in-game.

## Condition Requirements

Add `data/mods/affection/conditions/event-is-action-link-arms.condition.json` that checks `event.payload.actionId === 'affection:link_arms'`, mirroring the structure of the existing hold-hand condition. Include the condition in the affection manifest's `conditions` array for proper wiring. 【F:data/mods/affection/conditions/event-is-action-hold-hand.condition.json†L1-L7】

## Rule Requirements

Implement `data/mods/affection/rules/handle_link_arms.rule.json` by adapting the hold-hand rule pipeline for the new action while updating naming and messaging. 【F:data/mods/affection/rules/handle_hold_hand.rule.json†L2-L53】

- `rule_id`: `handle_link_arms`.
- `comment`: "Handles the 'affection:link_arms' action. Dispatches descriptive text and ends the turn." (adjust wording only if needed for clarity).
- `event_type`: `core:attempt_action`.
- `condition`: `{ "condition_ref": "affection:event-is-action-link-arms" }`.
- Actions sequence:
  1. `GET_NAME` actor → `actorName`.
  2. `GET_NAME` target → `targetName`.
  3. `QUERY_COMPONENT` actor `core:position` → `actorPosition`.
  4. `SET_VARIABLE` `logMessage` to the exact string `{context.actorName} links arms with {context.targetName}.`.
  5. `SET_VARIABLE` `perceptionType` to `action_target_general`.
  6. `SET_VARIABLE` `locationId` to `{context.actorPosition.locationId}`.
  7. `SET_VARIABLE` `targetId` to `{event.payload.targetId}`.
  8. `{ "macro": "core:logSuccessAndEndTurn" }`.

Ensure the successful action message and the perceptible event description both use `{actor} links arms with {target}.`, mirroring the parity validated by the hold-hand integration suite. 【F:tests/integration/mods/affection/hold_hand_action.test.js†L1-L195】 Include the new rule in the affection manifest's `rules` array.

## Testing Specification

Provide comprehensive integration coverage under `tests/integration/mods/affection/`, aligning with the depth of existing affection action suites. 【F:tests/integration/mods/affection/hold_hand_action.test.js†L1-L195】

1. **Action Discoverability** — Add `link_arms_action_discovery.test.js` using `ModTestFixture.forAction('affection', 'affection:link_arms')`. Validate:
   - Action metadata (id, name, template, targets, required components, and visual palette) matches the specification.
   - The action becomes available when the scope `affection:close_actors_facing_each_other_or_behind_target` is satisfied.
   - The action is unavailable when closeness or facing requirements fail, or when the actor lacks the `positioning:closeness` component.

2. **Rule Behavior** — Add `link_arms_action.test.js` that loads the new rule and condition. Assert:
   - The successful action message equals `"Alice links arms with Bob."` (and adapts correctly to different names).
   - The perceptible event mirrors the same description, uses `perceptionType` `action_target_general`, and includes the correct `locationId`, `actorId`, and `targetId`.
   - The rule only fires when `actionId` is `affection:link_arms`, ensuring no accidental triggers.
   - The turn-ending behavior remains consistent with other affection rules (a `core:turn_ended` event for the acting entity).

Run `npm run test:integration` after implementation to confirm the new suites and the existing integration tests all pass.

## Acceptance Criteria

- Action, condition, and rule JSON files are present, validated against their schemas, and wired into the affection manifest.
- Both success and perceptible messaging use the sentence `{actor} links arms with {target}.` verbatim.
- Integration tests cover action discoverability scenarios and rule execution edge cases, passing alongside the existing affection suites.
- `npm run test:integration` reports success with the new tests enabled.
