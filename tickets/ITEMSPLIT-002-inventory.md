# ITEMSPLIT-002: Create inventory Mod

## Summary

Create the `inventory` mod containing inventory management component and item transfer events. This mod depends on `items-core` and enables item carrying/transfer mechanics.

## Prerequisites

- ITEMSPLIT-001 (items-core) must be completed first

## Mod Specification

**Directory**: `data/mods/inventory/`

**mod-manifest.json**:
```json
{
  "id": "inventory",
  "version": "1.0.0",
  "name": "Inventory",
  "description": "Inventory component for carrying items and item transfer events",
  "dependencies": ["items-core", "personal-space"]
}
```

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

### Scopes

| Source File | Destination |
|-------------|-------------|
| `data/mods/items/scopes/close_actors_with_inventory.scope` | `data/mods/inventory/scopes/` |

## Namespace Changes

| Old ID | New ID |
|--------|--------|
| `items:inventory` | `inventory:inventory` |

## External References to Update

Search and update all references to `items:inventory`:

```bash
grep -r "items:inventory" data/mods/ tests/
```

**Likely locations:**
1. Entity definitions (actors, NPCs with inventory)
2. Scope DSL files checking for inventory
3. Action prerequisites requiring inventory
4. Rules that modify inventory
5. Tests referencing inventory component

## Test Updates

Check for tests that:
- Reference `items:inventory` component ID
- Import from `data/mods/items/` for inventory-related files
- Test inventory operations

Likely locations:
- `tests/integration/mods/items/` (inventory tests)
- `tests/unit/` files referencing inventory

## Migration Steps

1. [ ] Create directory structure:
   ```bash
   mkdir -p data/mods/inventory/{components,events,scopes}
   ```

2. [ ] Create `mod-manifest.json`

3. [ ] Copy and update component file (1 file)
   - Update `id` from `items:inventory` to `inventory:inventory`

4. [ ] Copy event files (3 files)

5. [ ] Copy scope file (1 file)

6. [ ] Update `data/game.json` to include `inventory` after `items-core`

7. [ ] Find and update all external references:
   ```bash
   grep -r "items:inventory" data/mods/ tests/
   # Update each reference to inventory:inventory
   ```

8. [ ] Update `items` mod manifest to depend on `inventory`

9. [ ] Validate:
   ```bash
   npm run validate
   npm run test:unit
   npm run test:integration
   ```

10. [ ] Remove copied files from original `items` mod

## Validation Checklist

- [ ] `npm run validate` passes
- [ ] `npm run test:unit` passes
- [ ] `npm run test:integration` passes
- [ ] No circular dependencies
- [ ] All `items:inventory` references updated to `inventory:inventory`
- [ ] Mod loads correctly in game

## Blocked By

- ITEMSPLIT-001 (items-core)

## Blocks

- ITEMSPLIT-005 (aiming) - needs inventory for wielded items
- ITEMSPLIT-006 (wielding) - needs inventory
- ITEMSPLIT-007 (drinking) - needs inventory
- ITEMSPLIT-009 (cosmetics) - needs inventory
- ITEMSPLIT-010 (comfort-items) - needs inventory
