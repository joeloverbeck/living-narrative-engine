# ARMSYSANA-002: Update Coverage Mapping Schema

**Phase**: Phase 1 - Core System Update
**Priority**: High (Optional but Recommended)
**Risk Level**: Minimal
**Estimated Effort**: 15 minutes

## Context

The coverage mapping component allows clothing items to cover additional body regions beyond their primary equipment slot. It uses a `coveragePriority` field to determine which layer is visible when multiple items cover the same body region.

Currently, the coverage priority scoring system is:
- `outer`: 100 (highest visibility)
- `base`: 200
- `underwear`: 300
- `accessories`: 350
- `direct`: 400 (fallback)

**CRITICAL DISCREPANCY IDENTIFIED**: The `clothing:wearable` component schema (data/mods/clothing/components/wearable.component.json:10) and `clothing:slot_metadata` component schema ALREADY include "armor" in their layer enums. However, the `clothing:coverage_mapping` component schema does NOT include "armor" in its coveragePriority enum.

This creates an **inconsistency** where:
- An item can have `"layer": "armor"` in its wearable component (VALID)
- But cannot have `"coveragePriority": "armor"` in its coverage_mapping component (INVALID)

This ticket fixes this schema inconsistency to align coverage_mapping with the other clothing component schemas.

## Objective

Update the `clothing:coverage_mapping` component schema to include "armor" as a valid `coveragePriority` value, bringing it into alignment with the `clothing:wearable` and `clothing:slot_metadata` schemas which already support armor. This ensures consistency across all clothing component schemas and allows armor to have its own priority tier between outer and base layers.

## Current State

```json
// data/mods/clothing/components/coverage_mapping.component.json:29
"coveragePriority": {
  "type": "string",
  "enum": ["outer", "base", "underwear", "accessories"],
  "description": "Priority tier for coverage resolution"
}
```

## Target State

Add "armor" to the coveragePriority enum:

```json
"coveragePriority": {
  "type": "string",
  "enum": ["outer", "armor", "base", "underwear", "accessories"],
  "description": "Priority tier for coverage resolution"
}
```

## Implementation Steps

1. **Open the coverage mapping component schema**
   - File: `data/mods/clothing/components/coverage_mapping.component.json`
   - Locate the `coveragePriority` property definition (around line 29)

2. **Add "armor" to the enum array**
   - Insert "armor" after "outer" in the enum array
   - This positions it correctly in the priority hierarchy
   - Maintain JSON formatting consistency

3. **Verify JSON validity**
   - Ensure the file is valid JSON
   - Check for proper comma placement
   - Verify closing brackets

## Recommended Coverage Priority Order

After this change, the coverage priority hierarchy will be:
1. `outer`: 100 (highest visibility)
2. `armor`: 150 (NEW - armor has priority between outer and base)
3. `base`: 200
4. `underwear`: 300
5. `accessories`: 350
6. `direct`: 400 (fallback)

**Note**: The numeric priority constants will be updated in ARMSYSANA-004 (Update Slot Access Resolver).

## Use Cases

This change allows armor entities to declare coverage priority explicitly:

```json
{
  "clothing:coverage_mapping": {
    "covers": ["torso_upper", "torso_lower"],
    "coveragePriority": "armor"
  }
}
```

This ensures that:
- Armor overrides regular clothing (base layer) coverage
- Armor can be hidden by outer garments (cloaks, robes)
- Armor is visible in action descriptions when appropriate

## Validation Steps

After making the change:

1. **Validate JSON syntax**
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('data/mods/clothing/components/coverage_mapping.component.json'))"
   ```

2. **Run schema validation**
   ```bash
   npm run validate
   ```

3. **Check for validation errors**
   - No errors should be reported
   - All existing coverage mapping entities should remain valid

## Impact Assessment

- **Existing Coverage Mappings**: ✅ Unaffected (backward compatible)
- **Slot Access Resolver**: ⚠️ Will need update (see ARMSYSANA-004)
- **Coverage Analyzer**: ⚠️ May need update (check during implementation)

## Breaking Changes

**None** - This is an additive change. All existing coverage mappings with priorities "outer", "base", "underwear", or "accessories" will continue to work.

## Success Criteria

- [ ] The coverage mapping schema includes "armor" in the coveragePriority enum
- [ ] The "armor" value is positioned after "outer" in the enum
- [ ] The JSON file is syntactically valid
- [ ] `npm run validate` passes without errors
- [ ] No existing coverage mapping entities are broken by the change

## Related Tickets

- **Previous**: ARMSYSANA-001 (Update Wearable Schema)
- **Next**: ARMSYSANA-003 (Run Validation Suite)
- **Related**: ARMSYSANA-004 (Update Slot Access Resolver) - Priority constants
- **Depends On**: ARMSYSANA-001

## Verified Assumptions (Reassessed)

✅ **File Location**: `data/mods/clothing/components/coverage_mapping.component.json` exists at expected location
✅ **Line Number**: `coveragePriority` property is at line 27-31 (close to stated "around line 29")
✅ **Current Enum Values**: Confirmed as ["outer", "base", "underwear", "accessories"]
❌ **New Feature**: This is NOT a new feature - it's a **consistency fix**. The `clothing:wearable` and `clothing:slot_metadata` schemas already include "armor"
✅ **Breaking Changes**: Confirmed as none - this is an additive change
✅ **Impact**: Minimal - no existing entities use armor coverage priority yet

**Updated Understanding**: This change removes a schema inconsistency between related clothing components, rather than adding new functionality.

## Notes

While this change is marked as "optional", it is **highly recommended** because:
1. It **fixes schema inconsistency** with wearable and slot_metadata components
2. It provides semantic clarity for armor coverage
3. It allows armor to have its own distinct priority tier
4. It supports flexible armor positioning (under or over other layers)
5. It aligns with the philosophy of armor as a distinct clothing category

Without this change:
- Armor entities would need to use "outer" or "base" as their coverage priority (less semantically clear)
- Schema validation would reject `"coveragePriority": "armor"` even though `"layer": "armor"` is valid in wearable component
