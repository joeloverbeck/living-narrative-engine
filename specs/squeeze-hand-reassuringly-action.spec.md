# Affection Mod — "Squeeze hand reassuringly" action & rule

## Goal
Add a new reassuring hand-squeeze interaction to the affection mod. Use the existing `affection:ruffle_hair_playfully` assets as the structural reference for schema fields, visual styling, and testing coverage. 【F:data/mods/affection/actions/ruffle_hair_playfully.action.json†L1-L17】【F:tests/integration/mods/affection/ruffle_hair_playfully_action.test.js†L1-L64】

## Content requirements
- Create `data/mods/affection/actions/squeeze_hand_reassuringly.action.json` patterned after the ruffle-hair action file.
  - `id`: `affection:squeeze_hand_reassuringly`.
  - `targets`: `affection:close_actors_facing_each_other_or_behind_target`.
  - `required_components.actor`: `["positioning:closeness"]` (closeness is the only required component).
  - `template`: `squeeze {target}'s hand reassuringly`.
  - Copy the affection visual palette (`backgroundColor` `#6a1b9a`, `textColor` `#f3e5f5`, `hoverBackgroundColor` `#8e24aa`, `hoverTextColor` `#ffffff`) to match the mod’s established presentation. 【F:data/mods/affection/actions/ruffle_hair_playfully.action.json†L8-L17】
- Add a matching condition file `data/mods/affection/conditions/event-is-action-squeeze-hand-reassuringly.condition.json` that checks for the new action ID, mirroring the naming and structure used for the ruffle-hair condition. 【F:data/mods/affection/conditions/event-is-action-ruffle-hair-playfully.condition.json†L1-L11】
- Implement `data/mods/affection/rules/handle_squeeze_hand_reassuringly.rule.json` using the standard affection rule flow. 【F:data/mods/affection/rules/handle_ruffle_hair_playfully.rule.json†L1-L34】
  - Both the perceptible event message and the successful action log string must be `{actor} squeezes {target}'s hand reassuringly.`
  - Ensure the rule dispatches the perceptible event, sets `perceptionType` to `action_target_general`, resolves `locationId` from the actor position, and ends the turn, following the ruffle-hair implementation structure.
- Register the new action, condition, and rule in `data/mods/affection/mod-manifest.json` alongside the other affection assets. 【F:data/mods/affection/mod-manifest.json†L33-L45】

## Testing requirements
- Add integration coverage under `tests/integration/mods/affection/`:
  - An action discovery suite (e.g., `squeeze_hand_reassuringly_action_discovery.test.js`) using `ModTestFixture.forAction('affection', 'affection:squeeze_hand_reassuringly')` to confirm discoverability and template output, mirroring the ruffle-hair discovery test. 【F:tests/integration/mods/affection/ruffle_hair_playfully_action_discovery.test.js†L1-L116】
  - An execution suite (e.g., `squeeze_hand_reassuringly_action.test.js`) that validates the rule emits the perceptible event message and success log, following the structure of the existing affection rule test. 【F:tests/integration/mods/affection/ruffle_hair_playfully_action.test.js†L1-L64】
- Ensure the new tests run alongside the existing affection suites.
