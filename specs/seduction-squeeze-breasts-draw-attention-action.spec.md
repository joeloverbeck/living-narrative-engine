# Seduction Mod: Squeeze Breasts to Draw Attention Specification

## Overview

Expand the seduction self-showcase suite with a new beat where the actor flaunts her uncovered bust by squeezing it enticingly. This interaction should mirror the existing seduction self-targeted actions for structure and tone while adopting the anatomy gating patterns established in the breastplay content.【F:data/mods/seduction/actions/draw_attention_to_breasts.action.json†L1-L31】【F:data/mods/sex-breastplay/actions/press_against_chest.action.json†L1-L31】

## Action Requirements

Author `data/mods/seduction/actions/squeeze_breasts_draw_attention.action.json` with these properties:

- **Identification**: `$schema` `schema://living-narrative-engine/action.schema.json`, `id` `seduction:squeeze_breasts_draw_attention`, name "Squeeze Breasts to Draw Attention", and a description framing the actor sensually squeezing her breasts to command attention.
- **Targets**: Set `"targets"` to `"none"`, matching the seduction self-directed pattern.【F:data/mods/seduction/actions/draw_attention_to_breasts.action.json†L6-L11】
- **Components**: Leave `required_components` empty and set `forbidden_components.actor` to only `"positioning:hugging"`, aligning with the breast-forward seduction action's restrictions.【F:data/mods/seduction/actions/draw_attention_to_breasts.action.json†L7-L24】
- **Template**: Use the exact template string `"squeeze your breasts to draw attention"`.
- **Prerequisites**:
  - Require at least one breast via `hasPartOfType` to keep parity with the breastplay references.【F:data/mods/sex-breastplay/actions/press_against_chest.action.json†L17-L24】【F:src/logic/operators/hasPartOfTypeOperator.js†L1-L52】
  - Demand uncovered breasts by wrapping `isSocketCovered` checks for `left_chest` and `right_chest` in a logical `or` with `not`, so the action appears if either breast is bare, mirroring the lactation tease gating.【F:data/mods/sex-breastplay/actions/pinch_milk_out_of_nipple.action.json†L11-L26】【F:src/logic/operators/isSocketCoveredOperator.js†L1-L200】 Provide a failure message communicating that her breasts must be uncovered.
- **Visuals**: Copy the orange palette from the crotch attention card (`#f57f17` background, `#000000` text, `#f9a825` hover background, `#212121` hover text) to maintain seduction theme consistency.【F:data/mods/seduction/actions/grab_crotch_draw_attention.action.json†L1-L32】

## Rule Requirements

Create `data/mods/seduction/rules/squeeze_breasts_draw_attention.rule.json` that mirrors the existing seduction self-attention handler:

- Trigger on `core:attempt_action` and depend on a dedicated condition `seduction:event-is-action-squeeze-breasts-draw-attention` analogous to the crotch attention rule.【F:data/mods/seduction/rules/grab_crotch_draw_attention.rule.json†L1-L58】
- `GET_NAME` for the actor and `QUERY_COMPONENT` for `core:position` to capture the location used when logging the event.【F:data/mods/seduction/rules/grab_crotch_draw_attention.rule.json†L10-L47】
- Set both the perceptible event message and action success log to `{actor} grabs her breasts and squeezes them sexily, drawing attention to them.` before invoking `core:logSuccessAndEndTurn`. Ensure the message interpolates the stored actor name in both pathways.【F:data/mods/seduction/rules/grab_crotch_draw_attention.rule.json†L28-L58】

## Condition and Manifest Updates

- Add `data/mods/seduction/conditions/event-is-action-squeeze-breasts-draw-attention.condition.json` following the structure of the existing grab-crotch condition but referencing the new action id.【F:data/mods/seduction/conditions/event-is-action-grab-crotch-draw-attention.condition.json†L1-L10】
- Register the new action, rule, and condition in the seduction `mod-manifest.json` content arrays so the engine loads them with the rest of the module.【F:data/mods/seduction/mod-manifest.json†L23-L44】

## Testing Expectations

Deliver two integration suites under `tests/integration/mods/seduction/` using the mod testing harness and documentation as guidance.【F:docs/testing/mod-testing-guide.md†L1-L200】

1. **Action Discoverability** — Verify the action appears for actors with at least one uncovered breast and disappears when breasts are absent, fully covered, or the actor is currently hugging someone. Model the structure after the existing seduction discovery specs to validate structure, prerequisites, and forbidden components.【F:tests/integration/mods/seduction/draw_attention_to_ass_action_discovery.test.js†L1-L128】
2. **Rule Behavior** — Exercise the rule via `ModTestFixture` to confirm it emits the specified perceptible event and action success log, reusing the assertion helpers and scenario builders seen in the seduction action integration tests.【F:tests/integration/mods/seduction/draw_attention_to_ass_action.test.js†L1-L133】 Include negative coverage for forbidden components or unmet prerequisites when appropriate.

All new tests must pass alongside the existing suites.
