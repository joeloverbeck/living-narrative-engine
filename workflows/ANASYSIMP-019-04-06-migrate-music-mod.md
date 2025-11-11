# ANASYSIMP-019-04-06: Migrate Music Mod Components

**Parent:** ANASYSIMP-019-04 (Migrate Components to Use ValidationRules)
**Phase:** 2 (Batch Migration - Priority 5)
**Timeline:** 8 minutes
**Status:** Not Started
**Dependencies:** ANASYSIMP-019-04-05

## Overview

Migrate 3 component schemas in the music mod to use the new `validationRules` feature. This is the fifth priority batch with music system components.

## Components to Migrate

1. **performance_mood** - Mood/tone of musical performance
2. **playing_music** - Music playing state and properties
3. **is_instrument** - Instrument classification and properties

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
- Moods: "upbeat", "melancholic", "energetic", "calm", "dramatic", "mysterious"

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

#### Component: playing_music

**File:** `data/mods/music/components/playing_music.component.json`

**Expected Enum Values:**
- Playing states: "playing", "paused", "stopped", "rehearsing"
- Performance types: "solo", "ensemble", "accompaniment"

**Example ValidationRules:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid music state: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Music state is required",
      "invalidType": "Invalid type for music: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

#### Component: is_instrument

**File:** `data/mods/music/components/is_instrument.component.json`

**Expected Enum Values:**
- Instrument types: "string", "wind", "percussion", "keyboard", "brass"
- Instrument categories: "melodic", "rhythmic", "harmonic"

**Example ValidationRules:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid instrument type: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Instrument type is required",
      "invalidType": "Invalid type for instrument: expected {{expected}}, got {{actual}}"
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
git add data/mods/music/components/*.component.json

# Commit with descriptive message
git commit -m "feat(validation): add validationRules to music mod components

- Add validationRules to performance_mood, playing_music, is_instrument
- Enable enhanced error messages with similarity suggestions
- Improve music system validation
- Part of ANASYSIMP-019-04 migration"

# Verify commit
git log -1 --stat
```

## Validation Checklist

- [ ] All 3 music mod components have validationRules
- [ ] Error messages use music-specific terminology
- [ ] Template variables use double braces
- [ ] All required properties present
- [ ] `npm run validate` passes
- [ ] No JSON syntax errors
- [ ] Changes committed to git

## Acceptance Criteria

- [ ] 3 components migrated with validationRules
- [ ] All components pass schema validation
- [ ] Error messages customized with music terminology
- [ ] Similarity suggestions enabled
- [ ] Batch committed with clear message
- [ ] No breaking changes to music system

## Time Estimate

- Component discovery: 1 minute
- Migration (3 components × 2 minutes): ~6 minutes
- Validation: 1 minute
- Commit: 1 minute
- **Total:** ~9 minutes (adjusted to 8)

## Next Steps

After completion, proceed to:
- **ANASYSIMP-019-04-07**: Migrate remaining mod components (~25 components)
