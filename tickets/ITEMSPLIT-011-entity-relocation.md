# ITEMSPLIT-011: Entity Relocation

## Summary

Move remaining entity definitions from the original `items` mod to appropriate destination mods. This includes container-related entities and valuable items.

## Prerequisites

- All previous ITEMSPLIT tickets (001-010) should be completed first
- Verify which entities remain in `items` mod after previous migrations

## Investigation Required

Before migration, verify remaining entities in `items` mod:

```bash
ls data/mods/items/entities/definitions/
ls data/mods/items/entities/instances/
```

## Expected Entities to Relocate

Based on analysis, the following entities may remain after previous migrations:

### Container-Related Entities → `containers` mod

| Source File | Destination | Notes |
|-------------|-------------|-------|
| `data/mods/items/entities/definitions/treasure_chest.entity.json` | `data/mods/containers/entities/definitions/` | Container entity |
| `data/mods/items/entities/definitions/brass_key.entity.json` | `data/mods/containers/entities/definitions/` | Key for containers |

### Valuable Items → New `valuables` mod or existing mod

| Source File | Destination | Notes |
|-------------|-------------|-------|
| `data/mods/items/entities/definitions/gold_bar.entity.json` | TBD (see options below) | Valuable item |

### Other Items → Appropriate mods

| Source File | Destination | Notes |
|-------------|-------------|-------|
| `data/mods/items/entities/definitions/smoking_pipe.entity.json` | TBD (see options below) | Smoking item |

## Decision Points

### 1. Valuable Items Destination

Options:
- **Option A**: Create new `valuables` mod for precious items
- **Option B**: Move to existing mod (e.g., `trading` if it exists)
- **Option C**: Keep in a minimal `items` mod as miscellaneous

### 2. Smoking Pipe Destination

Options:
- **Option A**: Create new `tobacco` or `smoking` mod
- **Option B**: Move to `props` mod if it exists
- **Option C**: Keep in a minimal `items` mod as miscellaneous

## Migration Steps

1. [ ] **Investigate** remaining entities after previous migrations:
   ```bash
   ls data/mods/items/entities/definitions/
   ls data/mods/items/entities/instances/
   ```

2. [ ] **Update this ticket** with actual remaining entities

3. [ ] **Decide destinations** for each remaining entity

4. [ ] Move container entities to `containers` mod:
   - Copy entity files
   - Update component references
   - Verify `containers` mod dependencies

5. [ ] Handle valuable items (based on decision):
   - If creating `valuables` mod:
     ```bash
     mkdir -p data/mods/valuables/{entities/definitions}
     ```
     - Create mod-manifest.json
     - Move gold_bar entity
   - OR move to existing appropriate mod

6. [ ] Handle smoking pipe (based on decision):
   - Create new mod OR move to existing appropriate mod

7. [ ] Update `data/game.json` with any new mods

8. [ ] Validate:
   ```bash
   npm run validate
   npm run test:unit
   npm run test:integration
   ```

9. [ ] Remove relocated files from original `items` mod

## Validation Checklist

- [ ] `npm run validate` passes
- [ ] `npm run test:unit` passes
- [ ] `npm run test:integration` passes
- [ ] No orphaned entity files in original `items` mod
- [ ] All relocated entities load correctly
- [ ] No broken references

## Blocked By

- ITEMSPLIT-001 through ITEMSPLIT-010

## Blocks

- ITEMSPLIT-012 (cleanup) - cannot finalize until entities are relocated

## Notes

- This ticket requires investigation to determine actual remaining entities
- Decisions on destination mods should be made based on project's current mod structure
- Some entities may require new mods to be created
