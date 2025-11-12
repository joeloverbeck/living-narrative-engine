# ANASYSIMP-019-04-07: Migrate Remaining Mod Components

**Parent:** ANASYSIMP-019-04 (Migrate Components to Use ValidationRules)
**Phase:** 2 (Batch Migration - Priority 6)
**Timeline:** 35 minutes
**Status:** Not Started
**Dependencies:** ANASYSIMP-019-04-06
**Corrected:** Workflow assumptions validated against actual codebase

## Overview

Migrate the final 31 component schemas in remaining mods to use the new `validationRules` feature. This is the final migration batch covering all remaining components with enum properties.

## Workflow Corrections Applied

**Original Assumptions (Incorrect):**
- Estimated ~25 components across multiple mods
- Expected components in: items, movement, patrol, vampirism mods
- Assumed even distribution across various game systems

**Actual Codebase Reality (Verified):**
- **31 components total** needing migration
- **Only 2 mods** have components needing migration:
  - **Descriptors mod: 30 components** (96.8% of work)
  - **Activity mod: 1 component** (3.2% of work)
- **No components** need migration in items, movement, patrol, or vampirism mods

## Actual Components by Mod (Verified)

Based on codebase verification, the remaining components are:

- **Descriptors mod** - 30 part-level descriptor components (96.8% of remaining work)
  - Part-level descriptors for anatomy system
  - Apply to individual anatomy parts (eyes, hands, limbs, etc.)
  - Includes color, shape, texture, structural integrity, sensory capabilities
  - Supports horror, fantasy, and medical scenarios
- **Activity mod** - 1 component (description_metadata)
  - Metadata for activity text generation

**Already migrated (16 components in previous workflows):**
- Anatomy mod: 2 components
- Clothing mod: 4 components
- Core mod: 4 components
- Descriptors mod: 5 body-level descriptors (height, build, body_composition, body_hair, texture-with-validation)
- Music mod: 1 component

**No other mods have components needing migration.** The items, movement, patrol, and vampirism mods either:
- Have no components with enum properties, OR
- Their components with enums already have validationRules, OR
- Their components are marker components without data schemas

**Location:** `data/mods/*/components/*.component.json`

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

### Step 1: Review Migration Candidates List

Generate the current list of components needing migration:

```bash
# Find all components with enums but without validationRules
grep -l '"enum"' data/mods/*/components/*.component.json | xargs grep -L 'validationRules' > /tmp/components-to-migrate.txt

# Review the list
cat /tmp/components-to-migrate.txt

# Count by mod
cat /tmp/components-to-migrate.txt | awk -F'/' '{print $3}' | sort | uniq -c

# Expected output:
#       1 activity
#      30 descriptors
```

### Step 2: Migration Strategy

Given that 30 out of 31 components (96.8%) are in the descriptors mod, use this strategy:

**Phase 1: Activity mod (1 component) - 2 minutes**
- Quick standalone migration
- Simple enum validation
- Validate and commit immediately

**Phase 2: Descriptors mod (30 components) - 30 minutes**
- Part-level descriptors for anatomy system
- Batch process in groups of 10 components
- Validate after each batch of 10
- Commit after each batch of 10

**Batching Strategy:**
- **Batch A**: Components 1-10 (acoustic_property through embellishment)
- **Batch B**: Components 11-20 (facial_aesthetic through pupil_shape)
- **Batch C**: Components 21-30 (secretion through weight_feel)

This approach provides better progress tracking and easier rollback if issues arise.

### Step 3: Phase 1 - Migrate Activity Mod (1 component)

#### Component: description_metadata

**File:** `data/mods/activity/components/description_metadata.component.json`

1. **Review enum properties:**
   ```bash
   # Check the component structure
   jq '.id, .dataSchema.properties | to_entries | map(select(.value.enum != null))' \
     data/mods/activity/components/description_metadata.component.json
   ```

2. **Migrate component:**
   - Open the component file
   - Identify enum property names and values
   - Add validationRules block after dataSchema
   - Customize error messages with appropriate property names
   - Save file

3. **Validate:**
   ```bash
   npm run validate
   echo $?  # Should be 0
   ```

4. **Commit:**
   ```bash
   git add data/mods/activity/components/description_metadata.component.json
   git commit -m "feat(validation): add validationRules to activity mod description_metadata component

   - Add validationRules to description_metadata component
   - Enable enhanced error messages with similarity suggestions
   - Part of ANASYSIMP-019-04 migration (final batch 1/4: activity mod)"
   ```

