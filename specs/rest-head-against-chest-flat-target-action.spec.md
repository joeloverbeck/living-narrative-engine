# Rest Head Against Chest (Flat-Chested Target) Action Specification

## Overview

Design an **affection** mod variant of the existing rest-head-against-chest interaction so actors can share the same tender moment with partners who do not have breasts. Reuse the established action structure, palette, and component gating from the breast-oriented version to maintain consistency inside the affection catalog.【F:data/mods/affection/actions/rest_head_against_chest.action.json†L1-L26】

## Scope Requirements

Introduce `data/mods/affection/scopes/actors_without_breasts_facing_each_other.scope` so discoverability can target close, mutually facing partners explicitly lacking breast anatomy. Mirror the facing and kneeling guards from `affection:actors_with_breasts_facing_each_other`, but switch the anatomy predicate to require that the partner **does not** include any `breast` parts.【F:data/mods/affection/scopes/actors_with_breasts_facing_each_other.scope†L1-L7】 Register the new scope in the affection manifest alongside the existing breast-aware scope entry.

```scope
// Actors in reciprocal closeness, facing each other, and lacking any breast anatomy
affection:actors_without_breasts_facing_each_other := actor.components.positioning:closeness.partners[][{ "and": [
  {"condition_ref": "positioning:both-actors-facing-each-other"},
  {"!": {"condition_ref": "positioning:entity-kneeling-before-actor"}},
  {"!": {"condition_ref": "positioning:actor-kneeling-before-entity"}},
  {"not": {"hasPartOfType": [".", "breast"]}}
]}]
```

## Action Requirements

Create `data/mods/affection/actions/rest_head_against_flat_chest.action.json` with identical metadata, template text, visual palette, and component gating as `affection:rest_head_against_chest`. Only swap the primary target scope to `affection:actors_without_breasts_facing_each_other` and update the target description to highlight the absence of breasts.【F:data/mods/affection/actions/rest_head_against_chest.action.json†L3-L25】 Use the action ID `affection:rest_head_against_flat_chest` so it reads as a purposeful variant. Update the affection manifest to reference the new action file.

## Condition & Rule Requirements

1. Add `data/mods/affection/conditions/event-is-action-rest-head-against-flat-chest.condition.json` mirroring the existing condition pattern used for the breast-aware action, but pointing at the new action ID.【F:data/mods/affection/rules/handle_rest_head_against_chest.rule.json†L1-L55】
2. Implement `data/mods/affection/rules/handle_rest_head_against_flat_chest.rule.json` by cloning the macro flow from `handle_rest_head_against_chest` while updating the success/perceptible messaging to `{actor} rests their head on {primary}'s chest.` (note the wording change and removal of the breast-specific clause). The rule should continue to resolve actor/target names, derive the actor location, set `perceptionType` to `action_target_general`, assign the primary target ID, and invoke `core:logSuccessAndEndTurn` for parity with the source rule.【F:data/mods/affection/rules/handle_rest_head_against_chest.rule.json†L5-L55】
3. Register the new rule and condition within `data/mods/affection/mod-manifest.json` so execution hooks fire during gameplay.

## Testing Specification

Author comprehensive integration coverage beneath `tests/integration/mods/affection/` following the practices in the mod testing guide.【F:docs/testing/mod-testing-guide.md†L1-L159】

1. **Action discoverability suite** — Add `rest_head_against_flat_chest_action_discovery.test.js` modeled after the current breast-aware discovery suite to confirm the new scope exposes the action only when the partner lacks breast anatomy while maintaining the other structural checks (closeness, facing alignment, kissing conflicts).【F:tests/integration/mods/affection/rest_head_against_chest_action_discovery.test.js†L1-L273】 Validate the schema metadata, template, visuals, and scope wiring against the JSON definition.
2. **Rule behavior suite** — Add `rest_head_against_flat_chest_action.test.js` that executes the action via `ModTestFixture.forAction`, asserting the success and perceptible events both emit `{actor} rests their head on {primary}'s chest.` and that the actor's turn ends. Use the existing rest-head rule tests as a reference for assertions around message formatting, perception metadata, and turn termination.【F:tests/integration/mods/affection/rest_head_against_chest_action.test.js†L1-L113】

Run the affection integration suites after implementation to ensure discoverability and rule behavior remain stable for both variations.
