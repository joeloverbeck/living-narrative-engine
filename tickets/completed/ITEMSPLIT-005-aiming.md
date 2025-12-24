# ITEMSPLIT-005: Create aiming Mod

## Summary

Create the `aiming` mod containing actions for aiming items at targets. This mod depends on `aiming-states` for state components and provides the `aim_item` and `lower_aim` actions.

## Prerequisites

- ITEMSPLIT-002 (inventory) must be completed first ✅ COMPLETED
- ITEMSPLIT-003 (aiming-states) must be completed first ✅ COMPLETED

## Discrepancies Found During Implementation

> **Note**: The following discrepancies were discovered during codebase analysis and corrected in this ticket:

| Original Assumption | Actual State | Resolution |
|---------------------|--------------|------------|
| Revolver entity has `aiming:aimable` component | Revolver **lacks** this component entirely | ADD component during migration |
| `personal-space` dependency needed | Scopes only use `entities(core:actor)` - no personal-space refs | REMOVE from dependencies |
| Event namespaces consistent | **Inconsistent**: `items-core:item_aimed` vs `items:aim_lowered` | Standardize both to `aiming:` namespace |

## Mod Specification

**Directory**: `data/mods/aiming/`

**mod-manifest.json**:
```json
{
  "id": "aiming",
  "version": "1.0.0",
  "name": "Aiming",
  "description": "Actions for aiming items at targets",
  "dependencies": ["aiming-states", "inventory"]
}
```

> **Note**: `personal-space` removed from dependencies - scope analysis shows it's not referenced.

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

### Events (namespace fix: standardizing to `aiming:`)

| Source File | Destination | Old ID | New ID |
|-------------|-------------|--------|--------|
| `data/mods/items/events/item_aimed.event.json` | `data/mods/aiming/events/` | `items-core:item_aimed` | `aiming:item_aimed` |
| `data/mods/items/events/aim_lowered.event.json` | `data/mods/aiming/events/` | `items:aim_lowered` | `aiming:aim_lowered` |

> **Note**: Pre-existing inconsistency (`items-core:` vs `items:`) resolved by standardizing both to `aiming:` namespace.

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

> **IMPORTANT**: Revolver entity must have `aiming:aimable` component ADDED (currently missing from source entity).

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

### Tests to Move (identified during implementation)

**Integration tests** (6 files):
| Source | Destination |
|--------|-------------|
| `tests/integration/mods/items/aimItemActionDiscovery.test.js` | `tests/integration/mods/aiming/` |
| `tests/integration/mods/items/lowerAimActionDiscovery.test.js` | `tests/integration/mods/aiming/` |
| `tests/integration/mods/items/aimingScopeResolution.test.js` | `tests/integration/mods/aiming/` |
| `tests/integration/mods/items/aimingEventsDispatched.test.js` | `tests/integration/mods/aiming/` |
| `tests/integration/mods/items/aimItemValidation.integration.test.js` | `tests/integration/mods/aiming/` |
| `tests/integration/mods/items/placeholderRulesValidation.integration.test.js` | `tests/integration/mods/aiming/` |

**Unit tests** (1 file):
| Source | Destination |
|--------|-------------|
| `tests/unit/mods/items/aimingEventSchemas.test.js` | `tests/unit/mods/aiming/` |

### Test namespace updates required
- `items:aim_item` → `aiming:aim_item`
- `items:lower_aim` → `aiming:lower_aim`
- `items-core:item_aimed` → `aiming:item_aimed`
- `items:aim_lowered` → `aiming:aim_lowered`
- `items:aimable_targets` → `aiming:aimable_targets`
- `items:aimable_items_in_inventory` → `aiming:aimable_items_in_inventory`
- `items:aimed_items_in_inventory` → `aiming:aimed_items_in_inventory`
- `items:event-is-action-aim-item` → `aiming:event-is-action-aim-item`
- `items:event-is-action-lower-aim` → `aiming:event-is-action-lower-aim`
- `ModTestFixture.forAction('items', ...)` → `ModTestFixture.forAction('aiming', ...)`

