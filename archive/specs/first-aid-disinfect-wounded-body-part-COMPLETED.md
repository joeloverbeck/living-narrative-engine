# First-Aid Disinfect Wounded Body Part Action & Rule

## Context
- First-aid mod is currently scaffold-only; wounded body part scoping exists (see `data/mods/first-aid/scopes/wounded_actor_body_parts.scope`) and new operators (`hasWoundedPartOperator`, `hasPartWithStatusEffectOperator`) make it easier to target injured anatomy.
- Body-part targeting in actions is only exemplified by `data/mods/violence/actions/peck_target.action.json`, whose primary scope directly points at body parts.
- Liquid containers cannot be tagged, so there is no way to scope “disinfectant” liquids in inventory items.

## Goal
Add a non-chance-based first-aid action/rule that lets an actor disinfect another actor’s wounded body part using an inventory item whose liquid container is tagged `disinfectant`, plus supporting schema/component/scope updates and tests.

## Action: `first-aid:disinfect_wounded_part`
- Template: `disinfect {target}'s {woundedBodyPart} with {disinfectant}`
- Visuals: use First-Aid’s Forest Green (4.1) from `docs/mods/mod-color-schemes.md`  
  `backgroundColor: #1b5e20`, `textColor: #e8f5e9`, `hoverBackgroundColor: #2e7d32`, `hoverTextColor: #ffffff`
- Required components: `actor` must have `skills:medicine_skill` (new component in `data/mods/skills/components/medicine_skill.component.json`, schema mirrors other skill components with a `value` integer 0-100).
- Forbidden components: `actor` list must mirror `violence:peck_target` (`positioning:hugging`, `positioning:giving_blowjob`, `positioning:doing_complex_performance`, `positioning:bending_over`, `positioning:being_restrained`, `positioning:restraining`, `positioning:fallen`); keep the standard `secondary: ["core:dead"]`.
- Prerequisites: none.
- Chance: none (omit `chanceBased`).
- Targets/scopes:
  - Primary `target`: `core:actors_in_location`
  - Secondary `woundedBodyPart`: `first-aid:wounded_actor_body_parts` with `contextFrom: "primary"` so we scope parts on the selected `target`.
  - Tertiary `disinfectant`: new scope that returns items in the actor’s inventory whose `items:liquid_container.tags` includes `"disinfectant"` and `currentVolumeMilliliters > 0` (see Scope section).
- generateCombinations: true (match body-part target pattern in `peck_target` to surface all valid tuples).

## Scope: disinfectant inventory items
- Add `data/mods/items/scopes/disinfectant_liquids_in_inventory.scope` (or similar name) that:
  - Starts from `actor.components.items:inventory.items[]`
  - Filters for entities with an `items:liquid_container` component whose `tags` array contains `"disinfectant"` and `currentVolumeMilliliters > 0`.
  - Emits the item entity IDs (mirror patterns from `actor_inventory_items.scope` and other filter scopes).

## Component & schema changes
- Update `data/mods/items/components/liquid_container.component.json` to support an optional `tags` array of strings (for scope queries like disinfectant). Keep existing required fields intact; allow `tags` to be empty or omitted.
- New skill component: `data/mods/skills/components/medicine_skill.component.json` (`skills:medicine_skill`), integer `value` 0-100 with default 0, styled after other skill components.
- New status component: `data/mods/first-aid/components/disinfected.component.json` (`first-aid:disinfected`) applied to body part entities. Schema should capture at least `appliedById` (string), `sourceItemId` (string), `appliedAtTurn` (integer ≥0), optional `expiresAtTurn` (integer ≥0) for future decay, and optional `notes` string; `additionalProperties: false`.

## Rule: handle disinfect action
- Condition: new condition file `data/mods/first-aid/conditions/event-is-action-disinfect-wounded-part.condition.json` checking `event.payload.actionId === "first-aid:disinfect_wounded_part"`.
- Rule file `data/mods/first-aid/rules/handle_disinfect_wounded_part.rule.json` listening on `core:attempt_action`.
- Behavior:
  - Resolve names for `actor`, `target`, `woundedBodyPart` entity, and `disinfectant` item for templating.
  - Dispatch perceptible event + successful action message: `{actor} disinfects {target}'s {woundedBodyPart} with {disinfectant}.`
  - Add `first-aid:disinfected` component to the `woundedBodyPart` entity with metadata (applied by actor, source item ID, applied turn timestamp).
  - Regenerate description of the `target` (and optionally actor if inventories change) to reflect treatment status.
  - End turn/advance time according to existing first-aid cadence (follow patterns used in other healing/recovery rules).

## Entities / content updates
- Tag at least one disinfectant-carrying item so the action is discoverable (e.g., create `data/mods/first-aid/entities/definitions/antiseptic_bottle.entity.json` with `items:liquid_container.tags: ["disinfectant"]` and required volume fields). Update any existing relevant items similarly.
- Ensure manifest wiring includes new action/rule/condition/components if needed.

## Tests
- Add integration coverage under `tests/integration/mods/first-aid/` (see patterns in other mod suites and `docs/testing/`):
  - Action discoverability: actor with `medicine_skill` + disinfectant item + target with wounded part sees the action; action disappears if no wounded parts or no disinfectant-tagged liquid container.
  - Scope correctness: tertiary scope ignores empty containers and items without the `disinfectant` tag; respects `contextFrom` for wounded body part selection.
  - Rule behavior: executing the action dispatches the perceptible message text above and adds `first-aid:disinfected` to the targeted body part with populated metadata.
- Unit tests for the new scope and any helper logic; reuse operator tests (`hasWoundedPartOperator`, `hasPartWithStatusEffectOperator`) as fixtures where helpful.
