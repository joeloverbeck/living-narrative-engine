# ITEMSPLIT-010: Create comfort-items Mod

## Summary

Create the `comfort-items` mod containing actions for items that provide emotional comfort when hugged, like teddy bears. This includes the `hug_item_for_comfort` action.

## Prerequisites

- ITEMSPLIT-001 (items-core) must be completed first
- ITEMSPLIT-002 (inventory) must be completed first

## Mod Specification

**Directory**: `data/mods/comfort-items/`

**mod-manifest.json**:
```json
{
  "id": "comfort_items",
  "version": "1.0.0",
  "name": "Comfort Items",
  "description": "Items that provide emotional comfort when hugged",
  "dependencies": ["items-core", "inventory"]
}
```

## Files to Move

### Components (namespace change: `items:` → `comfort_items:`)

| Source File | Destination | Old ID | New ID |
|-------------|-------------|--------|--------|
| `data/mods/items/components/allows_soothing_hug.component.json` | `data/mods/comfort-items/components/` | `items:allows_soothing_hug` | `comfort_items:allows_soothing_hug` |

### Actions (namespace change: `items:` → `comfort_items:`)

| Source File | Destination | Old ID | New ID |
|-------------|-------------|--------|--------|
| `data/mods/items/actions/hug_item_for_comfort.action.json` | `data/mods/comfort-items/actions/` | `items:hug_item_for_comfort` | `comfort_items:hug_item_for_comfort` |

### Rules

| Source File | Destination |
|-------------|-------------|
| `data/mods/items/rules/handle_hug_item_for_comfort.rule.json` | `data/mods/comfort-items/rules/` |

### Conditions

| Source File | Destination |
|-------------|-------------|
| `data/mods/items/conditions/event-is-action-hug-item-for-comfort.condition.json` | `data/mods/comfort-items/conditions/` |

### Entities

| Source File | Destination |
|-------------|-------------|
| `data/mods/items/entities/definitions/plush_teddy_bear.entity.json` | `data/mods/comfort-items/entities/definitions/` |

## Namespace Changes

| Old ID | New ID |
|--------|--------|
| `items:allows_soothing_hug` | `comfort_items:allows_soothing_hug` |
| `items:hug_item_for_comfort` | `comfort_items:hug_item_for_comfort` |

## External References to Update

Search and update all references:

```bash
grep -r "items:allows_soothing_hug" data/mods/ tests/
grep -r "items:hug_item_for_comfort" data/mods/ tests/
```

**Likely locations:**
1. Entity definitions for comfort items (teddy bears, blankets, etc.)
2. Tests for comfort item functionality

## Test Updates

Check for tests that:
- Reference comfort-items-related component or action IDs
- Import from `data/mods/items/` for comfort-related files
- Test comfort item action discovery and execution

Likely locations:
- `tests/integration/mods/items/` (comfort items tests)

## Migration Steps

1. [ ] Create directory structure:
   ```bash
   mkdir -p data/mods/comfort-items/{components,actions,rules,conditions,entities/definitions}
   ```

2. [ ] Create `mod-manifest.json`

3. [ ] Copy and update component file (1 file)
   - Update `id` from `items:allows_soothing_hug` to `comfort_items:allows_soothing_hug`

4. [ ] Copy and update action file (1 file)
   - Update `id` from `items:hug_item_for_comfort` to `comfort_items:hug_item_for_comfort`
   - Update any internal component references

5. [ ] Copy rule file (1 file)
   - Update references to action ID
   - Update references to component IDs

6. [ ] Copy condition file (1 file)
   - Update action ID reference

7. [ ] Copy entity file (1 file)
   - Update component references

8. [ ] Update `data/game.json` to include `comfort-items` after dependencies

9. [ ] Find and update all external references

10. [ ] Validate:
    ```bash
    npm run validate
    npm run test:unit
    npm run test:integration
    ```

11. [ ] Remove copied files from original `items` mod

## Validation Checklist

- [ ] `npm run validate` passes
- [ ] `npm run test:unit` passes
- [ ] `npm run test:integration` passes
- [ ] No circular dependencies
- [ ] All `items:allows_soothing_hug` references updated to `comfort_items:allows_soothing_hug`
- [ ] All `items:hug_item_for_comfort` references updated to `comfort_items:hug_item_for_comfort`
- [ ] Teddy bear entity loads correctly with new component references
- [ ] Mod loads correctly in game

## Blocked By

- ITEMSPLIT-001 (items-core)
- ITEMSPLIT-002 (inventory)

## Blocks

None

## Notes

- This is a self-contained mod for emotional support items
- Future expansions could add more comfort items (blankets, stuffed animals, etc.)
- Consider integration with emotion/mood systems if present
