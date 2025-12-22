# Liquids: Climb Out of Liquid Body Action/Rule Spec

## Overview
Create a new liquids action/rule combo that is the inverse of `liquids:enter_liquid_body`. The action allows an actor who is currently in a liquid body to climb out of it, targeting the liquid body referenced by the actor's `liquids-states:in_liquid_body` component. The rule should remove that component, announce success, and dispatch a sense-aware perceptible event per `docs/modding/sense-aware-perception.md`.

## References
- `data/mods/liquids/actions/enter_liquid_body.action.json`
- `data/mods/liquids/rules/handle_enter_liquid_body.rule.json`
- `data/mods/liquids-states/components/in_liquid_body.component.json`
- `docs/modding/sense-aware-perception.md`
- `data/mods/lying/scopes/furniture_im_lying_on.scope` (pattern for component-backed target scope)

## New/Updated Content

### Action: climb out of liquid body
- **File**: `data/mods/liquids/actions/climb_out_of_liquid_body.action.json`
- **Schema**: `schema://living-narrative-engine/action.schema.json`
- **Id**: `liquids:climb_out_of_liquid_body`
- **Name**: `Climb Out of Liquid Body`
- **Description**: `Climb out of the liquid body you are currently in.`
- **Targets**:
  - `primary` scope must resolve the liquid body entity referenced by the actor's `liquids-states:in_liquid_body.liquid_body_id`.
  - Use placeholder `liquidBody` with description `Liquid body to climb out of`.
- **required_components**:
  - `actor`: `["liquids-states:in_liquid_body"]`
- **forbidden_components**:
  - `actor`: `[]` (no new forbidden components)
- **template**:
  - `climb out of the {liquidBody}`
- **visual**:
  - Copy the `visual` block from `data/mods/liquids/actions/enter_liquid_body.action.json` unchanged (currently the teal scheme in that file).

### Target scope: liquid body actor is in
- **File**: `data/mods/liquids/scopes/liquid_body_actor_is_in.scope`
- **Purpose**: Resolve the single liquid body entity referenced by `liquids-states:in_liquid_body.liquid_body_id`.
- **Pattern** (mirrors `lying:furniture_im_lying_on`):
  - `entities(liquids:liquid_body)`
- Filter where `entity.id == actor.components.liquids-states:in_liquid_body.liquid_body_id`.
- Do not add a location check; the scope should mirror `lying:furniture_im_lying_on` and trust the component state.

### Condition: event-is-action-climb-out-of-liquid-body
- **File**: `data/mods/liquids/conditions/event-is-action-climb-out-of-liquid-body.condition.json`
- **Logic**: `event.payload.actionId == "liquids:climb_out_of_liquid_body"`

### Rule: handle_climb_out_of_liquid_body
- **File**: `data/mods/liquids/rules/handle_climb_out_of_liquid_body.rule.json`
- **Condition**: `liquids:event-is-action-climb-out-of-liquid-body`
- **Flow (mirrors `handle_enter_liquid_body` with inverse state change)**:
  1. `GET_NAME` for actor and target (liquid body).
  2. `QUERY_COMPONENT` for actor `core:position` (location for perceptible event).
  3. `REMOVE_COMPONENT` from actor: `liquids-states:in_liquid_body`.
  4. `SET_VARIABLE` log message: `{actor} climbs out of the {liquidBody}.`
  5. `REGENERATE_DESCRIPTION` for actor.
  6. `DISPATCH_PERCEPTIBLE_EVENT` using sense-aware settings (see below).
  7. `core:display_successful_action_result` with the same log message.
  8. `core:action_success` payload (actionId, actorId, targetId, success: true).
  9. `END_TURN` (success: true).

### Sense-aware perceptible event
- **Operation**: `DISPATCH_PERCEPTIBLE_EVENT` per `docs/modding/sense-aware-perception.md`.
- **Required parameters**:
  - `location_id`: actor location
  - `description_text`: `{actor} climbs out of the {liquidBody}.`
  - `actor_description`: `I climb out of the {liquidBody}.`
  - `perception_type`: `physical.self_action`
  - `actor_id`: `{event.payload.actorId}`
  - `target_id`: `{event.payload.targetId}`
- **alternate_descriptions**:
  - Provide an `auditory` fallback appropriate for splashing as someone climbs out (match the neutral "body of liquid" wording used in `handle_enter_liquid_body.rule.json`).
  - Avoid adding other fallbacks unless they are grounded in the action's sensory reality.

### Manifest updates
- `data/mods/liquids/mod-manifest.json` must include the new files in:
  - `actions`
  - `rules`
  - `conditions`
  - `scopes`

## Testing Requirements
Add comprehensive tests that cover both action discovery and rule behavior.

### Action discoverability tests
Create integration tests analogous to the existing enter-liquid tests to ensure:
- The action is discoverable only when the actor has `liquids-states:in_liquid_body` and the referenced liquid body exists.
- The action is not discoverable when the actor lacks `liquids-states:in_liquid_body`.
- The target scope resolves the liquid body referenced by `in_liquid_body.liquid_body_id` and does not return unrelated entities.
- The action metadata matches the spec: template, placeholder, and visual scheme copied from `enter_liquid_body` (compare directly to the source file, not hard-coded colors).

### Rule behavior tests
Create integration tests to verify:
- The rule removes `liquids-states:in_liquid_body` from the actor.
- The success message is exactly `{actor} climbs out of the {liquidBody}.` and is dispatched via `core:display_successful_action_result`.
- A `core:perceptible_event` is dispatched with:
  - `descriptionText`, `actorDescription`, `perceptionType`, `locationId`, `actorId`, `targetId`.
  - `alternateDescriptions.auditory` matching the chosen splash/exit text.
- The action success event and end-turn behavior mirror the enter-liquid rule.

## Non-Goals
- No changes to existing enter-liquid action/rule behavior.
- No new forbidden-components policy beyond the existing gate on `liquids-states:in_liquid_body`.

## Status
Completed.

## Outcome
Implemented the climb-out action/rule/condition/scope plus manifest entries; tests cover discovery and execution. Adjusted assumptions to match current code patterns (no scope location check, visual copied directly from enter action, and auditory fallback phrased with “body of liquid”).
