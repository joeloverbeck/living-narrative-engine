# ITEMSPLIT-005: Create aiming Mod

## Summary

Create the `aiming` mod containing actions for aiming items at targets. This mod depends on `aiming-states` for state components and provides the `aim_item` and `lower_aim` actions.

## Prerequisites

- ITEMSPLIT-002 (inventory) must be completed first
- ITEMSPLIT-003 (aiming-states) must be completed first

## Mod Specification

**Directory**: `data/mods/aiming/`

**mod-manifest.json**:
```json
{
  "id": "aiming",
  "version": "1.0.0",
  "name": "Aiming",
  "description": "Actions for aiming items at targets",
  "dependencies": ["aiming-states", "inventory", "personal-space"]
}
```

## Files to Move

### Actions (namespace change: `items:` → `aiming:`)

| Source File | Destination | Old ID | New ID |
|-------------|-------------|--------|--------|
| `data/mods/items/actions/aim_item.action.json` | `data/mods/aiming/actions/` | `items:aim_item` | `aiming:aim_item` |
| `data/mods/items/actions/lower_aim.action.json` | `data/mods/aiming/actions/` | `items:lower_aim` | `aiming:lower_aim` |

### Rules

| Source File | Destination |
|-------------|-------------|
| `data/mods/items/rules/handle_aim_item.rule.json` | `data/mods/aiming/rules/` |
| `data/mods/items/rules/handle_lower_aim.rule.json` | `data/mods/aiming/rules/` |

### Events

| Source File | Destination |
|-------------|-------------|
| `data/mods/items/events/item_aimed.event.json` | `data/mods/aiming/events/` |
| `data/mods/items/events/aim_lowered.event.json` | `data/mods/aiming/events/` |

### Conditions

| Source File | Destination |
|-------------|-------------|
| `data/mods/items/conditions/event-is-action-aim-item.condition.json` | `data/mods/aiming/conditions/` |
| `data/mods/items/conditions/event-is-action-lower-aim.condition.json` | `data/mods/aiming/conditions/` |

### Scopes

| Source File | Destination |
|-------------|-------------|
| `data/mods/items/scopes/aimable_items_in_inventory.scope` | `data/mods/aiming/scopes/` |
| `data/mods/items/scopes/aimed_items_in_inventory.scope` | `data/mods/aiming/scopes/` |
| `data/mods/items/scopes/aimable_targets.scope` | `data/mods/aiming/scopes/` |

### Entities

| Source File | Destination |
|-------------|-------------|
| `data/mods/items/entities/definitions/revolver.entity.json` | `data/mods/aiming/entities/definitions/` |

## Namespace Changes

| Old ID | New ID |
|--------|--------|
| `items:aim_item` | `aiming:aim_item` |
| `items:lower_aim` | `aiming:lower_aim` |

## External References to Update

Search and update all references:

```bash
grep -r "items:aim_item" data/mods/ tests/
grep -r "items:lower_aim" data/mods/ tests/
```

**Likely locations:**
1. Any mod that references aiming actions
2. Tests for aiming functionality
3. AI behavior scripts referencing aiming

## Test Updates

Check for tests that:
- Reference `items:aim_item` or `items:lower_aim` action IDs
- Import from `data/mods/items/` for aiming-related files
- Test aiming action discovery and execution

Likely locations:
- `tests/integration/mods/items/` (aiming tests)

## Migration Steps

1. [ ] Create directory structure:
   ```bash
   mkdir -p data/mods/aiming/{actions,rules,events,conditions,scopes,entities/definitions}
   ```

2. [ ] Create `mod-manifest.json`

3. [ ] Copy and update action files (2 files)
   - Update `id` from `items:aim_item` to `aiming:aim_item`
   - Update `id` from `items:lower_aim` to `aiming:lower_aim`
   - Update any internal references to aiming components

4. [ ] Copy rule files (2 files)
   - Update references to action IDs
   - Update references to component IDs (use `aiming:` namespace)

5. [ ] Copy event files (2 files)

6. [ ] Copy condition files (2 files)
   - Update action ID references

7. [ ] Copy scope files (3 files)
   - Update component references to `aiming:` namespace

8. [ ] Copy entity files (1 file - revolver)
   - Update component references

9. [ ] Update `data/game.json` to include `aiming` after dependencies

10. [ ] Find and update all external references

11. [ ] Validate:
    ```bash
    npm run validate
    npm run test:unit
    npm run test:integration
    ```

12. [ ] Remove copied files from original `items` mod

## Validation Checklist

- [ ] `npm run validate` passes
- [ ] `npm run test:unit` passes
- [ ] `npm run test:integration` passes
- [ ] No circular dependencies
- [ ] All `items:aim_item` references updated to `aiming:aim_item`
- [ ] All `items:lower_aim` references updated to `aiming:lower_aim`
- [ ] Revolver entity loads correctly with new component references
- [ ] Mod loads correctly in game

## Blocked By

- ITEMSPLIT-002 (inventory)
- ITEMSPLIT-003 (aiming-states)

## Blocks

None
