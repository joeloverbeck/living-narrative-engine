# FIRAIDDISWOUBODPAR-004: Action definition for disinfecting wounded body parts

## Current context check
- `items:disinfectant_liquids_in_inventory` scope already exists and filters tagged liquid containers with volume > 0.
- `skills:medicine_skill` component already exists in `data/mods/skills/components/medicine_skill.component.json`.
- `first-aid:wounded_actor_body_parts` scope already exists; `first-aid:disinfected` component schema is present (rule handling is ticketed separately).

## Goal
Add the `first-aid:disinfect_wounded_part` action that wires the existing scopes/components together with correct visuals, generateCombinations, and forbidden/required components.

## File list
- `data/mods/first-aid/actions/disinfect_wounded_part.action.json` (new)
- `data/mods/first-aid/mod-manifest.json` (add the action to the manifest)

## Out of scope
- Do not implement rule handling, messages, or status application (covered by follow-up ticket).
- No changes to violence actions beyond mirroring forbidden components.
- Do not adjust existing scopes or component schemas beyond wiring them into the action.

## Acceptance criteria
- Tests: integration test showing the action is discoverable only when the actor has `skills:medicine_skill` and an inventory disinfectant container with volume, and is hidden when prerequisites fail (e.g., no medicine skill, no wounded parts, or no disinfectant). Use the existing JS integration test patterns under `tests/integration/mods/first-aid/`.
- Invariants: action remains non-chance-based (no `chanceBased`), uses the First-Aid color scheme, and mirrors `violence:peck_target` forbidden actor positioning and `secondary: ["core:dead"]` behaviour.

## Status
Completed.

## Outcome
- Implemented `data/mods/first-aid/actions/disinfect_wounded_part.action.json` using existing scopes (`core:actors_in_location`, `first-aid:wounded_actor_body_parts`, `items:disinfectant_liquids_in_inventory`), First-Aid visuals, and a small actor gate on `skills:medicine_skill` + `items:inventory`.
- Added the action to `data/mods/first-aid/mod-manifest.json`.
- Added integration coverage at `tests/integration/mods/first-aid/disinfect_wounded_part_action_discovery.test.js` to prove discoverability toggles (skill, wound, disinfectant volume/tag) with lightweight custom resolvers mirroring the DSL scopes for test isolation.
