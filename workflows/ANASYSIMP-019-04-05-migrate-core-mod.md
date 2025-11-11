# ANASYSIMP-019-04-05: Migrate Core Mod Components

**Parent:** ANASYSIMP-019-04 (Migrate Components to Use ValidationRules)
**Phase:** 2 (Batch Migration - Priority 4)
**Timeline:** 10 minutes
**Status:** Not Started
**Dependencies:** ANASYSIMP-019-04-04

## Overview

Migrate 5 component schemas in the core mod to use the new `validationRules` feature. This is the fourth priority batch with foundational components that are widely used across the system.

## Components to Migrate

1. **gender** - Character gender definitions
2. **material** - Material properties for items/objects
3. **notes** - Note/annotation system
4. **actor_type** - Actor type classifications
5. **visibility** - Visibility states and properties

**Location:** `data/mods/core/components/*.component.json`

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

### Step 1: Identify Core Mod Components with Enums

```bash
# List all core mod components
ls -la data/mods/core/components/

# Find components with enum properties
grep -l '"enum"' data/mods/core/components/*.component.json

# Review each component's enum properties
for file in $(grep -l '"enum"' data/mods/core/components/*.component.json); do
  echo "=== $file ==="
  jq '.id, .dataSchema.properties | to_entries | map(select(.value.enum != null)) | map(.key)' "$file"
  echo ""
done
```

### Step 2: Migrate Each Component

#### Component: gender

**File:** `data/mods/core/components/gender.component.json`

**Expected Enum Values:**
- Common: "male", "female", "non-binary", "other"

**Example ValidationRules:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid gender: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Gender is required",
      "invalidType": "Invalid type for gender: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

#### Component: material

**File:** `data/mods/core/components/material.component.json`

**Expected Enum Values:**
- Materials: "wood", "metal", "stone", "fabric", "leather", etc.

**Example ValidationRules:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid material: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Material is required",
      "invalidType": "Invalid type for material: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

#### Component: notes

**File:** `data/mods/core/components/notes.component.json`

**Expected Enum Values:**
- Note types: "info", "warning", "error", "success"
- Note priorities: "low", "normal", "high", "critical"

**Example ValidationRules:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid note property: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Note property is required",
      "invalidType": "Invalid type for note: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

#### Component: actor_type

**File:** `data/mods/core/components/actor_type.component.json`

**Expected Enum Values:**
- Actor types: "player", "npc", "creature", "object", "vehicle"

**Example ValidationRules:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid actor type: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Actor type is required",
      "invalidType": "Invalid type for actor type: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

#### Component: visibility

**File:** `data/mods/core/components/visibility.component.json`

**Expected Enum Values:**
- Visibility states: "visible", "hidden", "partially-visible", "transparent"

**Example ValidationRules:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid visibility: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Visibility is required",
      "invalidType": "Invalid type for visibility: expected {{expected}}, got {{actual}}"
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

```bash
# Validate schema structure
npm run validate

# Check for errors
echo $?  # Should be 0
```

### Step 4: Commit Batch

```bash
# Stage changes
git add data/mods/core/components/*.component.json

# Commit with descriptive message
git commit -m "feat(validation): add validationRules to core mod components

- Add validationRules to gender, material, notes, actor_type, visibility
- Enable enhanced error messages with similarity suggestions
- Improve foundational component validation
- Part of ANASYSIMP-019-04 migration"

# Verify commit
git log -1 --stat
```

## Validation Checklist

- [ ] All 5 core mod components have validationRules
- [ ] Error messages use appropriate terminology
- [ ] Template variables use double braces
- [ ] All required properties present
- [ ] `npm run validate` passes
- [ ] No JSON syntax errors
- [ ] Changes committed to git

## Acceptance Criteria

- [ ] 5 components migrated with validationRules
- [ ] All components pass schema validation
- [ ] Error messages customized appropriately
- [ ] Similarity suggestions enabled
- [ ] Batch committed with clear message
- [ ] No breaking changes introduced

## Time Estimate

- Component discovery: 2 minutes
- Migration (5 components × 1.5 minutes): ~8 minutes
- Validation: 1 minute
- Commit: 1 minute
- **Total:** ~12 minutes (adjusted to 10 for efficiency)

## Next Steps

After completion, proceed to:
- **ANASYSIMP-019-04-06**: Migrate music mod components (Priority 5)
