# ANASYSIMP-019-04-04: Migrate Clothing Mod Components

**Parent:** ANASYSIMP-019-04 (Migrate Components to Use ValidationRules)
**Phase:** 2 (Batch Migration - Priority 3)
**Timeline:** 12 minutes
**Status:** Not Started
**Dependencies:** ANASYSIMP-019-04-03

## Overview

Migrate 4 component schemas in the clothing mod to use the new `validationRules` feature. This is the third priority batch with moderate complexity due to the clothing system's layering and equipment mechanics.

## Components to Migrate

1. **wearable** - Clothing item properties and equipment behavior (2 enum properties)
2. **coverage_mapping** - Body part coverage definitions (2 enum properties)
3. **slot_metadata** - Equipment slot metadata (1 enum property)
4. **blocks_removal** - Removal blocking relationships (3 enum properties)

**Total Enum Properties:** 8 enum properties across 4 components

**Location:** `data/mods/clothing/components/*.component.json`

**Note:** The `clothing:equipment` component exists but uses `patternProperties` with regex patterns, not enums, so it does not require validationRules migration.

## Workflow Corrections Applied

**Date:** 2025-11-12

This workflow has been updated to correct assumptions about the clothing mod structure:

### What Changed:
1. **Component Count:** Corrected from 7 to 4 components with enums
   - Removed: `equipment` (exists but has no enums), `layer_priority` (doesn't exist), `equipment_slots` (doesn't exist)
   - Retained: `wearable`, `coverage_mapping`, `slot_metadata`, `blocks_removal`

2. **Enum Properties:** Documented actual enum properties for each component (8 total)
   - `wearable`: 2 enum properties (layer, allowedLayers items)
   - `coverage_mapping`: 2 enum properties (covers items, coveragePriority)
   - `slot_metadata`: 1 enum property (allowedLayers items)
   - `blocks_removal`: 3 enum properties (slot, layers items, blockType)

3. **Coverage Mapping:** Corrected enum values to match actual schema
   - Actual covers: ["torso_upper", "torso_lower", "legs", "feet", "head_gear", "hands", "left_arm_clothing", "right_arm_clothing"]
   - Actual coveragePriority: ["outer", "base", "underwear", "accessories"]

4. **Slot Metadata:** Corrected to reflect actual structure
   - No enum for slot names (uses patternProperties)
   - Only `allowedLayers` has enum: ["underwear", "base", "outer", "accessory", "armor"]
   - Noted inconsistency: "accessory" vs "accessories" across components

5. **Blocks Removal:** Documented all 3 enum properties with correct values
   - Added reference to CLAUDE.md Clothing Removal Blocking System

6. **Added Notes:**
   - Component-level validationRules vs nested enum validation
   - Layer terminology inconsistencies across components
   - Integration with anatomy system (coverage slots)

### Verified Against:
- Actual component files in `data/mods/clothing/components/`
- `docs/anatomy/clothing-coverage-mapping.md`
- `workflows/ANASYSIMP-019-04-01-identify-migration-candidates.md` (correctly shows 4 components)

## Reference Documentation

Before starting, review:
- **Clothing Coverage Mapping:** `docs/anatomy/clothing-coverage-mapping.md`
- **Clothing Blocking System:** See CLAUDE.md section on "Clothing Removal Blocking System"
- **Parent Workflow**: `workflows/ANASYSIMP-019-04-migrate-components-validation-rules.md`

## Standard ValidationRules Template

Use this template for all components:

```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid {propertyName}: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "{PropertyLabel} is required",
      "invalidType": "Invalid type for {propertyName}: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

## Implementation Steps

### Step 1: Identify Clothing Mod Components with Enums

List all clothing mod components with enum properties:

```bash
# List all clothing mod components
ls -la data/mods/clothing/components/

