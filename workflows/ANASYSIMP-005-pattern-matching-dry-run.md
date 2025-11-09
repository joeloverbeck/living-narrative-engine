# ANASYSIMP-005: Pattern Matching Dry-Run

**Phase:** 1 (Quick Wins)
**Priority:** P1
**Effort:** Low (1-2 days)
**Impact:** Medium - Catches silent pattern failures
**Status:** Not Started

## Context

From the anatomy system improvements analysis, pattern matching failures are only logged at debug level during generation. This means creators don't know if their patterns will actually match any entities until they test the full generation.

**Pattern from Analysis:**
- 50% of recipes had pattern matching failures
- Failures logged at debug level only (easy to miss)
- No summary of unmatched patterns
- No suggestions for why patterns don't match

## Problem Statement

Recipe patterns define requirements for entity selection. However:
- Pattern validation only happens at generation time
- Failures are logged at debug level (not visible in normal console)
- No indication of which requirements are blocking matches
- No suggestions for entities that almost match
- Creators discover pattern issues late in development cycle

## Solution Overview

Implement pattern matching dry-run validation that runs at load time. The validator should:
1. Run slot matching logic without actual blueprint processing
2. Report patterns with zero matching slots as warnings
3. Identify which matcher criteria are blocking matches
4. Suggest available slots that partially match pattern criteria
5. Provide clear remediation guidance

**IMPORTANT CLARIFICATION:**
Patterns in the anatomy system match **SLOTS** (blueprint slot keys), not entity definitions. Pattern resolution occurs during blueprint processing where patterns use matchers (`matchesGroup`, `matchesPattern`, `matchesAll`) to identify which slots from the blueprint's structure template should receive the pattern's part requirements (partType, tags, properties).

## Implementation Details

### Core Validation Function

