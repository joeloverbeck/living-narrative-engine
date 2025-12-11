# FIRAIDDISWOUBODPAR-003: Scope for disinfectant liquids in inventory

## Status
Completed.

## Goal
Add a scope that returns inventory items with `containers-core:liquid_container.tags` containing `"disinfectant"` and `currentVolumeMilliliters > 0`, usable by first-aid actions.

## Current state check
- `containers-core:liquid_container` already supports optional `tags` (schema + unit tests in `tests/unit/mods/items/components/dataComponents.test.js`).
- No disinfectant-specific scope exists yet and `data/mods/items/mod-manifest.json` has no entry for one.
- Inventory items remain string IDs (`items:inventory.items`), so the scope should resolve entity components from those IDs (mirror `items:aimable_items_in_inventory` and similar filters).

## File list
- `data/mods/items/scopes/disinfectant_liquids_in_inventory.scope` (new scope definition)
- `data/mods/items/mod-manifest.json` scope list updated to include the new scope
- Unit/integration test for the scope filtering logic under `tests/integration/mods/items/` (may reuse the ScopeEngine pattern from `tests/integration/mods/items/wielded_items_scope.integration.test.js`)

## Out of scope
- Do not alter existing scope behaviours unrelated to disinfectant filtering.
- No action/rule changes; only add the scope and its tests/registration.
- No changes to inventory structure or item components beyond scope usage.

## Acceptance criteria
- Tests: scope test covering tag presence, non-zero volume, and exclusion cases passes via `npm run test:unit -- <path-to-scope-test>` or `npm run test:integration -- <path-to-scope-test>` (ScopeEngine-driven).
- Invariants: other inventory scopes (e.g., `actor_inventory_items`) continue to behave unchanged; scope requires both tag and volume to include an item.

## Outcome
- Added `items:disinfectant_liquids_in_inventory` scope filtering inventory items that have a liquid container with the `disinfectant` tag and `currentVolumeMilliliters > 0`, registered in `data/mods/items/mod-manifest.json`.
- Added integration coverage at `tests/integration/mods/items/disinfectant_liquids_in_inventory_scope.integration.test.js` validating tag/volume inclusion and exclusion of empty, untagged, or non-inventory items.
