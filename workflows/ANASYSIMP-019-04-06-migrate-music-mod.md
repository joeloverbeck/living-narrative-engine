# ANASYSIMP-019-04-06: Migrate Music Mod Components

**Parent:** ANASYSIMP-019-04 (Migrate Components to Use ValidationRules)
**Phase:** 2 (Batch Migration - Priority 5)
**Timeline:** 5 minutes (reduced from 8 - only 1 component needs migration)
**Status:** Not Started
**Dependencies:** ANASYSIMP-019-04-05
**Note:** Corrected after codebase validation - only 1 of 3 components has enum properties

## Overview

Migrate 1 component schema in the music mod to use the new `validationRules` feature. This is the fifth priority batch with music system components.

**Note:** Only 1 of the 3 original music mod components can be migrated. The other 2 components (playing_music, is_instrument) have no enum properties and do not require validationRules.

## Components to Migrate

1. **performance_mood** - Mood/tone of musical performance (HAS ENUMS - can migrate)

## Components NOT Requiring Migration

2. **playing_music** - Uses entity ID pattern validation, not enums (no migration needed)
3. **is_instrument** - Marker component with no properties (no migration needed)

**Location:** `data/mods/music/components/*.component.json`

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

### Step 1: Identify Music Mod Components with Enums

```bash
# List all music mod components
ls -la data/mods/music/components/

# Find components with enum properties
grep -l '"enum"' data/mods/music/components/*.component.json

# Review each component's enum properties
for file in $(grep -l '"enum"' data/mods/music/components/*.component.json); do
  echo "=== $file ==="
  jq '.id, .dataSchema.properties | to_entries | map(select(.value.enum != null)) | map(.key)' "$file"
  echo ""
done
```

### Step 2: Migrate Each Component

#### Component: performance_mood

**File:** `data/mods/music/components/performance_mood.component.json`

**Expected Enum Values:**
- Moods: "cheerful", "solemn", "mournful", "eerie", "tense", "triumphant", "tender", "playful", "aggressive", "meditative"

**Example ValidationRules:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid performance mood: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Performance mood is required",
      "invalidType": "Invalid type for mood: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

#### Component: playing_music (SKIPPED - No enum properties)

**File:** `data/mods/music/components/playing_music.component.json`

**Reason for Skipping:**
This component has no enum properties. It only contains:
- `playing_on` (string): Entity ID with pattern validation
- `activityMetadata` (object): Activity description metadata

**No migration needed** - component uses entity ID pattern validation, not enum validation.

#### Component: is_instrument (SKIPPED - Marker component)

**File:** `data/mods/music/components/is_instrument.component.json`

**Reason for Skipping:**
This is a marker component with an empty properties object:
```json
{
  "dataSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

**No migration needed** - marker components have no data to validate.

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
git add data/mods/music/components/performance_mood.component.json

# Commit with descriptive message
git commit -m "feat(validation): add validationRules to music mod performance_mood component

- Add validationRules to performance_mood component
- Enable enhanced error messages with similarity suggestions
- Note: playing_music and is_instrument do not require migration (no enum properties)
- Part of ANASYSIMP-019-04 migration"

# Verify commit
git log -1 --stat
```

## Validation Checklist

- [ ] performance_mood component has validationRules
- [ ] Error messages use music-specific terminology
- [ ] Template variables use double braces
- [ ] All required properties present
- [ ] `npm run validate` passes
- [ ] No JSON syntax errors
- [ ] Changes committed to git
- [ ] Verified that playing_music and is_instrument do not need migration

## Acceptance Criteria

- [ ] 1 component (performance_mood) migrated with validationRules
- [ ] All components pass schema validation
- [ ] Error messages customized with music terminology
- [ ] Similarity suggestions enabled
- [ ] Batch committed with clear message
- [ ] No breaking changes to music system
- [ ] Documented why 2 components were skipped

## Time Estimate

- Component discovery: 1 minute
- Migration (1 component × 2 minutes): ~2 minutes
- Validation: 1 minute
- Commit: 1 minute
- **Total:** ~5 minutes (reduced from 8 due to only 1 component needing migration)

## Next Steps

After completion, proceed to:
- **ANASYSIMP-019-04-07**: Migrate remaining mod components (~25 components)
