# Pinch Milk Out of Nipple Action & Rule Specification

## Overview

Author a self-targeted lactation tease for the `sex-breastplay` mod where a breasted, lactating actor pinches and rolls their own nipple until milk beads at the tip, matching the purple UI treatment used across existing breastplay cards.【F:data/mods/sex-breastplay/actions/press_against_chest.action.json†L16-L30】 The interaction has no explicit target entity and should mirror the anatomy gating found on other breast-centric actions in the mod.【F:data/mods/sex-breastplay/actions/press_against_chest.action.json†L17-L24】

## References & Constraints

- `targets` must be the string literal `"none"` so the card behaves like other self-contained flourishes such as the seduction stretch.【F:data/mods/seduction/actions/stretch_sexily.action.json†L6-L12】
- Preserve the breastplay visual palette (`#7a1d58` background, `#fde6f2` text, `#8d2465` hover background, `#fff2f9` hover text) for brand consistency.【F:data/mods/sex-breastplay/actions/press_against_chest.action.json†L25-L30】
- Leverage the existing lactation marker component to gate availability to actors capable of expressing milk.【F:data/mods/sex-breastplay/components/is_lactating.component.json†L1-L10】

## Action Requirements

1. Create `data/mods/sex-breastplay/actions/pinch_milk_out_of_nipple.action.json` with:
   - `id`: `sex-breastplay:pinch_milk_out_of_nipple` and `name`: "Pinch Milk Out of Nipple".
   - `description`: Highlight that the actor pinches and rolls their nipple until beads of milk surface.
   - `targets`: `"none"`.
   - `required_components`: declare `sex-breastplay:is_lactating` on the actor bucket so only lactating performers see the card by default.【F:data/mods/sex-breastplay/components/is_lactating.component.json†L1-L10】
   - `template`: `"pinch milk out of your nipple"`.
   - `visual`: Copy the color scheme from `press_against_chest` unchanged.【F:data/mods/sex-breastplay/actions/press_against_chest.action.json†L25-L30】
   - `prerequisites`: mirror the `press_against_chest` structure to assert the actor possesses at least one breast and that the breast zone is uncovered before presenting the card, emitting concise failure reasons for each clause.【F:data/mods/sex-breastplay/actions/press_against_chest.action.json†L17-L24】

## Rule Requirements

1. Add `data/mods/sex-breastplay/rules/handle_pinch_milk_out_of_nipple.rule.json` that:
   - Hooks into `core:attempt_action` with a dedicated condition that matches the new action id (follow the `handle_press_against_chest` pattern for structure, name resolution, and `core:logSuccessAndEndTurn`).【F:data/mods/sex-breastplay/rules/handle_press_against_chest.rule.json†L1-L55】
   - Sets both the perceptible event message and the success log to `{actor} pinches and rolls a nipple until milk beads at the tip.`
   - Uses the actor's current location for perception targeting when invoking `core:logSuccessAndEndTurn`, mirroring other breastplay rules.【F:data/mods/sex-breastplay/rules/handle_press_against_chest.rule.json†L19-L54】

## Testing

Implement comprehensive integration coverage under `tests/integration/mods/sex-breastplay/`:

- **Action discovery suite** – Confirm availability toggles based on the breast anatomy and lactation prerequisites, modeling assertions after the `slide_penis_along_labia` discovery tests that rely on `ModTestFixture` and builder helpers.【F:tests/integration/mods/sex-vaginal-penetration/slide_penis_along_labia_action_discovery.test.js†L1-L10】【F:docs/testing/mod-testing-guide.md†L1-L18】
- **Rule behavior suite** – Execute the action to assert the new log message, perception payload, and turn termination, following the structure of the existing slide-along-labia integration tests.【F:tests/integration/mods/sex-vaginal-penetration/slide_penis_along_labia_action.test.js†L1-L10】【F:docs/testing/mod-testing-guide.md†L1-L18】

Ensure both suites cover positive and negative paths for action discovery and verify the rule emits the prescribed narrative line.
