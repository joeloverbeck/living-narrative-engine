# ANASYSIMP-011: Blueprint/Recipe Compatibility Checker

**Phase:** 2 (Tooling & Documentation)
**Priority:** P2
**Effort:** Medium (2-3 days)
**Impact:** Medium - Prevents blueprint/recipe mismatches
**Status:** Not Started

## Context

Current validation (`src/anatomy/bodyBlueprintFactory/blueprintValidator.js`) only checks that recipe slot keys exist in blueprint. Missing validations:
1. Required slots (optional=false) not populated by recipe
2. Recipe patterns may not cover all blueprint slots
3. No warnings for recipe slots ignored by blueprint

**Existing Infrastructure:**
- `RecipePreflightValidator` (`src/anatomy/validation/RecipePreflightValidator.js`) - Comprehensive pre-flight validation
- `blueprintValidator.validateRecipeSlots()` - Validates recipe slots exist in blueprint
- `blueprintLoader.loadBlueprint()` - Handles V1/V2 blueprint loading with template generation

## Solution Overview

Enhance blueprint/recipe compatibility validation to check:
1. Recipe provides all required (non-optional) blueprint slots via explicit slots OR patterns
2. Recipe slots exist in blueprint (current behavior)
3. Recipe patterns successfully match intended blueprint slots
4. Warning for recipe slots that don't match any blueprint slot (will be ignored)

**Integration Point:** Extend `RecipePreflightValidator` with new validation method or integrate into `blueprintValidator.validateBlueprintRecipeConsistency()`.

## Implementation

```javascript
/**
 * Checks blueprint/recipe compatibility
 *
 * @param {object} blueprint - Blueprint (V1 or V2, already processed via blueprintLoader)
 * @param {object} recipe - Recipe with slots and patterns
 * @param {object} dependencies - SlotGenerator, RecipePatternResolver, Logger
 * @returns {object[]} Array of validation issues
 */
function checkBlueprintRecipeCompatibility(blueprint, recipe, { slotGenerator, recipePatternResolver, logger }) {
  const issues = [];

  // Step 1: Get all blueprint slots (already generated for V2 blueprints by blueprintLoader)
  // V1 blueprints: blueprint.slots contains explicit slot definitions
  // V2 blueprints: blueprint.slots contains merged template-generated + additionalSlots
  const blueprintSlots = blueprint.slots || {};

  // Step 2: Categorize blueprint slots by required/optional status
  const requiredSlotKeys = [];
  const optionalSlotKeys = [];

  for (const [slotKey, slotDef] of Object.entries(blueprintSlots)) {
    if (slotDef.optional) {
      optionalSlotKeys.push(slotKey);
    } else {
      requiredSlotKeys.push(slotKey);
    }
  }

  // Step 3: Determine which slots are populated by recipe
  const recipeExplicitSlots = new Set(Object.keys(recipe.slots || {}));

  // Resolve recipe patterns to determine which blueprint slots they match
  // For V2 blueprints, patterns use matchesGroup/matchesPattern/matchesAll
  // For V1 recipes, patterns use explicit matches array
  let patternMatchedSlots = new Set();

  if (blueprint.schemaVersion === '2.0' && recipe.patterns) {
    // Use RecipePatternResolver to resolve V2 patterns
    const resolvedRecipe = recipePatternResolver.resolveRecipePatterns(recipe, blueprint);
    patternMatchedSlots = new Set(Object.keys(resolvedRecipe.slots || {}));
  } else if (recipe.patterns) {
    // V1 patterns with explicit matches arrays
    for (const pattern of recipe.patterns) {
      if (pattern.matches) {
        pattern.matches.forEach(slotKey => patternMatchedSlots.add(slotKey));
      }
    }
  }

  const populatedSlots = new Set([...recipeExplicitSlots, ...patternMatchedSlots]);

  // Step 4: Check required slots are populated
  for (const requiredSlot of requiredSlotKeys) {
    // Skip special slots: 'torso' and 'root' are allowed in recipes but not required in blueprint
    if (requiredSlot === 'torso' || requiredSlot === 'root') {
      continue;
    }

    if (!populatedSlots.has(requiredSlot)) {
      issues.push({
        type: 'missing_required_slot',
        severity: 'error',
        slot: requiredSlot,
        message: `Required slot '${requiredSlot}' not populated by recipe`,
        fix: `Add slot '${requiredSlot}' to recipe.slots or create pattern that matches it`,
        location: {
          blueprintId: blueprint.id,
          recipeId: recipe.recipeId,
        },
      });
    }
  }

  // Step 5: Check for recipe slots that don't exist in blueprint (will be ignored)
  for (const recipeSlot of recipeExplicitSlots) {
    // Skip special slots that are allowed
    if (recipeSlot === 'torso' || recipeSlot === 'root') {
      continue;
    }

    if (!blueprintSlots[recipeSlot]) {
      issues.push({
        type: 'unexpected_slot',
        severity: 'warning',
        slot: recipeSlot,
        message: `Recipe slot '${recipeSlot}' not defined in blueprint '${blueprint.id}'`,
        impact: 'Slot will be ignored during anatomy generation',
        fix: `Remove slot or verify blueprint '${blueprint.id}' is correct`,
        location: {
          blueprintId: blueprint.id,
          recipeId: recipe.recipeId,
        },
      });
    }
  }

  // Step 6: Log pattern matching coverage for debugging
  if (recipe.patterns && recipe.patterns.length > 0) {
    logger.debug(`BlueprintRecipeValidator: Recipe '${recipe.recipeId}' has ${recipe.patterns.length} patterns matching ${patternMatchedSlots.size} slots`);
  }

  return issues;
}
```