## Migration Steps

1. [x] Create directory structure:
   ```bash
   mkdir -p data/mods/aiming/{actions,rules,events,conditions,scopes,entities/definitions}
   ```

2. [x] Create `mod-manifest.json`

3. [x] Copy and update action files (2 files)
   - Update `id` from `items:aim_item` to `aiming:aim_item`
   - Update `id` from `items:lower_aim` to `aiming:lower_aim`
   - Update any internal references to aiming components

4. [x] Copy rule files (2 files)
   - Update references to action IDs
   - Update references to component IDs (use `aiming:` namespace)

5. [x] Copy event files (2 files)

6. [x] Copy condition files (2 files)
   - Update action ID references

7. [x] Copy scope files (3 files)
   - Update component references to `aiming:` namespace

8. [x] Copy entity files (1 file - revolver)
   - Update component references

9. [x] Update `data/game.json` to include `aiming` after dependencies

10. [x] Find and update all external references

11. [x] Validate:
    ```bash
    npm run validate
    npm run test:unit
    npm run test:integration
    ```

12. [x] Remove copied files from original `items` mod

## Validation Checklist

- [x] `npm run validate` passes
- [x] `npm run test:unit` passes
- [x] `npm run test:integration` passes
- [x] No circular dependencies
- [x] All `items:aim_item` references updated to `aiming:aim_item`
- [x] All `items:lower_aim` references updated to `aiming:lower_aim`
- [x] Revolver entity loads correctly with new component references
- [x] Mod loads correctly in game

## Blocked By

- ITEMSPLIT-002 (inventory) ✅
- ITEMSPLIT-003 (aiming-states) ✅

## Blocks

None

---

## Outcome

**Status**: ✅ COMPLETED (2024-12-24)

### Summary

Successfully created the `aiming` mod by extracting aiming-related functionality from the `items` mod. The migration included:

- **2 actions**: `aim_item`, `lower_aim` with namespace change `items:` → `aiming:`
- **2 rules**: `handle_aim_item`, `handle_lower_aim` with updated condition and event references
- **2 events**: `item_aimed`, `aim_lowered` with namespace fix (standardized from inconsistent `items-core:`/`items:` to `aiming:`)
- **2 conditions**: `event-is-action-aim-item`, `event-is-action-lower-aim`
- **3 scopes**: `aimable_items_in_inventory`, `aimed_items_in_inventory`, `aimable_targets`
- **1 entity**: `revolver` with `aiming:aimable` component ADDED (was missing from source)

### Discrepancies Resolved

1. **Revolver missing component**: Added `aiming:aimable` component to revolver entity
2. **Event namespace inconsistency**: Fixed `items-core:item_aimed` and `items:aim_lowered` → both now `aiming:`
3. **Dependency correction**: Added `items-core` dependency (revolver uses `items-core:item` and `items-core:portable`)

### Tests Updated

- **7 test files** moved from `tests/*/mods/items/` to `tests/*/mods/aiming/`
- **52 tests** pass with all namespace updates applied
- All import paths and fixture references updated

### Validation Results

```
npm run validate: 0 cross-reference violations
npm run test (aiming): 7 suites, 52 tests passed
```

### Files Created

```
data/mods/aiming/
├── mod-manifest.json
├── actions/
│   ├── aim_item.action.json
│   └── lower_aim.action.json
├── rules/
│   ├── handle_aim_item.rule.json
│   └── handle_lower_aim.rule.json
├── events/
│   ├── item_aimed.event.json
│   └── aim_lowered.event.json
├── conditions/
│   ├── event-is-action-aim-item.condition.json
│   └── event-is-action-lower-aim.condition.json
├── scopes/
│   ├── aimable_items_in_inventory.scope
│   ├── aimed_items_in_inventory.scope
│   └── aimable_targets.scope
└── entities/definitions/
    └── revolver.entity.json
```

### Files Deleted from items mod

- 11 content files (actions, rules, events, conditions, scopes, entities)
- 7 test files moved to aiming mod test directories
