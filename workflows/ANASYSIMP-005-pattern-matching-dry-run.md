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
1. Run part selection logic without actual instantiation
2. Report patterns with zero matching entities as warnings
3. Identify which requirements are blocking matches
4. Suggest entities that partially match (almost-matches)
5. Provide clear remediation guidance

## Implementation Details

### Core Validation Function

```javascript
/**
 * Validates that recipe patterns have matching entities (dry-run)
 * @param {Object} recipe - Recipe to validate
 * @param {Object} entityRegistry - Registry of loaded entities
 * @returns {Array<Object>} Array of warnings for zero-match patterns
 */
function validatePatternMatching(recipe, entityRegistry) {
  const warnings = [];

  for (const pattern of recipe.patterns || []) {
    const patternId = pattern.matchesPattern || pattern.matchesGroup || 'unknown';

    // Run pattern matching (dry-run, no instantiation)
    const result = findMatchingEntities(pattern, entityRegistry);

    if (result.matches.length === 0) {
      warnings.push({
        type: 'NO_MATCHING_ENTITIES',
        location: { type: 'pattern', name: patternId },
        pattern: pattern,
        requirements: extractRequirements(pattern),
        almostMatches: result.almostMatches,
        message: `Pattern '${patternId}' has no matching entities`,
        reason: identifyBlockingRequirement(pattern, result.almostMatches),
        fix: suggestPatternFix(pattern, result.almostMatches),
        severity: 'warning',
      });
    } else {
      // Pattern has matches - could add info-level log
    }
  }

  return warnings;
}

/**
 * Finds entities matching pattern requirements
 * @param {Object} pattern - Pattern definition
 * @param {Object} entityRegistry - Entity registry
 * @returns {Object} Match results with almostMatches
 */
function findMatchingEntities(pattern, entityRegistry) {
  const requirements = {
    partType: pattern.partType,
    components: pattern.tags || [],
    properties: pattern.properties || {},
  };

  const matches = [];
  const almostMatches = [];

  for (const entity of entityRegistry.getAllEntities()) {
    const matchResult = checkEntityMatch(entity, requirements);

    if (matchResult.isFullMatch) {
      matches.push(entity);
    } else if (matchResult.isPartialMatch) {
      almostMatches.push({
        entity: entity,
        matchScore: matchResult.score,
        missingRequirements: matchResult.missing,
        extraComponents: matchResult.extra,
      });
    }
  }

  // Sort almost-matches by score (closest matches first)
  almostMatches.sort((a, b) => b.matchScore - a.matchScore);

  return { matches, almostMatches: almostMatches.slice(0, 5) }; // Top 5
}

/**
 * Checks if entity matches pattern requirements
 * @param {Object} entity - Entity definition
 * @param {Object} requirements - Pattern requirements
 * @returns {Object} Match result with score and missing requirements
 */
function checkEntityMatch(entity, requirements) {
  const result = {
    isFullMatch: true,
    isPartialMatch: false,
    score: 0,
    missing: [],
    extra: [],
  };

  // Check partType
  const entityPartType = entity.components?.['anatomy:part']?.subType;

  if (requirements.partType && entityPartType !== requirements.partType) {
    result.isFullMatch = false;
    result.missing.push({
      type: 'partType',
      expected: requirements.partType,
      actual: entityPartType,
    });
  } else if (requirements.partType) {
    result.score += 40; // partType is critical
  }

  // Check required components
  for (const requiredComponent of requirements.components) {
    if (!entity.components?.[requiredComponent]) {
      result.isFullMatch = false;
      result.missing.push({
        type: 'component',
        componentId: requiredComponent,
      });
    } else {
      result.score += 20; // Each component match
    }
  }

  // Check property values
  for (const [componentId, expectedProps] of Object.entries(requirements.properties)) {
    const actualProps = entity.components?.[componentId];

    if (!actualProps) {
      result.isFullMatch = false;
      result.missing.push({
        type: 'component',
        componentId: componentId,
        reason: 'component_missing',
      });
      continue;
    }

    const propMismatches = checkPropertiesMatch(expectedProps, actualProps);

    if (propMismatches.length > 0) {
      result.isFullMatch = false;
      result.missing.push({
        type: 'properties',
        componentId: componentId,
        mismatches: propMismatches,
      });
    } else {
      result.score += 10; // Property match
    }
  }

  // Determine if partial match
  if (!result.isFullMatch && result.score > 0) {
    result.isPartialMatch = true;
  }

  return result;
}

/**
 * Checks if actual properties match expected properties
 * @param {Object} expected - Expected property values
 * @param {Object} actual - Actual property values
 * @returns {Array<Object>} Array of mismatches
 */
function checkPropertiesMatch(expected, actual) {
  const mismatches = [];

  for (const [key, expectedValue] of Object.entries(expected)) {
    const actualValue = actual[key];

    if (JSON.stringify(expectedValue) !== JSON.stringify(actualValue)) {
      mismatches.push({
        property: key,
        expected: expectedValue,
        actual: actualValue,
      });
    }
  }

  return mismatches;
}

/**
 * Extracts pattern requirements for display
 * @param {Object} pattern - Pattern definition
 * @returns {Object} Formatted requirements
 */
function extractRequirements(pattern) {
  return {
    partType: pattern.partType || 'any',
    components: pattern.tags || [],
    properties: pattern.properties || {},
    count: Object.keys(pattern).length,
  };
}

/**
 * Identifies which requirement is blocking matches
 * @param {Object} pattern - Pattern definition
 * @param {Array} almostMatches - Almost-matching entities
 * @returns {string} Description of blocking requirement
 */
function identifyBlockingRequirement(pattern, almostMatches) {
  if (almostMatches.length === 0) {
    return 'No entities found with matching partType';
  }

  const topMatch = almostMatches[0];
  const missing = topMatch.missingRequirements;

  if (missing.length === 0) {
    return 'Unknown blocking requirement';
  }

  const first = missing[0];

  if (first.type === 'partType') {
    return `No entities with partType '${first.expected}'`;
  }

  if (first.type === 'component') {
    return `Entities missing required component '${first.componentId}'`;
  }

  if (first.type === 'properties') {
    const mismatch = first.mismatches[0];
    return `Component '${first.componentId}' property '${mismatch.property}' has value '${mismatch.actual}' but pattern requires '${mismatch.expected}'`;
  }

  return 'Multiple requirements not met';
}

/**
 * Suggests how to fix pattern matching issue
 * @param {Object} pattern - Pattern definition
 * @param {Array} almostMatches - Almost-matching entities
 * @returns {string} Fix suggestion
 */
function suggestPatternFix(pattern, almostMatches) {
  if (almostMatches.length === 0) {
    return `Create entity with partType '${pattern.partType}' or adjust pattern requirements`;
  }

  const topMatch = almostMatches[0];
  const entity = topMatch.entity;
  const missing = topMatch.missingRequirements[0];

  if (!missing) {
    return 'Entity almost matches - review pattern requirements';
  }

  if (missing.type === 'component') {
    return `Add component '${missing.componentId}' to entity '${entity.id}' at ${entity.filePath}`;
  }

  if (missing.type === 'properties') {
    const mismatch = missing.mismatches[0];
    return `Change ${entity.id}.${missing.componentId}.${mismatch.property} from '${mismatch.actual}' to '${mismatch.expected}'`;
  }

  if (missing.type === 'partType') {
    return `Entity '${entity.id}' has partType '${missing.actual}', pattern requires '${missing.expected}'`;
  }

  return 'Adjust pattern requirements or create new entity';
}
```

