# ANASYSIMP-019-04-01: Identify and Categorize Migration Candidates

**Parent:** ANASYSIMP-019-04 (Migrate Components to Use ValidationRules)
**Phase:** 1 (Identification)
**Timeline:** 15 minutes
**Status:** Not Started
**Dependencies:** ANASYSIMP-019-01, ANASYSIMP-019-03

## Overview

Identify all component schemas with enum properties that need migration to the new `validationRules` feature. Generate a categorized list organized by mod for efficient batch processing.

### Scope Clarification

This workflow identifies **ECS component definition files** (*.component.json) in `data/mods/*/components/` that contain enum properties. These files define the structure and validation rules for components that can be attached to entities.

**Total Scope**: 46 component files with enum properties across all mods
- Already migrated: 1 (texture-with-validation)
- To migrate: 45

**Distribution by Mod**:
- Descriptors: 34 components (largest group)
- Core: 4 components
- Clothing: 4 components
- Anatomy: 2 components
- Activity: 1 component
- Music: 1 component

## Objectives

1. Generate list of all components with enum properties
2. Filter out already migrated components (texture-with-validation)
3. Organize components by mod for batch processing
4. Document the migration plan by priority
5. Create tracking checklist for progress monitoring

## Implementation Steps

### Step 1: Generate Initial Candidate List

Use grep to find all components with enum properties:

```bash
# Find all components with enum properties
grep -l '"enum"' data/mods/*/components/*.component.json > migration-candidates.txt

# Review the list
wc -l migration-candidates.txt
cat migration-candidates.txt
```

**Expected:** ~46 component files

### Step 2: Filter Already Migrated Components

Exclude components that already have validationRules:

```bash
# Filter out already migrated components
grep -L 'validationRules' $(cat migration-candidates.txt) > components-to-migrate.txt

# Review filtered list
wc -l components-to-migrate.txt
cat components-to-migrate.txt
```

**Expected:** ~45 component files (excluding texture-with-validation)

### Step 3: Organize by Mod

Create a categorized list organized by mod:

```bash
# Group by mod
for file in $(cat components-to-migrate.txt); do
  mod=$(echo "$file" | cut -d'/' -f3)
  echo "$mod: $file"
done | sort | tee components-by-mod.txt

# Count per mod
for file in $(cat components-to-migrate.txt); do
  mod=$(echo "$file" | cut -d'/' -f3)
  echo "$mod"
done | sort | uniq -c | sort -rn
```

### Step 4: Document Migration Order

Based on complexity and dependencies, document recommended migration order:

**Priority 1: Core & Anatomy Mods (6 components)**
- Foundational components with simple enums
- **Core Mod (4 components)**: gender, material, notes, player_type
- **Anatomy Mod (2 components)**: body, sockets

**Priority 2: Clothing Mod (4 components)**
- Moderate complexity, clothing system integration
- Components: wearable, coverage_mapping, slot_metadata, blocks_removal

**Priority 3: Activity & Music Mods (2 components)**
- Single components with straightforward enums
- **Activity Mod (1 component)**: description_metadata
- **Music Mod (1 component)**: performance_mood

**Priority 4: Descriptors Mod (33 components to migrate)**
- Largest group - descriptors for anatomy parts
- Already migrated: texture-with-validation (example component)
- Reference: `docs/anatomy/body-descriptors-complete.md` for body descriptor context
- **Body-level descriptors (5 components)**:
  - body_composition, build, height, body_hair, texture
- **Part-level descriptors (28 components)**:
  - acoustic_property, animation, color_basic, color_extended, deformity
  - digit_count, effect, embellishment, facial_aesthetic, facial_hair
  - firmness, flexibility, hair_style, length_category, length_hair
  - luminosity, pattern, projection, secretion, sensory_capability
  - shape_eye, shape_general, size_category, size_specific, structural_integrity
  - temperature, visual_capability, vocal_capability, weight_feel

**Note on Body Descriptors**: The 6 body descriptors mentioned in `body-descriptors-complete.md` (height, skinColor, build, composition, hairDensity, smell) are RECIPE properties used in anatomy recipes, not component files. Only 5 of these have corresponding component files with enums: build, body_composition, height, body_hair, and texture. The skinColor and smell properties are free-form strings in recipes and have no corresponding component files.

