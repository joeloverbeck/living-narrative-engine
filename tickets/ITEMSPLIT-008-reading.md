# ITEMSPLIT-008: Create reading Mod

## Summary

Create the `reading` mod containing actions for reading text from items like letters and books. This is a simple, self-contained mod with the `read_item` action.

## Prerequisites

- ITEMSPLIT-001 (items-core) must be completed first

## Mod Specification

**Directory**: `data/mods/reading/`

**mod-manifest.json**:
```json
{
  "id": "reading",
  "version": "1.0.0",
  "name": "Reading",
  "description": "Actions for reading text from items",
  "dependencies": ["items-core"]
}
```

## Files to Move

### Components (namespace change: `items:` → `reading:`)

| Source File | Destination | Old ID | New ID |
|-------------|-------------|--------|--------|
| `data/mods/items/components/readable.component.json` | `data/mods/reading/components/` | `items:readable` | `reading:readable` |

### Actions (namespace change: `items:` → `reading:`)

| Source File | Destination | Old ID | New ID |
|-------------|-------------|--------|--------|
| `data/mods/items/actions/read_item.action.json` | `data/mods/reading/actions/` | `items:read_item` | `reading:read_item` |

### Rules

| Source File | Destination |
|-------------|-------------|
| `data/mods/items/rules/handle_read_item.rule.json` | `data/mods/reading/rules/` |

### Conditions

| Source File | Destination |
|-------------|-------------|
| `data/mods/items/conditions/event-is-action-read-item.condition.json` | `data/mods/reading/conditions/` |

### Entities

| Source File | Destination |
|-------------|-------------|
| `data/mods/items/entities/definitions/letter_to_sheriff.entity.json` | `data/mods/reading/entities/definitions/` |

## Namespace Changes

| Old ID | New ID |
|--------|--------|
| `items:readable` | `reading:readable` |
| `items:read_item` | `reading:read_item` |

## External References to Update

Search and update all references:

```bash
grep -r "items:readable" data/mods/ tests/
grep -r "items:read_item" data/mods/ tests/
```

**Likely locations:**
1. Entity definitions for readable items (books, letters, notes)
2. Tests for reading functionality

## Test Updates

Check for tests that:
- Reference `items:readable` or `items:read_item` IDs
- Import from `data/mods/items/` for reading-related files
- Test reading action discovery and execution

Likely locations:
- `tests/integration/mods/items/` (reading tests)

## Migration Steps

1. [ ] Create directory structure:
   ```bash
   mkdir -p data/mods/reading/{components,actions,rules,conditions,entities/definitions}
   ```

2. [ ] Create `mod-manifest.json`

3. [ ] Copy and update component file (1 file)
   - Update `id` from `items:readable` to `reading:readable`

4. [ ] Copy and update action file (1 file)
   - Update `id` from `items:read_item` to `reading:read_item`
   - Update any internal component references

5. [ ] Copy rule file (1 file)
   - Update references to action ID
   - Update references to component IDs

6. [ ] Copy condition file (1 file)
   - Update action ID reference

7. [ ] Copy entity file (1 file)
   - Update component references

8. [ ] Update `data/game.json` to include `reading` after `items-core`

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
- [ ] All `items:readable` references updated to `reading:readable`
- [ ] All `items:read_item` references updated to `reading:read_item`
- [ ] Letter entity loads correctly with new component references
- [ ] Mod loads correctly in game

## Blocked By

- ITEMSPLIT-001 (items-core)

## Blocks

None

## Notes

- This is a simple, self-contained mod with minimal dependencies
- Future expansions could add more readable item types (books, scrolls, etc.)
