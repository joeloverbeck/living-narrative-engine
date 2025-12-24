# OXYDROSYS-009: Create amphibian respiratory entities

## Status: COMPLETED

## Description

Create amphibian-specific respiratory entities including both lungs and cutaneous (skin) respiration.

## Files Created

- `data/mods/anatomy-creatures/entities/definitions/amphibian_lung_left.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/amphibian_lung_right.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/amphibian_skin_respiration.entity.json`
- `tests/integration/mods/anatomy-creatures/amphibianRespiratoryIntegration.test.js`

## Files Modified

- `data/mods/anatomy-creatures/entities/definitions/toad_folk_male_torso.entity.json` - Added lung and skin respiration sockets
- `data/mods/anatomy-creatures/parts/amphibian_core.part.json` - Added lung and skin respiration slots
- `data/mods/dredgers/recipes/toad_folk_male.recipe.json` - Added respiratory slot mappings
- `data/mods/anatomy-creatures/mod-manifest.json` - Registered new entities

## Out of Scope

- Dual-environment breathing logic (can breathe in water via skin)
- Other creature types

## Acceptance Criteria

1. ✅ **Lung entities**: Standard pulmonary with `environmentCompatibility: ["air"]`, oxygenCapacity: 6 (smaller than feline)
2. ✅ **Skin respiration entity**: `respirationType: "cutaneous"`, `environmentCompatibility: ["air", "water"]`, oxygenCapacity: 4
3. ✅ **Toad folk updated**: Torso sockets, part slots, and recipe mappings for both respiratory organs
4. ✅ **Unique behavior**: Amphibians have backup water-breathing capability via cutaneous respiration

## Tests That Must Pass

- ✅ `npm run validate` - Schema validation (0 violations)
- ✅ Integration test: 33 tests covering all amphibian respiratory entities and configurations

## Invariants

- ✅ Amphibian lung capacity (6) is smaller than feline (8) - species-appropriate
- ✅ Cutaneous respiration provides redundancy (oxygenCapacity: 4), not replacement

## Outcome

### Ticket Assumption Corrections

The original ticket had incorrect assumptions that were corrected during implementation:

| Original Assumption | Actual Implementation | Reason |
|---------------------|----------------------|--------|
| Entities in `breathing` mod | Entities in `anatomy-creatures` mod | Follows feline lung pattern, avoids circular dependencies |
| Single `amphibian_lung.entity.json` | Left/right pair (`amphibian_lung_left/right.entity.json`) | Matches established lung entity pattern |
| Toad folk already had lung support | Added sockets to torso, slots to part, mappings to recipe | Full integration required |

### Implementation Summary

1. **Lung Entities** (left/right pair):
   - `respirationType`: "pulmonary"
   - `oxygenCapacity`: 6 (smaller than feline's 8)
   - `environmentCompatibility`: ["air"]
   - Weight: 0.4, Health: 20/20

2. **Skin Respiration Entity**:
   - `respirationType`: "cutaneous"
   - `oxygenCapacity`: 4 (lower than lungs)
   - `environmentCompatibility`: ["air", "water"]
   - Zero weight and zero health calculation weight (surface capability, not organ)

3. **Infrastructure Changes**:
   - Toad folk male torso: Added `lung_left_socket`, `lung_right_socket`, `skin_respiration_socket`
   - Amphibian core part: Added `left_lung`, `right_lung` (using `$use` references), `skin_respiration` slots
   - Toad folk recipe: Added slot mappings with `preferId` for each respiratory entity

4. **Test Coverage**: 33 integration tests validating entity structure, component values, slot/socket definitions, recipe mappings, and manifest registration
