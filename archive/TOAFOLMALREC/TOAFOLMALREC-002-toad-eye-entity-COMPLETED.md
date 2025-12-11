# TOAFOLMALREC-002: Create toad_eye.entity.json

**Status**: COMPLETED

## Summary

Create the toad-specific eye entity definition with large, bulging characteristics typical of amphibians.

## Background

Toads have distinctive eyes - large, bulging, with horizontal pupils and positioned laterally on the head. This entity captures these visual characteristics while using the standard "eye" subType for compatibility with the anatomy system.

**Spec Reference**: `specs/toad-folk-male-recipe.md` - Section "2. entities/definitions/toad_eye.entity.json"

## Files to Create

| File | Description |
|------|-------------|
| `data/mods/dredgers/entities/definitions/toad_eye.entity.json` | Toad-specific eye entity |

## Files to Touch

- `data/mods/dredgers/entities/definitions/toad_eye.entity.json` (CREATE)
- `data/mods/descriptors/components/shape_eye.component.json` (MODIFY - add "bulging" to enum)

## Out of Scope

- DO NOT modify any existing entity files in dredgers mod
- DO NOT modify `ermine_ear.entity.json` or other ermine-folk entities
- DO NOT modify the mod-manifest.json (handled in TOAFOLMALREC-007)
- DO NOT create the tympanum entity (handled in TOAFOLMALREC-003)
- DO NOT create the torso entity (handled in TOAFOLMALREC-004)

## Implementation Details

Create `data/mods/dredgers/entities/definitions/toad_eye.entity.json` with:

### Required Components

**NOTE**: The spec file (`specs/toad-folk-male-recipe.md`) incorrectly specified `descriptors:appearance` which does NOT exist in the codebase. The actual pattern uses separate descriptor components as shown below. Additionally, `shape: "bulging"` was added to `descriptors:shape_eye` enum values since it's the correct descriptor for toad eyes.

1. **anatomy:part**
   - `subType`: "eye"
   - `hit_probability_weight`: 2
   - `health_calculation_weight`: 3

2. **anatomy:part_health**
   - `currentHealth`: 5
   - `maxHealth`: 5
   - `state`: "healthy"

3. **core:name**
   - `text`: "bulging eye"

4. **core:weight**
   - `weight`: 0.02 (kg)

5. **descriptors:size_category** (NOT `descriptors:appearance`)
   - `size`: "large"

6. **descriptors:shape_eye** (NOT part of `descriptors:appearance`)
   - `shape`: "bulging" (added to enum values)

7. **descriptors:texture** (NOT part of `descriptors:appearance`)
   - `texture`: "smooth"

### Entity Structure

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "dredgers:toad_eye",
  "description": "A large, bulging toad eye with horizontal pupil",
  "components": { ... }
}
```

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
   - `descriptors:shape_eye` component schema
   - `descriptors:texture` component schema

3. **Integration Test** (after all tickets complete):
   ```bash
   npm run validate:recipe -- --recipe dredgers:toad_folk_male_standard
   ```
   - Entity must be resolvable by recipe slot assignments

### Invariants That Must Remain True

1. **SubType Compatibility**: `subType` must be "eye" for anatomy system compatibility
2. **Existing Entities Unchanged**: All existing dredgers entity files must remain identical
3. **Valid Component References**: All component IDs must reference existing registered components
4. **Positive Health Values**: `currentHealth` and `maxHealth` must be positive integers
5. **Positive Weight**: Weight must be a positive number

### Completion Checklist

- [x] File created at `data/mods/dredgers/entities/definitions/toad_eye.entity.json`
- [x] Schema reference present and correct
- [x] ID is `dredgers:toad_eye`
- [x] All 7 required components present (corrected from spec's 5)
- [x] `subType` is "eye"
- [x] `npm run validate` passes
- [x] Only modified `descriptors:shape_eye` component to add "bulging" enum value

## Dependencies

- **Blocks**: TOAFOLMALREC-006 (recipe references this entity)
- **Blocked By**: None (can be created in parallel with TOAFOLMALREC-001, 003, 004)

## Outcome

### What Was Actually Changed vs. Originally Planned

**Planned (from spec)**:
- Create `toad_eye.entity.json` with 5 components including `descriptors:appearance`

**Actual Implementation**:
- Created `toad_eye.entity.json` with 7 components using separate descriptor components
- Modified `descriptors:shape_eye` component to add "bulging" enum value

### Discrepancies Found and Resolved

1. **`descriptors:appearance` does not exist**: The spec incorrectly assumed a `descriptors:appearance` component with combined `size`, `shape`, `texture` fields. The codebase uses separate descriptor components:
   - `descriptors:size_category`
   - `descriptors:shape_eye`
   - `descriptors:texture`

2. **"bulging" was not a valid eye shape**: Added "bulging" to `descriptors:shape_eye` enum values (alphabetically ordered) since it's the correct descriptor for toad eyes.

### Files Changed

| File | Change Type |
|------|-------------|
| `data/mods/dredgers/entities/definitions/toad_eye.entity.json` | CREATE |
| `data/mods/descriptors/components/shape_eye.component.json` | MODIFY (add "bulging" to enum) |
| `tests/integration/mods/dredgers/toadEyeEntityLoading.test.js` | CREATE (new tests) |

### Tests Added

| Test File | Tests | Purpose |
|-----------|-------|---------|
| `tests/integration/mods/dredgers/toadEyeEntityLoading.test.js` | 9 tests | Validates entity structure, components, and shape_eye enum |

### Validation Results

- `npm run validate`: PASSED (0 violations)
- `npm run test:unit tests/unit/schemas/descriptors.components.validation.test.js`: 171 tests passed
- `npm run test:integration tests/integration/mods/dredgers/toadEyeEntityLoading.test.js`: 9 tests passed
