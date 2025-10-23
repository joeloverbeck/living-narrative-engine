# Place Hands on Chest Action & Rule Specification

## Overview

Design a new **affection** mod interaction where the acting character places their hands on a partner's chest. Reuse the existing flat-chested rest-head assets for palette and structural guidance so the new content feels cohesive with the recently added flat-chest variants.【F:data/mods/affection/actions/rest_head_against_flat_chest.action.json†L1-L26】

## Action Requirements

Create `data/mods/affection/actions/place_hands_on_flat_chest.action.json` with the following characteristics:

- **ID & metadata** — Assign the action ID `affection:place_hands_on_flat_chest`, and author name/description text that frames the moment as a tender, hand-on-chest gesture.
- **Targeting** — Set the primary target scope to `affection:actors_without_breasts_facing_each_other` so only flat-chested, face-to-face partners qualify.【F:data/mods/affection/actions/rest_head_against_flat_chest.action.json†L7-L13】
- **Components** — Require `positioning:closeness` for the actor and omit any forbidden component lists (no kissing lockout for this interaction).
- **Template** — Use the template string `place your hands on {primary}'s chest` to drive generated narration.
- **Visual design** — Copy the background/hover/text color scheme from the flat-chest rest-head action to maintain affection catalog consistency.【F:data/mods/affection/actions/rest_head_against_flat_chest.action.json†L18-L25】
- **Manifest** — Register the new action inside `data/mods/affection/mod-manifest.json` so it can be discovered in play.

## Rule Requirements

Add supporting logic at `data/mods/affection/rules/handle_place_hands_on_flat_chest.rule.json` by cloning the structure from the existing flat-chest head-rest rule while applying the new flavor text.【F:data/mods/affection/rules/handle_rest_head_against_flat_chest.rule.json†L1-L43】 Key expectations:

- Trigger on `core:attempt_action` with a condition equivalent to `affection:event-is-action-rest-head-against-flat-chest`, but referencing the new action ID.
- Resolve actor and primary names, derive the actor's location, copy over `perceptionType` (`action_target_general`) and `targetId` wiring, and invoke `core:logSuccessAndEndTurn` to finish the turn as in the reference rule.
- Set both the perceptible event message and the successful action log message to `{actor} places their hands on {primary}'s chest in an intimate gesture.`
- Update the affection manifest to include the new rule (and matching condition file, if patterned after the reference rule’s condition).

## Testing Specification

Author comprehensive integration coverage under `tests/integration/mods/affection/` following the mod testing guidelines.【F:docs/testing/mod-testing-guide.md†L1-L159】

1. **Action discoverability suite** — Add `place_hands_on_flat_chest_action_discovery.test.js` modeled after the flat-chest head-rest discovery tests to ensure the new scope, component requirements, template text, and visuals are exposed correctly only for eligible partners.【F:tests/integration/mods/affection/rest_head_against_flat_chest_action_discovery.test.js†L1-L230】 Include cases that confirm the absence of forbidden component gating.
2. **Rule behavior suite** — Add `place_hands_on_flat_chest_action.test.js` that executes the action with `ModTestFixture.forAction`, verifying the perceptible event and success log both emit `{actor} places their hands on {primary}'s chest in an intimate gesture.` and that the turn ends, mirroring the structure of the existing flat-chest head-rest rule tests.【F:tests/integration/mods/affection/rest_head_against_flat_chest_action.test.js†L1-L126】

Run the affection integration suites after implementation to guarantee both action discovery and rule execution behave as designed.
