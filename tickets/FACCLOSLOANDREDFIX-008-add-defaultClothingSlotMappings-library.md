# FACCLOSLOANDREDFIX-008: Add defaultClothingSlotMappings to Slot Library

## Summary

Add the `defaultClothingSlotMappings` section to the humanoid slot library, containing all standard clothing slot mappings that should be inherited by parts.

## Context

After the schema (FACCLOSLOANDREDFIX-006) and loader (FACCLOSLOANDREDFIX-007) support library defaults, this ticket adds the actual default mappings to the slot library. This sets up the redundancy elimination in FACCLOSLOANDREDFIX-009.

## Files to Touch

### Must Modify (1 file)

1. `data/mods/anatomy/libraries/humanoid.slot-library.json`

## Out of Scope

- DO NOT modify part files (handled in FACCLOSLOANDREDFIX-009)
- DO NOT modify the loader (handled in FACCLOSLOANDREDFIX-007)
- DO NOT modify schemas (handled in FACCLOSLOANDREDFIX-006)
- DO NOT modify `slotDefinitions` section
- DO NOT modify `clothingDefinitions` section
- DO NOT remove any existing properties

## Implementation Details

Add a new top-level property `defaultClothingSlotMappings` containing all standard clothing slot mappings:

```json
{
  "id": "anatomy:humanoid_slots",
  "description": "Standard humanoid anatomy slot and clothing definitions",

  "slotDefinitions": { /* unchanged */ },

  "clothingDefinitions": { /* unchanged */ },

  "defaultClothingSlotMappings": {
    "head_gear": { "$use": "standard_head_gear" },
    "face_gear": { "$use": "standard_face_gear" },
    "torso_upper": { "$use": "standard_torso_upper" },
    "torso_lower": { "$use": "standard_torso_lower" },
    "left_arm_clothing": {
      "$use": "standard_arm_clothing",
      "blueprintSlots": ["left_arm"]
    },
    "right_arm_clothing": {
      "$use": "standard_arm_clothing",
      "blueprintSlots": ["right_arm"]
    },
    "hands": { "$use": "standard_hands" },
    "legs": { "$use": "standard_legs" },
    "feet": { "$use": "standard_feet" },
    "back_accessory": { "$use": "standard_back_accessory" },
    "nose_covering": { "$use": "standard_nose_covering" },
    "mouth_covering": { "$use": "standard_mouth_covering" },
    "face_lower": { "$use": "standard_face_lower" }
  }
}
```

### Notes

1. **Copy from existing parts**: The mappings should exactly match what's currently in `humanoid_core.part.json`
2. **Include new face slots**: Add the 3 new face slots (nose_covering, mouth_covering, face_lower)
3. **Preserve arm slot overrides**: Note that `left_arm_clothing` and `right_arm_clothing` have both `$use` AND `blueprintSlots` - copy this exactly

### Verification Steps

Before implementing, read `humanoid_core.part.json` to:
1. Get the exact current mapping names
2. Get the exact `$use` reference names
3. Identify any mappings with additional properties beyond `$use`

## Acceptance Criteria

### Tests That Must Pass

1. Schema validation passes: `npm run validate`
2. Slot library remains valid JSON
3. All existing anatomy tests pass: `npm run test:unit -- --testPathPattern="anatomy"`
4. All existing anatomy integration tests pass: `npm run test:integration -- --testPathPattern="anatomy"`
5. Loader tests from FACCLOSLOANDREDFIX-007 pass with real data

### Invariants That Must Remain True

1. **Existing sections unchanged**: `slotDefinitions` and `clothingDefinitions` remain exactly as they were
2. **Valid JSON structure**: File remains valid JSON with proper syntax
3. **$use references valid**: All `$use` references point to existing `clothingDefinitions` entries
4. **Complete coverage**: All standard mappings from parts are represented
5. **Exact match**: Default mappings match what parts currently define (same keys, same values)
6. **Schema compliant**: File validates against updated schema from FACCLOSLOANDREDFIX-006

### Manual Verification

After implementation:
1. `npm run validate` completes without errors
2. Load a blueprint and verify all clothing slots are available
3. Compare loaded slots with what existed before (should be identical)

## Test for Completeness

Create a comparison test:
```javascript
// Verify library defaults match what parts currently have
const library = loadSlotLibrary('anatomy:humanoid_slots');
const part = loadPart('humanoid_core');

// All part mappings should be in library defaults
for (const [slot, mapping] of Object.entries(part.clothingSlotMappings)) {
  expect(library.defaultClothingSlotMappings[slot]).toEqual(mapping);
}
```

## Dependencies

- FACCLOSLOANDREDFIX-003 (clothing definitions must include face slots)
- FACCLOSLOANDREDFIX-006 (schema must support the property)
- FACCLOSLOANDREDFIX-007 (loader must handle the property)

## Blocked By

- FACCLOSLOANDREDFIX-006 (schema support needed)
- FACCLOSLOANDREDFIX-007 (loader support needed)

## Blocks

- FACCLOSLOANDREDFIX-009 (can't remove redundant part mappings until library has defaults)
