# TORPERANAREC-004: Create Shell Entity Definitions

## Objective
Create both shell part entities (carapace and plastron) that mount to the torso.

## Dependencies
- None (entity definitions can be created independently)

## Files to Touch
- **CREATE**: `data/mods/anatomy/entities/definitions/tortoise_carapace.entity.json`
- **CREATE**: `data/mods/anatomy/entities/definitions/tortoise_plastron.entity.json`

## Out of Scope
- Do NOT modify existing entity definitions
- Do NOT create other tortoise entity files (handled in separate tickets)
- Do NOT modify anatomy mod manifest (handled in TORPERANAREC-014)
- Do NOT create torso entity (handled in TORPERANAREC-003)

## Implementation Details

### File 1: `tortoise_carapace.entity.json`

Create entity definition with:

1. **Schema reference**: `"$schema": "schema://living-narrative-engine/entity-definition.schema.json"`
2. **ID**: `"anatomy:tortoise_carapace"`
3. **Description**: "Domed upper shell (carapace) with growth rings"

4. **Components**:
   - **anatomy:part**: subType "shell_carapace"
   - **core:name**: text "carapace"
   - **descriptors:texture**: texture "scaled"
   - **descriptors:color_extended**: color "bronze" (closest match to amber-brown tones)

### File 2: `tortoise_plastron.entity.json`

Create entity definition with:

1. **Schema reference**: `"$schema": "schema://living-narrative-engine/entity-definition.schema.json"`
2. **ID**: `"anatomy:tortoise_plastron"`
3. **Description**: "Flat lower shell (plastron) protecting underside"

4. **Components**:
   - **anatomy:part**: subType "shell_plastron"
   - **core:name**: text "plastron"
   - **descriptors:texture**: texture "smooth"
   - **descriptors:color_extended**: color "cream" (closest match to pale-yellow tones)

## Acceptance Criteria

### Tests that must pass:
1. `npm run validate` - Schema validation passes for both files
2. Both entities validate against `entity-definition.schema.json`
3. All component IDs exist in the system
4. JSON is well-formed and parseable

### Invariants that must remain true:
1. No existing entity definitions are modified
2. subType values match torso socket allowedTypes: "shell_carapace", "shell_plastron"
3. Texture values are valid per component schema: "scaled", "smooth" ✓
4. Color values must be valid per descriptors:color_extended enum (using "bronze" and "cream")
5. Both files follow identical structure pattern (same components except for subType and color)

### Corrected Assumptions:
- **REMOVED**: descriptors:pattern component (original value "hexagonal-scutes" not in schema enum)
- **REMOVED**: descriptors:shape_general component (original values "domed"/"flat" not in schema enum)
- **CHANGED**: Color values from "dark-amber-brown"/"pale-yellow" to "bronze"/"cream" (valid enum values)
- **SIMPLIFIED**: Components now only include anatomy:part, core:name, descriptors:texture, descriptors:color_extended

## Validation Commands
```bash
npm run validate
```

## Definition of Done
- [x] Both files created with correct schema references
- [x] Entity IDs follow naming convention
- [x] All components properly structured
- [x] subTypes match socket requirements
- [x] Descriptors use valid values
- [x] Validation passes without errors
- [x] Test suite created and passing (16 tests)

## Status: ✅ COMPLETED

## Outcome

### What Was Changed

**Created Files:**
1. `data/mods/anatomy/entities/definitions/tortoise_carapace.entity.json`
   - Entity ID: `anatomy:tortoise_carapace`
   - Components: anatomy:part (shell_carapace), core:name, descriptors:texture (scaled), descriptors:color_extended (bronze)

2. `data/mods/anatomy/entities/definitions/tortoise_plastron.entity.json`
   - Entity ID: `anatomy:tortoise_plastron`
   - Components: anatomy:part (shell_plastron), core:name, descriptors:texture (smooth), descriptors:color_extended (cream)

3. `tests/integration/anatomy/tortoiseShellEntityValidation.test.js`
   - 16 tests validating entity structure, components, and socket compatibility
   - All tests passing

**Ticket Corrections:**
- Removed `descriptors:pattern` component (value "hexagonal-scutes" not in schema enum)
- Removed `descriptors:shape_general` component (values "domed"/"flat" not in schema enum)
- Changed color values: "dark-amber-brown" → "bronze", "pale-yellow" → "cream" (to match schema enum)

### What Was Originally Planned vs Actual

**Originally Planned:**
- 6 components per entity (anatomy:part, core:name, texture, pattern, color, shape)
- Free-form color values

**Actual Implementation:**
- 4 components per entity (anatomy:part, core:name, texture, color)
- Schema-compliant enum values for all descriptors
- Simplified structure that still achieves the objective

### Validation Results
- ✅ `npm run validate` passes
- ✅ All 16 integration tests pass
- ✅ No existing files modified
- ✅ subTypes match torso socket requirements exactly