### Step 4: Phase 2 - Migrate Descriptors Mod (30 components)

**Reference Documentation:**
- `docs/anatomy/anatomy-system-guide.md` - Anatomy system overview
- `docs/anatomy/body-descriptors-complete.md` - Body descriptor registry and validation

**Note:** These are **part-level descriptors** that can be attached to individual anatomy parts (eyes, hands, limbs, etc.) during anatomy generation. They differ from the 5 body-level descriptors already migrated in ANASYSIMP-019-04-02.

#### Batch A: Components 1-10

Components to migrate:
1. acoustic_property.component.json
2. animation.component.json
3. color_basic.component.json
4. color_extended.component.json
5. deformity.component.json
6. digit_count.component.json
7. effect.component.json
8. embellishment.component.json
9. facial_aesthetic.component.json
10. facial_hair.component.json

**Process:**
```bash
# List batch A components
cd data/mods/descriptors/components
ls -1 acoustic_property.component.json animation.component.json \
  color_basic.component.json color_extended.component.json \
  deformity.component.json digit_count.component.json \
  effect.component.json embellishment.component.json \
  facial_aesthetic.component.json facial_hair.component.json

# For each component:
# 1. Open file
# 2. Review enum properties
# 3. Add validationRules block with customized error messages
# 4. Save file

# Validate batch
npm run validate

# Commit batch A
git add data/mods/descriptors/components/acoustic_property.component.json \
  data/mods/descriptors/components/animation.component.json \
  data/mods/descriptors/components/color_basic.component.json \
  data/mods/descriptors/components/color_extended.component.json \
  data/mods/descriptors/components/deformity.component.json \
  data/mods/descriptors/components/digit_count.component.json \
  data/mods/descriptors/components/effect.component.json \
  data/mods/descriptors/components/embellishment.component.json \
  data/mods/descriptors/components/facial_aesthetic.component.json \
  data/mods/descriptors/components/facial_hair.component.json

git commit -m "feat(validation): add validationRules to descriptors mod components (batch A: 1-10)

- Add validationRules to part-level descriptor components
- Components: acoustic_property, animation, color_basic, color_extended,
  deformity, digit_count, effect, embellishment, facial_aesthetic, facial_hair
- Enable enhanced error messages with similarity suggestions
- Part of ANASYSIMP-019-04 migration (final batch 2/4: descriptors A)"
```

#### Batch B: Components 11-20

Components to migrate:
11. firmness.component.json
12. flexibility.component.json
13. hair_style.component.json
14. length_category.component.json
15. length_hair.component.json
16. luminosity.component.json
17. pattern.component.json
18. projection.component.json
19. pupil_shape.component.json
20. secretion.component.json

**Process:**
```bash
# Validate batch
npm run validate

# Commit batch B
git add data/mods/descriptors/components/firmness.component.json \
  data/mods/descriptors/components/flexibility.component.json \
  data/mods/descriptors/components/hair_style.component.json \
  data/mods/descriptors/components/length_category.component.json \
  data/mods/descriptors/components/length_hair.component.json \
  data/mods/descriptors/components/luminosity.component.json \
  data/mods/descriptors/components/pattern.component.json \
  data/mods/descriptors/components/projection.component.json \
  data/mods/descriptors/components/pupil_shape.component.json \
  data/mods/descriptors/components/secretion.component.json

git commit -m "feat(validation): add validationRules to descriptors mod components (batch B: 11-20)

- Add validationRules to part-level descriptor components
- Components: firmness, flexibility, hair_style, length_category, length_hair,
  luminosity, pattern, projection, pupil_shape, secretion
- Enable enhanced error messages with similarity suggestions
- Part of ANASYSIMP-019-04 migration (final batch 3/4: descriptors B)"
```

#### Batch C: Components 21-30

Components to migrate:
21. sensory_capability.component.json
22. shape_eye.component.json
23. shape_general.component.json
24. size_category.component.json
25. structural_integrity.component.json
26. temperature.component.json
27. texture.component.json
28. visual_capability.component.json
29. vocal_capability.component.json
30. weight_feel.component.json

