# ANASYSIMP-019-04-02: Migrate Descriptors Mod Components

**Parent:** ANASYSIMP-019-04 (Migrate Components to Use ValidationRules)
**Phase:** 2 (Batch Migration - Priority 1)
**Timeline:** 10 minutes
**Status:** Not Started
**Dependencies:** ANASYSIMP-019-04-01

## Overview

Migrate 6 component schemas in the descriptors mod to use the new `validationRules` feature. This is the first priority batch due to its simple, well-defined structure and relationship to the body descriptor system.

## Components to Migrate

1. **texture** (may already have validation - verify)
2. **composition**
3. **build**
4. **height**
5. **hairDensity**
6. **smell** (note: free-form descriptor, but component may have enums)

**Location:** `data/mods/descriptors/components/*.component.json`

## Reference Documentation

Before starting, review:
- **Body Descriptors Guide**: `docs/anatomy/body-descriptors-complete.md`
  - Current descriptors: height, skinColor, build, composition, hairDensity, smell
  - Valid values for each descriptor (lines 73-81)
  - Enhanced values for horror/fantasy/medical use cases (lines 84-206)
- **Validation Workflow**: `docs/anatomy/validation-workflow.md`
- **Parent Workflow**: `workflows/ANASYSIMP-019-04-migrate-components-validation-rules.md`
  - Standard ValidationRules template (lines 44-64)
  - Example migration (lines 67-121)

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

### Step 1: Review Existing Example

Check if texture-with-validation already exists:

```bash
# Check for existing validationRules
grep -l 'validationRules' data/mods/descriptors/components/texture*.component.json

# Review the example
cat data/mods/descriptors/components/texture-with-validation.component.json
```

### Step 2: Identify Descriptors Mod Components

List all descriptor components with enums:

```bash
# List all descriptors mod components
ls -la data/mods/descriptors/components/

# Find components with enum properties
grep -l '"enum"' data/mods/descriptors/components/*.component.json
```

### Step 3: Migrate Each Component

For each component file:

#### Component: composition

**File:** `data/mods/descriptors/components/composition.component.json`

**Valid Values (from body-descriptors-complete.md:78-79):**
- Original: underweight, lean, average, soft, chubby, overweight, obese
- Horror/Medical: atrophied, emaciated, skeletal, malnourished, dehydrated, wasted, desiccated, bloated, rotting

**Migration:**
1. Read current component schema
2. Identify enum property and values
3. Add validationRules block after dataSchema
4. Customize error messages with property name "composition"

**Example ValidationRules:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid composition: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Composition is required",
      "invalidType": "Invalid type for composition: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

#### Component: build

**File:** `data/mods/descriptors/components/build.component.json`

**Valid Values (from body-descriptors-complete.md:77-78):**
- Original: skinny, slim, lissom, toned, athletic, shapely, hourglass, thick, muscular, hulking, stocky
- Extreme/Fantasy: frail, gaunt, skeletal, atrophied, cadaverous, massive, willowy, barrel-chested, lanky

**Example ValidationRules:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid build: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Build is required",
      "invalidType": "Invalid type for build: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

#### Component: height

**File:** `data/mods/descriptors/components/height.component.json`

**Valid Values (from body-descriptors-complete.md:75):**
- Original: gigantic, very-tall, tall, average, short, petite, tiny
- Extreme: colossal, titanic (giants/kaiju), minuscule, microscopic (fairies/magical)

**Example ValidationRules:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid height: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Height is required",
      "invalidType": "Invalid type for height: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

#### Component: hairDensity

**File:** `data/mods/descriptors/components/hairDensity.component.json`

**Valid Values (from body-descriptors-complete.md:79):**
- hairless, sparse, light, moderate, hairy, very-hairy

**Example ValidationRules:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid hair density: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Hair density is required",
      "invalidType": "Invalid type for hair density: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

#### Component: smell

**File:** `data/mods/descriptors/components/smell.component.json`

**Note:** Smell is a free-form descriptor (from body-descriptors-complete.md:76, 80)
- If component has enum: Add validationRules
- If component is free-form string: Still add validationRules (will apply to type validation)

**Example ValidationRules:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid smell: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Smell is required",
      "invalidType": "Invalid type for smell: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

### Step 4: Validate After Each Component

Run validation after migrating each component:

```bash
# Validate schema structure
npm run validate

# Check for errors
echo $?  # Should be 0
```

### Step 5: Commit Batch

After all descriptors mod components are migrated:

```bash
# Stage changes
git add data/mods/descriptors/components/*.component.json

# Commit with descriptive message
git commit -m "feat(validation): add validationRules to descriptors mod components

- Add validationRules to composition, build, height, hairDensity, smell components
- Enable enhanced error messages with similarity suggestions
- Reference body descriptor valid values from registry
- Part of ANASYSIMP-019-04 migration"

# Verify commit
git log -1 --stat
```

## Validation Checklist

After migration, verify:

- [ ] All 6 descriptors mod components have validationRules
- [ ] Error messages use correct property names
- [ ] Template variables use double braces: `{{value}}`, `{{validValues}}`
- [ ] All required properties present: generateValidator, errorMessages, suggestions
- [ ] `npm run validate` passes (exit code 0)
- [ ] No JSON syntax errors
- [ ] Changes committed to git

## Acceptance Criteria

- [ ] 6 components migrated with validationRules
- [ ] All components pass schema validation
- [ ] Error messages customized with property names
- [ ] Similarity suggestions enabled (maxDistance: 3, maxSuggestions: 3)
- [ ] Valid values align with body descriptor registry
- [ ] Batch committed to git with clear message
- [ ] No breaking changes introduced

## Common Pitfalls

### Pitfall 1: Wrong Template Variable Syntax
**Problem:** Using `{value}` instead of `{{value}}`
**Solution:** Always use double braces: `{{value}}`, `{{validValues}}`, `{{expected}}`, `{{actual}}`

### Pitfall 2: Missing Required Properties
**Problem:** Forgetting `generateValidator`, `errorMessages`, or `suggestions`
**Solution:** Copy complete template, don't piece together manually

### Pitfall 3: Inconsistent Capitalization
**Problem:** "composition is required" vs "Composition is required"
**Solution:** Capitalize property name in user-facing messages (missingRequired)

## Time Estimate

- Component review: 2 minutes
- Migration (6 components × 1 minute each): 6 minutes
- Validation: 1 minute
- Commit: 1 minute
- **Total:** ~10 minutes

## Next Steps

After completion, proceed to:
- **ANASYSIMP-019-04-03**: Migrate anatomy mod components (Priority 2)
