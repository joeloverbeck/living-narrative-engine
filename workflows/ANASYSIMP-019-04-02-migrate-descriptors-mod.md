# ANASYSIMP-019-04-02: Migrate Body-Descriptor-Related Components (Descriptors Mod)

**Parent:** ANASYSIMP-019-04 (Migrate Components to Use ValidationRules)
**Phase:** 2 (Batch Migration - Priority 1)
**Timeline:** 8 minutes
**Status:** Not Started
**Dependencies:** ANASYSIMP-019-04-01

## Overview

Migrate the 4 body-descriptor-related component schemas in the descriptors mod to use the new `validationRules` feature. These components correspond to body descriptor properties defined in the Body Descriptor Registry and are used during anatomy generation.

**Note:** The Body Descriptor Registry defines 6 body descriptors (height, skinColor, build, composition, hairDensity, smell), but only 4 have corresponding component files with enums in the descriptors mod. The other 2 (skinColor and smell) are free-form strings at the recipe level and have no component files.

## Components to Migrate

1. **height** - Height categories (microscopic through titanic)
2. **build** - Body build descriptors (skinny, athletic, muscular, etc.)
3. **body_composition** - Body fat levels and composition (underweight through rotting)
4. **body_hair** - Body hair density including fur (hairless through furred)

**Location:** `data/mods/descriptors/components/*.component.json`

**Note on texture:** There are TWO texture component files:
- `texture.component.json` - Production component (will be migrated separately with other descriptor components)
- `texture-with-validation.component.json` - Example component demonstrating validationRules (already has validation)

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

Review the texture-with-validation example (already has validationRules):

```bash
# Review the example component (already migrated)
cat data/mods/descriptors/components/texture-with-validation.component.json

# Note: This is a separate example file, not the production texture.component.json
```

### Step 2: Verify Body-Descriptor Components

Verify the 4 body-descriptor-related component files:

```bash
# Verify the components we need to migrate
ls -la data/mods/descriptors/components/height.component.json
ls -la data/mods/descriptors/components/build.component.json
ls -la data/mods/descriptors/components/body_composition.component.json
ls -la data/mods/descriptors/components/body_hair.component.json

# Verify they have enums and not validationRules yet
for file in height build body_composition body_hair; do
  echo "=== $file ==="
  grep -q '"enum"' "data/mods/descriptors/components/${file}.component.json" && echo "✓ Has enum" || echo "✗ No enum"
  grep -q 'validationRules' "data/mods/descriptors/components/${file}.component.json" && echo "✗ Already migrated" || echo "✓ Needs migration"
done
```

### Step 3: Migrate Each Component

For each component file:

#### Component: body_composition

**File:** `data/mods/descriptors/components/body_composition.component.json`

**Registry Reference:** `composition` property in bodyDescriptorRegistry.js (lines 75-84)

**Valid Values (from bodyDescriptorRegistry.js:80):**
- Original: underweight, lean, average, soft, chubby, overweight, obese
- Horror/Medical: atrophied, emaciated, skeletal, malnourished, dehydrated, wasted, desiccated, bloated, rotting

**Migration:**
1. Read current component schema
2. Identify enum property (property name is "composition" not "body_composition")
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

**Registry Reference:** `build` property in bodyDescriptorRegistry.js (lines 64-73)

**Valid Values (from bodyDescriptorRegistry.js:69):**
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

**Registry Reference:** `height` property in bodyDescriptorRegistry.js (lines 42-52)

**Valid Values (from bodyDescriptorRegistry.js:47):**
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

#### Component: body_hair

**File:** `data/mods/descriptors/components/body_hair.component.json`

**Registry Reference:** `hairDensity` property in bodyDescriptorRegistry.js (lines 86-95)

**Valid Values (from bodyDescriptorRegistry.js:91):**
- hairless, sparse, light, moderate, hairy, very-hairy, furred

**Note:** This component has two properties: `hairDensity` (current) and `density` (deprecated). The validationRules will apply to both enum properties.

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

**Note on Smell and SkinColor:**
These two body descriptors (smell and skinColor) from the Body Descriptor Registry do NOT have corresponding component files in the descriptors mod. They are free-form string properties defined only at the recipe level in `data/schemas/anatomy.recipe.schema.json`.

### Step 4: Validate After Each Component

Run validation after migrating each component:

```bash
# Validate schema structure
npm run validate

# Check for errors
echo $?  # Should be 0
```

### Step 5: Commit Batch

After all body-descriptor-related components are migrated:

```bash
# Stage changes (only the 4 body-descriptor components)
git add data/mods/descriptors/components/body_composition.component.json
git add data/mods/descriptors/components/build.component.json
git add data/mods/descriptors/components/height.component.json
git add data/mods/descriptors/components/body_hair.component.json

# Commit with descriptive message
git commit -m "feat(validation): add validationRules to body-descriptor components

- Add validationRules to body_composition, build, height, body_hair components
- Enable enhanced error messages with similarity suggestions
- Align with Body Descriptor Registry valid values
- Part of ANASYSIMP-019-04 migration (batch 1: body descriptors)"

# Verify commit
git log -1 --stat
```

## Validation Checklist

After migration, verify:

- [ ] All 4 body-descriptor components have validationRules
- [ ] Error messages use correct property names (composition, build, height, hairDensity)
- [ ] Template variables use double braces: `{{value}}`, `{{validValues}}`
- [ ] All required properties present: generateValidator, errorMessages, suggestions
- [ ] `npm run validate` passes (exit code 0)
- [ ] No JSON syntax errors
- [ ] Changes committed to git

## Acceptance Criteria

- [ ] 4 components migrated with validationRules (body_composition, build, height, body_hair)
- [ ] All components pass schema validation
- [ ] Error messages customized with correct property names
- [ ] Similarity suggestions enabled (maxDistance: 3, maxSuggestions: 3)
- [ ] Valid values align with Body Descriptor Registry
- [ ] Enum values match exactly between component schemas and registry
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

### Pitfall 4: Wrong Component File Names
**Problem:** Using "composition.component.json" instead of "body_composition.component.json"
**Solution:** Component file names: body_composition, body_hair (with underscores); Property names inside: composition, hairDensity (no underscores)

### Pitfall 5: Expecting smell.component.json
**Problem:** Assuming smell has a component file because it's in the Body Descriptor Registry
**Solution:** Only 4 of the 6 body descriptors have component files; smell and skinColor are recipe-level only

## Time Estimate

- Component review: 1 minute
- Migration (4 components × 1 minute each): 4 minutes
- Validation: 2 minutes
- Commit: 1 minute
- **Total:** ~8 minutes

## Scope Note

This workflow migrates only the 4 body-descriptor-related components. The descriptors mod contains 35 total component files with enums (34 to migrate after excluding texture-with-validation). The remaining 30 descriptor components (part-level descriptors like color_basic, shape_general, etc.) will be migrated separately.

## Next Steps

After completion, proceed to:
- **ANASYSIMP-019-04-03**: Migrate remaining descriptors mod components (30 part-level descriptors)
- **ANASYSIMP-019-04-04**: Migrate anatomy mod components (Priority 2)