```javascript
/**
 * Validates that recipe patterns have matching slots (dry-run)
 * @param {Object} recipe - Recipe to validate
 * @param {Object} blueprint - Blueprint with slots from structure template
 * @param {Object} dataRegistry - Data registry for structure templates
 * @param {Object} slotGenerator - SlotGenerator for extracting slot keys from limbSets/appendages
 * @returns {Array<Object>} Array of warnings for zero-match patterns
 */
function validatePatternMatching(recipe, blueprint, dataRegistry, slotGenerator) {
  const warnings = [];

  for (const pattern of recipe.patterns || []) {
    const patternDesc = getPatternDescription(pattern);

    // Run slot matching (dry-run, no blueprint processing)
    const result = findMatchingSlots(pattern, blueprint, dataRegistry, slotGenerator);

    if (result.matches.length === 0) {
      warnings.push({
        type: 'NO_MATCHING_SLOTS',
        location: { type: 'pattern', description: patternDesc },
        pattern: pattern,
        matcher: extractMatcherInfo(pattern),
        availableSlots: result.availableSlots,
        message: `Pattern ${patternDesc} has no matching slots`,
        reason: identifyBlockingMatcher(pattern, result),
        fix: suggestPatternFix(pattern, result),
        severity: 'warning',
      });
    } else {
      // Pattern has matches - could add info-level log
    }
  }

  return warnings;
}

/**
 * Finds slots matching pattern matchers
 * @param {Object} pattern - Pattern definition (v1 or v2)
 * @param {Object} blueprint - Blueprint with slots
 * @param {Object} dataRegistry - Data registry for structure templates
 * @param {Object} slotGenerator - SlotGenerator instance
 * @returns {Object} Match results with available slots info
 */
function findMatchingSlots(pattern, blueprint, dataRegistry, slotGenerator) {
  const matches = [];
  const blueprintSlots = blueprint.slots || {};
  const blueprintSlotKeys = Object.keys(blueprintSlots);

  // V1 pattern: explicit matches array
  if (Array.isArray(pattern.matches)) {
    for (const slotKey of pattern.matches) {
      if (blueprintSlots[slotKey]) {
        matches.push(slotKey);
      }
    }
    return {
      matches,
      availableSlots: blueprintSlotKeys,
      matcherType: 'v1_explicit',
    };
  }

  // V2 pattern: matchesGroup (limbSet:leg, appendage:tail)
  if (pattern.matchesGroup) {
    try {
      const deps = { dataRegistry, slotGenerator, logger: console };
      const resolvedSlots = resolveSlotGroup(
        pattern.matchesGroup,
        blueprint,
        {},
        deps
      );
      matches.push(...resolvedSlots);
    } catch (error) {
      // Group resolution failed
    }
    return {
      matches,
      availableSlots: blueprintSlotKeys,
      matcherType: 'matchesGroup',
      matcherValue: pattern.matchesGroup,
    };
  }

  // V2 pattern: matchesPattern (wildcard: leg_*, *_left)
  if (pattern.matchesPattern !== undefined) {
    const matchedSlots = resolveWildcardPattern(
      pattern.matchesPattern,
      blueprintSlotKeys
    );
    matches.push(...matchedSlots);
    return {
      matches,
      availableSlots: blueprintSlotKeys,
      matcherType: 'matchesPattern',
      matcherValue: pattern.matchesPattern,
    };
  }

  // V2 pattern: matchesAll (property filter)
  if (pattern.matchesAll) {
    const matchedSlots = resolvePropertyFilter(
      pattern.matchesAll,
      blueprintSlots
    );
    matches.push(...matchedSlots);
    return {
      matches,
      availableSlots: blueprintSlotKeys,
      matcherType: 'matchesAll',
      matcherValue: pattern.matchesAll,
    };
  }

  // No recognized matcher
  return {
    matches: [],
    availableSlots: blueprintSlotKeys,
    matcherType: 'none',
  };
}

/**
 * Helper to get pattern description for logging
 * @param {Object} pattern - Pattern definition
 * @returns {string} Human-readable pattern description
 */
function getPatternDescription(pattern) {
  if (pattern.matchesGroup) return `matchesGroup '${pattern.matchesGroup}'`;
  if (pattern.matchesPattern !== undefined) return `matchesPattern '${pattern.matchesPattern}'`;
  if (pattern.matchesAll) return `matchesAll ${JSON.stringify(pattern.matchesAll)}`;
  if (Array.isArray(pattern.matches)) return `explicit matches [${pattern.matches.join(', ')}]`;
  return 'no matcher defined';
}

/**
 * Resolves slot group to slot keys (simplified from recipePatternResolver)
 * @param {string} groupRef - Group reference (e.g., 'limbSet:leg')
 * @param {Object} blueprint - Blueprint with structureTemplate
 * @param {Object} context - Resolution context
 * @param {Object} deps - Dependencies (dataRegistry, slotGenerator, logger)
 * @returns {string[]} Matched slot keys
 */
function resolveSlotGroup(groupRef, blueprint, context, deps) {
  const [groupType, groupId] = groupRef.split(':');
  const structureTemplateId = blueprint.structureTemplate;

  if (!structureTemplateId) {
    throw new Error(`Blueprint missing structureTemplate for group ${groupRef}`);
  }

  const template = deps.dataRegistry.get('structureTemplates', structureTemplateId);
  if (!template) {
    throw new Error(`Structure template '${structureTemplateId}' not found`);
  }

  if (groupType === 'limbSet') {
    const limbSet = template.topology?.limbSets?.find(ls => ls.type === groupId);
    if (!limbSet) return [];
    return deps.slotGenerator.extractSlotKeysFromLimbSet(limbSet);
  }

  if (groupType === 'appendage') {
    const appendage = template.topology?.appendages?.find(a => a.type === groupId);
    if (!appendage) return [];
    return deps.slotGenerator.extractSlotKeysFromAppendage(appendage);
  }

  return [];
}

/**
 * Resolves wildcard pattern to matching slot keys
 * @param {string} pattern - Wildcard pattern (e.g., 'leg_*', '*_left')
 * @param {string[]} slotKeys - Available slot keys
 * @returns {string[]} Matched slot keys
 */
function resolveWildcardPattern(pattern, slotKeys) {
  // Convert wildcard pattern to regex
  const regexPattern = pattern.replace(/\*/g, '.*');
  const regex = new RegExp(`^${regexPattern}$`);

  return slotKeys.filter(key => regex.test(key));
}

/**
 * Resolves property filter to matching slot keys
 * @param {Object} filter - Property filter object
 * @param {Object} slots - Blueprint slots object
 * @returns {string[]} Matched slot keys
 */
function resolvePropertyFilter(filter, slots) {
  const matches = [];

  for (const [slotKey, slotDef] of Object.entries(slots)) {
    let isMatch = true;

    if (filter.slotType && slotDef.slotType !== filter.slotType) {
      isMatch = false;
    }

    if (filter.orientation) {
      const orientPattern = filter.orientation.replace(/\*/g, '.*');
      const orientRegex = new RegExp(`^${orientPattern}$`);
      if (!orientRegex.test(slotDef.orientation || '')) {
        isMatch = false;
      }
    }

    if (filter.socketId && slotDef.socket !== filter.socketId) {
      isMatch = false;
    }

    if (isMatch) {
      matches.push(slotKey);
    }
  }

  return matches;
}

/**
 * Extracts matcher information for display
 * @param {Object} pattern - Pattern definition
 * @returns {Object} Formatted matcher info
 */
function extractMatcherInfo(pattern) {
  if (pattern.matchesGroup) {
    return { type: 'matchesGroup', value: pattern.matchesGroup };
  }
  if (pattern.matchesPattern !== undefined) {
    return { type: 'matchesPattern', value: pattern.matchesPattern };
  }
  if (pattern.matchesAll) {
    return { type: 'matchesAll', value: pattern.matchesAll };
  }
  if (Array.isArray(pattern.matches)) {
    return { type: 'v1_explicit', value: pattern.matches };
  }
  return { type: 'none', value: null };
}

/**
 * Identifies which matcher is blocking slot matches
 * @param {Object} pattern - Pattern definition
 * @param {Object} result - Match result from findMatchingSlots
 * @returns {string} Description of blocking matcher
 */
function identifyBlockingMatcher(pattern, result) {
  const { matcherType, matcherValue, availableSlots } = result;

  if (matcherType === 'none') {
    return 'No matcher defined (requires matchesGroup, matchesPattern, matchesAll, or matches array)';
  }

  if (matcherType === 'matchesGroup') {
    return `Slot group '${matcherValue}' not found in blueprint's structure template or produced 0 slots`;
  }

  if (matcherType === 'matchesPattern') {
    if (availableSlots.length === 0) {
      return `Blueprint has no slots defined`;
    }
    return `Pattern '${matcherValue}' does not match any of ${availableSlots.length} available slot keys`;
  }

  if (matcherType === 'matchesAll') {
    const filterStr = JSON.stringify(matcherValue);
    return `Property filter ${filterStr} does not match any blueprint slots`;
  }

  if (matcherType === 'v1_explicit') {
    return `None of the explicit slot keys ${JSON.stringify(matcherValue)} exist in blueprint`;
  }

  return 'Unknown matcher blocking issue';
}

