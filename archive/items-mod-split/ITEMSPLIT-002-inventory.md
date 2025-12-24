# ITEMSPLIT-002: Create inventory Mod

## Summary

Create the `inventory` mod containing inventory management component and item transfer events. This mod depends on `items-core` and enables item carrying/transfer mechanics.

**⚠️ SCOPE CORRECTION**: This ticket originally underestimated the scope. The namespace change `items:inventory` → `inventory:inventory` affects ~250+ files across mod data, source code, and tests.

## Prerequisites

- ITEMSPLIT-001 (items-core) must be completed first ✅

## Mod Specification

**Directory**: `data/mods/inventory/`

**mod-manifest.json**:
```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "inventory",
  "version": "1.0.0",
  "name": "Inventory",
  "description": "Inventory component for carrying items and item transfer events",
  "author": "Living Narrative Engine",
  "gameVersion": ">=0.0.1",
  "dependencies": [
    { "id": "items-core", "version": "^1.0.0" }
  ],
  "content": {
    "components": ["inventory.component.json"],
    "events": ["item_picked_up.event.json", "item_dropped.event.json", "item_transferred.event.json"],
    "actions": [],
    "rules": [],
    "conditions": [],
    "scopes": [],
    "entities": { "definitions": [], "instances": [] }
  }
}
```

**Note**: `personal-space` dependency removed - the inventory mod is a pure foundational mod.

## Files to Move

### Components (namespace change: `items:` → `inventory:`)

| Source File | Destination | Old ID | New ID |
|-------------|-------------|--------|--------|
| `data/mods/items/components/inventory.component.json` | `data/mods/inventory/components/` | `items:inventory` | `inventory:inventory` |

### Events

| Source File | Destination |
|-------------|-------------|
| `data/mods/items/events/item_picked_up.event.json` | `data/mods/inventory/events/` |
| `data/mods/items/events/item_dropped.event.json` | `data/mods/inventory/events/` |
| `data/mods/items/events/item_transferred.event.json` | `data/mods/inventory/events/` |

### Scopes - CORRECTION

**`close_actors_with_inventory.scope` will NOT be moved** - it remains in the `items` mod because:
- It extends `personal-space:close_actors` scope
- Moving it would require inventory → personal-space dependency (wrong direction)
- The `items` mod already depends on `personal-space`

## Namespace Changes

| Old ID | New ID |
|--------|--------|
| `items:inventory` | `inventory:inventory` |

## External References to Update (~250+ files)

### Source Code (10 files with hardcoded constants)
- `src/logic/operationHandlers/dropItemAtLocationHandler.js`
- `src/logic/operationHandlers/pickUpItemFromLocationHandler.js`
- `src/logic/operationHandlers/openContainerHandler.js`
- `src/logic/operationHandlers/putInContainerHandler.js`
- `src/logic/operationHandlers/takeFromContainerHandler.js`
- `src/logic/operationHandlers/transferItemHandler.js`
- `src/logic/operationHandlers/validateInventoryCapacityHandler.js`
- `src/logic/operationHandlers/equipClothingHandler.js`
- `src/anatomy/bodyDescriptionComposer.js`
- `src/locations/services/lightingStateService.js`

### Mod Data (~55 files)
- Action files across: item-handling, items, containers, lighting, item-placement, locks, item-transfer, first-aid, weapons
- Scope files with DSL expressions referencing inventory component
- Condition/Rule files in locks mod
- Character entity files in patrol, dredgers, fantasy mods

### Tests (~156 files)
- Test helpers in `tests/common/`
- Unit tests in `tests/unit/`
- Integration tests in `tests/integration/`
- E2E tests in `tests/e2e/`

## Migration Steps

1. [x] Create directory structure
2. [x] Create `mod-manifest.json`
3. [x] Copy and update component file (ID: `inventory:inventory`)
4. [x] Copy event files (3 files)
5. [x] Bulk update all external references using sed
6. [x] Update `items` mod manifest to depend on `inventory`
7. [x] Remove copied files from original `items` mod
8. [x] Validate with npm run validate
9. [x] Run test suites

**Note**: game.json does NOT need updating - mods are loaded via dependency chain.

## Validation Checklist

- [x] `npm run validate` passes
- [x] `npm run test:unit` passes
- [x] `npm run test:integration` passes
- [x] No circular dependencies
- [x] All `items:inventory` references updated to `inventory:inventory`
- [x] Mod loads correctly in game

## Blocked By

- ITEMSPLIT-001 (items-core) ✅ COMPLETED

## Blocks

- ITEMSPLIT-005 (aiming) - needs inventory for wielded items
- ITEMSPLIT-006 (wielding) - needs inventory
- ITEMSPLIT-007 (drinking) - needs inventory
- ITEMSPLIT-009 (cosmetics) - needs inventory
- ITEMSPLIT-010 (comfort-items) - needs inventory

## Status

**COMPLETED** ✅

## Outcome

**Completed**: 2025-12-24

**Changes Made**:
1. Created `data/mods/inventory/` mod with:
   - `mod-manifest.json` with `items-core` dependency
   - `inventory:inventory` component (inventory.component.json)
   - 3 transfer event files (item_picked_up, item_dropped, item_transferred)
2. Updated 752 references from `items:inventory` to `inventory:inventory` across:
   - ~10 source files with hardcoded constants
   - ~55 mod data files (actions, scopes, conditions, rules, entities)
   - ~156 test files
3. Added `inventory` dependency to 18 mods that reference `inventory:inventory`:
   - breaching, clothing, containers, dredgers, fantasy, first-aid, item-handling
   - item-placement, item-transfer, lighting, locks, p_erotica, p_erotica_duchess
   - p_erotica_irun, patrol, ranged, warding, weapons
4. Updated `items` mod to depend on `inventory` and removed migrated files
5. Added `'inventory:'` prefix to `ACTION_AFFECTING_COMPONENTS` in availableActionsProvider.js for cache invalidation

**Test Fixes Required**:
- `tests/integration/mods/warding/warding_components_loading.test.js`: Updated to expect `inventory` dependency instead of removed `items` dependency

**Discrepancies from Original Ticket**:
- Scope increased from "6 files" to 752 references (namespace change impact)
- Removed `personal-space` dependency (not needed for inventory mod)
- `close_actors_with_inventory.scope` kept in `items` mod (not moved)
- game.json not updated (mods loaded via dependency chain)

**Validation**:
- `npm run validate` ✅ (0 cross-reference violations)
- `npm run test:unit` ✅ (40764 tests passed)
- `npm run test:integration` ✅ (only pre-existing anatomy-creatures failure unrelated to this ticket)
