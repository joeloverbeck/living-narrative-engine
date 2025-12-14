# FACCLOSLOANDREDFIX-009: Remove Redundant Mappings from Part Files

## Summary

Remove the redundant `clothingSlotMappings` entries from all 6 core part files that are now inherited from the slot library's `defaultClothingSlotMappings`.

## Context

After FACCLOSLOANDREDFIX-008 adds defaults to the library and FACCLOSLOANDREDFIX-007 enables auto-inheritance, the ~10 identical mappings in each part file become redundant. This ticket removes them, leaving only creature-specific overrides (like `tail_accessory`).

## Files to Touch

### Must Modify (6 files)

1. `data/mods/anatomy/parts/humanoid_core.part.json` - remove ALL mappings (inherits everything)
2. `data/mods/anatomy-creatures/parts/hyena_core.part.json` - remove standard, keep tail_accessory if present
3. `data/mods/anatomy-creatures/parts/feline_core.part.json` - remove standard, keep tail_accessory if present
4. `data/mods/anatomy-creatures/parts/amphibian_core.part.json` - remove standard, may need no mappings
5. `data/mods/anatomy-creatures/parts/mustelid_core.part.json` - remove standard, keep tail_accessory if present
6. `data/mods/anatomy-creatures/parts/rodent_core.part.json` - remove standard, keep tail_accessory if present

## Out of Scope

- DO NOT modify the slot library
- DO NOT modify the loader
- DO NOT modify schemas
- DO NOT modify entity files
- DO NOT modify any other part file properties
- DO NOT add new mappings (those were added in FACCLOSLOANDREDFIX-005)

## Implementation Details

### For humanoid_core.part.json

Remove the entire contents of `clothingSlotMappings`, leaving either:

**Option A - Empty object:**
```json
{
  "clothingSlotMappings": {}
}
```

**Option B - Remove property entirely:**
```json
{
  // No clothingSlotMappings property
}
```

Prefer Option A for explicitness, but verify which is valid per schema.

### For creature part files (hyena, feline, mustelid, rodent)

Keep ONLY creature-specific mappings that differ from library defaults:

```json
{
  "clothingSlotMappings": {
    "tail_accessory": { "$use": "standard_tail_accessory" }
  }
}
```

**Pre-implementation check**: Read each creature part file to identify:
1. Which mappings exist
2. Which are creature-specific (tail_accessory, etc.)
3. Which exactly duplicate library defaults

### For amphibian_core.part.json

Check if amphibians have any special mappings. If all mappings duplicate library defaults, use empty object like humanoid_core.

### Mappings to REMOVE (standard ones)

These should be removed from all part files as they're now in library defaults:
- `head_gear`
- `face_gear`
- `torso_upper`
- `torso_lower`
- `left_arm_clothing`
- `right_arm_clothing`
- `hands`
- `legs`
- `feet`
- `back_accessory`
- `nose_covering`
- `mouth_covering`
- `face_lower`

### Mappings to KEEP (creature-specific)

These should remain in creature parts if they exist:
- `tail_accessory` (cats, hyenas, rodents, mustelids)
- Any other creature-specific slots

## Acceptance Criteria

### Tests That Must Pass

1. Schema validation passes: `npm run validate`
2. All part files remain valid JSON
3. All existing anatomy tests pass: `npm run test:unit -- --testPathPattern="anatomy"`
4. All existing anatomy integration tests pass: `npm run test:integration -- --testPathPattern="anatomy"`
5. Blueprint loading works for all creature types
6. All clothing equipping functionality works unchanged

### Critical Integration Test

This test MUST pass after changes:
```javascript
describe('Clothing slot inheritance after redundancy removal', () => {
  it('should have all standard slots on humanoid blueprint', async () => {
    const blueprint = await loadBlueprint('human_female');
    const slots = blueprint.getClothingSlots();

    // All standard slots inherited from library
    expect(slots).toContain('head_gear');
    expect(slots).toContain('face_gear');
    expect(slots).toContain('torso_upper');
    expect(slots).toContain('hands');
    expect(slots).toContain('nose_covering');
    expect(slots).toContain('mouth_covering');
    expect(slots).toContain('face_lower');
    // ... etc
  });

  it('should have tail_accessory on cat_girl blueprint', async () => {
    const blueprint = await loadBlueprint('cat_girl');
    const slots = blueprint.getClothingSlots();

    // Standard slots from library
    expect(slots).toContain('head_gear');
    // Creature-specific slot from part
    expect(slots).toContain('tail_accessory');
  });
});
```

### Invariants That Must Remain True

1. **Functional equivalence**: Loaded blueprints have identical clothing slots before and after
2. **Valid JSON structure**: All files remain valid JSON
3. **Creature specifics preserved**: tail_accessory (and any other creature-specific slots) remain for creatures that need them
4. **Override capability**: Parts can still override library defaults if needed in future
5. **Game behavior unchanged**: Clothing equipping works exactly as before

### Manual Verification

After implementation:
1. `npm run validate` completes without errors
2. Load game with various character types
3. Verify all clothing slots appear correctly
4. Equip items to various slots (head_gear, face_lower, tail_accessory)
5. Compare character builder clothing options before/after

## Risk Mitigation

1. **Before removing**: Create a backup of all part files or commit current state
2. **Incremental approach**: Remove from one file, test, then proceed to next
3. **Regression test**: Run full test suite after each file modification

## Dependencies

- FACCLOSLOANDREDFIX-006 (schema support)
- FACCLOSLOANDREDFIX-007 (loader support)
- FACCLOSLOANDREDFIX-008 (library defaults must exist)

## Blocked By

- FACCLOSLOANDREDFIX-008 (must have library defaults before removing part mappings)

## Blocks

- Nothing (final ticket in the chain)

## Rollback Plan

If issues discovered:
1. Restore part files from version control
2. Remove `defaultClothingSlotMappings` from library
3. System returns to pre-redundancy-fix state
