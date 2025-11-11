# ANASYSIMP-019-04-01: Identify and Categorize Migration Candidates

**Parent:** ANASYSIMP-019-04 (Migrate Components to Use ValidationRules)
**Phase:** 1 (Identification)
**Timeline:** 15 minutes
**Status:** Not Started
**Dependencies:** ANASYSIMP-019-01, ANASYSIMP-019-03

## Overview

Identify all component schemas with enum properties that need migration to the new `validationRules` feature. Generate a categorized list organized by mod for efficient batch processing.

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

**Priority 1: Descriptors Mod (6 components)**
- Simple, well-defined enum values
- Reference: `docs/anatomy/body-descriptors-complete.md`
- Components: texture, composition, build, height, hairDensity, smell

**Priority 2: Anatomy Mod (2-3 components)**
- Reference body descriptor docs
- Components: body, sockets

**Priority 3: Clothing Mod (7 components)**
- Moderate complexity
- Components: wearable, coverage_mapping, slot_metadata, blocks_removal, equipment, layer_priority, equipment_slots

**Priority 4: Core Mod (5 components)**
- Foundational components
- Components: gender, material, notes, actor_type, visibility

**Priority 5: Music Mod (3 components)**
- Components: performance_mood, playing_music, is_instrument

**Priority 6: Remaining Mods (~25 components)**
- Activity, items, movement, patrol, vampirism, etc.
- Process by priority as needed

### Step 5: Create Migration Tracking Checklist

Generate a detailed checklist for tracking progress:

```markdown
## Migration Progress Tracking

### Descriptors Mod (6 components)
- [ ] texture-* (verify, already has example)
- [ ] composition
- [ ] build
- [ ] height
- [ ] hairDensity
- [ ] smell

### Anatomy Mod (2 components)
- [ ] body
- [ ] sockets

### Clothing Mod (7 components)
- [ ] wearable
- [ ] coverage_mapping
- [ ] slot_metadata
- [ ] blocks_removal
- [ ] equipment
- [ ] layer_priority
- [ ] equipment_slots

### Core Mod (5 components)
- [ ] gender
- [ ] material
- [ ] notes
- [ ] actor_type
- [ ] visibility

### Music Mod (3 components)
- [ ] performance_mood
- [ ] playing_music
- [ ] is_instrument

### Remaining Mods (~25 components)
- [ ] Activity mod
- [ ] Items mod
- [ ] Movement mod
- [ ] Patrol mod
- [ ] Vampirism mod
- [ ] (Others as discovered)
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
- Use this list to guide subsequent migration tickets (ANASYSIMP-019-04-02 through ANASYSIMP-019-04-07)
- Update tracking checklist as each mod is completed

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
- **ANASYSIMP-019-04-02**: Migrate descriptors mod components (Priority 1)
