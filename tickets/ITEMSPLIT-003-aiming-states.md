# ITEMSPLIT-003: Create aiming-states Mod

## Summary

Create the `aiming-states` mod containing state components for aiming mechanics. This mod is separated from the main `aiming` mod to avoid circular dependencies, following the project's `-states` pattern.

## Prerequisites

- ITEMSPLIT-001 (items-core) must be completed first

## Mod Specification

**Directory**: `data/mods/aiming-states/`

**mod-manifest.json**:
```json
{
  "id": "aiming_states",
  "version": "1.0.0",
  "name": "Aiming States",
  "description": "State components for aiming mechanics. Separated to avoid circular dependencies.",
  "dependencies": ["items-core"]
}
```

## Files to Move

### Components (namespace change: `items:` → `aiming:`)

| Source File | Destination | Old ID | New ID |
|-------------|-------------|--------|--------|
| `data/mods/items/components/aimable.component.json` | `data/mods/aiming-states/components/` | `items:aimable` | `aiming:aimable` |
| `data/mods/items/components/aimed_at.component.json` | `data/mods/aiming-states/components/` | `items:aimed_at` | `aiming:aimed_at` |

## Namespace Changes

| Old ID | New ID |
|--------|--------|
| `items:aimable` | `aiming:aimable` |
| `items:aimed_at` | `aiming:aimed_at` |

## External References to Update

Search and update all references:

```bash
grep -r "items:aimable" data/mods/ tests/
grep -r "items:aimed_at" data/mods/ tests/
```

**Likely locations:**
1. Entity definitions (weapons, flashlights with `items:aimable`)
2. Scope DSL files checking for aimable items
3. Action prerequisites checking for aimed state
4. Rules that set/check aimed_at component
5. Tests referencing these component IDs

## Test Updates

Check for tests that:
- Reference `items:aimable` or `items:aimed_at` component IDs
- Test aiming state management

Likely locations:
- `tests/integration/mods/items/` (aiming-related tests)
- `tests/unit/` files referencing aiming components

## Migration Steps

1. [ ] Create directory structure:
   ```bash
   mkdir -p data/mods/aiming-states/components
   ```

2. [ ] Create `mod-manifest.json`

3. [ ] Copy and update component files (2 files)
   - Update `id` from `items:aimable` to `aiming:aimable`
   - Update `id` from `items:aimed_at` to `aiming:aimed_at`

4. [ ] Update `data/game.json` to include `aiming-states` after `items-core`

5. [ ] Find and update all external references:
   ```bash
   grep -r "items:aimable" data/mods/ tests/
   grep -r "items:aimed_at" data/mods/ tests/
   # Update each reference to new namespace
   ```

6. [ ] Validate:
   ```bash
   npm run validate
   npm run test:unit
   npm run test:integration
   ```

7. [ ] Remove copied files from original `items` mod

## Validation Checklist

- [ ] `npm run validate` passes
- [ ] `npm run test:unit` passes
- [ ] `npm run test:integration` passes
- [ ] No circular dependencies
- [ ] All `items:aimable` references updated to `aiming:aimable`
- [ ] All `items:aimed_at` references updated to `aiming:aimed_at`
- [ ] Mod loads correctly in game

## Blocked By

- ITEMSPLIT-001 (items-core)

## Blocks

- ITEMSPLIT-005 (aiming) - main aiming mod depends on state components