**Process:**
```bash
# Validate batch
npm run validate

# Commit batch C
git add data/mods/descriptors/components/sensory_capability.component.json \
  data/mods/descriptors/components/shape_eye.component.json \
  data/mods/descriptors/components/shape_general.component.json \
  data/mods/descriptors/components/size_category.component.json \
  data/mods/descriptors/components/structural_integrity.component.json \
  data/mods/descriptors/components/temperature.component.json \
  data/mods/descriptors/components/texture.component.json \
  data/mods/descriptors/components/visual_capability.component.json \
  data/mods/descriptors/components/vocal_capability.component.json \
  data/mods/descriptors/components/weight_feel.component.json

git commit -m "feat(validation): add validationRules to descriptors mod components (batch C: 21-30)

- Add validationRules to part-level descriptor components
- Components: sensory_capability, shape_eye, shape_general, size_category,
  structural_integrity, temperature, texture, visual_capability,
  vocal_capability, weight_feel
- Enable enhanced error messages with similarity suggestions
- Part of ANASYSIMP-019-04 migration (final batch 4/4: descriptors C)"
```

### Step 5: Migration Examples

These examples show how to customize error messages for different descriptor types:

#### Example 1: Activity Mod Component

**File:** `data/mods/activity/components/description_metadata.component.json`

**Purpose:** Metadata for describing activities in text generation

**ValidationRules Pattern:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid description metadata property: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Description metadata is required",
      "invalidType": "Invalid type for description metadata: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

#### Example 2: Color Descriptor Component

**File:** `data/mods/descriptors/components/color_basic.component.json`

**Purpose:** Basic color descriptors for anatomy parts (eyes, hair, skin, etc.)

**ValidationRules Pattern:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid color: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Color is required",
      "invalidType": "Invalid type for color: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

#### Example 3: Shape Descriptor Component

**File:** `data/mods/descriptors/components/shape_general.component.json`

**Purpose:** General shape descriptors for various anatomy parts

**ValidationRules Pattern:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid shape: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Shape is required",
      "invalidType": "Invalid type for shape: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

#### Example 4: Structural Integrity Component (Advanced)

**File:** `data/mods/descriptors/components/structural_integrity.component.json`

**Purpose:** Describes physical condition of anatomy parts (intact, damaged, necrotic, etc.)

**Context:** Used for horror, medical, and fantasy scenarios

**ValidationRules Pattern:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid structural integrity: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Structural integrity is required",
      "invalidType": "Invalid type for structural integrity: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

### Step 6: Track Progress

Use the migration tracking checklist:

```markdown
### Final Migration Batch (31 components)

#### Phase 1: Activity Mod (1 component)
- [ ] description_metadata

#### Phase 2: Descriptors Mod (30 components)

##### Batch A (Components 1-10)
- [ ] acoustic_property
- [ ] animation
- [ ] color_basic
- [ ] color_extended
- [ ] deformity
- [ ] digit_count
- [ ] effect
- [ ] embellishment
- [ ] facial_aesthetic
- [ ] facial_hair

##### Batch B (Components 11-20)
- [ ] firmness
- [ ] flexibility
- [ ] hair_style
- [ ] length_category
- [ ] length_hair
- [ ] luminosity
- [ ] pattern
- [ ] projection
- [ ] pupil_shape
- [ ] secretion

##### Batch C (Components 21-30)
- [ ] sensory_capability
- [ ] shape_eye
- [ ] shape_general
- [ ] size_category
- [ ] structural_integrity
- [ ] temperature
- [ ] texture
- [ ] visual_capability
- [ ] vocal_capability
- [ ] weight_feel
```

Update checklist after each batch is completed.

### Step 7: Final Batch Validation

After all remaining mods are migrated:

```bash
# Validate all schemas
npm run validate

# Verify no components remain without validationRules
grep -l '"enum"' data/mods/*/components/*.component.json | \
  xargs grep -L 'validationRules' | \
  wc -l
# Expected: 0

# Double-check by listing any remaining components
grep -l '"enum"' data/mods/*/components/*.component.json | \
  xargs grep -L 'validationRules'
# Expected: (empty output)
```

## Validation Checklist

- [ ] Activity mod component (1) has validationRules
- [ ] All descriptors mod components (30) have validationRules
- [ ] Error messages use appropriate descriptor terminology
- [ ] Template variables use double braces (`{{value}}`, `{{validValues}}`)
- [ ] All required properties present (generateValidator, errorMessages, suggestions)
- [ ] `npm run validate` passes after each batch
- [ ] No components remain without validationRules (verified with grep)
- [ ] All changes committed with clear messages per batch (4 commits total)

