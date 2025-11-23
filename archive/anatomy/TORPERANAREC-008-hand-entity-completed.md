# TORPERANAREC-008: Create Tortoise Hand Entity ✅ COMPLETED

## Objective
Create the hand entity with three clawed digits.

## Dependencies
- None (entity definitions can be created independently)

## Files Touched
- **CREATED**: `data/mods/anatomy/entities/definitions/tortoise_hand.entity.json`
- **CREATED**: `tests/integration/anatomy/tortoiseHandEntityValidation.test.js`
- **MODIFIED**: `data/mods/descriptors/components/projection.component.json` (added "clawed" to enum)

## Out of Scope
- Do NOT modify existing entity definitions (except projection component schema)
- Do NOT create arm entity (handled in TORPERANAREC-007)
- Do NOT create other tortoise entity files (handled in separate tickets)
- Do NOT modify anatomy mod manifest (handled in TORPERANAREC-014)

## Implementation Details

### File: `tortoise_hand.entity.json`

Created entity definition with:

1. **Schema reference**: `"$schema": "schema://living-narrative-engine/entity-definition.schema.json"`
2. **ID**: `"anatomy:tortoise_hand"`
3. **Description**: "Thick-skinned hand with three prominent claws"

4. **Components**:

   - **anatomy:part**:
     - subType: "tortoise_hand"

   - **core:name**:
     - text: "hand"

   - **descriptors:texture**:
     - texture: "leathery"

   - **descriptors:digit_count**:
     - count: "3" (STRING value per schema requirement)

   - **descriptors:projection**:
     - projection: "clawed"

   - **descriptors:color_extended**:
     - color: "sickly-gray-green" (closest valid option to grey-green)

### File: `projection.component.json`

Extended projection component enum to include "clawed":
- **Previous enum**: `["flat", "bubbly", "shelf"]`
- **Updated enum**: `["flat", "bubbly", "shelf", "clawed"]`

## Acceptance Criteria ✅

### Tests that must pass:
- [x] `npm run validate` - Schema validation passes
- [x] Entity validates against `entity-definition.schema.json`
- [x] All component IDs exist in the system
- [x] Component property schemas validate correctly
- [x] JSON is well-formed and parseable
- [x] All 25 integration tests pass

### Invariants that remained true:
- [x] No existing entity definitions were modified (except projection schema extension)
- [x] subType "tortoise_hand" matches arm socket allowedTypes
- [x] Texture value "leathery" is valid per component schema (✓ confirmed)
- [x] digit_count.count is STRING value "3" per schema enum requirement
- [x] projection value "clawed" is valid per `descriptors:projection` schema (✓ added to enum)
- [x] color "sickly-gray-green" is valid per `descriptors:color_extended` schema (✓ confirmed)
- [x] No sockets defined (hand is terminal limb part)
- [x] All descriptor components use correct property names

## Validation Results
```bash
npm run validate
# ✅ No errors found for tortoise_hand
# ✅ All cross-reference validation passed

NODE_ENV=test npx jest tests/integration/anatomy/tortoiseHandEntityValidation.test.js
# ✅ Test Suites: 1 passed
# ✅ Tests: 25 passed
```

## Definition of Done ✅
- [x] File created with correct schema reference
- [x] Entity ID follows naming convention
- [x] All components properly structured
- [x] Digit count as STRING "3" per schema
- [x] Projection component added with "clawed" value
- [x] No sockets defined (terminal part)
- [x] Validation passes without errors
- [x] Tests created and passing
- [x] File committed with descriptive message

---

## Outcome

### What Was Changed vs Originally Planned

**Schema Extensions:**
1. **projection component**: Added "clawed" to enum `["flat", "bubbly", "shelf", "clawed"]` to support anatomical claw descriptors

**Corrected Assumptions:**
1. **digit_count value type**: Changed from numeric `3` to string `"3"` to match schema enum requirement
2. **color value**: Changed from "grey-green" to "sickly-gray-green" to match schema enum

**Files Created:**
- `data/mods/anatomy/entities/definitions/tortoise_hand.entity.json` - Entity definition with 6 components
- `tests/integration/anatomy/tortoiseHandEntityValidation.test.js` - Comprehensive validation test suite

**Files Modified:**
- `data/mods/descriptors/components/projection.component.json` - Extended enum to include "clawed"

**Test Coverage:**
- 25 integration tests covering:
  - Entity ID and description
  - All 6 components (part, name, texture, digit_count, projection, color_extended)
  - Terminal limb structure (no sockets)
  - Schema compliance
  - Descriptor enum validation (including new "clawed" projection)
  - Compatibility with arm socket
  - All invariants

**Validation Status:**
- ✅ Schema validation passed
- ✅ All 25 tests passed
- ✅ Compatible with tortoise_arm socket allowedTypes
- ✅ All component values within valid schema enums
- ✅ "clawed" projection now available for other anatomy entities

**Key Learning:**
The original ticket correctly identified the need for a "clawed" projection descriptor. Rather than working around the missing enum value, the projection component schema was extended to include "clawed" as a valid option, making it available for any future anatomical parts that feature claws. The implementation follows the validated schemas exactly and is compatible with the tortoise arm entity's hand socket.