/**
 * Suggests how to fix pattern matching issue
 * @param {Object} pattern - Pattern definition
 * @param {Object} result - Match result from findMatchingSlots
 * @returns {string} Fix suggestion
 */
function suggestPatternFix(pattern, result) {
  const { matcherType, matcherValue, availableSlots } = result;

  if (matcherType === 'none') {
    return 'Add a matcher property: matchesGroup (e.g., "limbSet:leg"), matchesPattern (e.g., "leg_*"), matchesAll, or matches array';
  }

  if (matcherType === 'matchesGroup') {
    const [groupType, groupId] = matcherValue.split(':');
    return `Add ${groupType} with type '${groupId}' to the blueprint's structure template topology, or use a different slot group`;
  }

  if (matcherType === 'matchesPattern') {
    if (availableSlots.length === 0) {
      return 'Blueprint has no slots - verify blueprint has structureTemplate with limbSets/appendages';
    }
    const suggestions = availableSlots.slice(0, 5).join(', ');
    return `Adjust pattern to match available slots. Available: ${suggestions}${availableSlots.length > 5 ? '...' : ''}`;
  }

  if (matcherType === 'matchesAll') {
    return `Adjust property filter criteria or add slots to blueprint that match the filter`;
  }

  if (matcherType === 'v1_explicit') {
    const available = availableSlots.slice(0, 5).join(', ');
    return `Update matches array to use existing slot keys. Available: ${available}${availableSlots.length > 5 ? '...' : ''}`;
  }

  return 'Adjust pattern matcher or update blueprint structure';
}
```

### Integration with Pre-flight Validator

```javascript
// In RecipePreflightValidator (ANASYSIMP-003)
async #checkPatternMatching(recipe, results) {
  try {
    // Get blueprint for the recipe
    const blueprint = await this.#anatomyBlueprintRepository.getBlueprint(recipe.blueprintId);

    if (!blueprint) {
      this.#logger.warn(`Cannot validate patterns: blueprint '${recipe.blueprintId}' not found`);
      return;
    }

    // Need SlotGenerator instance - retrieve from DI container
    const slotGenerator = this.#slotGenerator; // Assume injected dependency

    const warnings = validatePatternMatching(
      recipe,
      blueprint,
      this.#dataRegistry,
      slotGenerator
    );

    if (warnings.length === 0) {
      const patternCount = (recipe.patterns || []).length;
      results.passed.push({
        check: 'pattern_matching',
        message: `All ${patternCount} pattern(s) have matching slots`,
      });
    } else {
      results.warnings.push(...warnings);
    }
  } catch (error) {
    this.#logger.error('Pattern matching check failed', error);
    results.warnings.push({
      type: 'VALIDATION_WARNING',
      check: 'pattern_matching',
      message: 'Pattern matching check failed',
      error: error.message,
    });
  }
}
```

**Required Dependency Updates:**
```javascript
// RecipePreflightValidator constructor needs SlotGenerator
constructor({
  dataRegistry,
  anatomyBlueprintRepository,
  schemaValidator,
  slotGenerator,  // NEW: Add SlotGenerator dependency
  logger,
}) {
  // ... existing validation ...
  this.#slotGenerator = slotGenerator;
}
```

### File Structure

```
src/anatomy/validation/
├── patternMatchingValidator.js     # Main validator
├── entityMatcher.js                # Entity matching logic
└── validationErrors.js             # Error classes

