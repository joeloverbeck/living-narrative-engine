# Place Hand on Knee Affection Action Specification

## Overview

Design a new **affection** mod interaction where an actor seated close to someone places a hand on the nearby target's knee. Mirror the proximity targeting used by the waist touch so the new gesture appears alongside existing close-contact actions, and reuse the same purple visual palette for UI consistency. 【F:data/mods/affection/actions/place_hand_on_waist.action.json†L2-L20】

## Action Requirements

Author `data/mods/affection/actions/place_hand_on_knee.action.json` using the waist action as the baseline reference. 【F:data/mods/affection/actions/place_hand_on_waist.action.json†L2-L20】

- `$schema`: `schema://living-narrative-engine/action.schema.json`.
- `id`: `affection:place_hand_on_knee`.
- `name`: `Place hand on knee` (sentence case to match existing affection actions).
- `description`: Briefly describe resting a hand on a close companion's knee.
- `targets`: `positioning:close_actors` so the action is available for nearby companions. 【F:data/mods/affection/actions/place_hand_on_waist.action.json†L7-L8】
- `required_components.actor`: `["positioning:closeness"]` to ensure the actor participates in an established closeness circle. 【F:data/mods/positioning/components/closeness.component.json†L2-L20】
- `forbidden_components.actor`: empty array; this gesture should not add new blocking rules beyond the base closeness requirement.
- `template`: **exactly** `place a hand on {target}'s knee`.
- `prerequisites`: empty array.
- `visual`: copy `backgroundColor`, `textColor`, `hoverBackgroundColor`, and `hoverTextColor` values from `affection:place_hand_on_waist`. 【F:data/mods/affection/actions/place_hand_on_waist.action.json†L15-L20】

Register the new action inside the affection manifest alongside the other interaction files.

## Rule Requirements

Create `data/mods/affection/rules/place_hand_on_knee.rule.json` (or `handle_place_hand_on_knee.rule.json`) by following the waist rule's structure for variable setup, perceptible event emission, and the concluding success macro. 【F:data/mods/affection/rules/place_hand_on_waist.rule.json†L2-L38】

- `rule_id`: `handle_place_hand_on_knee`.
- `comment`: "Handles the 'affection:place_hand_on_knee' action. Dispatches descriptive text and ends the turn."
- `event_type`: `core:attempt_action`.
- `condition`: `{ "condition_ref": "affection:event-is-action-place-hand-on-knee" }` using a new condition file that mirrors the waist implementation naming convention.
- Actions sequence:
  1. `GET_NAME` the actor → `actorName`.
  2. `GET_NAME` the target → `targetName`.
  3. `QUERY_COMPONENT` the actor's `core:position` → `actorPosition` for location routing.
  4. `SET_VARIABLE` `logMessage` to **exactly** `{context.actorName} places a hand on {context.targetName}'s knee.`
  5. `SET_VARIABLE` `perceptionType` to `action_target_general`.
  6. `SET_VARIABLE` `locationId` to `{context.actorPosition.locationId}`.
  7. `SET_VARIABLE` `targetId` to `{event.payload.targetId}`.
  8. Invoke `{ "macro": "core:logSuccessAndEndTurn" }` to publish the success message and terminate the turn.

Ensure both the perceptible event description and the successful action message use the identical knee sentence so observers and the acting player receive synchronized feedback. 【F:data/mods/affection/rules/place_hand_on_waist.rule.json†L24-L38】

Remember to register the new rule (and its companion condition) in `data/mods/affection/mod-manifest.json`.

## Testing Specification

Develop comprehensive integration coverage under `tests/integration/mods/affection/`, following the existing affection action suites as references. 【F:tests/integration/mods/affection/place_hand_on_waist_action.test.js†L1-L68】【F:tests/integration/mods/affection/place_hands_on_shoulders_action_discovery.test.js†L1-L129】

1. **Action Discoverability** — Add `place_hand_on_knee_action_discovery.test.js` that loads the new action via `ModTestFixture.forAction` and validates:
   - Static metadata (id, template, targets, required/forbidden components, and visual palette) match this specification.
   - The action becomes discoverable when actors share the `positioning:closeness` component within the `positioning:close_actors` scope.
   - The action is withheld when closeness is absent or when the scope returns no partners.
2. **Rule Behavior** — Add `place_hand_on_knee_action.test.js` exercising the rule and confirming:
   - Successful action and perceptible event payloads both emit `{actor} places a hand on {target}'s knee.`.
   - `perceptionType`, `locationId`, and `targetId` propagate exactly as configured in the rule sequence.
   - The rule only fires for `affection:place_hand_on_knee` attempts and ends the turn through `core:logSuccessAndEndTurn`.

Follow the mod testing methodologies outlined in the Mod Testing Guide when assembling fixtures and assertions. 【F:docs/testing/mod-testing-guide.md†L1-L115】

## Acceptance Criteria

- Action, condition, and rule JSON artifacts exist, validate against their schemas, and are registered with the affection manifest.
- Messaging parity between the action success event and perceptible event is maintained for the knee gesture.
- New integration suites cover discoverability and rule execution, built with the Test Module Pattern, and all integration tests pass after implementation.
