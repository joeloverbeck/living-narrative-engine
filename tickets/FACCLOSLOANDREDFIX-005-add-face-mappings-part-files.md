# FACCLOSLOANDREDFIX-005: Add Face Mappings to Part Files

## Summary

Add three new clothing slot mappings (`nose_covering`, `mouth_covering`, `face_lower`) to all 6 core part files in both anatomy and anatomy-creatures mods.

## Context

Part files define `clothingSlotMappings` that connect clothing slot names to their definitions in the slot library. After FACCLOSLOANDREDFIX-003 adds the clothing definitions, this ticket wires them into the parts so characters can actually equip face-covering items.

**Note:** This is a temporary step. After Phase 2 (FACCLOSLOANDREDFIX-006, 007, 008), these redundant mappings will be removed (FACCLOSLOANDREDFIX-009) in favor of library defaults.

## Files to Touch

### Must Modify (6 files)

1. `data/mods/anatomy/parts/humanoid_core.part.json`
2. `data/mods/anatomy-creatures/parts/hyena_core.part.json`
3. `data/mods/anatomy-creatures/parts/feline_core.part.json`
4. `data/mods/anatomy-creatures/parts/amphibian_core.part.json`
5. `data/mods/anatomy-creatures/parts/mustelid_core.part.json`
6. `data/mods/anatomy-creatures/parts/rodent_core.part.json`

## Out of Scope

- DO NOT modify head entity files
- DO NOT modify the slot library (handled in FACCLOSLOANDREDFIX-003)
- DO NOT modify the coverage_mapping component
- DO NOT modify schemas
- DO NOT add or remove any other mappings besides the 3 specified
- DO NOT modify any other properties in the part files

## Implementation Details

For each part file, add the following 3 entries to the `clothingSlotMappings` object:

```json
{
  "clothingSlotMappings": {
    // ... existing mappings remain unchanged ...

    "nose_covering": { "$use": "standard_nose_covering" },
    "mouth_covering": { "$use": "standard_mouth_covering" },
    "face_lower": { "$use": "standard_face_lower" }
  }
}
```

**Notes:**
- Add entries at the end of the existing `clothingSlotMappings` object
- Use consistent ordering across all 6 files
- The `$use` references must match the definition names from FACCLOSLOANDREDFIX-003

## Acceptance Criteria

### Tests That Must Pass

1. Schema validation passes: `npm run validate`
2. All part files remain valid JSON
3. All existing anatomy tests pass: `npm run test:unit -- --testPathPattern="anatomy"`
4. All existing anatomy integration tests pass: `npm run test:integration -- --testPathPattern="anatomy"`
5. Blueprint loading works correctly for all creature types

### Invariants That Must Remain True

1. **Existing mappings unchanged**: All pre-existing `clothingSlotMappings` entries remain exactly as they were
2. **Valid JSON structure**: All files remain valid JSON with proper syntax
3. **$use references valid**: References point to definitions that exist in the slot library (after FACCLOSLOANDREDFIX-003)
4. **Consistent across files**: All 6 files have identical new mappings
5. **No duplicate keys**: No duplicate keys in `clothingSlotMappings` object
6. **Part file structure**: No other part file properties are modified

### Integration Test Recommendation

Create a new test (or add to existing) that verifies:
```javascript
// Pseudocode for test verification
const blueprint = loadBlueprint('human_female');
const clothingSlots = blueprint.getClothingSlots();
expect(clothingSlots).toContain('nose_covering');
expect(clothingSlots).toContain('mouth_covering');
expect(clothingSlots).toContain('face_lower');
```

### Manual Verification

After implementation:
1. `npm run validate` completes without errors
2. Load a character blueprint in game/test and verify face slots appear
3. Can create a test respirator entity and equip it to `face_lower` slot

## Dependencies

- FACCLOSLOANDREDFIX-001: Sockets must exist in head entities
- FACCLOSLOANDREDFIX-002: Sockets must exist in creature head entities
- FACCLOSLOANDREDFIX-003: Clothing definitions must exist in slot library

## Blocked By

- FACCLOSLOANDREDFIX-003 (needs clothing definitions to reference)

## Blocks

- Nothing (completes Phase 1)
