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

**CORRECTED ASSUMPTION**: The wearable component defines four layers in **TWO locations** (not one):

```json
// data/mods/clothing/components/wearable.component.json:8-12
"layer": {
  "type": "string",
  "enum": ["underwear", "base", "outer", "accessories"],
  "description": "Layer priority for stacking"
}
```

AND

```json
// data/mods/clothing/components/wearable.component.json:31-38
"allowedLayers": {
  "type": "array",
  "items": {
    "type": "string",
    "enum": ["underwear", "base", "outer", "accessories"]
  },
  "description": "Layers allowed for this clothing item based on equipment slot"
}
```

## Target State

Add "armor" to **BOTH** layer enums:

```json
"layer": {
  "type": "string",
  "enum": ["underwear", "base", "outer", "accessories", "armor"],
  "description": "Layer priority for stacking"
}
```

AND

```json
"allowedLayers": {
  "type": "array",
  "items": {
    "type": "string",
    "enum": ["underwear", "base", "outer", "accessories", "armor"]
  },
  "description": "Layers allowed for this clothing item based on equipment slot"
}
```

## Implementation Steps

1. **Open the wearable component schema**
   - File: `data/mods/clothing/components/wearable.component.json`
   - Locate the `layer` property definition (line 8-12)
   - Locate the `allowedLayers.items` enum (line 35)

2. **Add "armor" to BOTH enum arrays**
   - Add "armor" as the fifth value in the `layer` enum (line 10)
   - Add "armor" as the fifth value in the `allowedLayers.items` enum (line 35)
   - Maintain JSON formatting consistency
   - Preserve the existing descriptions

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

- [x] The wearable component schema includes "armor" in the `layer` enum (line 10)
- [x] The wearable component schema includes "armor" in the `allowedLayers.items` enum (line 35)
- [x] The JSON file is syntactically valid
- [x] All test files updated to include "armor" in layer enums
- [x] Operator implementation updated to validate "armor" as a valid layer
- [x] No existing clothing entities are broken by the change (backward compatible)

## Related Tickets

- **Next**: ARMSYSANA-002 (Update Coverage Mapping Schema)
- **Depends On**: None

## Notes

This change is the **most critical** update required for armor support. Once this schema is updated, armor entities can be created and will be recognized by the system.

The anatomy system was already future-proofed for this exact use case - this ticket simply aligns the clothing schema with the existing infrastructure.

---

## Completion Status: ✅ COMPLETED

### Outcome

**What was changed:**

1. **Schema Updates (as originally planned):**
   - ✅ `data/mods/clothing/components/wearable.component.json`:
     - Updated `layer` enum to include "armor" (line 10)
     - Updated `allowedLayers.items` enum to include "armor" (line 35)

2. **Source Code Updates (additional scope discovered):**
   - ✅ `src/logic/operators/base/BaseEquipmentOperator.js`:
     - Updated `isValidLayerName()` method to include "armor" in validLayers array
   - ✅ `src/logic/operators/hasClothingInSlotLayerOperator.js`:
     - Updated error message to include "armor" in valid layers list

3. **Test Updates (additional scope discovered):**
   - ✅ `tests/integration/validation/componentValidationRules.integration.test.js` (7 locations)
   - ✅ `tests/integration/anatomy/anatomyGenerationWithClothing.test.js`
   - ✅ `tests/unit/schemas/anatomy.recipe.schema.test.js`
   - ✅ `tests/unit/clothing/clothingUnequippedEventValidation.test.js`
   - ✅ `tests/unit/logic/jsonLogicCustomOperators.test.js`
   - ✅ `tests/unit/logic/operators/hasClothingInSlotLayerOperator.test.js` (2 locations)
   - ✅ `tests/unit/clothing/events/clothingEquippedEvent.test.js`
   - ✅ `tests/unit/clothing/entities/jon_urena_clothing_entities.test.js` (2 locations)
   - ✅ `tests/unit/clothing/entities/new_clothing_items.test.js` (2 locations)
   - **New Test Added:** Specific validation test for armor layer in componentValidationRules.integration.test.js

**Actual vs. Originally Planned:**

The original ticket assumed only the schema file needed updating in TWO locations (after correction). However, the actual implementation revealed that:

- **Critical Discovery:** The operator validation logic in `BaseEquipmentOperator` had a hardcoded list of valid layers that needed updating
- **Test Coverage:** 10+ test files contained hardcoded layer enums that needed updating to maintain consistency
- **Error Messages:** Error messages in operators needed updating to reflect the new valid layer

The expanded scope ensures **complete system consistency** - armor is now recognized at all levels: schema validation, runtime operators, and test coverage.

**Result:** The armor layer is now fully integrated into the clothing system and will be validated correctly throughout the entire codebase.
