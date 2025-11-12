# ARMSYSANA-001: Update Wearable Component Schema

**Phase**: Phase 1 - Core System Update
**Priority**: Critical
**Risk Level**: Minimal
**Estimated Effort**: 15 minutes

## Context

The Living Narrative Engine's anatomy system is already prepared for armor as a distinct clothing layer. The infrastructure exists in the anatomy blueprints and slot definitions, but the clothing system needs minimal updates to fully support armor entities.

The anatomy system has already defined "armor" as a layer in multiple locations:
- Slot metadata component (`data/mods/clothing/components/slot_metadata.component.json:29`)
- Humanoid slot library (`data/mods/anatomy/libraries/humanoid.slot-library.json`)
- All major humanoid and non-human blueprints

However, the `clothing:wearable` component schema does not include "armor" in its layer enum.

## Objective

Update the `clothing:wearable` component schema to include "armor" as a valid layer value, aligning it with the existing anatomy system infrastructure.

## Current State

The wearable component currently defines four layers:

```json
// data/mods/clothing/components/wearable.component.json:8-12
"layer": {
  "type": "string",
  "enum": ["underwear", "base", "outer", "accessories"],
  "description": "Layer priority for stacking"
}
```

## Target State

Add "armor" to the layer enum:

```json
"layer": {
  "type": "string",
  "enum": ["underwear", "base", "outer", "accessories", "armor"],
  "description": "Layer priority for stacking"
}
```

## Implementation Steps

1. **Open the wearable component schema**
   - File: `data/mods/clothing/components/wearable.component.json`
   - Locate the `layer` property definition (around line 8-12)

2. **Add "armor" to the enum array**
   - Add "armor" as the fifth value in the enum array
   - Maintain JSON formatting consistency
   - Preserve the existing description

3. **Verify JSON validity**
   - Ensure the file is valid JSON
   - Check for proper comma placement
   - Verify closing brackets

## Expected Layer Hierarchy

After this change, the layer hierarchy will be (innermost to outermost):
1. underwear - Undergarments
2. base - Regular clothing (shirts, pants)
3. armor - Protective equipment (cuirass, chainmail, plate)
4. outer - Outerwear (cloaks, robes, long coats)
5. accessories - Accessories (jewelry, belts)

## Validation Steps

After making the change:

1. **Validate JSON syntax**
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('data/mods/clothing/components/wearable.component.json'))"
   ```

2. **Run schema validation**
   ```bash
   npm run validate
   ```

3. **Check for validation errors**
   - No errors should be reported
   - All existing clothing entities should remain valid

## Impact Assessment

- **Anatomy Blueprints**: ✅ No changes needed (already support armor)
- **Slot Metadata Schema**: ✅ No changes needed (already includes armor)
- **Humanoid Slot Library**: ✅ No changes needed (already defines armor)
- **Existing Clothing Entities**: ✅ Unaffected (backward compatible)

## Breaking Changes

**None** - This is an additive change. All existing clothing entities with layers "underwear", "base", "outer", or "accessories" will continue to work.

## Success Criteria

- [ ] The wearable component schema includes "armor" in the layer enum
- [ ] The JSON file is syntactically valid
- [ ] `npm run validate` passes without errors
- [ ] No existing clothing entities are broken by the change

## Related Tickets

- **Next**: ARMSYSANA-002 (Update Coverage Mapping Schema)
- **Depends On**: None

## Notes

This change is the **most critical** update required for armor support. Once this schema is updated, armor entities can be created and will be recognized by the system.

The anatomy system was already future-proofed for this exact use case - this ticket simply aligns the clothing schema with the existing infrastructure.
