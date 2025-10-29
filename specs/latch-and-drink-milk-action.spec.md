# Latch and Drink Milk Action & Rule Specification

## Overview

Design a new face-to-face breastplay interaction where the acting character latches onto a partner's nipple and actively drinks the milk, extending the lactation-focused content in the `sex-breastplay` mod.【F:data/mods/sex-breastplay/actions/suck_on_nipples.action.json†L3-L25】 The feature requires both a discoverable action card and a rule that narrates the milk-drinking beat while respecting the mod's established presentation.

## References & Constraints

- Match the existing `sex-breastplay:actors_with_breasts_facing_each_other` primary scope so the card appears only when two breasted actors are close and facing one another.【F:data/mods/sex-breastplay/actions/suck_on_nipples.action.json†L6-L19】
- Reuse the closeness requirement on the actor and forbid the blowjob positioning state to align with the other nipple-suckling interaction.【F:data/mods/sex-breastplay/actions/suck_on_nipples.action.json†L13-L18】
- Gate the target with the established lactation marker component so the action is offered only when milk can actually be expressed.【F:data/mods/sex-breastplay/components/is_lactating.component.json†L1-L10】
- Copy the purple breastplay visual palette (`#7a1d58` background, `#fde6f2` text, `#8d2465` hover background, `#fff2f9` hover text) for UI consistency.【F:data/mods/sex-breastplay/actions/pinch_milk_out_of_nipple.action.json†L28-L33】

## Action Requirements

1. Create `data/mods/sex-breastplay/actions/latch_and_drink_milk.action.json` with:
   - `id`: `sex-breastplay:latch_and_drink_milk`, `name`: "Latch and Drink Milk", and a description that highlights the actor sealing their lips over the target's nipple and drawing down milk.
   - `targets.primary.scope`: `sex-breastplay:actors_with_breasts_facing_each_other`, `targets.primary.placeholder`: `target`, and a concise description of the nursing partner.【F:data/mods/sex-breastplay/actions/suck_on_nipples.action.json†L6-L11】
   - `required_components.actor`: `["positioning:closeness"]` and `required_components.target`: `["sex-breastplay:is_lactating"]` so proximity and lactation both gate availability.【F:data/mods/sex-breastplay/actions/suck_on_nipples.action.json†L13-L14】【F:data/mods/sex-breastplay/components/is_lactating.component.json†L1-L10】
   - `forbidden_components.actor`: `["positioning:giving_blowjob"]` to avoid conflicts with oral sex positioning.【F:data/mods/sex-breastplay/actions/suck_on_nipples.action.json†L16-L18】
   - `template`: `"nurse at {target}'s breast"` and `prerequisites`: mirror any anatomy or coverage checks already used in comparable two-character breastplay actions if needed.
   - `visual`: background/text/hover colors copied verbatim from the pinch milk action for brand alignment.【F:data/mods/sex-breastplay/actions/pinch_milk_out_of_nipple.action.json†L28-L33】

## Rule Requirements

1. Add `data/mods/sex-breastplay/rules/handle_latch_and_drink_milk.rule.json` that:
   - Subscribes to `core:attempt_action` with a condition referencing the new action id, following the structural pattern in `handle_suck_on_nipples` for name resolution, position lookup, and turn termination.【F:data/mods/sex-breastplay/rules/handle_suck_on_nipples.rule.json†L1-L62】
   - Sets both the perceptible event message and the success narration to `{actor} suckles at {target}'s nipple, drawing milk and drinking it.` while targeting the actor's current location and the target entity for perception routing.【F:data/mods/sex-breastplay/rules/handle_suck_on_nipples.rule.json†L25-L62】

## Testing

Implement comprehensive integration coverage under `tests/integration/mods/sex-breastplay/`:

- **Action discovery suite** – Clone the structure of the existing pinch milk discovery tests to assert the new nursing card appears only when closeness, facing, and target lactation requirements are satisfied (and disappears when any gate fails).【F:tests/integration/mods/sex-breastplay/pinch_milk_out_of_nipple_action_discovery.test.js†L1-L10】【F:docs/testing/mod-testing-guide.md†L1-L10】
- **Rule behavior suite** – Mirror the execution tests for the pinch milk action to validate the narrated line, perception payload (location + target), and turn wrap-up when the action fires.【F:tests/integration/mods/sex-breastplay/pinch_milk_out_of_nipple_action.test.js†L1-L10】【F:docs/testing/mod-testing-guide.md†L1-L10】

Ensure both suites cover positive and negative branches for discoverability and confirm the rule emits the exact shared message `{actor} suckles at {target}'s nipple, drawing milk and drinking it.`
