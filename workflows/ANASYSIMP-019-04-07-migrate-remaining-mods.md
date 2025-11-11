# ANASYSIMP-019-04-07: Migrate Remaining Mod Components

**Parent:** ANASYSIMP-019-04 (Migrate Components to Use ValidationRules)
**Phase:** 2 (Batch Migration - Priority 6)
**Timeline:** 30 minutes
**Status:** Not Started
**Dependencies:** ANASYSIMP-019-04-06

## Overview

Migrate approximately 25 component schemas in remaining mods to use the new `validationRules` feature. This is the final migration batch covering all remaining mods with enum properties.

## Estimated Components by Mod

Based on initial discovery (ANASYSIMP-019-04-01), remaining mods may include:

- **Activity mod** - Activity states, types, etc.
- **Items mod** - Item types, categories, states
- **Movement mod** - Movement types, speeds, directions
- **Patrol mod** - Patrol states, behaviors
- **Vampirism mod** - Vampire-specific states
- **Other mods** - As discovered during identification phase

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

Use the list generated in ANASYSIMP-019-04-01:

```bash
# Review remaining components to migrate
cat components-to-migrate.txt | grep -v descriptors | grep -v anatomy | grep -v clothing | grep -v core | grep -v music

# Count remaining
cat components-to-migrate.txt | grep -v descriptors | grep -v anatomy | grep -v clothing | grep -v core | grep -v music | wc -l

# Organize by mod
for file in $(cat components-to-migrate.txt | grep -v descriptors | grep -v anatomy | grep -v clothing | grep -v core | grep -v music); do
  mod=$(echo "$file" | cut -d'/' -f3)
  echo "$mod: $file"
done | sort
```

### Step 2: Prioritize Remaining Mods

Based on discovery, prioritize mods by:
1. **Usage frequency** - Mods used in many scenarios
2. **Dependencies** - Mods depended on by others
3. **Complexity** - Simple mods first, complex later

**Recommended Order:**
1. Items mod (if present)
2. Movement mod (if present)
3. Activity mod (if present)
4. Patrol mod (if present)
5. Vampirism mod (if present)
6. Other mods by alphabetical order

### Step 3: Migrate by Mod (Batch Processing)

For each mod, follow this process:

#### Process per Mod

1. **Identify components:**
   ```bash
   # List components for specific mod
   MOD_NAME="items"  # Change per mod
   grep "data/mods/$MOD_NAME" components-to-migrate.txt
   ```

2. **Review enum properties:**
   ```bash
   # For each component, check enum properties
   for file in $(grep "data/mods/$MOD_NAME" components-to-migrate.txt); do
     echo "=== $file ==="
     jq '.id, .dataSchema.properties | to_entries | map(select(.value.enum != null)) | map({key: .key, enum: .value.enum})' "$file"
     echo ""
   done
   ```

3. **Migrate components:**
   - Open each component file
   - Identify enum property names and values
   - Add validationRules block after dataSchema
   - Customize error messages with property names
   - Save file

4. **Validate:**
   ```bash
   npm run validate
   echo $?  # Should be 0
   ```

5. **Commit mod batch:**
   ```bash
   git add data/mods/$MOD_NAME/components/*.component.json
   git commit -m "feat(validation): add validationRules to $MOD_NAME mod components

   - Add validationRules to [list component names]
   - Enable enhanced error messages with similarity suggestions
   - Part of ANASYSIMP-019-04 migration"
   ```

### Step 4: Migration Examples

#### Example: Items Mod Component

**File:** `data/mods/items/components/item_type.component.json`

**Hypothetical Enum Values:**
- Item types: "weapon", "armor", "consumable", "quest", "misc"

**Example ValidationRules:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid item type: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Item type is required",
      "invalidType": "Invalid type for item: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

#### Example: Movement Mod Component

**File:** `data/mods/movement/components/movement_type.component.json`

