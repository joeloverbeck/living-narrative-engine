# ITEMSPLIT-006: Create wielding Mod

## Summary

Create the `wielding` mod containing actions for wielding and unwielding items. This mod depends on `wielding-states` for state components and provides the `unwield_item` action.

## Prerequisites

- ITEMSPLIT-002 (inventory) must be completed first
- ITEMSPLIT-004 (wielding-states) must be completed first

## Mod Specification

**Directory**: `data/mods/wielding/`

**mod-manifest.json**:
```json
{
  "id": "wielding",
  "version": "1.0.0",
  "name": "Wielding",
  "description": "Actions for wielding and unwielding items",
  "dependencies": ["wielding-states", "inventory"]
}
```

## Files to Move

### Actions (namespace change: `items:` → `wielding:`)

| Source File | Destination | Old ID | New ID |
|-------------|-------------|--------|--------|
| `data/mods/items/actions/unwield_item.action.json` | `data/mods/wielding/actions/` | `items:unwield_item` | `wielding:unwield_item` |

### Rules

| Source File | Destination |
|-------------|-------------|
| `data/mods/items/rules/handle_unwield_item.rule.json` | `data/mods/wielding/rules/` |

### Events

| Source File | Destination |
|-------------|-------------|
| `data/mods/items/events/item_unwielded.event.json` | `data/mods/wielding/events/` |

### Conditions

| Source File | Destination |
|-------------|-------------|
| `data/mods/items/conditions/event-is-action-unwield-item.condition.json` | `data/mods/wielding/conditions/` |

### Scopes

| Source File | Destination |
|-------------|-------------|
| `data/mods/items/scopes/wielded_items.scope` | `data/mods/wielding/scopes/` |

## Namespace Changes

| Old ID | New ID |
|--------|--------|
| `items:unwield_item` | `wielding:unwield_item` |

## External References to Update

Search and update all references:

```bash
grep -r "items:unwield_item" data/mods/ tests/
```

**Likely locations:**
1. Any mod that references unwielding actions
2. Tests for wielding functionality
3. AI behavior scripts referencing wielding

## Test Updates

Check for tests that:
- Reference `items:unwield_item` action ID
- Import from `data/mods/items/` for wielding-related files
- Test wielding action discovery and execution

Likely locations:
- `tests/integration/mods/items/` (wielding tests)

## Migration Steps

1. [ ] Create directory structure:
   ```bash
   mkdir -p data/mods/wielding/{actions,rules,events,conditions,scopes}
   ```

2. [ ] Create `mod-manifest.json`

3. [ ] Copy and update action file (1 file)
   - Update `id` from `items:unwield_item` to `wielding:unwield_item`
   - Update any internal references to wielding components

4. [ ] Copy rule file (1 file)
   - Update references to action ID
   - Update references to component IDs (use `wielding:` namespace)

5. [ ] Copy event file (1 file)

6. [ ] Copy condition file (1 file)
   - Update action ID reference

7. [ ] Copy scope file (1 file)
   - Update component references to `wielding:` namespace

8. [ ] Update `data/game.json` to include `wielding` after dependencies

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
- [ ] All `items:unwield_item` references updated to `wielding:unwield_item`
- [ ] Mod loads correctly in game

## Blocked By

- ITEMSPLIT-002 (inventory)
- ITEMSPLIT-004 (wielding-states)

## Blocks

None
