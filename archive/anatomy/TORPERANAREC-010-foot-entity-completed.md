# TORPERANAREC-010: Create Tortoise Foot Entity

**Status**: ✅ COMPLETED

## Objective

Create the foot entity with three clawed toes.

## Dependencies

- None (entity definitions can be created independently)

## Files Touched

- **CREATED**: `data/mods/anatomy/entities/definitions/tortoise_foot.entity.json`
- **CREATED**: `tests/integration/anatomy/tortoiseFootEntityValidation.test.js`

## Out of Scope

- Do NOT modify existing entity definitions
- Do NOT create leg entity (handled in TORPERANAREC-009)
- Do NOT create other tortoise entity files (handled in separate tickets)
- Do NOT modify anatomy mod manifest (handled in TORPERANAREC-014)

## Implementation Details

### File: `tortoise_foot.entity.json`

Create entity definition with:

1. **Schema reference**: `"$schema": "schema://living-narrative-engine/entity-definition.schema.json"`
2. **ID**: `"anatomy:tortoise_foot"`
3. **Description**: "Broad foot with three clawed toes"

4. **Components**:
   - **anatomy:part**:
     - subType: "tortoise_foot"

   - **core:name**:
     - text: "foot"

   - **descriptors:texture**:
     - texture: "leathery"

   - **descriptors:digit_count**:
     - count: "3" _(STRING value per schema enum, not numeric)_

   - **descriptors:projection**:
     - projection: "clawed"

   - **descriptors:color_extended**:
     - color: "sickly-gray-green" _(matches hand entity pattern and enum value)_

## Assumptions Corrected

1. ✅ **digit_count.count**: Must be STRING "3" (enum value), not numeric 3
   - Verified against `descriptors:digit_count` schema which defines `type: "string"` with enum values
2. ✅ **color_extended.color**: Must be "sickly-gray-green" (valid enum value)
   - Original assumption "grey-green" is NOT in the `descriptors:color_extended` enum
   - Pattern from hand entity uses "sickly-gray-green" which IS valid

## Acceptance Criteria

### Tests that must pass:

1. ✅ `npm run validate` - Schema validation passes
2. ✅ Entity validates against `entity-definition.schema.json`
3. ✅ All component IDs exist in the system
4. ✅ Component property schemas validate correctly
5. ✅ JSON is well-formed and parseable

### Invariants that must remain true:

1. ✅ No existing entity definitions are modified
2. ✅ subType "tortoise_foot" matches leg socket allowedTypes
3. ✅ Texture value "leathery" is valid per component schema
4. ✅ digit_count.count is STRING "3" (enum value)
5. ✅ projection value "clawed" is valid per `descriptors:projection` schema
6. ✅ No sockets defined (foot is terminal limb part)
7. ✅ Component structure mirrors hand entity pattern

## Validation Commands

```bash
npm run validate
NODE_ENV=test npx jest tests/integration/anatomy/tortoiseFootEntityValidation.test.js
```

## Definition of Done

- [x] File created with correct schema reference
- [x] Entity ID follows naming convention
- [x] All components properly structured
- [x] Digit count "3" (string) and projection "clawed" correctly specified
- [x] Color "sickly-gray-green" (valid enum value) specified
- [x] No sockets defined (terminal part)
- [x] Validation passes without errors
- [x] Comprehensive test suite created (25 tests)
- [x] File committed with descriptive message

## Outcome

### What Was Changed

1. **Created** `tortoise_foot.entity.json` with corrected component values
2. **Created** comprehensive test suite with 25 validation tests
3. **Corrected** two ticket assumptions:
   - Changed digit count from numeric to string "3"
   - Changed color from "grey-green" to "sickly-gray-green"

### Validation Results

- ✅ All 25 tests pass
- ✅ Schema validation passes
- ✅ ESLint validation passes
- ✅ Component compatibility with leg socket verified

### Test Coverage

The test suite validates:

- Entity structure and ID
- All 6 components with correct values
- Terminal limb structure (no sockets)
- Schema compliance
- Descriptor enum validation
- Component invariants
- Compatibility with tortoise_leg socket

No changes were made beyond the minimal scope required by the ticket.
