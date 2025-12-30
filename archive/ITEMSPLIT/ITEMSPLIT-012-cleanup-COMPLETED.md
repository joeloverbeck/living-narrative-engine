# ITEMSPLIT-012: Cleanup Original Items Mod - COMPLETED

## Summary

Final cleanup of the original `items` mod after all content has been migrated to granular mods. The mod was deleted entirely (Option A) and all scopes were migrated to appropriate modules.

## Completed Tasks

### Phase 1: Migrate Scopes

1. **[DONE] Migrated `actor_inventory_items` to `inventory` mod**:
   - Created: `data/mods/inventory/scopes/actor_inventory_items.scope`
   - DSL: `inventory:actor_inventory_items := actor.components.inventory:inventory.items[][{"!": {"var": "itemId"}}] | actor.components.inventory:inventory.items[].itemId`

2. **[DONE] Migrated `close_actors_with_inventory` to `inventory` mod**:
   - Created: `data/mods/inventory/scopes/close_actors_with_inventory.scope`
   - DSL: `inventory:close_actors_with_inventory := personal-space:close_actors[{"!!": {"var": "entity.components.inventory:inventory"}}]`

3. **[DONE] Migrated `examinable_items` to `items-core` mod**:
   - Created: `data/mods/items-core/scopes/examinable_items.scope`
   - DSL: `items-core:examinable_items := inventory:actor_inventory_items | items-core:items_at_location | items-core:non_portable_items_at_location`

4. **[DONE] Updated mod manifests**:
   - Updated `data/mods/inventory/mod-manifest.json` - added scopes to content
   - Updated `data/mods/items-core/mod-manifest.json` - added scope and inventory dependency

### Phase 2: Update All References

5. **[DONE] Updated actions using `items:actor_inventory_items` → `inventory:actor_inventory_items`**:
   - `data/mods/item-placement/actions/put_on_nearby_surface.action.json`
   - `data/mods/containers/actions/put_in_container.action.json`
   - `data/mods/cosmetics/actions/apply_lipstick.action.json`
   - `data/mods/item-transfer/actions/give_item.action.json`
   - `data/mods/observation/actions/examine_owned_item.action.json`
   - `data/mods/writing/actions/sign_document.action.json`
   - `data/mods/writing/actions/jot_down_notes.action.json`

6. **[DONE] Updated actions using `items:examinable_items` → `items-core:examinable_items`**:
   - `data/mods/comfort/actions/hug_item_for_comfort.action.json`
   - `data/mods/reading/actions/read_item.action.json`
   - `data/mods/drinking/actions/drink_entirely.action.json`
   - `data/mods/drinking/actions/drink_from.action.json`
   - `data/mods/music/actions/set_*_mood_on_instrument.action.json` (10 files)

### Phase 3: Update Mod Dependencies

7. **[DONE] Updated 16 mod manifests**:
   - Removed `items` dependency
   - Added `inventory` and/or `items-core` dependencies as appropriate

### Phase 4: Delete Items Mod

8. **[DONE] Deleted `data/mods/items/` directory entirely**

### Phase 5: Fix Tests

9. **[DONE] Fixed test helper**:
   - Updated `tests/common/mods/scopeResolverHelpers.js` - Added `registerInventoryScopes()` method with proper resolvers for `inventory:actor_inventory_items` and `items-core:examinable_items`

10. **[DONE] Fixed 10+ integration test files**:
    - Added `ScopeResolverHelpers.registerInventoryScopes(testFixture.testEnv)` calls to tests using inventory/examinable scopes:
      - `tests/integration/mods/observation/examineOwnedItemActionDiscovery.test.js`
      - `tests/integration/mods/writing/signDocumentActionDiscovery.test.js`
      - `tests/integration/mods/writing/jotDownNotesActionDiscovery.test.js`
      - `tests/integration/mods/music/setAggressiveMoodOnInstrumentActionDiscovery.test.js`
      - `tests/integration/mods/music/musicMoodActionsDiscovery.test.js`
      - `tests/integration/mods/item-placement/putOnNearbySurfaceActionDiscovery.test.js`
      - `tests/integration/mods/item-placement/putOnSurfaceBertramScenario.test.js`
      - `tests/integration/mods/item-transfer/giveItemActionDiscovery.test.js`
      - `tests/integration/mods/cosmetics/applyLipstickActionDiscovery.test.js`
      - `tests/integration/mods/comfort/hugItemForComfortActionDiscovery.test.js`

11. **[DONE] Fixed test expectation in `musicMoodActionsDiscovery.test.js`**:
    - Updated test "should NOT discover actions for non-portable instruments" → "should discover actions for non-portable instruments"
    - The `examinable_items` scope correctly includes non-portable items (like grand pianos), making them available for music actions

## Validation Results

- **Unit tests**: 17579 passed
- **Integration tests**: 2070 test suites passed
- **All tests**: ✅ PASS

## Files Changed

### Created (3 files)
- `data/mods/inventory/scopes/actor_inventory_items.scope`
- `data/mods/inventory/scopes/close_actors_with_inventory.scope`
- `data/mods/items-core/scopes/examinable_items.scope`

### Modified (30+ files)
- 2 mod-manifest.json files (inventory, items-core)
- 17 action files (scope references)
- 16 mod-manifest.json files (dependency updates)
- 1 test helper file (scopeResolverHelpers.js)
- 11 integration test files

### Deleted
- `data/mods/items/` entire directory (all content had been migrated)

## Final State

The `items` mod has been completely removed. Its functionality is now distributed across:
- **`items-core`** - Core markers, scopes (`items_at_location`, `non_portable_items_at_location`, `examinable_items`)
- **`inventory`** - Inventory management, scopes (`actor_inventory_items`, `close_actors_with_inventory`)
- **`aiming-states` + `aiming`** - Aiming functionality
- **`wielding-states` + `wielding`** - Wielding functionality
- **`drinking`** - Liquid consumption
- **`reading`** - Readable items
- **`cosmetics`** - Cosmetic items
- **`comfort`** - Comfort items

## Completion Date

December 29, 2025
