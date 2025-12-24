# ITEMSPLIT-004: Create wielding-states Mod

## Summary

Create the `wielding-states` mod containing state components for item wielding mechanics. This mod is separated from the main `wielding` mod to avoid circular dependencies, following the project's `-states` pattern.

## Prerequisites

- ITEMSPLIT-001 (items-core) must be completed first

## Mod Specification

**Directory**: `data/mods/wielding-states/`

**mod-manifest.json**:
```json
{
  "id": "wielding_states",
  "version": "1.0.0",
  "name": "Wielding States",
  "description": "State components for item wielding. Separated to avoid circular dependencies.",
  "dependencies": ["items-core"]
}
```

## Files to Move

### Components

**Note**: Need to verify which wielding state components exist in the items mod. Check for:
- `wielded_by` component (tracks who is wielding an item)
- `wielding` component (tracks what item actor is wielding)
- Or similar wielding state tracking components

```bash
# Find wielding-related components
ls data/mods/items/components/ | grep -i wield
grep -l "wield" data/mods/items/components/*.json
```

### Expected Structure (verify before migration)

| Source File | Destination | Old ID | New ID |
|-------------|-------------|--------|--------|
| `data/mods/items/components/[wielding_state].component.json` | `data/mods/wielding-states/components/` | `items:[id]` | `wielding:[id]` |

## Investigation Required

Before migration, investigate:

1. **What wielding state components exist?**
   ```bash
   grep -l "wield" data/mods/items/components/*.json
   cat data/mods/items/components/*.json | grep -i wield
   ```

2. **How is wielding state currently tracked?**
   - Check action files for wielding mechanics
   - Check rule files for wielding state changes
   - Check entity definitions for wielded items

3. **Update this ticket** with actual component files found

## Namespace Changes

| Old ID | New ID |
|--------|--------|
| `items:[wielding_component]` | `wielding:[wielding_component]` |

## External References to Update

Once components are identified:

```bash
grep -r "items:[wielding_id]" data/mods/ tests/
```

## Migration Steps

1. [ ] **Investigate** wielding state components (see Investigation Required above)

2. [ ] **Update this ticket** with actual files to move

3. [ ] Create directory structure:
   ```bash
   mkdir -p data/mods/wielding-states/components
   ```

4. [ ] Create `mod-manifest.json`

5. [ ] Copy and update component files
   - Update IDs to `wielding:` namespace

6. [ ] Update `data/game.json` to include `wielding-states` after `items-core`

7. [ ] Find and update all external references

8. [ ] Validate:
   ```bash
   npm run validate
   npm run test:unit
   npm run test:integration
   ```

9. [ ] Remove copied files from original `items` mod

## Validation Checklist

- [ ] `npm run validate` passes
- [ ] `npm run test:unit` passes
- [ ] `npm run test:integration` passes
- [ ] No circular dependencies
- [ ] All wielding state references updated to new namespace
- [ ] Mod loads correctly in game

## Blocked By

- ITEMSPLIT-001 (items-core)

## Blocks

- ITEMSPLIT-006 (wielding) - main wielding mod depends on state components
