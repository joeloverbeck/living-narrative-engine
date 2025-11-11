# ANASYSIMP-019-04-04: Migrate Clothing Mod Components

**Parent:** ANASYSIMP-019-04 (Migrate Components to Use ValidationRules)
**Phase:** 2 (Batch Migration - Priority 3)
**Timeline:** 12 minutes
**Status:** Not Started
**Dependencies:** ANASYSIMP-019-04-03

## Overview

Migrate 7 component schemas in the clothing mod to use the new `validationRules` feature. This is the third priority batch with moderate complexity due to the clothing system's layering and equipment mechanics.

## Components to Migrate

1. **wearable** - Clothing item properties and equipment behavior
2. **coverage_mapping** - Body part coverage definitions
3. **slot_metadata** - Equipment slot metadata
4. **blocks_removal** - Removal blocking relationships
5. **equipment** - Equipment state and properties
6. **layer_priority** - Layer stacking priority
7. **equipment_slots** - Available equipment slots

**Location:** `data/mods/clothing/components/*.component.json`

## Reference Documentation

Before starting, review:
- **Clothing System Documentation** (if available in `docs/`)
- **Parent Workflow**: `workflows/ANASYSIMP-019-04-migrate-components-validation-rules.md`
  - Example migration with wearable component (lines 67-121)

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

**Expected Enum Properties:**
- `layer` - Layer priority for stacking (e.g., "underwear", "base", "outer", "accessories")

**Example (from parent workflow lines 68-121):**
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "clothing:wearable",
  "description": "Defines clothing item properties and equipment behavior",
  "dataSchema": {
    "type": "object",
    "properties": {
      "layer": {
        "type": "string",
        "enum": ["underwear", "base", "outer", "accessories"],
        "description": "Layer priority for stacking"
      }
    },
    "required": ["layer"],
    "additionalProperties": false
  },
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid layer: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Layer is required",
      "invalidType": "Invalid type for layer: expected {{expected}}, got {{actual}}"
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

**Expected Enum Properties:**
- Body parts (e.g., "head", "torso", "arms", "legs")
- Coverage levels (e.g., "full", "partial", "none")

**Example ValidationRules:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid coverage value: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Coverage mapping is required",
      "invalidType": "Invalid type for coverage: expected {{expected}}, got {{actual}}"
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

**Expected Enum Properties:**
- Slot types (e.g., "head", "torso", "hands", "feet")
- Slot states or priorities

**Example ValidationRules:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid slot type: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Slot metadata is required",
      "invalidType": "Invalid type for slot: expected {{expected}}, got {{actual}}"
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

**Expected Enum Properties:**
- Blocking relationships or states
- Review actual schema for specific enum values

**Example ValidationRules:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid blocking state: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Blocking state is required",
      "invalidType": "Invalid type for blocking: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

#### Component: equipment

**File:** `data/mods/clothing/components/equipment.component.json`

**Expected Enum Properties:**
- Equipment states (e.g., "equipped", "unequipped", "broken")
- Equipment types or categories

**Example ValidationRules:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid equipment state: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Equipment state is required",
      "invalidType": "Invalid type for equipment: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

#### Component: layer_priority

**File:** `data/mods/clothing/components/layer_priority.component.json`

**Expected Enum Properties:**
- Layer priorities or ordering values
- Priority levels (e.g., "lowest", "low", "normal", "high", "highest")

**Example ValidationRules:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid layer priority: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Layer priority is required",
      "invalidType": "Invalid type for priority: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

#### Component: equipment_slots

**File:** `data/mods/clothing/components/equipment_slots.component.json`

**Expected Enum Properties:**
- Slot names (e.g., "head", "chest", "hands", "feet")
- Slot categories or types

**Example ValidationRules:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid equipment slot: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Equipment slot is required",
      "invalidType": "Invalid type for slot: expected {{expected}}, got {{actual}}"
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

- Add validationRules to wearable, coverage_mapping, slot_metadata, blocks_removal, equipment, layer_priority, equipment_slots
- Enable enhanced error messages with similarity suggestions
- Improve clothing system validation error clarity
- Part of ANASYSIMP-019-04 migration"

# Verify commit
git log -1 --stat
```

## Validation Checklist

After migration, verify:

- [ ] All 7 clothing mod components have validationRules
- [ ] Error messages use clothing-specific terminology
- [ ] Template variables use double braces: `{{value}}`, `{{validValues}}`
- [ ] All required properties present: generateValidator, errorMessages, suggestions
- [ ] `npm run validate` passes (exit code 0)
- [ ] No JSON syntax errors
- [ ] Changes committed to git

## Acceptance Criteria

- [ ] 7 components migrated with validationRules
- [ ] All components pass schema validation
- [ ] Error messages customized with clothing-specific property names
- [ ] Similarity suggestions enabled (maxDistance: 3, maxSuggestions: 3)
- [ ] Batch committed to git with clear message
- [ ] No breaking changes to clothing system introduced

## Common Pitfalls

### Pitfall 1: Wrong Template Variable Syntax
**Problem:** Using `{value}` instead of `{{value}}`
**Solution:** Always use double braces: `{{value}}`, `{{validValues}}`, `{{expected}}`, `{{actual}}`

### Pitfall 2: Generic Error Messages
**Problem:** Using "Invalid value" for clothing-specific properties
**Solution:** Use domain-specific terminology: "Invalid layer", "Invalid equipment slot"

### Pitfall 3: Not Customizing for Multiple Enums
**Problem:** Component has multiple enum properties but error messages reference only one
**Solution:** Use generic messages like "Invalid value: {{value}}" or add separate messages per property

### Pitfall 4: Forgetting Layer Terminology
**Problem:** Inconsistent terminology for clothing layers
**Solution:** Use standard layer terms: "underwear", "base", "outer", "accessories"

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
- Migration (7 components × 1.5 minutes each): ~10 minutes
- Validation: 1 minute
- Commit: 1 minute
- **Total:** ~14 minutes (adjusted to 12 for efficiency)

## Next Steps

After completion, proceed to:
- **ANASYSIMP-019-04-05**: Migrate core mod components (Priority 4)