tests/unit/anatomy/validation/
├── patternMatchingValidator.test.js
└── entityMatcher.test.js

tests/integration/anatomy/validation/
└── patternMatching.integration.test.js
```

## Acceptance Criteria

- [ ] Validator performs dry-run of slot matching using pattern matchers
- [ ] Validator detects patterns with zero matching slots
- [ ] Warnings include pattern description and matcher type/value
- [ ] Warnings identify which matcher is blocking matches
- [ ] Warnings list available blueprint slots (for context)
- [ ] Warnings include actionable fix suggestions
- [ ] Supports all pattern types: v1 (matches array), matchesGroup, matchesPattern, matchesAll
- [ ] Integration with ANASYSIMP-003 pre-flight validator works correctly
- [ ] RecipePreflightValidator receives SlotGenerator dependency
- [ ] Patterns with matches do not generate warnings
- [ ] All existing recipes pass validation (warnings acceptable for known issues)

## Testing Requirements

### Unit Tests

1. **Slot Matching - V1 Patterns**
   - Explicit matches with all slots existing → matches found
   - Explicit matches with missing slots → zero matches, warning
   - Empty matches array → zero matches

2. **Slot Matching - matchesGroup**
   - Valid limbSet reference → resolves to slot keys
   - Valid appendage reference → resolves to slot keys
   - Non-existent slot group → zero matches, warning
   - Blueprint without structureTemplate → error/warning

3. **Slot Matching - matchesPattern**
   - Wildcard pattern matching slots → matches found
   - Wildcard pattern with no matches → warning
   - Complex patterns (`*_left`, `leg_*_front`) → correct matching

4. **Slot Matching - matchesAll**
   - Property filter matching slots → matches found
   - Property filter with no matches → warning
   - Multiple property criteria → correct filtering

5. **Matcher Detection**
   - Pattern without matcher → "no matcher" warning
   - Pattern with invalid matcher → appropriate error

6. **Fix Suggestions**
   - matchesGroup failure → suggest adding to structure template
   - matchesPattern failure → list available slots
   - matchesAll failure → suggest adjusting filter
   - No matcher → suggest adding matcher

7. **Edge Cases**
   - Recipe with no patterns → no warnings
   - Blueprint with no slots → all patterns warn
   - Pattern with exclusions → validates post-exclusion matches

### Integration Tests

1. **Real Blueprint & Structure Template Integration**
   - Test with actual blueprint and structure template definitions
   - Verify slot group resolution works correctly
   - Test with complex blueprint topologies (multiple limbSets, appendages)

2. **Pre-flight Integration**
   - Pattern warnings appear in validation report
   - Warnings don't block recipe load (only errors do)
   - Passed patterns tracked correctly
   - SlotGenerator dependency properly injected

3. **Multi-Pattern Scenarios**
   - Multiple patterns, some match → only non-matching warn
   - All patterns match → no warnings
   - No patterns match → all warn with suggestions
   - Mix of v1 and v2 patterns → all validated correctly

4. **Existing Recipe Validation**
   - Test all recipes in data/mods/anatomy/recipes/
   - Verify known working recipes pass validation
   - Document any expected warnings from legacy patterns

## Documentation Requirements

- [ ] Add JSDoc comments to validation functions
- [ ] Document slot matching validation in validation workflow docs
- [ ] Add example warnings to common errors catalog
- [ ] Update recipe creation checklist with pattern validation guidance
- [ ] Document pattern matcher types (v1, matchesGroup, matchesPattern, matchesAll)
- [ ] Add troubleshooting guide for common zero-match scenarios

## Dependencies

**Required:**
- `IDataRegistry` - Access to structure templates and blueprints
- `IAnatomyBlueprintRepository` - Retrieve blueprint for recipe
- `SlotGenerator` - Extract slot keys from limbSets/appendages
- `ILogger` - Logging

**Depends On:**
- None (independent validator)

**Integrates With:**
- ANASYSIMP-003 (Pre-flight Recipe Validator) - uses this
- Existing RecipePatternResolver logic for matcher functions

**Blocks:**
- None (optional validation feature)

## Implementation Notes

### Warning vs Error

Pattern matching issues are **warnings**, not errors, because:
- Patterns may be optional/fallback mechanisms
- Some patterns intended for future entities
- Zero matches may be temporary during development
- Should inform but not block recipe loading

### Slot Matching Algorithm

The validation performs a dry-run of pattern resolution using the same logic as RecipePatternResolver:

1. **V1 Patterns** - Check if explicit slot keys exist in blueprint
2. **matchesGroup** - Resolve slot group from structure template topology
3. **matchesPattern** - Apply wildcard matching against blueprint slot keys
4. **matchesAll** - Filter blueprint slots by property criteria

This ensures validation mirrors actual runtime behavior.

### Performance Considerations

- Dry-run doesn't process blueprint or generate entities (lightweight)
- Slot matching: O(p * s) where p = patterns, s = blueprint slots
- Structure template resolution: O(g) where g = slot groups (limbSets + appendages)
- Expected: 5-10 patterns, 10-50 slots per blueprint
- Performance impact: ~5-15ms per recipe
- Acceptable for load-time validation
- Can be skipped with `skipPatternValidation` option

### Error Message Template

```
[WARNING] Pattern has no matching slots