## Technical Details

### Blueprint Slot Resolution

**V1 Blueprints** (`schemaVersion` omitted or "1.0"):
- `blueprint.slots` contains explicit slot definitions
- Each slot: `{ socket, requirements: { partType, components }, optional? }`

**V2 Blueprints** (`schemaVersion: "2.0"`):
- `blueprintLoader.loadBlueprint()` loads structure template
- `slotGenerator.generateBlueprintSlots(template)` generates slots from template
- Merges with `blueprint.additionalSlots`
- Result: `blueprint.slots` contains complete merged slots

### Recipe Pattern Matching

**V1 Patterns:**
```json
{
  "patterns": [
    {
      "matches": ["leg_1", "leg_2", "leg_3"],
      "partType": "spider_leg"
    }
  ]
}
```

**V2 Patterns:**
```json
{
  "patterns": [
    {
      "matchesGroup": "limbSet:leg",
      "partType": "spider_leg"
    },
    {
      "matchesPattern": "arm_*",
      "partType": "human_arm"
    },
    {
      "matchesAll": {
        "slotType": "leg",
        "orientation": "left_*"
      },
      "partType": "left_leg"
    }
  ]
}
```

**Resolution:** `RecipePatternResolver.resolveRecipePatterns()` expands patterns to explicit slots.

### Special Slots

- `torso`: Overrides root entity properties (allowed in recipe, not required in blueprint)
- `root`: Defines root mantle properties (allowed in recipe, not required in blueprint)

## Acceptance Criteria

- [ ] Detects missing required (non-optional) slots
- [ ] Warns about unexpected recipe slots (not in blueprint)
- [ ] Handles V1 and V2 blueprints correctly
- [ ] Handles V1 (`matches`) and V2 (`matchesGroup`/`matchesPattern`/`matchesAll`) patterns
- [ ] Respects special slots (`torso`, `root`)
- [ ] Integrates with `RecipePreflightValidator` or `blueprintValidator`
- [ ] Provides actionable fix suggestions with file locations

## Dependencies

**Depends On:**
- `RecipePreflightValidator` (`src/anatomy/validation/RecipePreflightValidator.js`)
- `blueprintLoader.loadBlueprint()` (`src/anatomy/bodyBlueprintFactory/blueprintLoader.js`)
- `slotGenerator` (`src/anatomy/slotGenerator.js`)
- `recipePatternResolver` (`src/anatomy/recipePatternResolver/patternResolver.js`)

**Existing Validation:**
- `blueprintValidator.validateRecipeSlots()` - Validates recipe slots exist in blueprint (needs enhancement for required slots check)
- `blueprintValidator.validateBlueprintRecipeConsistency()` - Placeholder for future consistency checks (good integration point)

## Implementation Approach

### Option 1: Extend RecipePreflightValidator
Add new validation check `#checkRequiredSlotCoverage()` to existing pre-flight validator.

**Pros:**
- Centralized validation in one place
- Follows existing pattern
- Already has all dependencies

**Cons:**
- Pre-flight validator is recipe-focused; this is blueprint/recipe consistency

### Option 2: Enhance blueprintValidator.validateBlueprintRecipeConsistency()
Implement the blueprint/recipe consistency placeholder in `blueprintValidator.js`.

**Pros:**
- Named specifically for this purpose
- Called during blueprint loading workflow
- Closer to blueprint processing code

**Cons:**
- Needs dependency injection for `slotGenerator` and `recipePatternResolver`

**Recommendation:** Option 2 - Enhance `blueprintValidator.validateBlueprintRecipeConsistency()` with required dependencies.

## Code Locations

- **Blueprint Loading:** `src/anatomy/bodyBlueprintFactory/blueprintLoader.js:39-54`
- **Blueprint Validation:** `src/anatomy/bodyBlueprintFactory/blueprintValidator.js:85-95` (consistency check placeholder)
- **Recipe Validation:** `src/anatomy/validation/RecipePreflightValidator.js`
- **Pattern Resolution:** `src/anatomy/recipePatternResolver/patternResolver.js`
- **Slot Generation:** `src/anatomy/slotGenerator.js:48-91`

## References

- **Anatomy Docs:** `docs/anatomy/blueprints-and-templates.md` - Blueprint V2 and structure templates
- **Recipe Patterns:** `docs/anatomy/recipe-pattern-matching.md` - Pattern matching reference
- **System Guide:** `docs/anatomy/anatomy-system-guide.md` - Architecture overview
- **Report Section:** Recommendation 2.4 (Lines 793-836)
