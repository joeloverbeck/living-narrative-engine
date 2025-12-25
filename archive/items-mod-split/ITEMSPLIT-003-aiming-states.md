# ITEMSPLIT-003: Create aiming-states Mod

## Status: COMPLETED

## Summary

Create the `aiming-states` mod containing state components for aiming mechanics. This mod is separated from the main `aiming` mod to avoid circular dependencies, following the project's `-states` pattern.

## Prerequisites

- ITEMSPLIT-001 (items-core) must be completed first

## Mod Specification

**Directory**: `data/mods/aiming-states/`

**mod-manifest.json**:
```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "aiming-states",
  "version": "1.0.0",
  "name": "Aiming States",
  "description": "State components for aiming mechanics. Separated to avoid circular dependencies.",
  "author": "Living Narrative Engine",
  "gameVersion": ">=0.0.1",
  "dependencies": [],
  "content": {
    "components": [
      "aimable.component.json",
      "aimed_at.component.json"
    ]
  }
}
```

**Note**: Following the pattern of other `-states` mods (e.g., `physical-control-states`, `item-handling-states`), this mod has **no dependencies**. State mods are intentionally dependency-free to allow other mods to check state without pulling in action dependencies.

## Files to Move

### Components (namespace change: `items:` → `aiming:`)

| Source File | Destination | Old ID | New ID |
|-------------|-------------|--------|--------|
| `data/mods/items/components/aimable.component.json` | `data/mods/aiming-states/components/` | `items:aimable` | `aiming-states:aimable` |
| `data/mods/items/components/aimed_at.component.json` | `data/mods/aiming-states/components/` | `items:aimed_at` | `aiming-states:aimed_at` |

## Namespace Changes

| Old ID | New ID |
|--------|--------|
| `items:aimable` | `aiming-states:aimable` |
| `items:aimed_at` | `aiming-states:aimed_at` |

## External References to Update

### Actual References Found (verified via grep)

**In `data/mods/items/`:**
- `scopes/aimable_items_in_inventory.scope` - references `items:aimable`
- `scopes/aimed_items_in_inventory.scope` - references `items:aimed_at`
- `rules/handle_aim_item.rule.json` - references `items:aimed_at`
- `rules/handle_lower_aim.rule.json` - references `items:aimed_at`
- `actions/aim_item.action.json` - description references `items:aimable`

**Note**: `scopes/aimable_targets.scope` does NOT reference aiming components - it only finds actors at the same location.

**In `tests/`:**
- `tests/unit/mods/items/components/aimingComponents.test.js`
- `tests/integration/mods/items/aimItemActionDiscovery.test.js`
- `tests/integration/mods/items/lowerAimActionDiscovery.test.js`
- `tests/integration/mods/items/aimingEventsDispatched.test.js`
- `tests/integration/mods/items/aimingScopeResolution.test.js`
- `tests/integration/mods/items/placeholderRulesValidation.integration.test.js`

**Corrections from original ticket:**
1. ~~Entity definitions (weapons, flashlights with `items:aimable`)~~ - **INCORRECT**: No entity definitions reference these components
2. ~~Update `data/game.json`~~ - **NOT NEEDED**: `items` and `items-core` are not in game.json; aiming-states is loaded as a dependency

## Migration Steps

1. [x] Create directory structure:
   ```bash
   mkdir -p data/mods/aiming-states/components
   ```

2. [x] Create `mod-manifest.json`

3. [x] Copy and update component files (2 files)
   - Update `id` from `items:aimable` to `aiming-states:aimable`
   - Update `id` from `items:aimed_at` to `aiming-states:aimed_at`

4. [x] ~~Update `data/game.json`~~ - NOT NEEDED (mod loaded as dependency)

5. [x] Find and update all external references

6. [x] Validate:
   ```bash
   npm run validate
   npm run test:unit
   npm run test:integration
   ```

7. [x] Remove copied files from original `items` mod

8. [x] Update `items` mod-manifest.json to add `aiming-states` dependency

## Validation Checklist

- [x] `npm run validate` passes
- [x] `npm run test:unit` passes
- [x] `npm run test:integration` passes
- [x] No circular dependencies
- [x] All `items:aimable` references updated to `aiming-states:aimable`
- [x] All `items:aimed_at` references updated to `aiming-states:aimed_at`
- [x] Mod loads correctly in game

## Blocked By

- ITEMSPLIT-001 (items-core) - COMPLETED

## Blocks

- ITEMSPLIT-005 (aiming) - main aiming mod depends on state components

## Outcome

**Completion Date**: 2024-12-24

### What Changed vs Originally Planned

1. **Ticket corrections applied before implementation**:
   - ~~Entity definitions (weapons, flashlights with `items:aimable`)~~ - No entity definitions existed (was a false claim)
   - ~~Update `data/game.json`~~ - Not needed since `items` is loaded as dependency of other mods
   - Confirmed `-states` pattern: mod has **no dependencies** (matching `physical-control-states`, `item-handling-states`)

2. **Files created**:
   - `data/mods/aiming-states/mod-manifest.json`
   - `data/mods/aiming-states/components/aimable.component.json` (`aiming-states:aimable`)
   - `data/mods/aiming-states/components/aimed_at.component.json` (`aiming-states:aimed_at`)

3. **Files updated** (namespace migration `items:` → `aiming:`):
   - `data/mods/items/scopes/aimable_items_in_inventory.scope`
   - `data/mods/items/scopes/aimed_items_in_inventory.scope`
   - `data/mods/items/rules/handle_aim_item.rule.json`
   - `data/mods/items/rules/handle_lower_aim.rule.json`
   - `data/mods/items/actions/aim_item.action.json` (description)
   - `data/mods/items/actions/lower_aim.action.json` (description)
   - `data/mods/items/mod-manifest.json` (added `aiming-states` dependency)

4. **Test files updated** (6 files):
   - `tests/unit/mods/items/components/aimingComponents.test.js`
   - `tests/integration/mods/items/aimItemActionDiscovery.test.js`
   - `tests/integration/mods/items/lowerAimActionDiscovery.test.js`
   - `tests/integration/mods/items/aimingEventsDispatched.test.js`
   - `tests/integration/mods/items/aimingScopeResolution.test.js`
   - `tests/integration/mods/items/placeholderRulesValidation.integration.test.js`

5. **Files deleted**:
   - `data/mods/items/components/aimable.component.json`
   - `data/mods/items/components/aimed_at.component.json`

### Validation Results

- `npm run validate`: 0 violations (one false positive warning for "unused dependency" - validator doesn't detect scope DSL/rule component references)
- All aiming tests pass: 44 tests across 6 files
- `npm run scope:lint`: All 145 scope files valid
- ESLint: No issues on modified files
