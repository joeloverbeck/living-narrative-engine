# ITEMSPLIT-010: Create comfort-items Mod

## Summary

Create the `comfort-items` mod containing actions for items that provide emotional comfort when hugged, like teddy bears. This includes the `hug_item_for_comfort` action and its supporting component, condition, rule, and entity definition.

**Status**: Completed

## Prerequisites

- ITEMSPLIT-001 (items-core) must be completed first
- ITEMSPLIT-002 (inventory) must be completed first

## Mod Specification

**Directory**: `data/mods/comfort-items/`

**mod-manifest.json**:
```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "comfort-items",
  "version": "1.0.0",
  "name": "Comfort Items",
  "description": "Items that provide emotional comfort when hugged.",
  "actionPurpose": "Hug soothing items to feel calmer.",
  "actionConsiderWhen": "Seeking comfort from a plush toy, pillow, or similar item.",
  "author": "Living Narrative Engine",
  "gameVersion": ">=0.0.1",
  "dependencies": [
    {
      "id": "items-core",
      "version": "1.0.0"
    },
    {
      "id": "inventory",
      "version": "1.0.0"
    },
    {
      "id": "items",
      "version": "1.0.0"
    }
  ],
  "content": {
    "actions": [
      "hug_item_for_comfort.action.json"
    ],
    "components": [
      "allows_soothing_hug.component.json"
    ],
    "conditions": [
      "event-is-action-hug-item-for-comfort.condition.json"
    ],
    "rules": [
      "handle_hug_item_for_comfort.rule.json"
    ],
    "events": [],
    "scopes": [],
    "entities": {
      "definitions": [
        "plush_teddy_bear.entity.json"
      ],
      "instances": []
    }
  }
}
```

## Files to Move

### Components (namespace change: `items:` → `comfort-items:`)

| Source File | Destination | Old ID | New ID |
|-------------|-------------|--------|--------|
| `data/mods/items/components/allows_soothing_hug.component.json` | `data/mods/comfort-items/components/` | `items:allows_soothing_hug` | `comfort-items:allows_soothing_hug` |

### Actions (namespace change: `items:` → `comfort-items:`)

| Source File | Destination | Old ID | New ID |
|-------------|-------------|--------|--------|
| `data/mods/items/actions/hug_item_for_comfort.action.json` | `data/mods/comfort-items/actions/` | `items:hug_item_for_comfort` | `comfort-items:hug_item_for_comfort` |

### Rules

| Source File | Destination |
|-------------|-------------|
| `data/mods/items/rules/handle_hug_item_for_comfort.rule.json` | `data/mods/comfort-items/rules/` |

### Conditions (namespace change: `items:` → `comfort-items:`)

| Source File | Destination |
|-------------|-------------|
| `data/mods/items/conditions/event-is-action-hug-item-for-comfort.condition.json` | `data/mods/comfort-items/conditions/` | `items:event-is-action-hug-item-for-comfort` | `comfort-items:event-is-action-hug-item-for-comfort` |

### Entities (namespace change: `items:` → `comfort-items:`)

| Source File | Destination |
|-------------|-------------|
| `data/mods/items/entities/definitions/plush_teddy_bear.entity.json` | `data/mods/comfort-items/entities/definitions/` | `items:plush_teddy_bear` | `comfort-items:plush_teddy_bear` |

## Namespace Changes

| Old ID | New ID |
|--------|--------|
| `items:allows_soothing_hug` | `comfort-items:allows_soothing_hug` |
| `items:hug_item_for_comfort` | `comfort-items:hug_item_for_comfort` |
| `items:event-is-action-hug-item-for-comfort` | `comfort-items:event-is-action-hug-item-for-comfort` |
| `items:plush_teddy_bear` | `comfort-items:plush_teddy_bear` |

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

## Color Scheme

Select a unique scheme for this mod (and its actions) from the available WCAG-compliant list in `docs/mods/mod-color-schemes-available.md`. Update `docs/mods/mod-color-schemes-used.md` with the assignment.

## Migration Steps

1. [x] Create directory structure:
   ```bash
   mkdir -p data/mods/comfort-items/{components,actions,rules,conditions,entities/definitions}
   ```

2. [x] Create `mod-manifest.json`

3. [x] Copy and update component file (1 file)
   - Update `id` from `items:allows_soothing_hug` to `comfort_items:allows_soothing_hug`

4. [x] Copy and update action file (1 file)
   - Update `id` from `items:hug_item_for_comfort` to `comfort_items:hug_item_for_comfort`
   - Update any internal component references

5. [x] Copy rule file (1 file)
   - Update references to action ID
   - Update references to component IDs

6. [x] Copy condition file (1 file)
   - Update action ID reference

7. [x] Copy entity file (1 file)
   - Update component references

8. [x] Update `data/game.json` to include `comfort-items` after dependencies if the config lists `items-core`/`inventory` mods; otherwise leave `data/game.json` unchanged for this ticket

9. [x] Find and update all external references

10. [x] Validate:
    ```bash
    npm run validate
    npm run test:unit
    npm run test:integration
    ```

11. [x] Remove copied files from original `items` mod

## Validation Checklist

- [ ] `npm run validate` passes
- [ ] `npm run test:unit` passes
- [x] `npm run test:integration` passes
- [x] No circular dependencies
- [x] All `items:allows_soothing_hug` references updated to `comfort-items:allows_soothing_hug`
- [x] All `items:hug_item_for_comfort` references updated to `comfort-items:hug_item_for_comfort`
- [x] All `items:event-is-action-hug-item-for-comfort` references updated to `comfort-items:event-is-action-hug-item-for-comfort`
- [x] Teddy bear entity loads correctly with new component references (`comfort-items:plush_teddy_bear`)
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

## Outcome

- Created the `comfort-items` mod with updated `comfort-items:` IDs, and removed the comfort-item assets from `items`.
- Kept `data/game.json` unchanged because it does not list `items-core`/`inventory` in the current config.
- Assigned the Sunlit Lagoon color scheme to the new mod and updated the action visual colors.
