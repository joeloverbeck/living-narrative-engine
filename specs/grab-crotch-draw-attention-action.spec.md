# Grab Crotch to Draw Attention Action Specification

## Overview

Introduce a new self-focused seduction beat where an actor grabs their clothed crotch to highlight their bulge. The interaction mirrors existing self-showcase actions such as drawing attention to the ass, keeping the same visual styling and manifest wiring within the seduction mod.【F:data/mods/seduction/actions/draw_attention_to_ass.action.json†L23-L28】【F:data/mods/seduction/mod-manifest.json†L20-L34】

## Action Requirements

Create `data/mods/seduction/actions/grab_crotch_draw_attention.action.json` with the following structure:

- **Schema**: `schema://living-narrative-engine/action.schema.json`.
- **Identification**: `id` of `seduction:grab_crotch_draw_attention`, name "Grab Crotch to Draw Attention", and a description explaining that the actor grabs their crotch through their clothes to emphasize the bulge.
- **Targets**: `"none"`, matching other self-directed seduction prompts.【F:data/mods/seduction/actions/draw_attention_to_ass.action.json†L7-L10】
- **Required/Forbidden Components**: No additional requirements; use empty objects like the reference action.
- **Template**: Set to the exact string `"grab your crotch to draw attention"` as requested.
- **Prerequisites**:
  - `hasPartOfType` ensuring the actor has a penis, with a failure message such as "You need a penis to grab and draw attention to it."【F:data/mods/sex-vaginal-penetration/actions/slide_penis_along_labia.action.json†L20-L26】
  - `hasClothingInSlot` for the actor's `torso_lower` slot, communicating that the crotch must be covered (for example, "Your crotch needs to be covered to emphasize the bulge.").【F:data/mods/seduction/actions/draw_attention_to_ass.action.json†L15-L20】
- **Visual Scheme**: Reuse the orange palette from the ass attention action (`backgroundColor` `#f57f17`, `textColor` `#000000`, `hoverBackgroundColor` `#f9a825`, `hoverTextColor` `#212121`).【F:data/mods/seduction/actions/draw_attention_to_ass.action.json†L23-L28】

## Rule Requirements

Author `data/mods/seduction/rules/grab_crotch_draw_attention.rule.json` to handle the action attempt:

- Follow the seduction self-attention rule structure: respond to `core:attempt_action`, reference a dedicated condition, gather the actor's name and position, and finish with `core:logSuccessAndEndTurn`.【F:data/mods/seduction/rules/draw_attention_to_ass.rule.json†L5-L57】
- Set both the perceptible event message and the success log to `{actor} grabs their crotch through the clothes, drawing attention to its bulge.` Use the retrieved actor name when interpolating the string in the rule's `SET_VARIABLE` steps.
- Keep `perceptionType` as `action_self_general`, `targetId` null, and derive `locationId` from the actor's position component like the existing rule.【F:data/mods/seduction/rules/draw_attention_to_ass.rule.json†L36-L55】

## Condition and Manifest Updates

- Add `data/mods/seduction/conditions/event-is-action-grab-crotch-draw-attention.condition.json`, mirroring the structure of other seduction condition files but comparing against the new action ID.【F:data/mods/seduction/conditions/event-is-action-draw-attention-to-ass.condition.json†L1-L10】
- Register the action, rule, and condition inside `data/mods/seduction/mod-manifest.json` so the engine loads them with the rest of the seduction content.【F:data/mods/seduction/mod-manifest.json†L20-L34】

## Testing Expectations

Produce comprehensive integration coverage alongside the implementation:

1. **Action Discoverability Suite** — Place a new file under `tests/integration/mods/seduction/` that confirms eligible actors can discover `seduction:grab_crotch_draw_attention`, while scenarios lacking a penis or lower-body clothing cannot. Use `ModTestFixture` patterns from the existing seduction discovery suite as scaffolding.【F:tests/integration/mods/seduction/draw_attention_to_ass_action_discovery.test.js†L1-L10】【F:docs/testing/mod-testing-guide.md†L1-L120】
2. **Rule Behavior Suite** — Author integration tests exercising the rule to ensure it emits the correct perceptible event and success message, referencing the same fixture helpers leveraged by other seduction action suites.【F:tests/integration/mods/seduction/draw_attention_to_ass_action.test.js†L1-L10】【F:docs/testing/mod-testing-guide.md†L70-L120】

These suites must pass with the rest of the repository's integration tests before opening a pull request, per the mod testing guide.