### Integration with Pre-flight Validator

```javascript
// In RecipePreflightValidator (ANASYSIMP-003)
#checkPatternMatching(recipe, results) {
  try {
    const warnings = validatePatternMatching(recipe, this.#entityRegistry);

    if (warnings.length === 0) {
      const patternCount = (recipe.patterns || []).length;
      results.passed.push({
        check: 'pattern_matching',
        message: `All ${patternCount} pattern(s) have matching entities`,
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

- [ ] Validator performs dry-run of pattern matching
- [ ] Validator detects patterns with zero matching entities
- [ ] Warnings include pattern ID and requirements
- [ ] Warnings identify blocking requirement
- [ ] Warnings suggest almost-matching entities (top 5)
- [ ] Warnings include fix suggestions
- [ ] Almost-match scoring prioritizes partType > components > properties
- [ ] Integration with ANASYSIMP-003 pre-flight validator works correctly
- [ ] Patterns with matches do not generate warnings
- [ ] All existing recipes pass validation (warnings acceptable for known issues)

## Testing Requirements

### Unit Tests

1. **Entity Matching**
   - Entity with exact match → isFullMatch = true
   - Entity with partType mismatch → missing includes partType
   - Entity missing component → missing includes component
   - Entity with property mismatch → missing includes properties
   - Entity with partial match → isPartialMatch = true

2. **Match Scoring**
   - Exact match: high score
   - partType + components: medium score
   - Components only: lower score
   - Scoring prioritizes critical requirements

3. **Pattern Validation**
   - Pattern with no matches → warning generated
   - Pattern with matches → no warning
   - Pattern with almost-matches → suggests closest

4. **Blocking Requirement Detection**
   - No matches → "No entities with partType"
   - Missing component → identifies component
   - Property mismatch → identifies property and values

5. **Fix Suggestions**
   - No almost-matches → suggest creating entity
   - Missing component → suggest adding to entity
   - Property mismatch → suggest changing value
   - partType mismatch → explain incompatibility

6. **Edge Cases**
   - Recipe with no patterns → no warnings
   - Pattern with no requirements → matches all
   - Entity registry empty → all patterns warn

### Integration Tests

1. **Real Entity Registry**
   - Test with actual entity definitions
   - Verify pattern matching logic works correctly
   - Test with complex property requirements

2. **Pre-flight Integration**
   - Pattern warnings appear in validation report
   - Warnings don't block recipe load (only errors do)
   - Passed patterns tracked correctly

3. **Multi-Pattern Scenarios**
   - Multiple patterns, some match → only non-matching warn
   - All patterns match → no warnings
   - No patterns match → all warn with suggestions

## Documentation Requirements

- [ ] Add JSDoc comments to validation functions
- [ ] Document pattern matching in validation workflow docs
- [ ] Add example warnings to common errors catalog
- [ ] Update recipe creation checklist with pattern validation guidance
- [ ] Document almost-match scoring algorithm

## Dependencies

**Required:**
- Entity registry with `getAllEntities()` method

**Depends On:**
- None (independent validator)

**Integrates With:**
- ANASYSIMP-003 (Pre-flight Recipe Validator) - uses this

**Blocks:**
- None (optional validation feature)

## Implementation Notes

### Warning vs Error

Pattern matching issues are **warnings**, not errors, because:
- Patterns may be optional/fallback mechanisms
- Some patterns intended for future entities
- Zero matches may be temporary during development
- Should inform but not block recipe loading

### Almost-Match Algorithm

The scoring system prioritizes:
1. **partType** (40 points) - Most critical requirement
2. **Components** (20 points each) - Required functionality
3. **Properties** (10 points each) - Fine-tuning

This ensures suggestions show entities that need minimal changes.

### Performance Considerations

- Dry-run doesn't instantiate entities (lightweight)
- Entity registry iteration: O(n) where n = total entities
- Pattern matching: O(p * n) where p = patterns, n = entities
- Expected: 5-10 patterns, 50-200 entities
- Performance impact: ~20-50ms per recipe
- Acceptable for load-time validation

### Error Message Template

```
[WARNING] Pattern has no matching entities

