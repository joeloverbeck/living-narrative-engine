# ANASYSIMP-011: Blueprint/Recipe Compatibility Checker

**Phase:** 2 (Tooling & Documentation)
**Priority:** P2
**Effort:** Medium (2-3 days)
**Impact:** Medium - Prevents blueprint/recipe mismatches
**Status:** Not Started

## Context

No validation exists to ensure recipes provide all slots required by their blueprint or that recipe slots match blueprint structure.

## Solution Overview

Create compatibility validator that checks:
1. Recipe provides all required blueprint slots
2. Recipe slots match blueprint socket definitions
3. Recipe patterns cover expected slot groups
4. Warning for unexpected recipe slots (ignored by blueprint)

## Implementation

```javascript
function checkBlueprintRecipeCompatibility(blueprint, recipe) {
  const issues = [];

  // Get blueprint slots from structure template
  const blueprintSlots = getBlueprintSlots(blueprint);
  const recipeSlots = new Set(Object.keys(recipe.slots || {}));

  // Check required slots provided
  for (const requiredSlot of blueprintSlots.required) {
    if (!recipeSlots.has(requiredSlot) && !isMatchedByPattern(recipe.patterns, requiredSlot)) {
      issues.push({
        type: 'missing_slot',
        slot: requiredSlot,
        fix: `Add slot '${requiredSlot}' to recipe or create pattern that matches it`,
      });
    }
  }

  // Check for unexpected slots
  for (const slotName of recipeSlots) {
    if (!blueprintSlots.all.has(slotName)) {
      issues.push({
        type: 'unexpected_slot',
        slot: slotName,
        warning: `Slot '${slotName}' not defined in blueprint`,
        impact: 'Slot will be ignored during generation',
      });
    }
  }

  return issues;
}
```

## Acceptance Criteria

- [ ] Detects missing required slots
- [ ] Warns about unexpected slots
- [ ] Validates slot-socket compatibility
- [ ] Integrates with pre-flight validator
- [ ] Provides actionable fix suggestions

## Dependencies

**Depends On:** ANASYSIMP-003 (Pre-flight Validator)
**Requires:** Blueprint structure template analysis

## References

- **Report Section:** Recommendation 2.4
- **Report Pages:** Lines 793-836
