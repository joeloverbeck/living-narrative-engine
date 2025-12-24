# ITEMSPLIT-001: Create items-core Mod - COMPLETED

## Summary

Created the foundational `items-core` mod by splitting core item marker components from the existing `items` mod.

## Completion Date

2025-12-24

## What Was Implemented

### New Mod Structure

```
data/mods/items-core/
├── mod-manifest.json
├── components/
│   ├── item.component.json
│   ├── portable.component.json
│   └── openable.component.json
├── scopes/
│   ├── items_at_location.scope
│   ├── items_at_actor_location.scope
│   └── non_portable_items_at_location.scope
└── conditions/
    └── secondary-has-portable.condition.json
```

### Namespace Changes

All IDs updated from `items:` to `items-core:` namespace:

- Components: `items-core:item`, `items-core:portable`, `items-core:openable`
- Scopes: `items-core:items_at_location`, `items-core:items_at_actor_location`, `items-core:non_portable_items_at_location`
- Conditions: `items-core:secondary-has-portable`

## Deviations from Original Plan

### 1. Namespace Must Match Mod Name (User Correction)

**Originally planned**: Keep `items:` namespace with new mod
**Actual**: Changed to `items-core:` namespace to match mod name per project convention

### 2. Scope Reduction

**Originally planned**: 5 scopes
**Actual**: 3 scopes moved to items-core

Scopes NOT moved (depend on `items:inventory` component):
- `actor_inventory_items.scope` → stays in items mod for ITEMSPLIT-002 (inventory)
- `examinable_items.scope` → stays in items mod for ITEMSPLIT-002 (inventory)

### 3. Dependencies

**Originally planned**: `["locations"]`
**Actual**: `[]` (no dependencies - core markers don't depend on anything)

## Files Modified

### New Files Created

- `data/mods/items-core/mod-manifest.json`
- `data/mods/items-core/components/item.component.json`
- `data/mods/items-core/components/portable.component.json`
- `data/mods/items-core/components/openable.component.json`
- `data/mods/items-core/scopes/items_at_location.scope`
- `data/mods/items-core/scopes/items_at_actor_location.scope`
- `data/mods/items-core/scopes/non_portable_items_at_location.scope`
- `data/mods/items-core/conditions/secondary-has-portable.condition.json`
- `tests/unit/mods/items-core/components/markerComponents.test.js`

### Source Files Updated

- `src/data/providers/availableActionsProvider.js` - Added `items-core:` to ACTION_AFFECTING_COMPONENTS for cache invalidation

### Mod Manifests Updated (19 mods)

Added `items-core` dependency to:
- accessories, armor, base-clothing, breaching, dredgers, fantasy, furniture
- intoxicants, item-handling, lighting, music, observation, outer-clothing
- patrol, ranged, underwear, warding, weapons, writing

### Test Files Updated

- `tests/unit/mods/items-core/components/markerComponents.test.js` - New location with updated namespace
- `tests/integration/mods/furniture/furnitureModDependencies.integration.test.js` - Updated for items-core dependency
- `tests/integration/mods/weapons/weaponComponentLoading.integration.test.js` - Updated paths to items-core
- 159 additional test files - Updated namespace references via sed

## Validation Results

- **Mod Validation**: PASSED - 0 violations across 93 mods
- **Unit Tests**: PASSED - All 40,763 tests passing
- **Integration Tests**: PASSED for items-core related tests

## Notes for Follow-up Tickets

### ITEMSPLIT-002 (Inventory) Should Include

- `actor_inventory_items.scope` (depends on `items:inventory`)
- `examinable_items.scope` (depends on `actor_inventory_items`)
- The `items:inventory` component itself

### Items Mod Status

The `items` mod no longer contains the core marker components. It now depends on `items-core` and contains only the inventory-related components and scopes.
