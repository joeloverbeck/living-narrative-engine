# Press Against Chest Action & Rule Specification

## Overview

Add a front-facing variant of the breast-pressing interaction to the `sex-breastplay` mod so a breasted actor can press herself against a partner's chest while facing them, mirroring the structure and presentation of the existing back-press content.【F:data/mods/sex-breastplay/actions/press_against_back.action.json†L1-L27】 The new content should rely on the shared `positioning:close_actors_facing_each_other` scope that represents two close partners facing each other.【F:data/mods/positioning/scopes/close_actors_facing_each_other.scope†L1-L6】

## References & Constraints

- Reuse the actor prerequisite that verifies the presence of breasts and the purple card palette from `press_against_back` to maintain mod consistency.【F:data/mods/sex-breastplay/actions/press_against_back.action.json†L12-L26】
- Adopt the same rule structure as `handle_press_against_back.rule.json`, including the `GET_NAME` / `QUERY_COMPONENT` calls and `core:logSuccessAndEndTurn` macro usage for logging and turn flow.【F:data/mods/sex-breastplay/rules/handle_press_against_back.rule.json†L1-L47】
- Follow the mod integration testing practices documented in the mod testing guide and model the breadth of discovery + execution suites after existing breastplay tests.【F:docs/testing/mod-testing-guide.md†L1-L120】【F:tests/integration/mods/sex/nuzzle_bare_breasts_action_discovery.test.js†L1-L151】【F:tests/integration/mods/sex/nuzzle_bare_breasts_action.test.js†L1-L140】

## Action Requirements

Create `data/mods/sex-breastplay/actions/press_against_chest.action.json` with the following:

1. `$schema`: `schema://living-narrative-engine/action.schema.json`.
2. `id`: `sex-breastplay:press_against_chest`; `name`: `Press Against Chest`; `description`: describe the actor pressing herself against the target's chest to let her breasts make contact.
3. `targets.primary.scope`: `positioning:close_actors_facing_each_other`; retain `placeholder = "target"` and a brief description of the facing partner.
4. `required_components.actor`: `["positioning:closeness"]` exactly, matching the closeness requirement used elsewhere in the mod.【F:data/mods/sex-breastplay/actions/press_against_back.action.json†L12-L15】
5. `template`: exactly `press yourself against {target}'s chest`.
6. `prerequisites`: copy the existing breast prerequisite block from `press_against_back` so the action only appears for breasted actors.【F:data/mods/sex-breastplay/actions/press_against_back.action.json†L16-L23】
7. `visual`: reuse the same `backgroundColor`, `textColor`, `hoverBackgroundColor`, and `hoverTextColor` values as the reference action.【F:data/mods/sex-breastplay/actions/press_against_back.action.json†L24-L26】

Register the new action in `data/mods/sex-breastplay/mod-manifest.json` alongside the other breastplay actions.

## Condition & Rule Requirements

1. Add `data/mods/sex-breastplay/conditions/event-is-action-press-against-chest.condition.json` mirroring the JSON structure of the back-press condition but targeting the new action id.【F:data/mods/sex-breastplay/conditions/event-is-action-press-against-back.condition.json†L1-L8】
2. Implement `data/mods/sex-breastplay/rules/handle_press_against_chest.rule.json` by adapting the back-press handler:
   - Load actor and target names plus the actor's `core:position` for location metadata.【F:data/mods/sex-breastplay/rules/handle_press_against_back.rule.json†L9-L23】
   - Set both the perceptible event message and the success log to `{actor} presses herself against {target}'s chest, her breasts getting squeezed between their bodies.` before invoking `core:logSuccessAndEndTurn`.
   - Maintain `perceptionType = 'action_target_general'`, `locationId = {context.actorPosition.locationId}`, and `targetId = {event.payload.targetId}` within the rule actions.【F:data/mods/sex-breastplay/rules/handle_press_against_back.rule.json†L24-L46】
3. Add the new condition and rule file names to the breastplay manifest lists so they load with the mod content.

## Testing Requirements

Author comprehensive integration suites in `tests/integration/mods/sex/`:

- **Action discoverability**: Add a `{action_name}_discovery.test.js` file that mirrors the structure of other breastplay discovery suites, asserting the new action surfaces only when the actor has breasts, is in closeness, and facing the target.【F:tests/integration/mods/sex/nuzzle_bare_breasts_action_discovery.test.js†L1-L151】
- **Rule behavior**: Add a `{action_name}_action.test.js` file to verify the rule emits the specified perceptible event and success message, sets the correct perception metadata, and ends the actor's turn following the same expectations as other breastplay rule tests.【F:tests/integration/mods/sex/nuzzle_bare_breasts_action.test.js†L1-L140】

Ensure the new suites follow the documented conventions for fixtures, helpers, and naming in the mod testing guide, and update any shared utilities if necessary to accommodate the new scope usage.【F:docs/testing/mod-testing-guide.md†L1-L120】