Context:  Recipe 'anatomy:red_dragon', Pattern matchesGroup 'limbSet:wing'
Problem:  No slots found matching pattern matcher
Impact:   Pattern will not create any slot definitions
Fix:      Add limbSet to structure template or adjust pattern matcher

Pattern Matcher:
  - Type: matchesGroup
  - Value: limbSet:wing
  - Blueprint: anatomy:red_dragon (references structureTemplate 'dragon_quadruped')

Available Slots in Blueprint:
  - head, neck, torso, leg_left_front, leg_right_front, leg_left_rear, leg_right_rear, tail

Diagnosis:
  Slot group 'limbSet:wing' not found in structure template 'dragon_quadruped' topology.
  The structure template has limbSets: [leg], appendages: [tail]

Suggestions:
  1. Add a limbSet with type 'wing' to the structure template topology:
     {
       "type": "wing",
       "count": 2,
       "socketPattern": "wing_{{orientation}}",
       "arrangement": "bilateral"
     }

  2. OR use a different pattern matcher for existing slots:
     - matchesPattern: "wing_*" (if wing slots exist)
     - matchesAll: { "slotType": "wing" }

  3. OR remove this pattern from the recipe if wings are not needed
```

## Success Metrics

- **Warning Detection:** 100% of zero-match patterns detected at load time
- **False Positives:** <5% (patterns without matchers are valid warnings)
- **Actionable Suggestions:** >90% of suggestions provide clear fix guidance
- **Time Savings:** 10-20 minutes per pattern issue (early detection vs. runtime debugging)
- **Developer Experience:** Pattern issues visible in console during recipe load, not hidden in debug logs

## References

- **Report Section:** Category 1: Validation Enhancements → Recommendation 1.4
- **Report Pages:** Lines 543-588
- **Pattern Analysis:** Lines 264-267 (50% of recipes had pattern failures)
- **Related Validators:** Pre-flight Recipe Validator (ANASYSIMP-003)