**Hypothetical Enum Values:**
- Movement types: "walk", "run", "sprint", "crawl", "fly", "swim"

**Example ValidationRules:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid movement type: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Movement type is required",
      "invalidType": "Invalid type for movement: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

#### Example: Activity Mod Component

**File:** `data/mods/activity/components/activity_state.component.json`

**Hypothetical Enum Values:**
- Activity states: "idle", "active", "paused", "completed", "failed"

**Example ValidationRules:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid activity state: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Activity state is required",
      "invalidType": "Invalid type for activity: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

### Step 5: Track Progress

Use the migration tracking checklist from ANASYSIMP-019-04:

```markdown
### Remaining Mods (~25 components)
- [ ] Activity mod (X components)
  - [ ] component1
  - [ ] component2
- [ ] Items mod (X components)
  - [ ] component1
  - [ ] component2
- [ ] Movement mod (X components)
  - [ ] component1
  - [ ] component2
- [ ] Patrol mod (X components)
  - [ ] component1
- [ ] Vampirism mod (X components)
  - [ ] component1
- [ ] (Other mods as discovered)
```

Update checklist after each mod is completed.

### Step 6: Final Batch Validation

After all remaining mods are migrated:

```bash
# Validate all schemas
npm run validate

# Verify no components remain
grep -l '"enum"' data/mods/*/components/*.component.json | \
  xargs grep -L 'validationRules' | \
  wc -l
# Expected: 0
```

## Validation Checklist

- [ ] All remaining components (~25) have validationRules
- [ ] Error messages use appropriate terminology per mod
- [ ] Template variables use double braces
- [ ] All required properties present
- [ ] `npm run validate` passes
- [ ] No components remain without validationRules
- [ ] All changes committed with clear messages per mod

## Acceptance Criteria

- [ ] ~25 components migrated with validationRules
- [ ] All components pass schema validation
- [ ] Error messages customized appropriately per domain
- [ ] Similarity suggestions enabled for all
- [ ] Each mod batch committed separately with clear messages
- [ ] No breaking changes introduced
- [ ] Migration tracking checklist completed

## Common Pitfalls

### Pitfall 1: Batch Commits Too Large
**Problem:** Committing all 25 components in one batch
**Solution:** Commit per mod (5-10 components per batch) for easier review

### Pitfall 2: Generic Error Messages
**Problem:** Using same error messages for all mods
**Solution:** Customize messages with domain-specific terminology per mod

### Pitfall 3: Not Tracking Progress
**Problem:** Losing track of which components are completed
**Solution:** Update migration tracking checklist after each mod

### Pitfall 4: Skipping Validation Between Mods
**Problem:** Multiple mods fail validation at once
**Solution:** Run `npm run validate` after each mod batch

## Time Estimate

- Mod discovery and prioritization: 5 minutes
- Migration (~25 components × 1 minute each): ~25 minutes
- Validation per mod (6 batches × 1 minute): 6 minutes
- Commits per mod (6 batches × 1 minute): 6 minutes
- Final verification: 3 minutes
- **Total:** ~45 minutes (adjusted to 30 with experience from previous batches)

## Special Considerations

### Domain-Specific Terminology

Each mod has its own domain language:
- **Items mod**: "item type", "rarity", "quality"
- **Movement mod**: "movement type", "speed", "direction"
- **Activity mod**: "activity state", "priority"
- **Patrol mod**: "patrol state", "behavior"
- **Vampirism mod**: "vampire state", "feeding state"

**Important:** Use terminology that matches the mod's domain for clear error messages.

### Unknown Mods

During discovery, you may find mods not listed in the initial estimate:
1. Review the mod's purpose and components
2. Identify enum properties and valid values
3. Apply standard migration pattern
4. Customize error messages with mod-specific terminology
5. Add to tracking checklist

## Next Steps

After completion, proceed to:
- **ANASYSIMP-019-04-08**: Create integration tests for validationRules
