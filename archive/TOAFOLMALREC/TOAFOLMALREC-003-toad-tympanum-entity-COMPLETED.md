# TOAFOLMALREC-003: Create toad_tympanum.entity.json

**Status**: COMPLETED

## Summary

Create the toad-specific tympanum (external eardrum) entity definition to replace traditional external ears, as is biologically accurate for amphibians.

## Background

Toads and frogs have tympana (singular: tympanum) instead of external ears. A tympanum is a circular, membrane-covered area on the side of the head that transmits sound vibrations. This entity represents this unique amphibian hearing organ while using the standard "ear" subType for anatomy system compatibility.

**Spec Reference**: `specs/toad-folk-male-recipe.md` - Section "3. entities/definitions/toad_tympanum.entity.json"

## Files to Create

| File | Description |
|------|-------------|
| `data/mods/dredgers/entities/definitions/toad_tympanum.entity.json` | Toad-specific ear (tympanum) entity |

## Files to Touch

- `data/mods/dredgers/entities/definitions/toad_tympanum.entity.json` (CREATE)

## Out of Scope

- DO NOT modify any existing entity files in dredgers mod
- DO NOT modify `ermine_ear.entity.json` (different species, different ear type)
- DO NOT modify the mod-manifest.json (handled in TOAFOLMALREC-007)
- DO NOT create other entity files (handled in other tickets)

## Implementation Details

Create `data/mods/dredgers/entities/definitions/toad_tympanum.entity.json` with:

**Schema compatibility note**: The shared `descriptors:appearance` bundle component does **not** exist in this codebase (see TOAFOLMALREC-002 correction). Use the discrete descriptor components that exist: `descriptors:size_category`, `descriptors:shape_general`, and `descriptors:texture`.

### Required Components

1. **anatomy:part**
   - `subType`: "ear" (for anatomy system compatibility)
   - `hit_probability_weight`: 1
   - `health_calculation_weight`: 1

2. **anatomy:part_health**
   - `currentHealth`: 3
   - `maxHealth`: 3
   - `state`: "healthy"

3. **core:name**
   - `text`: "tympanum"

4. **core:weight**
   - `weight`: 0.005 (kg) - very light membrane

5. **descriptors:size_category**
   - `size`: "medium"

6. **descriptors:shape_general**
   - `shape`: "circular" (added to `shape_general` enum)

7. **descriptors:texture**
   - `texture`: "smooth"

### Entity Structure

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "dredgers:toad_tympanum",
  "description": "A circular tympanum (external eardrum) typical of amphibians",
  "components": { ... }
}
```

### Design Notes

- **Lower Health**: 3 HP vs 5 HP for eyes - tympanum is a delicate membrane
- **Lower Weight**: 0.005 kg vs 0.02 kg for eyes - membrane vs organ
- **Circular Shape**: Tympana are distinctively round, unlike mammalian ears

## Acceptance Criteria

### Tests That Must Pass

1. **Schema Validation**:
   ```bash
   npm run validate
   ```
   - Entity must be valid against `entity-definition.schema.json`

2. **Component Schema Validation**: All components must validate:
   - `anatomy:part` component schema
   - `anatomy:part_health` component schema
   - `core:name` component schema
   - `core:weight` component schema
   - `descriptors:size_category` component schema
   - `descriptors:shape_general` component schema
   - `descriptors:texture` component schema

3. **Integration Test** (after all tickets complete):
   ```bash
   npm run validate:recipe -- --recipe dredgers:toad_folk_male_standard
   ```
   - Entity must be resolvable by recipe slot assignments for left_ear and right_ear

### Invariants That Must Remain True

1. **SubType Compatibility**: `subType` must be "ear" for anatomy system compatibility
2. **Existing Entities Unchanged**: All existing dredgers entity files must remain identical
3. **ermine_ear Preserved**: `ermine_ear.entity.json` must remain unchanged
4. **Valid Component References**: All component IDs must reference existing registered components
5. **Positive Health Values**: `currentHealth` and `maxHealth` must be positive integers
6. **Positive Weight**: Weight must be a positive number

### Completion Checklist

- [x] File created at `data/mods/dredgers/entities/definitions/toad_tympanum.entity.json`
- [x] Schema reference present and correct
- [x] ID is `dredgers:toad_tympanum`
- [x] All 7 required components present (separate descriptor components)
- [x] `subType` is "ear"
- [x] `npm run validate` passes
- [x] `ermine_ear.entity.json` unchanged
- [x] No changes to any other files (besides new test coverage)

## Dependencies

- **Blocks**: TOAFOLMALREC-006 (recipe references this entity)
- **Blocked By**: None (can be created in parallel with TOAFOLMALREC-001, 002, 004)

## Outcome

### What Was Actually Changed vs. Originally Planned

- **Planned**: Use a combined `descriptors:appearance` component with size/shape/texture fields and create the tympanum entity.
- **Actual**: The codebase does not include `descriptors:appearance`, so the tympanum uses existing discrete descriptor components (`descriptors:size_category`, `descriptors:shape_general`, `descriptors:texture`). Added `circular` to `shape_general` enums so the tympanum can match the spec’s intended shape and updated integration coverage accordingly.

### Tests Run

- `npm run validate`
- `npm run test:integration -- tests/integration/mods/dredgers/toadTympanumEntityLoading.test.js`
