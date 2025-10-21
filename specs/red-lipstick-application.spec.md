# Red Lipstick Item & Apply Action Specification

## Summary
- Introduce a red lipstick item entity definition carrying the base `items:item`, `items:portable`, and a new marker component `items:can_apply_lipstick`.
- Define a new `items:can_apply_lipstick` marker component under `data/mods/items/components/` and register it in the mod manifest.
- Add an `items:apply_lipstick` action requiring actors with `items:inventory` to select a single inventory item scoped via `items:actor_inventory_items` that includes the new marker component; surface the prompt template `"coat your lips evenly with {item}"`.
- Implement a corresponding `items:apply_lipstick` rule that emits both the perceptible event and successful action message `{actor} coats their lips evenly with {item}.`.
- Expand integration test coverage to validate action discoverability and rule execution behavior using the patterns documented in `docs/testing/` and existing suites under `tests/integration/mods/`.

## Background & Related Components
- `data/mods/items/components/item.component.json` establishes the generic marker for items; the lipstick entity must include it for item system compatibility.
- `data/mods/items/components/portable.component.json` gates portable inventory items; reuse this to make lipstick carriable.
- `data/mods/items/components/weight.component.json` demonstrates schema conventions for components; the new `items:can_apply_lipstick` should follow the marker-style layout (`dataSchema` empty object, no properties) similar to `items:item` and `items:portable`.
- `data/mods/items/actions/give_item.action.json` illustrates action schema usage, required components, and target scoping—mirror its structure while constraining the new action to a single `primary` target drawn from `items:actor_inventory_items`.

## Detailed Requirements

### Red Lipstick Entity Definition
- Location: `data/mods/items/entities/definitions/red_lipstick.entity.json`.
- Schema: `schema://living-narrative-engine/entity.schema.json`.
- Metadata:
  - `id`: `items:red_lipstick`.
  - `name`: `"red lipstick"` (lowercase to ensure runtime template renders `red lipstick`).
  - Optional description can highlight cosmetic usage but keep scope minimal.
- Components:
  - Include `items:item` and `items:portable`.
  - Add the new marker `items:can_apply_lipstick` component.
  - Add weight if desired (e.g., reuse `items:weight` with a light value) but only if consistent with balance.
- Register the entity in `data/mods/items/mod-manifest.json` under `content.entities.definitions`.

### New Marker Component (`items:can_apply_lipstick`)
- Location: `data/mods/items/components/can_apply_lipstick.component.json`.
- Schema: `schema://living-narrative-engine/component.schema.json`.
- Structure: marker component (no properties, `additionalProperties: false`).
- Description: clarifies that items with this component can be used to apply lipstick.
- Register in the mod manifest `content.components`.

### Apply Lipstick Action Definition
- Location: `data/mods/items/actions/apply_lipstick.action.json`.
- Schema: `schema://living-narrative-engine/action.schema.json`.
- Identifiers:
  - `id`: `items:apply_lipstick`.
  - `name`: `"Apply Lipstick"`.
  - `description`: describe coating lips with a qualifying cosmetic item.
- `generateCombinations`: enable if action should auto-combine actors and items (likely `true`, matching other inventory actions).
- `required_components`:
  - `actor`: `["items:inventory"]` to ensure the actor has an inventory container for the lipstick.
- `targets`:
  - Single `primary` target.
  - `scope`: `"items:actor_inventory_items"`.
  - `placeholder`: `item`.
  - `description`: clarify this must be a lipstick-capable item.
  - `required_components`: include `items:can_apply_lipstick` (and optionally `items:item` for safety) so only lipstick-capable inventory items appear.
- `template`: `"coat your lips evenly with {item}"`.
- Add to manifest `content.actions`.

### Apply Lipstick Rule Definition
- Location: `data/mods/items/rules/handle_apply_lipstick.rule.json`.
- Schema: `schema://living-narrative-engine/rule.schema.json`.
- Trigger: `core:attempt_action` events filtered via a new condition `event-is-action-apply-lipstick.condition.json` (mirror existing action conditions under `data/mods/items/conditions/`).
- Behavior:
  1. When the action succeeds, dispatch a `core:perceptible_event` whose `message` is `{actor} coats their lips evenly with {item}.`.
  2. Emit a matching `core:display_successful_action_result` (or equivalent) with the same string for UI feedback.
  3. Ensure contextual data (e.g., recipients) mirrors norms in comparable rules so observers see the message appropriately (likely all nearby actors, unless lipstick application should be private).
  4. End the action with a success outcome; no inventory mutation required (lipstick remains in inventory).
- Register both the new condition and rule in the mod manifest.

### Manifest Updates
- Append the new component, action, condition, rule, and entity IDs to `data/mods/items/mod-manifest.json` sections to ensure they load.
- If a new perception type is introduced, document/register it alongside existing enumerations.

## Testing Strategy
- Follow guidelines in `docs/testing/` for mod integration suites.
- Add new integration tests under `tests/integration/mods/items/`:
  - **Action discoverability suite** (e.g., `applyLipstickActionDiscovery.test.js`): verify the action surfaces only when the actor has `items:inventory` and possesses a lipstick item carrying `items:can_apply_lipstick`; ensure absence when inventory lacks such items or actor lacks inventory.
  - **Rule execution suite** (e.g., `applyLipstickRuleExecution.test.js`): execute the action and assert the perceptible event and success message both output `{actor} coats their lips evenly with {item}.` with the lipstick entity name substituted; confirm state remains stable and the action succeeds.
- Reuse fixtures/patterns from existing inventory-related tests (see `tests/integration/mods/items/`) to maintain consistency.
- Tests must cover discoverability permutations (inventory present/absent, wrong items) and rule outcomes (success path, message content) comprehensively.

## Open Questions & Considerations
- Confirm whether lipstick application should consume the item or track usage counts; current spec assumes infinite use.
- Decide if additional cosmetic categories (color variants) are anticipated, potentially warranting shared helper utilities or data-driven tests.
- Validate whether the perceptible event should be audible/visible to others or restricted to the actor; align with narrative tone.

