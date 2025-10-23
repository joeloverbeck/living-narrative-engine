# Rest Head Against Chest Affection Action Specification

## Overview

Design a new **affection** mod interaction where an actor rests their head against a partner's chest, drawing on the structure of the waist embrace action for consistency in proximity requirements, forbidden components, and visual styling.【F:data/mods/affection/actions/wrap_arm_around_waist.action.json†L1-L21】 Mirror the multi-target patterns and breast-oriented scopes from the breastplay actions so the new interaction properly models facing actors and breast anatomy regardless of coverage.【F:data/mods/sex-breastplay/actions/fondle_breasts_over_clothes.action.json†L1-L30】【F:data/mods/sex-breastplay/actions/fondle_breasts.action.json†L1-L24】

## Scope Requirements

Introduce `data/mods/affection/scopes/actors_with_breasts_facing_each_other.scope` to keep the dependency within the affection mod while combining the positioning constraints used by `affection:close_actors_facing_each_other` with the breast anatomy checks from the sex breastplay scopes.【F:data/mods/affection/scopes/close_actors_facing_each_other.scope†L1-L9】【F:data/mods/sex-breastplay/scopes/actors_with_breasts_facing_each_other.scope†L1-L14】【F:data/mods/sex-breastplay/scopes/actors_with_breasts_facing_each_other_covered.scope†L1-L15】

```scope
// Actors in reciprocal closeness, facing each other, and possessing breasts (coverage agnostic)
affection:actors_with_breasts_facing_each_other := actor.components.positioning:closeness.partners[][{ "and": [
  {"condition_ref": "positioning:both-actors-facing-each-other"},
  {"!": {"condition_ref": "positioning:entity-kneeling-before-actor"}},
  {"!": {"condition_ref": "positioning:actor-kneeling-before-entity"}},
  {"hasPartOfType": [".", "breast"]}
]}]
```

Register the scope in the affection manifest alongside the other scope files.

## Action Requirements

Create `data/mods/affection/actions/rest_head_against_chest.action.json` following the affection action schema conventions.【F:data/mods/affection/actions/wrap_arm_around_waist.action.json†L1-L21】 Apply the following specifications:

- `id`: `affection:rest_head_against_chest`.
- `name`: `Rest head against chest` (sentence case to match existing affection names).
- `description`: Summarize the tender gesture (one sentence).
- `targets`: object with a single `primary` target using the new scope `affection:actors_with_breasts_facing_each_other`, placeholder `primary`, and a description noting the facing requirement and breast anatomy parity with the actor.【F:data/mods/sex-breastplay/actions/fondle_breasts_over_clothes.action.json†L6-L17】
- `required_components.actor`: `["positioning:closeness"]`.
- `forbidden_components.actor`: `["kissing:kissing"]` to block simultaneous kissing interactions, mirroring how the waist embrace forbids conflicting states.【F:data/mods/affection/actions/wrap_arm_around_waist.action.json†L7-L12】
- `template`: **exactly** `rest your head on {primary}'s chest`.
- `prerequisites`: empty array.
- `visual`: copy the background, text, hover background, and hover text colors from `wrap_arm_around_waist` so the card remains consistent within the affection palette.【F:data/mods/affection/actions/wrap_arm_around_waist.action.json†L15-L20】

Update the affection manifest to include the new action file under `actions` and ensure the new scope is discoverable via the manifest scopes list.

## Condition & Rule Requirements

1. Add `data/mods/affection/conditions/event-is-action-rest-head-against-chest.condition.json` patterned after the existing waist-embrace condition, targeting the new action ID and wired into the manifest.【F:data/mods/affection/conditions/event-is-action-wrap-arm-around-waist.condition.json†L1-L11】
2. Implement `data/mods/affection/rules/handle_rest_head_against_chest.rule.json` by adapting the macro sequence used in the wrap-arm rule so logging and turn termination match affection standards. Set both the successful action message and perceptible event message to the exact string `{actor} rests their head against {primary}'s chest, between her breasts.` Ensure the rule pulls `actorName`, `primaryName`, and location/target identifiers before invoking `core:logSuccessAndEndTurn` so the event payload mirrors other affection actions.【F:data/mods/affection/rules/wrap_arm_around_waist.rule.json†L1-L56】
3. Register the new rule and condition in `data/mods/affection/mod-manifest.json`.

## Testing Specification

Author comprehensive integration coverage under `tests/integration/mods/affection/`, following the patterns outlined in the mod testing guide.【F:docs/testing/mod-testing-guide.md†L1-L84】

1. **Action discoverability suite** — Add `rest_head_against_chest_action_discovery.test.js` that loads the new action via `ModTestFixture.forAction('affection', 'affection:rest_head_against_chest')`. Validate positive discovery when the new scope is satisfied, negative cases for missing breasts, lack of facing alignment, absence of closeness, or when the actor has `kissing:kissing`. Assert the template, visual palette, target metadata, and required/forbidden components line up with the spec, using the breastplay discovery suite as a structural reference.【F:tests/integration/mods/sex/fondle_breasts_over_clothes_action_discovery.test.js†L1-L99】
2. **Rule behavior suite** — Add `rest_head_against_chest_action.test.js` to execute the action and confirm the rule emits matching success and perceptible event messages, correct perception metadata, and ends the actor's turn. Mirror the assertion depth from the waist-embrace rule suite to ensure parity in behavior validation.【F:tests/integration/mods/affection/wrap_arm_around_waist_action.test.js†L1-L120】

Run the integration suites after implementation and expand fixtures as needed so coverage captures both discoverability and rule execution paths.
