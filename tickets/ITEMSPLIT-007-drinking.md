# ITEMSPLIT-007: Create drinking Mod

## Summary

Create the `drinking` mod containing actions for consuming liquids from containers. This includes the `drink_from` and `drink_entirely` actions along with drinkable/empty state components.

## Prerequisites

- ITEMSPLIT-001 (items-core) must be completed first
- ITEMSPLIT-002 (inventory) must be completed first

## Mod Specification

**Directory**: `data/mods/drinking/`

**mod-manifest.json**:
```json
{
  "id": "drinking",
  "version": "1.0.0",
  "name": "Drinking",
  "description": "Actions for consuming liquids from containers",
  "dependencies": ["items-core", "inventory", "anatomy"]
}
```

## Files to Move

### Components (namespace change: `items:` → `drinking:`)

| Source File | Destination | Old ID | New ID |
|-------------|-------------|--------|--------|
| `data/mods/items/components/drinkable.component.json` | `data/mods/drinking/components/` | `items:drinkable` | `drinking:drinkable` |
| `data/mods/items/components/empty.component.json` | `data/mods/drinking/components/` | `items:empty` | `drinking:empty` |

### Actions (namespace change: `items:` → `drinking:`)

| Source File | Destination | Old ID | New ID |
|-------------|-------------|--------|--------|
| `data/mods/items/actions/drink_from.action.json` | `data/mods/drinking/actions/` | `items:drink_from` | `drinking:drink_from` |
| `data/mods/items/actions/drink_entirely.action.json` | `data/mods/drinking/actions/` | `items:drink_entirely` | `drinking:drink_entirely` |

### Rules

| Source File | Destination |
|-------------|-------------|
| `data/mods/items/rules/handle_drink_from.rule.json` | `data/mods/drinking/rules/` |
| `data/mods/items/rules/handle_drink_entirely.rule.json` | `data/mods/drinking/rules/` |

### Events

| Source File | Destination |
|-------------|-------------|
| `data/mods/items/events/liquid_consumed.event.json` | `data/mods/drinking/events/` |
| `data/mods/items/events/liquid_consumed_entirely.event.json` | `data/mods/drinking/events/` |

### Conditions

| Source File | Destination |
|-------------|-------------|
| `data/mods/items/conditions/event-is-action-drink-from.condition.json` | `data/mods/drinking/conditions/` |
| `data/mods/items/conditions/event-is-action-drink-entirely.condition.json` | `data/mods/drinking/conditions/` |

### Scopes

| Source File | Destination |
|-------------|-------------|
| `data/mods/items/scopes/disinfectant_liquids_in_inventory.scope` | `data/mods/drinking/scopes/` |

### Entities

| Source File | Destination |
|-------------|-------------|
| `data/mods/items/entities/definitions/coffee_cup.entity.json` | `data/mods/drinking/entities/definitions/` |
| `data/mods/items/entities/definitions/antiseptic_bottle.entity.json` | `data/mods/drinking/entities/definitions/` |

## Namespace Changes

| Old ID | New ID |
|--------|--------|
| `items:drinkable` | `drinking:drinkable` |
| `items:empty` | `drinking:empty` |
| `items:drink_from` | `drinking:drink_from` |
| `items:drink_entirely` | `drinking:drink_entirely` |

## External References to Update

Search and update all references:

```bash
grep -r "items:drinkable" data/mods/ tests/
grep -r "items:empty" data/mods/ tests/
grep -r "items:drink_from" data/mods/ tests/
grep -r "items:drink_entirely" data/mods/ tests/
```

**Likely locations:**
1. Entity definitions for drinkable items
2. First-aid or medical mods using antiseptic
3. Tests for drinking functionality

## Test Updates

Check for tests that:
- Reference drinking-related component or action IDs
- Import from `data/mods/items/` for drinking-related files
- Test drinking action discovery and execution

Likely locations:
- `tests/integration/mods/items/` (drinking tests)

## Migration Steps

1. [ ] Create directory structure:
   ```bash
   mkdir -p data/mods/drinking/{components,actions,rules,events,conditions,scopes,entities/definitions}
   ```

2. [ ] Create `mod-manifest.json`

3. [ ] Copy and update component files (2 files)
   - Update `id` from `items:drinkable` to `drinking:drinkable`
   - Update `id` from `items:empty` to `drinking:empty`

4. [ ] Copy and update action files (2 files)
   - Update `id` from `items:drink_from` to `drinking:drink_from`
   - Update `id` from `items:drink_entirely` to `drinking:drink_entirely`
   - Update any internal component references

5. [ ] Copy rule files (2 files)
   - Update references to action IDs
   - Update references to component IDs

6. [ ] Copy event files (2 files)

7. [ ] Copy condition files (2 files)
   - Update action ID references

8. [ ] Copy scope file (1 file)
   - Update component references

9. [ ] Copy entity files (2 files)
   - Update component references

10. [ ] Update `data/game.json` to include `drinking` after dependencies

11. [ ] Find and update all external references

12. [ ] Validate:
    ```bash
    npm run validate
    npm run test:unit
    npm run test:integration
    ```

13. [ ] Remove copied files from original `items` mod

## Validation Checklist

- [ ] `npm run validate` passes
- [ ] `npm run test:unit` passes
- [ ] `npm run test:integration` passes
- [ ] No circular dependencies
- [ ] All drinking-related references updated to new namespace
- [ ] Entity files load correctly with new component references
- [ ] Mod loads correctly in game

## Blocked By

- ITEMSPLIT-001 (items-core)
- ITEMSPLIT-002 (inventory)

## Blocks

None

## Notes

- The `drinking` mod may need to integrate with `first-aid` or similar mods for antiseptic consumption effects
- Consider whether `items:empty` component should be in `items-core` if used by multiple mods
