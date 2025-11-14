# RECVALREF-005: Create String Utility Service

**Phase:** 2 - Shared Services & Utilities
**Priority:** P1 - High
**Estimated Effort:** 2 hours
**Dependencies:** None

## Context

The Levenshtein distance algorithm is currently duplicated in **3 separate files**:
1. `socketSlotCompatibilityValidator.js:16-42`
2. `propertySchemaValidationRule.js:382-408`
3. `patternMatchingValidator.js` (inferred from suggestion logic)

This violates the DRY principle and creates a maintenance burden where bug fixes must be applied three times.

## Objectives

1. Create centralized `stringUtils.js` utility module
2. Implement Levenshtein distance algorithm once
3. Provide fuzzy string matching utilities
4. Replace all 3 duplicated implementations
5. Ensure backward-compatible behavior

## Implementation Details

### File to Create

`src/utils/stringUtils.js`

### Utility Functions

```javascript
/**
 * @file String manipulation utilities
 */

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Edit distance
 */
export function levenshteinDistance(a, b) {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Find closest matches from list of candidates
 * @param {string} target - Target string
 * @param {string[]} candidates - Candidate strings
 * @param {number} maxDistance - Maximum edit distance (default: 3)
 * @returns {string[]} Sorted matches within max distance
 */
export function findClosestMatches(target, candidates, maxDistance = 3) {
  const matches = candidates
    .map((candidate) => ({
      value: candidate,
      distance: levenshteinDistance(target, candidate),
    }))
    .filter(({ distance }) => distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .map(({ value }) => value);

  return matches;
}
```

## Migration Tasks

### 1. Remove from `socketSlotCompatibilityValidator.js`

**Current Location:** Lines 16-42

**Action:** Delete internal `levenshteinDistance` function, import from `stringUtils.js`

```javascript
// Add import
import { levenshteinDistance } from '../../utils/stringUtils.js';

// Remove lines 16-42 (internal implementation)
```

### 2. Remove from `propertySchemaValidationRule.js`

**Current Location:** Lines 382-408

**Action:** Delete internal `levenshteinDistance` function, import from `stringUtils.js`

```javascript
// Add import
import { levenshteinDistance } from '../../utils/stringUtils.js';

// Remove lines 382-408 (internal implementation)
```

### 3. Update `patternMatchingValidator.js`

**Action:** Replace inline implementation with import

```javascript
import { levenshteinDistance } from '../../utils/stringUtils.js';
```

## Testing Requirements

### Unit Tests

**File:** `tests/unit/utils/stringUtils.test.js`

**Test Cases:**
1. ✅ Levenshtein distance for identical strings should be 0
2. ✅ Levenshtein distance for completely different strings
3. ✅ Levenshtein distance with single character insertion
4. ✅ Levenshtein distance with single character deletion
5. ✅ Levenshtein distance with single character substitution
6. ✅ Levenshtein distance with multiple operations
7. ✅ Levenshtein distance with empty strings
8. ✅ findClosestMatches should return exact match first
9. ✅ findClosestMatches should filter by max distance
10. ✅ findClosestMatches should sort by edit distance
11. ✅ findClosestMatches should return empty array when no matches

### Example Tests

```javascript
import { describe, it, expect } from '@jest/globals';
import { levenshteinDistance, findClosestMatches } from '../../../src/utils/stringUtils.js';

describe('stringUtils', () => {
  describe('levenshteinDistance', () => {
    it('should return 0 for identical strings', () => {
      expect(levenshteinDistance('test', 'test')).toBe(0);
    });

    it('should calculate distance with insertion', () => {
      expect(levenshteinDistance('cat', 'cats')).toBe(1);
    });

    it('should calculate distance with deletion', () => {
      expect(levenshteinDistance('cats', 'cat')).toBe(1);
    });

    it('should calculate distance with substitution', () => {
      expect(levenshteinDistance('cat', 'bat')).toBe(1);
    });

    it('should handle empty strings', () => {
      expect(levenshteinDistance('', 'test')).toBe(4);
      expect(levenshteinDistance('test', '')).toBe(4);
      expect(levenshteinDistance('', '')).toBe(0);
    });

    it('should calculate distance for complex differences', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    });
  });

  describe('findClosestMatches', () => {
    it('should return exact match first', () => {
      const candidates = ['apple', 'apples', 'pear'];
      const matches = findClosestMatches('apple', candidates);

      expect(matches[0]).toBe('apple');
    });

    it('should filter by max distance', () => {
      const candidates = ['cat', 'bat', 'dog', 'elephant'];
      const matches = findClosestMatches('cat', candidates, 1);

      expect(matches).toEqual(['cat', 'bat']);
    });

    it('should sort by edit distance', () => {
      const candidates = ['cats', 'cart', 'cat'];
      const matches = findClosestMatches('cat', candidates);

      expect(matches).toEqual(['cat', 'cats', 'cart']);
    });

    it('should return empty array when no matches within distance', () => {
      const candidates = ['elephant', 'giraffe'];
      const matches = findClosestMatches('cat', candidates, 2);

      expect(matches).toEqual([]);
    });
  });
});
```

### Migration Verification Tests

**File:** `tests/unit/utils/stringUtils.migration.test.js`

**Test Cases:**
1. ✅ Should produce same results as original socketSlotCompatibilityValidator implementation
2. ✅ Should produce same results as original propertySchemaValidationRule implementation
3. ✅ Should produce same results as original patternMatchingValidator implementation

## Acceptance Criteria

- [ ] `stringUtils.js` created with Levenshtein distance implementation
- [ ] `findClosestMatches` utility function implemented
- [ ] All 3 original implementations replaced with imports
- [ ] Unit tests achieve 100% branch coverage
- [ ] Migration verification tests pass
- [ ] All existing tests still pass after migration
- [ ] Code follows project guidelines
- [ ] No ESLint violations

## Performance Considerations

The centralized implementation should have identical performance characteristics to the original inline implementations. No performance regression expected.

## Related Tickets

- RECVALREF-006 (entity matcher service - uses string utilities)
- RECVALREF-010 (validators will use this utility)

## References

- **Analysis:** `reports/recipe-validation-architecture-analysis.md` (Section: Levenshtein Distance Triplication)
- **Recommendations:** `reports/recipe-validation-refactoring-recommendations.md` (Phase 2.1)
- **Project Guidelines:** `CLAUDE.md` (Code Organization section)
