# Vaginal Penetration Initiation Action Specification

## Overview

Define a new action/rule pair under the `sex-vaginal-penetration` mod that covers the explicit start of vaginal penetration, following the existing slide-along-labia interaction for anatomical checks, closeness, and UI styling. The action must use the same partner scope that resolves uncovered vaginas with acceptable orientation and should continue to forbid sitting-on states that would interfere with a standing penetration beat.【F:data/mods/sex-vaginal-penetration/actions/slide_penis_along_labia.action.json†L8-L18】

This interaction is now **state-based**. Introduce a paired-component pattern matching the hand-holding implementation so we can track which actor is penetrating and who is being penetrated.【F:data/mods/hand-holding/components/hand_held.component.json†L1-L21】【F:data/mods/hand-holding/components/holding_hand.component.json†L1-L19】

## Reference Patterns

- **Prerequisite symmetry** – Reuse the `hasPartOfType` and uncovered penis checks from `sex-vaginal-penetration:slide_penis_along_labia` so only actors with exposed penises can initiate penetration.【F:data/mods/sex-vaginal-penetration/actions/slide_penis_along_labia.action.json†L20-L33】
- **Complementary interaction state** – Mirror the dual-component modeling used by hand-holding, where one component marks the initiator and another the partner, to guide how penetration state tracking can evolve if future work requires paired anatomy components or consent flags.【F:data/mods/hand-holding/components/holding_hand.component.json†L1-L19】【F:data/mods/hand-holding/components/hand_held.component.json†L1-L21】
- **Testing conventions** – Follow the established integration approach where one suite validates discoverability (structure, scopes, components) and a separate suite covers rule execution, as shown in existing sex mod tests.【F:tests/integration/mods/sex/fondle_breasts_over_clothes_action_discovery.test.js†L1-L79】【F:tests/integration/mods/sex/fondle_penis_action.test.js†L1-L119】

## Component Requirements

Create two new components that record the active penetration state:

1. `data/mods/sex-core/components/fucking_vaginally.component.json`
   - `$schema`: `schema://living-narrative-engine/component.schema.json`.
   - `id`: `sex-core:fucking_vaginally`.
   - `name`: `Fucking Vaginally` with a description clarifying it marks the penetrating actor.
   - Include a single `fields.targetId` entry so rules can reference the currently penetrated partner by entity id.

2. `data/mods/sex-core/components/being_fucked_vaginally.component.json`
   - `$schema`: `schema://living-narrative-engine/component.schema.json`.
   - `id`: `sex-core:being_fucked_vaginally`.
   - `name`: `Being Fucked Vaginally` with a description clarifying it marks the penetrated target.
   - Include a single `fields.actorId` entry referencing the penetrating actor.

Register both components in the `sex-core` manifest and reference the new action and rule from the sex-vaginal-penetration mod manifest.

## Action Requirements

Create `data/mods/sex-vaginal-penetration/actions/insert_penis_into_vagina.action.json` with:

1. `$schema`: `schema://living-narrative-engine/action.schema.json`.
2. `id`: `sex-vaginal-penetration:insert_penis_into_vagina`.
3. `name`: `Insert Penis Into Vagina` with a concise description of initiating vaginal penetration.
4. `targets.primary`:
   - `scope`: `sex-vaginal-penetration:actors_with_uncovered_vagina_facing_each_other_or_target_facing_away`.
   - `placeholder`: `primary` and description explaining the uncovered vagina/orientation requirement.
5. `required_components.actor`: `["positioning:closeness", "sex-core:fucking_vaginally"]` so the action is only discoverable before the state is applied again, preventing repeat initiations once penetration is underway.
6. `forbidden_components.primary`: `["positioning:sitting_on"]`, retaining compatibility with straddling/standing contexts while blocking seated posture conflicts.【F:data/mods/sex-vaginal-penetration/actions/slide_penis_along_labia.action.json†L13-L18】
7. `template`: **Exactly** `insert your penis into {primary}'s vagina`.
8. `prerequisites`: Copy the two prerequisite objects from `sex-vaginal-penetration:slide_penis_along_labia`, including identical failure messages.【F:data/mods/sex-vaginal-penetration/actions/slide_penis_along_labia.action.json†L20-L33】
9. `visual`: Apply the Crimson Embrace palette (background `#6c0f36`, text `#ffe6ef`, hover background `#861445`, hover text `#fff2f7`) documented for vaginal penetration flows.【F:specs/wcag-compliant-color-combinations.spec.md†L752-L768】

Update the sex-vaginal-penetration mod manifest to register the new action (and the new components if not already covered above).

## Rule Requirements

Author `data/mods/sex-vaginal-penetration/rules/handle_insert_penis_into_vagina.rule.json` that:

1. Uses `event_type`: `core:attempt_action` and a condition referencing a new file `data/mods/sex-vaginal-penetration/conditions/event-is-action-insert-penis-into-vagina.condition.json` filtering on `sex-vaginal-penetration:insert_penis_into_vagina`.
2. Loads actor and primary names via `GET_NAME` operations.
3. Captures the actor's location with `QUERY_COMPONENT` (`core:position`) and stores `{context.actorPosition.locationId}`.
4. Sets the shared message string `{actor} inserts their penis into {primary}'s vagina, that stretches to accomodate the girth.` for both perceptible and success outputs before delegating to the standard `core:logSuccessAndEndTurn` macro.
5. Adds the new state components:
   - `sex-core:fucking_vaginally` applied to the acting actor with `targetId: {event.payload.primaryId}`.
   - `sex-core:being_fucked_vaginally` applied to the primary target with `actorId: {event.payload.actorId}`.
6. Populates the macro context so the perceptible event fires with `perceptionType: action_target_general`, `actorId: {event.payload.actorId}`, `targetId: {event.payload.primaryId}`, and `locationId` from the captured position.
7. Registers the rule and condition (and both new components if not already covered above) in the sex-vaginal-penetration mod manifest.

## Testing Requirements

Build two comprehensive integration suites under `tests/integration/mods/sex-vaginal-penetration/` using the Test Module Pattern from the Mod Testing Guide.【F:docs/testing/mod-testing-guide.md†L1-L119】

1. **`insert_penis_into_vagina_action_discovery.test.js`** – Validate structure parity, closeness requirements, forbidden `sitting_on`, template text, the new `sex-core:fucking_vaginally` required component, and ensure discoverability when actors are close, penis is uncovered, and the primary target meets the scope. Include negative cases for covered anatomy, missing closeness, sitting posture, or pre-existing state components blocking discovery.
2. **`insert_penis_into_vagina_action.test.js`** – Execute the action directly to assert the perceptible and success messages both read `{actor} inserts their penis into {primary}'s vagina, that stretches to accomodate the girth.`, confirm the rule ends the turn, ensure the actor gains `sex-core:fucking_vaginally` with a `targetId` pointing at the primary, ensure the primary gains `sex-core:being_fucked_vaginally` referencing the actor, and ensure no events fire for unrelated actions.

All new suites must pass locally before raising a PR, and they should demonstrate both action discovery and rule execution behavior end to end.
