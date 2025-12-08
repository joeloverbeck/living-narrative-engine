# Self-Disinfect Action & Wounded Scope Corrections

## Context
- `data/mods/first-aid/actions/disinfect_wounded_part.action.json` currently disinfects another actor: primary scope selects actors in location, secondary selects their wounded parts via `first-aid:wounded_actor_body_parts`, tertiary selects disinfectant liquids. Because it owns three scopes and the wounded-part scope actually iterates `target.body_parts`, it is not a good base for an actor-only variant.
- The scope identifier `first-aid:wounded_actor_body_parts` is misnamed: its DSL path is `target.body_parts`, not `actor.body_parts`. README/docs claim actor traversal, so the identifier and references need to be corrected to reflect that it scopes the target.

## Goals
- Rename the existing target-facing wounded-part scope to an accurate identifier and update all references/tests.
- Introduce a new actor-facing wounded-part scope (same filtering logic, but against `actor.body_parts`) for self-treatment flows.
- Add a new action + rule that lets the acting actor disinfect their own wounded part with a disinfectant liquid, using the new actor scope.
- Keep visuals consistent with the existing first-aid disinfect action.

## Scope Changes
- Rename `data/mods/first-aid/scopes/wounded_actor_body_parts.scope` identifier to `first-aid:wounded_target_body_parts` (or similarly explicit “target” naming). Update the file name, mod manifest entry, scope README, and every reference across tests and actions (integration + e2e suites under `tests/**/*woundedBodyParts*` and disinfect action discovery/fantasy scenario tests) to the new identifier.
- Add a new scope file `data/mods/first-aid/scopes/wounded_actor_body_parts.scope` that mirrors the current JSON Logic predicates but walks `actor.body_parts` instead of `target.body_parts`. Preserve the vital-organ exclusion and part_health < maxHealth filter.
- Keep both scopes documented in `data/mods/first-aid/scopes/README.md` with correct descriptions.

## New Action (self-disinfect)
- Add an action (suggested id: `first-aid:disinfect_my_wounded_part`) with template `disinfect my {woundedBodyPart} with {disinfectant}`.
- Required components: `actor` → `skills:medicine_skill`, `items:inventory`.
- Forbidden components: `actor` mirrors `disinfect_wounded_part.action.json` (hugging, giving_blowjob, doing_complex_performance, bending_over, being_restrained, restraining, fallen). No `forbidden_components` for `secondary`.
- Targets (only two scopes):
  - `primary`: `first-aid:wounded_actor_body_parts` (new actor-facing scope), placeholder `woundedBodyPart`, description that it selects the acting actor’s wounded parts, no `contextFrom`.
  - `secondary`: `items:disinfectant_liquids_in_inventory`, placeholder `disinfectant`, description unchanged.
- Add `forbidden_components` for `primary` to block already disinfected parts: `first-aid:disinfected` (so the action hides when the part already has the component).
- Reuse the visual scheme from `first-aid:disinfect_wounded_part` (`#1b5e20` background, `#e8f5e9` text, `#2e7d32` hover background, `#ffffff` hover text).

## New Rule/Condition
- Create a dedicated condition (e.g., `first-aid:event-is-action-disinfect-my-wounded-part`) and rule `handle_disinfect_my_wounded_part` wired to `core:attempt_action`.
- On success: add `first-aid:disinfected` to the selected wounded body part with `appliedById` = actor id and `sourceItemId` = disinfectant id; regenerate descriptions for actor and the part (actor refresh may be optional if nothing changes).
- Log/perception string should be: `{actor} disinfects their wounded {woundedBodyPart} with {disinfectant}.` Use `action_target_general` perception type and actor position for location targeting, mirroring the existing rule structure.
- Ensure the existing multi-target disinfect rule remains intact and keep its behavior unchanged aside from the renamed scope reference.

## Tests & Validation
- Update all scope-related tests to the new target-scope identifier: `tests/integration/scopes/first-aid/woundedAndBleedingBodyParts.integration.test.js` and `tests/e2e/first-aid/woundedBodyParts.e2e.test.js` should assert `first-aid:wounded_target_body_parts` and still validate vital-organ exclusion and wounded filtering.
- Adjust disinfect action discovery/fantasy integration tests under `tests/integration/mods/first-aid/` to reference the renamed target scope for the existing action.
- Add new coverage for the self-disinfect flow:
  - Action discoverability: actor with required components, wounded part without `first-aid:disinfected`, and disinfectant in inventory can see the new action; ensure it hides when no wounded parts or when the part is already disinfected.
  - Rule behavior: executing the action adds `first-aid:disinfected` to the chosen body part, regenerates descriptions, logs the new message, and ends the turn. Include a test that the forbidden-component guard prevents selecting already disinfected parts.
- Reference mod test helpers/docs in `docs/testing/` and existing mod suites in `tests/integration/mods/` for patterns.
