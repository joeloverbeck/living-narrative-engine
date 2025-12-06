# TORPERANAREC-003: Create Tortoise Torso Root Entity

**Status**: ✅ COMPLETED

## Objective

Create the root torso entity with integrated shell mounting sockets.

## Dependencies

- None (entity definitions can be created independently)

## Files to Touch

- **CREATE**: `data/mods/anatomy/entities/definitions/tortoise_torso_with_shell.entity.json`

## Out of Scope

- Do NOT modify existing entity definitions
- Do NOT create other tortoise entity files (handled in separate tickets)
- Do NOT modify anatomy mod manifest (handled in TORPERANAREC-014)
- Do NOT create blueprint or recipe yet

## Implementation Details

### File: `tortoise_torso_with_shell.entity.json`

Create entity definition with:

1. **Schema reference**: `"$schema": "schema://living-narrative-engine/entity-definition.schema.json"`
2. **ID**: `"anatomy:tortoise_torso_with_shell"`
3. **Description**: "Tortoise torso with integrated shell mounting points"

4. **Components**:
   - **anatomy:part**:
     - subType: "tortoise_torso"

   - **anatomy:sockets** (shell mounting points):
     - sockets array with 2 entries:
       1. id: "carapace_mount"
          - allowedTypes: ["shell_carapace"]
          - nameTpl: "upper shell mount"
       2. id: "plastron_mount"
          - allowedTypes: ["shell_plastron"]
          - nameTpl: "lower shell mount"

   - **core:name**:
     - text: "tortoise torso"

   - **descriptors:texture**:
     - texture: "leathery"

   - **descriptors:color_extended**:
     - color: "dark-olive" _(CORRECTED: "olive-green" is not a valid enum value; "dark-olive" is the closest match)_

## Acceptance Criteria

### Tests that must pass:

1. ✅ `npm run validate` - Schema validation passes
2. ✅ Entity validates against `entity-definition.schema.json`
3. ✅ All component IDs exist in the system
4. ✅ JSON is well-formed and parseable

### Invariants that must remain true:

1. ✅ No existing entity definitions are modified
2. ✅ Socket IDs exactly match blueprint expectations: "carapace_mount", "plastron_mount"
3. ✅ Socket allowedTypes exactly match: ["shell_carapace"], ["shell_plastron"]
4. ✅ Texture value "leathery" is valid per `descriptors:texture` component schema
5. ✅ Color value "dark-olive" is valid per `descriptors:color_extended` component schema
6. ✅ Component structure follows ECS patterns
7. ✅ subType "tortoise_torso" is unique and descriptive

## Validation Commands

```bash
npm run validate
```

## Definition of Done

- [x] File created with correct schema reference
- [x] Entity ID follows naming convention
- [x] All components properly structured
- [x] Socket definitions match blueprint requirements
- [x] Descriptors use valid enumerated values
- [x] Validation passes without errors
- [x] File committed with descriptive message
- [x] Comprehensive test suite created

## Outcome

### What was changed:

1. **Ticket Correction**: Changed color from "olive-green" (invalid) to "dark-olive" (valid enum value)
2. **Entity File Created**: `data/mods/anatomy/entities/definitions/tortoise_torso_with_shell.entity.json`
3. **Test Suite Created**: `tests/integration/anatomy/tortoiseTorsoEntityValidation.test.js` with 26 comprehensive tests

### What was preserved:

- All existing entity definitions remain unchanged
- Socket IDs and allowedTypes exactly match blueprint requirements
- Component structure follows established ECS patterns
- All validation passes successfully

### Test Coverage:

- **New Tests**: 26 passing tests covering:
  - File structure validation
  - Schema compliance for all 5 components
  - Socket configuration correctness
  - Invariant validation
  - Enum value validation

### Validation Results:

- ✅ All 26 new tests passing
- ✅ All existing anatomy tests still passing
- ✅ `npm run validate` passes without errors
- ✅ No regressions introduced
