# ITEMSPLIT-011: Entity Relocation - COMPLETED

## Summary

Move remaining entity definitions from the original `items` mod to appropriate destination mods.

## Prerequisites

- All previous ITEMSPLIT tickets (001-010) should be completed first ✅
- Verify which entities remain in `items` mod after previous migrations ✅

## Investigation Results

### Remaining Entities in `items` mod:

```
data/mods/items/entities/definitions/
├── brass_key.entity.json
├── gold_bar.entity.json
├── smoking_pipe.entity.json
└── treasure_chest.entity.json
```

**Entity instances directory**: Empty (no instances remain)

### Remaining Scopes in `items` mod (will stay):

- `actor_inventory_items.scope`
- `close_actors_with_inventory.scope`
- `examinable_items.scope`

These scopes provide general item functionality used by dependent mods and will remain in `items`.

### External References Found:

- `fantasy` mod has instance `smoking_pipe.entity.json` that references `items:smoking_pipe`
  - File: `data/mods/fantasy/entities/instances/smoking_pipe.entity.json`
  - Reference: `"definitionId": "items:smoking_pipe"`
  - Action: Will update to `smoking:smoking_pipe`

## Migration Destinations

### Container-Related Entities → `containers` mod

| Source File | New ID | Notes |
|-------------|--------|-------|
| `items/entities/definitions/treasure_chest.entity.json` | `containers:treasure_chest` | Container entity |
| `items/entities/definitions/brass_key.entity.json` | `containers:brass_key` | Key for containers |

### Valuable Items → New `valuables` mod

| Source File | New ID | Notes |
|-------------|--------|-------|
| `items/entities/definitions/gold_bar.entity.json` | `valuables:gold_bar` | Precious metal item |

### Smoking Items → New `smoking` mod

| Source File | New ID | Notes |
|-------------|--------|-------|
| `items/entities/definitions/smoking_pipe.entity.json` | `smoking:smoking_pipe` | Smoking-related prop |

## Migration Steps

1. [x] **Investigate** remaining entities after previous migrations
2. [x] **Update this ticket** with actual remaining entities
3. [x] **Decide destinations** for each remaining entity

4. [x] Create `containers/entities/definitions/` directory and move container entities:
   - Create `treasure_chest.entity.json` with ID `containers:treasure_chest`
   - Create `brass_key.entity.json` with ID `containers:brass_key`
   - Update treasure_chest's `keyItemId` reference to `containers:brass_key`
   - Update containers mod-manifest.json with entities section

5. [x] Create `valuables` mod:
   - Create `data/mods/valuables/` directory structure
   - Create mod-manifest.json
   - Create `gold_bar.entity.json` with ID `valuables:gold_bar`

6. [x] Create `smoking` mod:
   - Create `data/mods/smoking/` directory structure
   - Create mod-manifest.json
   - Create `smoking_pipe.entity.json` with ID `smoking:smoking_pipe`

7. [x] Update `fantasy` mod:
   - Add `smoking` dependency to mod-manifest.json
   - Update `entities/instances/smoking_pipe.entity.json` definitionId to `smoking:smoking_pipe`

8. [x] Validate:
   ```bash
   npm run validate
   npm run test:unit
   npm run test:integration
   ```

9. [x] Remove relocated files from original `items` mod:
   - Delete entity files from `items/entities/definitions/`
   - Update `items/mod-manifest.json` to remove entities section

## Validation Checklist

- [x] `npm run validate` passes
- [x] `npm run test:unit` passes (container tests)
- [x] `npm run test:integration` passes (container tests)
- [x] No orphaned entity files in original `items` mod
- [x] All relocated entities load correctly
- [x] No broken references
- [x] `fantasy` mod correctly references `smoking:smoking_pipe`

## Blocked By

- ITEMSPLIT-001 through ITEMSPLIT-010 ✅ (completed)

## Blocks

- ITEMSPLIT-012 (cleanup) - cannot finalize until entities are relocated

## Notes

- Scopes remain in `items` mod as they provide general item functionality
- The `fantasy` mod has an existing reference that needs updating
- No game.json changes needed - new mods loaded via dependency chain

---

## Outcome

### Completion Date
2025-12-29

### Actual vs Planned Changes

**Planned**: Relocate 4 entity definitions from `items` mod to destination mods.

**Actual**: Successfully relocated all 4 entities as planned:
- `treasure_chest` and `brass_key` → `containers` mod
- `gold_bar` → new `valuables` mod
- `smoking_pipe` → new `smoking` mod

### Files Created

1. `data/mods/containers/entities/definitions/treasure_chest.entity.json`
2. `data/mods/containers/entities/definitions/brass_key.entity.json`
3. `data/mods/valuables/mod-manifest.json`
4. `data/mods/valuables/entities/definitions/gold_bar.entity.json`
5. `data/mods/smoking/mod-manifest.json`
6. `data/mods/smoking/entities/definitions/smoking_pipe.entity.json`

### Files Modified

1. `data/mods/containers/mod-manifest.json` - Added entities section and `items-core` dependency
2. `data/mods/fantasy/mod-manifest.json` - Added `smoking` dependency, removed unused `items` dependency
3. `data/mods/fantasy/entities/instances/smoking_pipe.entity.json` - Updated definitionId to `smoking:smoking_pipe`
4. `data/mods/items/mod-manifest.json` - Removed entities section and unused dependencies (`containers-core`, `descriptors`)

### Files Deleted

1. `data/mods/items/entities/definitions/brass_key.entity.json`
2. `data/mods/items/entities/definitions/gold_bar.entity.json`
3. `data/mods/items/entities/definitions/smoking_pipe.entity.json`
4. `data/mods/items/entities/definitions/treasure_chest.entity.json`

### Dependency Changes

| Mod | Added | Removed |
|-----|-------|---------|
| `containers` | `items-core` | - |
| `fantasy` | `smoking` | `items` |
| `items` | - | `containers-core`, `descriptors` |

### Validation Results

- Cross-reference validation: 0 violations across 111 mods
- Container workflow tests: 6 passed
- Container prerequisites tests: 27 passed
- Open container rule execution tests: 14 passed

### Deviations from Plan

1. **Added `items-core` dependency to `containers` mod** - Not in original plan but required because container entities use `items-core:item`, `items-core:portable`, and `items-core:openable` components.

2. **Removed `items` dependency from `fantasy` mod** - Discovered during validation that fantasy no longer needed `items` dependency after the `smoking_pipe` instance was updated to reference the new `smoking` mod.

3. **Removed unused dependencies from `items` mod** - Validation revealed `containers-core` and `descriptors` were unused after entity removal.

### Lessons Learned

- Cross-reference validation is essential after entity relocations to catch dependency chain issues
- Entity component usage determines required dependencies (e.g., using `items-core:item` requires `items-core` dependency)
- When moving entities, both definition IDs AND any cross-references (like `keyItemId`) must be updated
