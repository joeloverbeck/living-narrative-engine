# ITEMSPLIT-009: Create cosmetics Mod

## Summary

Create the `cosmetics` mod containing actions for applying cosmetic items like lipstick. This includes the `apply_lipstick` action and related components.

## Status

Completed

## Prerequisites

- ITEMSPLIT-001 (items-core) must be completed first
- ITEMSPLIT-002 (inventory) must be completed first

## Mod Specification

**Directory**: `data/mods/cosmetics/`

**mod-manifest.json**:
```json
{
  "id": "cosmetics",
  "version": "1.0.0",
  "name": "Cosmetics",
  "description": "Actions for applying cosmetic items",
  "dependencies": ["items-core", "inventory", "items"]
}
```

## Files to Move

### Components (namespace change: `items:` → `cosmetics:`)

| Source File | Destination | Old ID | New ID |
|-------------|-------------|--------|--------|
| `data/mods/items/components/can_apply_lipstick.component.json` | `data/mods/cosmetics/components/` | `items:can_apply_lipstick` | `cosmetics:can_apply_lipstick` |

### Actions (namespace change: `items:` → `cosmetics:`)

| Source File | Destination | Old ID | New ID |
|-------------|-------------|--------|--------|
| `data/mods/items/actions/apply_lipstick.action.json` | `data/mods/cosmetics/actions/` | `items:apply_lipstick` | `cosmetics:apply_lipstick` |

### Rules

| Source File | Destination |
|-------------|-------------|
| `data/mods/items/rules/handle_apply_lipstick.rule.json` | `data/mods/cosmetics/rules/` |

### Conditions

| Source File | Destination |
|-------------|-------------|
| `data/mods/items/conditions/event-is-action-apply-lipstick.condition.json` | `data/mods/cosmetics/conditions/` |

### Entities

| Source File | Destination |
|-------------|-------------|
| `data/mods/items/entities/definitions/red_lipstick.entity.json` | `data/mods/cosmetics/entities/definitions/` |
| `data/mods/items/entities/instances/red_lipstick.entity.json` | `data/mods/cosmetics/entities/instances/` |

## Namespace Changes

| Old ID | New ID |
|--------|--------|
| `items:can_apply_lipstick` | `cosmetics:can_apply_lipstick` |
| `items:apply_lipstick` | `cosmetics:apply_lipstick` |

## External References to Update

Search and update all references:

```bash
grep -r "items:can_apply_lipstick" data/mods/ tests/
grep -r "items:apply_lipstick" data/mods/ tests/
```

**Likely locations:**
1. Entity definitions for lipstick items
2. Cosmetics action tests (currently under `tests/integration/mods/items/`)
3. Condition/rule references inside the migrated files

## Visual Scheme Updates

- Apply a cosmetics-specific `visual` scheme on `cosmetics:apply_lipstick`.
- If no available scheme fits the cosmetics theme, add a new WCAG-compliant scheme to `docs/mods/mod-color-schemes-available.md`, then mark it as used in `docs/mods/mod-color-schemes-used.md`.

## Test Updates

Check for tests that:
- Reference cosmetics-related component or action IDs
- Import from `data/mods/items/` for cosmetics-related files
- Test cosmetics action discovery and execution

Likely locations:
- `tests/integration/mods/items/` (cosmetics tests)

## Migration Steps

1. [ ] Create directory structure:
   ```bash
   mkdir -p data/mods/cosmetics/{components,actions,rules,conditions,entities/definitions,entities/instances}
   ```

2. [ ] Create `mod-manifest.json`

3. [ ] Copy and update component file (1 file)
   - Update `id` from `items:can_apply_lipstick` to `cosmetics:can_apply_lipstick`

4. [ ] Copy and update action file (1 file)
   - Update `id` from `items:apply_lipstick` to `cosmetics:apply_lipstick`
   - Update any internal component references
   - Update `visual` to use the cosmetics color scheme

5. [ ] Copy rule file (1 file)
   - Update references to action ID
   - Update references to component IDs

6. [ ] Copy condition file (1 file)
   - Update action ID reference

7. [ ] Copy entity files (2 files - definition + instance)
   - Update component references
   - Update `instanceId` and `definitionId` namespaces

8. [ ] Update `data/game.json` only if the cosmetics mod is part of the active mod list (the current file does not include items-related mods)

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
- [ ] All `items:can_apply_lipstick` references updated to `cosmetics:can_apply_lipstick`
- [ ] All `items:apply_lipstick` references updated to `cosmetics:apply_lipstick`
- [ ] Lipstick entity files load correctly with new component references
- [ ] Mod loads correctly in game

## Blocked By

- ITEMSPLIT-001 (items-core)
- ITEMSPLIT-002 (inventory)

## Blocks

None

## Notes

- This mod uses `items:actor_inventory_items` scope, so it must depend on `items`
- Anatomy is not currently referenced by the lipstick action/rule/condition

## Outcome

- Moved lipstick action/component/condition/rule and red lipstick entities into the new `cosmetics` mod with updated namespaces.
- Chose the Bold Red scheme for cosmetics and updated the mod color scheme docs accordingly.
- Updated integration tests to target the cosmetics mod paths and IDs.
- Kept `data/game.json` unchanged because it does not currently include items-related mods.
- Future expansions could add more cosmetic items (makeup, nail polish, etc.)