Context:  Recipe 'red_dragon.recipe.json', Pattern 'limbSet:wing'
Problem:  No entities found matching pattern requirements
Impact:   Wing slots will not be generated
Fix:      Add component to entity or adjust pattern requirements

Pattern Requirements:
  - Part Type: dragon_wing
  - Required Components: [anatomy:part, descriptors:length_category]
  - Required Properties: {
      "descriptors:length_category": { "length": "immense" }
    }

Almost Matches (closest first):
  1. anatomy:dragon_wing (Score: 60/100)
     Missing: descriptors:length_category component
     Fix: Add to data/mods/anatomy/entities/definitions/dragon_wing.entity.json:
          {
            "descriptors:length_category": { "length": "immense" }
          }

  2. anatomy:bird_wing (Score: 40/100)
     Missing: partType mismatch (bird_wing vs dragon_wing)
     Fix: Create new dragon_wing entity or adjust pattern

Suggestion: Add descriptor component to dragon_wing entity
```

## Success Metrics

- **Warning Detection:** 100% of zero-match patterns detected
- **False Positives:** <10% (some patterns intentionally have no matches)
- **Suggestion Quality:** >80% of top suggestions are actionable
- **Time Savings:** 15-30 minutes per pattern issue (eliminated console log hunting)

## References

- **Report Section:** Category 1: Validation Enhancements → Recommendation 1.4
- **Report Pages:** Lines 543-588
- **Pattern Analysis:** Lines 264-267 (50% of recipes had pattern failures)
- **Related Validators:** Pre-flight Recipe Validator (ANASYSIMP-003)