### Step 5: Create Migration Tracking Checklist

Generate a detailed checklist for tracking progress:

```markdown
## Migration Progress Tracking

### Priority 1: Core & Anatomy Mods (6 components)

#### Core Mod (4 components)
- [ ] gender
- [ ] material
- [ ] notes
- [ ] player_type

#### Anatomy Mod (2 components)
- [ ] body
- [ ] sockets

### Priority 2: Clothing Mod (4 components)
- [ ] wearable
- [ ] coverage_mapping
- [ ] slot_metadata
- [ ] blocks_removal

### Priority 3: Activity & Music Mods (2 components)
- [ ] description_metadata (activity mod)
- [ ] performance_mood (music mod)

### Priority 4: Descriptors Mod (33 components)

#### Already Migrated (1 component)
- [x] texture-with-validation ✓

#### Body-level descriptors (5 components)
- [ ] body_composition
- [ ] build
- [ ] height
- [ ] body_hair
- [ ] texture

#### Part-level descriptors (28 components)
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
- [ ] firmness
- [ ] flexibility
- [ ] hair_style
- [ ] length_category
- [ ] length_hair
- [ ] luminosity
- [ ] pattern
- [ ] projection
- [ ] secretion
- [ ] sensory_capability
- [ ] shape_eye
- [ ] shape_general
- [ ] size_category
- [ ] size_specific
- [ ] structural_integrity
- [ ] temperature
- [ ] visual_capability
- [ ] vocal_capability
- [ ] weight_feel

**Total: 45 components to migrate (46 total - 1 already migrated)**
```

## Acceptance Criteria

- [ ] Complete list of migration candidates generated
- [ ] Already migrated components filtered out (texture-with-validation)
- [ ] Components organized by mod
- [ ] Migration order documented by priority
- [ ] Detailed tracking checklist created
- [ ] Expected count matches (~45 components)
- [ ] Temporary files listed (not committed to git):
  - `migration-candidates.txt`
  - `components-to-migrate.txt`
  - `components-by-mod.txt`

## Deliverables

1. **migration-candidates.txt** - Initial list of all components with enums
2. **components-to-migrate.txt** - Filtered list excluding already migrated
3. **components-by-mod.txt** - Components organized by mod
4. **Migration tracking checklist** - Updated in parent workflow ANASYSIMP-019-04

## Notes

- These are **temporary files** - add to .gitignore or delete before committing
- Use this list to guide subsequent migration tickets (ANASYSIMP-019-04-02 through ANASYSIMP-019-04-05)
- Update tracking checklist as each mod is completed

### Important Distinction: Body Descriptors vs Descriptor Components

**Body Descriptors** (6 properties in anatomy recipes):
- These are properties in the `bodyDescriptors` field of anatomy recipe files
- Defined in `data/schemas/anatomy.recipe.schema.json`
- Used during anatomy generation to describe body characteristics
- List: height, skinColor, build, composition, hairDensity, smell

**Descriptor Components** (34 component files in descriptors mod):
- These are ECS component definition files in `data/mods/descriptors/components/`
- Applied to individual anatomy parts during generation
- Include both body-level (5 files) and part-level (28 files) descriptors
- Only some correspond to body descriptor properties (build, body_composition, height, body_hair, texture)

This workflow migrates **component files**, not recipe properties. The descriptors mod has 34 component files with enums that need migration, not just 6.

## Validation

After generating the lists:

```bash
# Verify count matches expectations
echo "Total candidates: $(wc -l < migration-candidates.txt)"
echo "Already migrated: $(grep -l 'validationRules' $(cat migration-candidates.txt) | wc -l)"
echo "To migrate: $(wc -l < components-to-migrate.txt)"

# Expected output:
# Total candidates: ~46
# Already migrated: 1
# To migrate: ~45
```

## Next Steps

After completion, proceed to:
- **ANASYSIMP-019-04-02**: Migrate Core & Anatomy mod components (Priority 1)
- **ANASYSIMP-019-04-03**: Migrate Clothing mod components (Priority 2)
- **ANASYSIMP-019-04-04**: Migrate Activity & Music mod components (Priority 3)
- **ANASYSIMP-019-04-05**: Migrate Descriptors mod components (Priority 4)