## Acceptance Criteria

- [ ] 31 components migrated with validationRules (1 activity + 30 descriptors)
- [ ] All components pass schema validation
- [ ] Error messages customized appropriately for anatomy descriptors
- [ ] Similarity suggestions enabled for all (maxDistance: 3, maxSuggestions: 3)
- [ ] 4 separate commits:
  - Batch 1: Activity mod (1 component)
  - Batch 2: Descriptors A (10 components)
  - Batch 3: Descriptors B (10 components)
  - Batch 4: Descriptors C (10 components)
- [ ] No breaking changes introduced
- [ ] Migration tracking checklist completed
- [ ] Final verification shows 0 components without validationRules

## Common Pitfalls

### Pitfall 1: Batch Commits Too Large
**Problem:** Committing all 31 components in one batch
**Solution:** Commit in 4 batches (activity + 3 descriptor batches of 10 each) for easier review and rollback

### Pitfall 2: Generic Error Messages for Descriptors
**Problem:** Using "Invalid value" for all 30 descriptor components
**Solution:** Customize messages with specific descriptor names (e.g., "Invalid color", "Invalid shape", "Invalid structural integrity")

### Pitfall 3: Not Tracking Progress Across 30 Components
**Problem:** Losing track of which of the 30 descriptor components are completed
**Solution:** Update migration tracking checklist after each batch of 10 components

### Pitfall 4: Skipping Validation Between Batches
**Problem:** All 30 descriptor components fail validation at once
**Solution:** Run `npm run validate` after each batch of 10 components

### Pitfall 5: Confusing Body-Level vs Part-Level Descriptors
**Problem:** Expecting these 30 components to be like the 5 body-level descriptors migrated in ANASYSIMP-019-04-02
**Solution:** Understand that these are **part-level descriptors** that attach to individual anatomy parts (eyes, hands, etc.), not body-level properties

### Pitfall 6: Assuming Other Mods Need Migration
**Problem:** Searching for components in items, movement, patrol, or vampirism mods
**Solution:** Only activity (1) and descriptors (30) mods have components needing migration

## Time Estimate

- Generate current migration list: 2 minutes
- Phase 1: Activity mod migration (1 component): 2 minutes
- Phase 2: Descriptors mod migration (30 components):
  - Batch A (10 components): 10 minutes
  - Batch B (10 components): 10 minutes
  - Batch C (10 components): 10 minutes
- Validation (4 batches × 1 minute): 4 minutes
- Commits (4 batches × 1 minute): 4 minutes
- Final verification: 3 minutes
- **Total:** ~35 minutes

## Special Considerations

### Part-Level Descriptors Context

The 30 descriptor components in this migration are **part-level descriptors** used during anatomy generation. They differ from the 5 body-level descriptors migrated in ANASYSIMP-019-04-02:

**Body-Level Descriptors (already migrated):**
- Applied to entire body: height, build, body_composition, body_hair
- Used in Body Descriptor Registry
- Referenced in anatomy recipes' `bodyDescriptors` field

**Part-Level Descriptors (this migration):**
- Applied to individual anatomy parts: eyes, hands, limbs, torso, etc.
- Examples: color_basic, shape_eye, structural_integrity, texture
- Used during part generation to describe individual body parts
- Can represent horror/fantasy/medical scenarios (necrotic, crystalline, ethereal)

### Descriptor Terminology Guidelines

Use clear, specific terminology in error messages:
- **Color components**: "Invalid color" not "Invalid value"
- **Shape components**: "Invalid shape" not "Invalid type"
- **Structural components**: "Invalid structural integrity" not "Invalid state"
- **Size components**: "Invalid size category" not "Invalid size"
- **Sensory components**: "Invalid visual capability", "Invalid acoustic property"

### Reference Documentation

When in doubt about descriptor usage or valid values:
- `docs/anatomy/anatomy-system-guide.md` - Complete anatomy system guide
- `docs/anatomy/body-descriptors-complete.md` - Body descriptor registry (focus on part-level descriptors section)
- `src/anatomy/registries/bodyDescriptorRegistry.js` - Source of truth for body-level descriptors
- Descriptor component files themselves - Check existing enum values

## Next Steps

After completion, proceed to:
- **ANASYSIMP-019-04-08**: Create integration tests for validationRules
