# Affection Mod — "Warm hands between yours" action & rule

## Goal
Introduce a tender hand-warming interaction in the affection mod that mirrors the structure, scope usage, and presentation established by `affection:ruffle_hair_playfully`. Reuse its closeness requirements, shared target scope, and visual palette so the new action feels cohesive with the rest of the affection catalog. 【F:data/mods/affection/actions/ruffle_hair_playfully.action.json†L1-L17】

## Content requirements
- Create `data/mods/affection/actions/warm_hands_between_yours.action.json` patterned after the ruffle-hair action schema. 【F:data/mods/affection/actions/ruffle_hair_playfully.action.json†L1-L17】
  - `id`: `affection:warm_hands_between_yours`.
  - `targets`: `affection:close_actors_facing_each_other_or_behind_target`.
  - `required_components.actor`: `["positioning:closeness"]` (closeness is the only requirement).
  - `template`: `warm {target}'s hands between yours`.
  - Copy the affection visual palette (`backgroundColor` `#6a1b9a`, `textColor` `#f3e5f5`, `hoverBackgroundColor` `#8e24aa`, `hoverTextColor` `#ffffff`). 【F:data/mods/affection/actions/ruffle_hair_playfully.action.json†L12-L16】
- Add a condition file `data/mods/affection/conditions/event-is-action-warm-hands-between-yours.condition.json` that checks for the new action ID, matching the structure used for the ruffle-hair condition. 【F:data/mods/affection/conditions/event-is-action-ruffle-hair-playfully.condition.json†L1-L8】
- Implement `data/mods/affection/rules/handle_warm_hands_between_yours.rule.json` following the standard affection rule flow. 【F:data/mods/affection/rules/handle_ruffle_hair_playfully.rule.json†L1-L55】
  - Retrieve actor/target names and the actor’s location via `core:position`, set `perceptionType` to `action_target_general`, and finish by invoking `core:logSuccessAndEndTurn`.
  - Both the perceptible event message and the successful action log must be exactly `{actor} warms {target}'s hands between theirs.`
  - Emit the perceptible event at the actor’s location and include the target’s entity ID, mirroring the reference rule’s structure. 【F:data/mods/affection/rules/handle_ruffle_hair_playfully.rule.json†L19-L55】
- Register the new action, condition, and rule in `data/mods/affection/mod-manifest.json` alongside the existing affection assets.

## Testing requirements
- Create comprehensive integration coverage under `tests/integration/mods/affection/`.
  - An action discovery suite (e.g., `warm_hands_between_yours_action_discovery.test.js`) using `ModTestFixture.forAction('affection', 'affection:warm_hands_between_yours')` to confirm discoverability, closeness gating, and template output, modeled on the existing ruffle-hair discovery tests. 【F:tests/integration/mods/affection/ruffle_hair_playfully_action_discovery.test.js†L1-L188】
  - An execution suite (e.g., `warm_hands_between_yours_action.test.js`) validating the rule emits the shared success/perceptible message, perception type, location, and target bindings, mirroring the existing affection integration test. 【F:tests/integration/mods/affection/ruffle_hair_playfully_action.test.js†L1-L57】
- Ensure the new suites are part of the affection integration collection and can run alongside the existing coverage.