# Find components with enum properties
grep -l '"enum"' data/mods/clothing/components/*.component.json

# Review each component's enum properties
for file in $(grep -l '"enum"' data/mods/clothing/components/*.component.json); do
  echo "=== $file ==="
  jq '.dataSchema.properties | to_entries | map(select(.value.enum != null)) | map(.key)' "$file"
  echo ""
done
```

### Step 2: Migrate Each Component

For each component file:

#### Component: wearable

**File:** `data/mods/clothing/components/wearable.component.json`

**Enum Properties (2):**
1. `layer` - Layer priority for stacking: ["underwear", "base", "outer", "accessories"]
2. `allowedLayers` (array items) - Layers allowed for this item: ["underwear", "base", "outer", "accessories"]

**Migration Strategy:**
- Use generic error messages since component has multiple enum properties with overlapping values
- Provide clear context about which property is invalid

**Example ValidationRules:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid {propertyName}: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "{PropertyLabel} is required",
      "invalidType": "Invalid type for {propertyName}: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

#### Component: coverage_mapping

**File:** `data/mods/clothing/components/coverage_mapping.component.json`

**Enum Properties (2):**
1. `covers` (array items) - Body slots covered by this item: ["torso_upper", "torso_lower", "legs", "feet", "head_gear", "hands", "left_arm_clothing", "right_arm_clothing"]
2. `coveragePriority` - Priority level for coverage resolution: ["outer", "base", "underwear", "accessories"]

**Migration Strategy:**
- Use generic error messages for multiple enum properties
- Note: Coverage slots align with anatomy sockets (see `docs/anatomy/clothing-coverage-mapping.md`)

**Example ValidationRules:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid {propertyName}: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "{PropertyLabel} is required",
      "invalidType": "Invalid type for {propertyName}: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

#### Component: slot_metadata

**File:** `data/mods/clothing/components/slot_metadata.component.json`

**Enum Properties (1):**
1. `allowedLayers` (nested in patternProperties) - Layers allowed for this slot: ["underwear", "base", "outer", "accessory", "armor"]

**Migration Strategy:**
- Single enum property, can use specific error messages
- Note: Slot names are defined via patternProperties (dynamic), not enums
- Note: "accessory" (singular) vs "accessories" (plural) - inconsistency with other components!

**Example ValidationRules:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid allowed layer: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Allowed layers are required",
      "invalidType": "Invalid type for allowedLayers: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

#### Component: blocks_removal

**File:** `data/mods/clothing/components/blocks_removal.component.json`

**Enum Properties (3):**
1. `slot` (nested in blockedSlots array) - Equipment slot that is blocked: ["feet", "full_body", "hands", "head_gear", "left_arm_clothing", "legs", "right_arm_clothing", "torso_lower", "torso_upper"]
2. `layers` (nested array items in blockedSlots) - Layers in the blocked slot: ["underwear", "base", "outer", "accessories"]
3. `blockType` (nested in blockedSlots array) - Type of blocking behavior: ["must_remove_first", "must_loosen_first", "full_block"]

**Migration Strategy:**
- Multiple enum properties at different nesting levels
- Use generic error messages for clarity
- This component enforces realistic clothing physics (see `CLAUDE.md` Clothing Removal Blocking System)

**Example ValidationRules:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid {propertyName}: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "{PropertyLabel} is required",
      "invalidType": "Invalid type for {propertyName}: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

### Step 3: Validate After Each Component

Run validation after migrating each component:

```bash
# Validate schema structure
npm run validate

# Check for errors
echo $?  # Should be 0
```

### Step 4: Commit Batch

After all clothing mod components are migrated:

```bash
# Stage changes
git add data/mods/clothing/components/*.component.json

# Commit with descriptive message
git commit -m "feat(validation): add validationRules to clothing mod components

- Add validationRules to wearable, coverage_mapping, slot_metadata, blocks_removal
- Enable enhanced error messages with similarity suggestions
- Improve clothing system validation error clarity
- 8 total enum properties migrated across 4 components
- Part of ANASYSIMP-019-04 migration"

# Verify commit
git log -1 --stat
```

## Validation Checklist

After migration, verify:

- [ ] All 4 clothing mod components have validationRules (wearable, coverage_mapping, slot_metadata, blocks_removal)
- [ ] All 8 enum properties covered by validationRules
- [ ] Error messages use appropriate terminology (generic for multi-enum components)
- [ ] Template variables use double braces: `{{value}}`, `{{validValues}}`
- [ ] All required properties present: generateValidator, errorMessages, suggestions
- [ ] `npm run validate` passes (exit code 0)
- [ ] No JSON syntax errors
- [ ] Changes committed to git

## Acceptance Criteria

- [ ] 4 components migrated with validationRules (8 total enum properties)
- [ ] All components pass schema validation
- [ ] Error messages follow the recommended patterns for single vs multi-enum components
- [ ] Similarity suggestions enabled (maxDistance: 3, maxSuggestions: 3)
- [ ] Batch committed to git with clear message
- [ ] No breaking changes to clothing system introduced
- [ ] `clothing:equipment` component correctly excluded (uses patternProperties, not enums)

## Common Pitfalls

### Pitfall 1: Wrong Template Variable Syntax
**Problem:** Using `{value}` instead of `{{value}}`
**Solution:** Always use double braces: `{{value}}`, `{{validValues}}`, `{{expected}}`, `{{actual}}`

### Pitfall 2: Generic Error Messages
**Problem:** Using "Invalid value" for clothing-specific properties
**Solution:** Use domain-specific terminology: "Invalid layer", "Invalid equipment slot"

### Pitfall 3: Not Customizing for Multiple Enums
**Problem:** Component has multiple enum properties but error messages reference only one
**Solution:** Use generic messages like "Invalid {propertyName}: {{value}}" that work for all properties

### Pitfall 4: Layer Terminology Inconsistencies
**Problem:** Inconsistent terminology for clothing layers across components
**Known Issue:** `slot_metadata` uses "accessory" (singular) while other components use "accessories" (plural)
**Solution:** Keep existing terminology consistent within each component; document discrepancies

### Pitfall 5: Nested Enum Properties
**Problem:** Components like `blocks_removal` have enums nested in arrays and objects
**Solution:** ValidationRules apply at the component level; nested enum validation still works automatically

## Special Considerations

### Clothing Layer System

The clothing system uses layers for stacking:
- **underwear** - Bottom layer (first to wear)
- **base** - Base clothing layer
- **outer** - Outer layer (jackets, coats)
- **accessories** - Top layer (hats, jewelry)

**Important:** Validation error messages should align with layer terminology.

### Equipment Slots

Equipment slots define where clothing can be worn:
- Slots must align with anatomy sockets
- Slot validation is critical for equipment system
- Clear error messages help modders debug equipment issues

**Important:** Error messages should reference both slot and anatomy context.

### Coverage Mapping

Coverage mapping defines which body parts are covered:
- Must align with anatomy part definitions
- Critical for clothing removal/accessibility logic
- Validation prevents coverage mapping errors

**Important:** Error messages should reference anatomy parts clearly.

## Time Estimate

- Component discovery: 2 minutes
- Migration (4 components, 8 enum properties total): ~8 minutes
  - wearable: 2 minutes (2 enum properties)
  - coverage_mapping: 2 minutes (2 enum properties)
  - slot_metadata: 1.5 minutes (1 enum property)
  - blocks_removal: 2.5 minutes (3 enum properties, more complex nesting)
- Validation: 1 minute
- Commit: 1 minute
- **Total:** ~12 minutes

## Next Steps

After completion, proceed to:
- **ANASYSIMP-019-04-05**: Migrate core mod components (Priority 4)
