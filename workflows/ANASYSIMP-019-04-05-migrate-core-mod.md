# ANASYSIMP-019-04-05: Migrate Core Mod Components

**Parent:** ANASYSIMP-019-04 (Migrate Components to Use ValidationRules)
**Phase:** 2 (Batch Migration - Priority 4)
**Timeline:** 11 minutes
**Status:** Not Started
**Dependencies:** ANASYSIMP-019-04-04
**Corrected:** Workflow assumptions validated against actual codebase

## Overview

Migrate 4 component schemas in the core mod to use the new `validationRules` feature. This is the fourth priority batch with foundational components that are widely used across the system.

## Components to Migrate

1. **gender** - Character gender definitions for pronoun resolution
2. **material** - Material properties for items/objects (multiple enum properties)
3. **notes** - Note/annotation system with structured context
4. **player_type** - Player controller type classifications (human/AI)

**Location:** `data/mods/core/components/*.component.json`

**Note:** The components `actor_type` and `visibility` do not exist in the core mod and have been removed from this migration.

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

**Actual Enum Values:**
- `value`: "male", "female", "neutral"
- Purpose: Gender identity used for pronoun selection (he/him, she/her, they/them)

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

**Actual Enum Values (Multiple Properties):**
- `material` (required): 43 values including "wood", "metal", "stone", "fabric", "leather", "cotton", "silk", "wool", "linen", "denim", "canvas", "leather", "suede", "plastic", "glass", "ceramic", "steel", "iron", "gold", "platinum", and many more
- `careInstructions` (array): "hand_wash_only", "machine_washable", "dry_clean_only", "waterproof", "heat_sensitive", "requires_oiling", "requires_polishing", "stain_resistant"
- `properties` (array): "breathable", "waterproof", "fireproof", "flexible", "rigid", "transparent", "reflective", "magnetic", "conductive", "insulating"

**Note:** This component has THREE enum properties, not just one. The validationRules will apply to all of them.

**Example ValidationRules:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid material property: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Material is required",
      "invalidType": "Invalid type for material property: expected {{expected}}, got {{actual}}"
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

**Actual Enum Values:**
- `subjectType` (required for each note): Categorization of note subject with 17 values:
  - "character", "location", "item", "creature", "event", "concept"
  - "relationship", "organization", "quest", "skill", "emotion", "plan"
  - "timeline", "theory", "observation", "knowledge_state", "psychological_state", "other"

**Note Structure:** This component stores an array of notes. Each note has:
- `text` (required): The note content
- `subject` (required): Primary subject of the note
- `subjectType` (required, enum): Categorization for organizational purposes
- `context` (optional): Where/how this was observed
- `timestamp` (optional): When the note was created

**Example ValidationRules:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid note subject type: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Note property is required",
      "invalidType": "Invalid type for note property: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

#### Component: player_type

**File:** `data/mods/core/components/player_type.component.json`

**Actual Enum Values:**
- `type` (required): "human", "llm", "goap"
- Purpose: Distinguishes between human players and different types of AI players (LLM-based or Goal-Oriented Action Planning)

**Example ValidationRules:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid player type: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Player type is required",
      "invalidType": "Invalid type for player type: expected {{expected}}, got {{actual}}"
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
# If dependencies are missing, install them first
npm install

# Validate schema structure
npm run validate

# Check for errors
echo $?  # Should be 0
```

**Note:** If `npm run validate` fails with "Cannot find package 'ajv'" error, run `npm install` first to install all dependencies.

### Step 4: Commit Batch

```bash
# Stage changes
git add data/mods/core/components/*.component.json

# Commit with descriptive message
git commit -m "feat(validation): add validationRules to core mod components

- Add validationRules to gender, material, notes, player_type
- Enable enhanced error messages with similarity suggestions
- Improve foundational component validation
- Part of ANASYSIMP-019-04 migration"

# Verify commit
git log -1 --stat
```

## Validation Checklist

- [ ] All 4 core mod components have validationRules
- [ ] Error messages use appropriate terminology
- [ ] Template variables use double braces ({{value}}, {{validValues}}, etc.)
- [ ] All required properties present
- [ ] Dependencies installed (`npm install` if needed)
- [ ] `npm run validate` passes
- [ ] No JSON syntax errors
- [ ] Changes committed to git

## Acceptance Criteria

- [ ] 4 components migrated with validationRules (gender, material, notes, player_type)
- [ ] All components pass schema validation
- [ ] Error messages customized appropriately for each component
- [ ] Similarity suggestions enabled on all components
- [ ] Material component accounts for multiple enum properties
- [ ] Batch committed with clear message
- [ ] No breaking changes introduced

## Time Estimate

- Component discovery: 2 minutes
- Migration (4 components × 1.5 minutes): ~6 minutes
- Validation (including npm install if needed): 2 minutes
- Commit: 1 minute
- **Total:** ~11 minutes

## Next Steps

After completion, proceed to:
- **ANASYSIMP-019-04-06**: Migrate music mod components (Priority 5)
