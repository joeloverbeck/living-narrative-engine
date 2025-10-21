# Vaginal Penetration Initiation Action Specification

## Overview

Define a new action/rule pair under the `sex` mod that covers the explicit start of vaginal penetration, following the existing slide-along-labia interaction for anatomical checks, closeness, and UI styling. The action must use the same partner scope that resolves uncovered vaginas with acceptable orientation and should continue to forbid sitting-on states that would interfere with a standing penetration beat.【F:data/mods/sex/actions/slide_penis_along_labia.action.json†L8-L18】

## Reference Patterns

- **Prerequisite symmetry** – Reuse the `hasPartOfType` and uncovered penis checks from `sex:slide_penis_along_labia` so only actors with exposed penises can initiate penetration.【F:data/mods/sex/actions/slide_penis_along_labia.action.json†L20-L33】
- **Complementary interaction state** – Mirror the dual-component modeling used by hand-holding, where one component marks the initiator and another the partner, to guide how penetration state tracking can evolve if future work requires paired anatomy components or consent flags.【F:data/mods/hand_holding/components/holding_hand.component.json†L1-L19】【F:data/mods/hand_holding/components/hand_held.component.json†L1-L21】
- **Testing conventions** – Follow the established integration approach where one suite validates discoverability (structure, scopes, components) and a separate suite covers rule execution, as shown in existing sex mod tests.【F:tests/integration/mods/sex/fondle_breasts_over_clothes_action_discovery.test.js†L1-L79】【F:tests/integration/mods/sex/fondle_penis_action.test.js†L1-L119】

## Action Requirements

Create `data/mods/sex/actions/insert_penis_into_vagina.action.json` with:

1. `$schema`: `schema://living-narrative-engine/action.schema.json`.
2. `id`: `sex:insert_penis_into_vagina`.
3. `name`: `Insert Penis Into Vagina` with a concise description of initiating vaginal penetration.
4. `targets.primary`:
   - `scope`: `sex:actors_with_uncovered_vagina_facing_each_other_or_target_facing_away`.
   - `placeholder`: `primary` and description explaining the uncovered vagina/orientation requirement.
5. `required_components.actor`: `["positioning:closeness"]`.
6. `forbidden_components.primary`: `["positioning:sitting_on"]`, retaining compatibility with straddling/standing contexts while blocking seated posture conflicts.【F:data/mods/sex/actions/slide_penis_along_labia.action.json†L13-L18】
7. `template`: **Exactly** `insert your penis into {primary}'s vagina`.
8. `prerequisites`: Copy the two prerequisite objects from `sex:slide_penis_along_labia`, including identical failure messages.【F:data/mods/sex/actions/slide_penis_along_labia.action.json†L20-L33】
9. `visual`: Reuse the purple palette established by other sex actions (background `#4a148c`, text `#e1bee7`, hover background `#6a1b9a`, hover text `#f3e5f5`).【F:data/mods/sex/actions/slide_penis_along_labia.action.json†L36-L40】

Update the sex mod manifest to register the new action.

## Rule Requirements

Author `data/mods/sex/rules/handle_insert_penis_into_vagina.rule.json` that:

1. Uses `event_type`: `core:attempt_action` and a condition referencing a new file `data/mods/sex/conditions/event-is-action-insert-penis-into-vagina.condition.json` filtering on `sex:insert_penis_into_vagina`.
2. Loads actor and primary names via `GET_NAME` operations.
3. Captures the actor's location with `QUERY_COMPONENT` (`core:position`) and stores `{context.actorPosition.locationId}`.
4. Sets the shared message string `{actor} inserts their penis into {primary}'s vagina, that stretches to accomodate the girth.` for both perceptible and success outputs before delegating to the standard `core:logSuccessAndEndTurn` macro.
5. Populates the macro context so the perceptible event fires with `perceptionType: action_target_general`, `actorId: {event.payload.actorId}`, `targetId: {event.payload.primaryId}`, and `locationId` from the captured position.
6. Registers the rule and condition in the sex mod manifest.

## Testing Requirements

Build two comprehensive integration suites under `tests/integration/mods/sex/` using the Test Module Pattern from the Mod Testing Guide.【F:docs/testing/mod-testing-guide.md†L1-L119】

1. **`insert_penis_into_vagina_action_discovery.test.js`** – Validate structure parity, closeness requirements, forbidden `sitting_on`, template text, and ensure discoverability when actors are close, penis is uncovered, and the primary target meets the scope. Include negative cases for covered anatomy, missing closeness, or sitting posture.
2. **`insert_penis_into_vagina_action.test.js`** – Execute the action directly to assert the perceptible and success messages both read `{actor} inserts their penis into {primary}'s vagina, that stretches to accomodate the girth.`, confirm the rule ends the turn, and ensure no events fire for unrelated actions.

All new suites must pass locally before raising a PR, and they should demonstrate both action discovery and rule execution behavior end to end.
