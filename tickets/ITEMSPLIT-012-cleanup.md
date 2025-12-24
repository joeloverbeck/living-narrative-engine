# ITEMSPLIT-012: Cleanup Original Items Mod

## Summary

Final cleanup of the original `items` mod after all content has been migrated to granular mods. This involves either deleting the mod entirely or converting it to a meta-dependency mod.

## Prerequisites

- All previous ITEMSPLIT tickets (001-011) must be completed
- All files must be migrated out of the original `items` mod
- All tests must be passing

## Pre-Cleanup Verification

Before cleanup, verify the `items` mod is empty or contains only the manifest:

```bash
# Check remaining files
find data/mods/items/ -type f -name "*.json" | grep -v mod-manifest

# Expected output: nothing (all files migrated)
```

## Cleanup Options

### Option A: Delete the `items` Mod Entirely (Recommended)

If all content has been migrated:

1. [ ] Remove `items` from `data/game.json`
2. [ ] Delete `data/mods/items/` directory
3. [ ] Update any mods that depend on `items` to depend on specific granular mods instead

### Option B: Convert to Meta-Dependency Mod

If maintaining backward compatibility is needed:

1. [ ] Update `mod-manifest.json` to be a "bundle" that depends on all granular mods:
   ```json
   {
     "id": "items",
     "version": "2.0.0",
     "name": "Items Bundle",
     "description": "Meta-mod that includes all item-related mods for convenience",
     "dependencies": [
       "items-core",
       "inventory",
       "aiming-states",
       "aiming",
       "wielding-states",
       "wielding",
       "drinking",
       "reading",
       "cosmetics",
       "comfort-items"
     ]
   }
   ```
2. [ ] Remove all content directories (keep only mod-manifest.json)
3. [ ] Document that this is now a convenience bundle

## Migration Steps

1. [ ] **Verify all content migrated**:
   ```bash
   # List all remaining files
   find data/mods/items/ -type f -name "*.json"

   # Should only show mod-manifest.json
   ```

2. [ ] **Update dependent mods**:
   ```bash
   # Find mods that depend on "items"
   grep -r '"items"' data/mods/*/mod-manifest.json

   # Update each to depend on appropriate granular mods
   ```

3. [ ] **Update game.json**:
   - Remove `items` OR
   - Update load order to include all new granular mods

4. [ ] **Execute chosen cleanup option** (A or B)

5. [ ] **Update tests**:
   ```bash
   # Find tests referencing items mod
   grep -r "data/mods/items" tests/
   grep -r '"items"' tests/

   # Update paths and references
   ```

6. [ ] **Final validation**:
   ```bash
   npm run validate
   npm run test:unit
   npm run test:integration
   npm run test:e2e
   ```

7. [ ] **Document changes**:
   - Update any documentation referencing the `items` mod
   - Add migration notes if needed for mod authors

## Validation Checklist

- [ ] `npm run validate` passes
- [ ] `npm run test:unit` passes
- [ ] `npm run test:integration` passes
- [ ] `npm run test:e2e` passes
- [ ] No references to old `items` mod paths remain
- [ ] All dependent mods updated to new dependencies
- [ ] Game loads and runs correctly
- [ ] No console errors related to items mod

## Post-Cleanup Verification

```bash
# Verify no broken references
grep -r "items:" data/mods/ | grep -v "items-core:" | grep -v "comfort_items:"

# Verify game.json is correct
cat data/game.json | grep -A 20 '"mods"'

# Run full test suite
npm run test:ci
```

## Blocked By

- ITEMSPLIT-001 through ITEMSPLIT-011

## Blocks

None (final ticket in series)

## Success Criteria

- [ ] Original `items` mod either deleted or converted to meta-mod
- [ ] All 11 granular mods functional and tested
- [ ] No broken references anywhere in codebase
- [ ] All tests passing
- [ ] Game runs correctly with new mod structure
- [ ] Documentation updated

## Notes

- This is the final ticket in the ITEMSPLIT series
- After completion, the items functionality will be distributed across:
  - `items-core` - Core markers and scopes
  - `inventory` - Inventory management
  - `aiming-states` + `aiming` - Aiming functionality
  - `wielding-states` + `wielding` - Wielding functionality
  - `drinking` - Liquid consumption
  - `reading` - Readable items
  - `cosmetics` - Cosmetic items
  - `comfort-items` - Comfort items
