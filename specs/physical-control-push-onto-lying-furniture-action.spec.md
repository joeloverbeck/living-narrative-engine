# Physical-Control Mod: Push Onto Lying Furniture Action & Rule Specification

## Overview

This document defines the new **physical-control** mod action/rule pair that lets an actor forcefully push a close partner down onto furniture that supports lying. It builds on the existing `physical-control:push_off` action/rule flow and the positioning mod's lying mechanics (`positioning:lie_down`) while adopting the multi-target action pattern demonstrated by `items:give_item`.

## Design References

- `data/mods/physical-control/actions/push_off.action.json` & `data/mods/physical-control/rules/handle_push_off.rule.json` for physical-control action gating, component usage, and messaging structure.
- `data/mods/positioning/actions/lie_down.action.json` & `data/mods/positioning/rules/handle_lie_down.rule.json` for how lying state components and movement locking are managed.
- `data/mods/items/actions/give_item.action.json` for the canonical multi-target `primary`/`secondary` action configuration with `generateCombinations`.

## Action Definition Requirements

Create `data/mods/physical-control/actions/push_onto_lying_furniture.action.json` with the following properties:

- **Schema & Metadata**
  - `$schema`: `schema://living-narrative-engine/action.schema.json`
  - `id`: `physical-control:push_onto_lying_furniture`
  - `name`: "Push Onto Furniture"
  - `description`: "Forcefully push a close actor down onto lying-friendly furniture"

- **Targeting (Multi-target)**
  - Set `generateCombinations` to `true` so the engine enumerates valid (actor, primary, secondary) combinations.
  - `targets.primary`
    - `scope`: `positioning:close_actors_facing_each_other_or_behind_target`
    - `placeholder`: `primary` (must match the template string requirement)
    - `description`: "Actor you are pushing down"
  - `targets.secondary`
    - `scope`: `positioning:available_lying_furniture`
    - `placeholder`: `secondary`
    - `description`: "Furniture that can be used to pin the target down"

- **Components & State Requirements**
  - `required_components.actor`: `["positioning:closeness"]`
  - `forbidden_components.actor`: `["positioning:lying_down"]`
  - `forbidden_components.primary`: `["positioning:lying_down", "positioning:kneeling_before"]`
  - No additional requirements for the secondary target beyond the scope.

- **Template & Visuals**
  - `template`: `push {primary} down onto {secondary}`
  - Provide an Ironclad Slate `visual` block consistent with other physical-control actions (mirror `push_off`).

- **Manifest**
  - Add the action file to `data/mods/physical-control/mod-manifest.json`.

## Supporting Condition

Introduce `data/mods/physical-control/conditions/event-is-action-push-onto-lying-furniture.condition.json` that mirrors other physical-control action conditions:

- `$schema`: `schema://living-narrative-engine/condition.schema.json`
- `id`: `physical-control:event-is-action-push-onto-lying-furniture`
- Logic: compare `event.payload.actionId` to `physical-control:push_onto_lying_furniture`.
- Register the condition inside the mod manifest alongside existing condition references.

## Rule Definition Requirements

Create `data/mods/physical-control/rules/handle_push_onto_lying_furniture.rule.json`:

- `$schema`: `schema://living-narrative-engine/rule.schema.json`
- `rule_id`: `handle_push_onto_lying_furniture`
- `comment`: Describe that it handles the new action by forcing the primary target to lie on the chosen furniture and logs a physical domination narration.
- `event_type`: `core:attempt_action`
- `condition.condition_ref`: `physical-control:event-is-action-push-onto-lying-furniture`

### Rule Action Pipeline

1. `GET_NAME` for the actor, primary target, and secondary target (store as `actorName`, `primaryName`, `furnitureName`).
2. `QUERY_COMPONENT` for the actor's `core:position` to capture `locationId` for logging.
3. `BREAK_CLOSENESS_WITH_TARGET` to sever the closeness link between the actor and the primary target (mirror the `handle_push_off` rule implementation):
   - `actor_id`: `{event.payload.actorId}`
   - `target_id`: `{event.payload.primaryId}`
4. `ADD_COMPONENT` on the **primary** target:
   - `component_type`: `positioning:lying_down`
   - `value`: `{ "furniture_id": "{event.payload.secondaryId}" }`
5. `LOCK_MOVEMENT` for the primary target to mirror lying state restrictions (`actor_id`: `{event.payload.primaryId}`).
6. Prepare shared messaging values:
   - `SET_VARIABLE` `logMessage`: `{context.actorName} pushes {context.primaryName} down roughly onto {context.furnitureName}.`
   - `SET_VARIABLE` `perceptionType`: `action_target_general`.
   - `SET_VARIABLE` `perceptionEventMessage`: same string as `logMessage` (requirement).
   - `SET_VARIABLE` `locationId`: `{context.actorPosition.locationId}`.
   - `SET_VARIABLE` `targetId`: `{event.payload.primaryId}`.
7. Invoke `core:logSuccessAndEndTurn` to emit the action log and finish the turn.

**Behavioral Notes**
- Break the closeness link after the push since the displacement is significant enough to separate the actors.
- No additional damage, stamina, or secondary effects are introduced in this version; the focus is positional control.

- Remember to register the rule file inside `data/mods/physical-control/mod-manifest.json`.

## Logging & Messaging Requirements

Both the successful action message and the perceptible event message must be exactly:

```
{actor} pushes {primary} down roughly onto {secondary}.
```

Ensure variable substitution uses the names retrieved in the rule and that both `logMessage` and `perceptionEventMessage` use the same literal string to satisfy this requirement.

## Testing Strategy

Create comprehensive integration suites under `tests/integration/mods/physical-control/`:

1. **Action Discovery Suite** – `push_onto_lying_furniture_action_discovery.test.js`
   - Use the latest mod testing methodology from `docs/testing/`.
   - Validate that the action is discoverable only when:
     - The actor has `positioning:closeness` with the target.
     - The actor is **not** lying down.
     - The primary target is not lying or kneeling.
     - Lying-friendly furniture is available in the shared location.
   - Confirm the action disappears when any forbidden component is present or when no furniture is available.

2. **Rule Execution Suite** – `push_onto_lying_furniture_action.test.js`
   - Assert that executing the action:
       - Adds `positioning:lying_down` to the primary target with the selected furniture id.
       - Locks the primary target's movement.
       - Leaves the actor's state unchanged except for action cost effects handled by the macro.
       - Removes the `positioning:closeness` relationship between the actor and primary target.
     - Emits the exact log/perception message string specified above.
   - Follow the structure of existing physical-control integration tests (e.g., `push_off_action.test.js`).

Ensure both suites are wired into the integration test runner (they will be picked up automatically by filename) and that the mod manifest adjustments are reflected in the fixtures.

## Implementation Checklist

- [ ] `push_onto_lying_furniture.action.json`
- [ ] `event-is-action-push-onto-lying-furniture.condition.json`
- [ ] `handle_push_onto_lying_furniture.rule.json`
- [ ] `mod-manifest.json` updates (action, rule, condition)
- [ ] Integration discovery test suite
- [ ] Integration rule behavior test suite
- [ ] Any supporting fixture updates required by the new tests

Follow the repo's formatting and linting standards (`npm run format`) once implementation starts.
