# TORPERANAREC-009: Create Tortoise Leg Entity

## Objective
Create the leg entity with socket for foot attachment and stocky build descriptor.

## Dependencies
- None (entity definitions can be created independently)

## Files to Touch
- **CREATE**: `data/mods/anatomy/entities/definitions/tortoise_leg.entity.json`

## Out of Scope
- Do NOT modify existing entity definitions
- Do NOT create foot entity (handled in TORPERANAREC-010)
- Do NOT create other tortoise entity files (handled in separate tickets)
- Do NOT modify anatomy mod manifest (handled in TORPERANAREC-014)

## Implementation Details

### File: `tortoise_leg.entity.json`

Create entity definition with:

1. **Schema reference**: `"$schema": "schema://living-narrative-engine/entity-definition.schema.json"`
2. **ID**: `"anatomy:tortoise_leg"`
3. **Description**: "Sturdy reptilian leg with foot socket"

4. **Components**:

   - **anatomy:part**:
     - subType: "tortoise_leg"

   - **anatomy:sockets** (foot attachment point):
     - sockets array with 1 entry:
       - id: "foot"
       - allowedTypes: ["tortoise_foot"]
       - nameTpl: "foot"

   - **core:name**:
     - text: "leg"

   - **descriptors:texture**:
     - texture: "scaled"

   - **descriptors:build**:
     - build: "stocky"

   - **descriptors:color_extended**:
     - color: "dark-olive"

## Assumptions Corrected

**Color Value**: Original ticket specified "olive-green" which is not a valid enum value in `descriptors:color_extended`. Corrected to "dark-olive" to match schema. Note: Existing `tortoise_arm.entity.json` also uses invalid "olive-green" value - flagged for future correction but out of scope for this ticket.

## Acceptance Criteria

### Tests that must pass:
1. `npm run validate` - Schema validation passes
2. Entity validates against `entity-definition.schema.json`
3. All component IDs exist in the system
4. JSON is well-formed and parseable

### Invariants that must remain true:
1. No existing entity definitions are modified
2. Socket ID is exactly "foot" (generic, not left/right)
3. Socket allowedTypes exactly matches: ["tortoise_foot"]
4. Texture value "scaled" is valid per component schema
5. Build value "stocky" is valid enumerated value per Body Descriptor Registry
6. subType "tortoise_leg" matches structure template allowedTypes
7. Socket count is exactly 1 (one foot per leg)

## Validation Commands
```bash
npm run validate
```

## Definition of Done
- [x] File created with correct schema reference
- [x] Entity ID follows naming convention
- [x] All components properly structured
- [x] Socket definition matches foot entity expectations
- [x] Build descriptor uses valid enumerated value
- [x] Validation passes without errors
- [x] File committed with descriptive message

## Status: ✅ COMPLETED

## Outcome

### What Was Actually Changed vs Originally Planned

**Changed:**
1. ✅ Created `data/mods/anatomy/entities/definitions/tortoise_leg.entity.json` with all specified components
2. ✅ Created comprehensive test suite: `tests/integration/anatomy/tortoiseLegEntityValidation.test.js` with 22 test cases
3. ⚠️ **Corrected color value**: Changed from invalid "olive-green" to valid "dark-olive" per schema
4. ✅ All 22 tests passing
5. ✅ Schema validation passing

**Key Correction:**
- **Original plan** specified `color: "olive-green"`
- **Actual implementation** uses `color: "dark-olive"`
- **Reason**: "olive-green" is not a valid enum value in `descriptors:color_extended.component.json`. The schema only contains "dark-olive".
- **Note**: Discovered that existing `tortoise_arm.entity.json` also uses invalid "olive-green" - flagged for future correction but out of scope for this ticket.

**Validation:**
- Entity file validates correctly against schema
- All component references exist in the system
- Socket configuration matches foot entity expectations (awaiting TORPERANAREC-010)
- Build descriptor "stocky" is valid per Body Descriptor Registry

**Test Coverage:**
- Entity structure validation (7 tests)
- Socket structure validation (5 tests)
- Component structure validation (2 tests)
- Schema compliance validation (2 tests)
- Invariants validation (4 tests)
- Build descriptor validation (2 tests)
