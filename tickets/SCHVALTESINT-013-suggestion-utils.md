# SCHVALTESINT-013: Create suggestionUtils.js for "Did You Mean?" Matching

**Epic**: SCHVALTESINT - Schema Validation Test Integration
**Priority**: LOW
**Phase**: 5 - Enhanced Error Messages
**Dependencies**: None (can proceed in parallel)
**Blocks**: SCHVALTESINT-014

---

## Objective

Create `suggestionUtils.js` that provides fuzzy matching and "Did you mean?" suggestions for unknown operation types and parameter names using Levenshtein distance.

## File List

### Files to Create

| File | Purpose |
|------|---------|
| `src/utils/suggestionUtils.js` | Fuzzy matching and suggestion generation |
| `tests/unit/utils/suggestionUtils.test.js` | Unit tests |

### Files to Read (for reference)

| File | Purpose |
|------|---------|
| `src/utils/preValidationUtils.js` | KNOWN_OPERATION_TYPES to suggest against |

---

## Out of Scope

**DO NOT MODIFY:**

- `src/utils/preValidationUtils.js` - Don't integrate yet
- `src/utils/ajvAnyOfErrorFormatter.js` - Separate ticket (SCHVALTESINT-014)
- Any other existing source files

**DO NOT:**

- Add external dependencies (implement Levenshtein locally)
- Integrate with error formatters (that's SCHVALTESINT-014)
- Over-optimize for performance (suggestions are on error path only)

---

## Implementation Details

### Edge Cases to Handle (from spec 4.2)

| Input | Expected Suggestion |
|-------|---------------------|
| `LOCK_GRABB` | "Did you mean LOCK_GRABBING?" |
| `SET_COMP` | "Did you mean SET_COMPONENT?" |
| `entity` | "Did you mean entity_id?" |

### Suggested Implementation

```javascript
/**
 * @file src/utils/suggestionUtils.js
 * Provides fuzzy matching and "Did you mean?" suggestions
 */

/**
 * Calculates Levenshtein distance between two strings
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Edit distance
 */
export function levenshteinDistance(a, b) {
  const matrix = [];

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
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
 * Finds similar strings from a list based on Levenshtein distance
 * @param {string} input - The unknown string
 * @param {string[]} candidates - List of valid strings to match against
 * @param {Object} [options] - Configuration options
 * @param {number} [options.maxDistance=3] - Maximum edit distance for suggestions
 * @param {number} [options.maxSuggestions=3] - Maximum number of suggestions
 * @param {boolean} [options.caseInsensitive=true] - Ignore case when matching
 * @returns {string[]} Similar strings sorted by distance (closest first)
 */
export function findSimilar(input, candidates, options = {}) {
  const {
    maxDistance = 3,
    maxSuggestions = 3,
    caseInsensitive = true
  } = options;

  const normalizedInput = caseInsensitive ? input.toUpperCase() : input;

  const matches = candidates
    .map(candidate => {
      const normalizedCandidate = caseInsensitive ? candidate.toUpperCase() : candidate;
      return {
        value: candidate,
        distance: levenshteinDistance(normalizedInput, normalizedCandidate)
      };
    })
    .filter(match => match.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxSuggestions);

  return matches.map(m => m.value);
}

/**
 * Generates a "Did you mean?" suggestion message
 * @param {string} input - The unknown string
 * @param {string[]} candidates - List of valid strings
 * @param {Object} [options] - Configuration options (passed to findSimilar)
 * @returns {string|null} Suggestion message or null if no good matches
 */
export function suggestDidYouMean(input, candidates, options = {}) {
  const similar = findSimilar(input, candidates, options);

  if (similar.length === 0) {
    return null;
  }

  if (similar.length === 1) {
    return `Did you mean "${similar[0]}"?`;
  }

  const last = similar.pop();
  return `Did you mean "${similar.join('", "')}" or "${last}"?`;
}

/**
 * Suggests operation types similar to an unknown type
 * @param {string} unknownType - The unknown operation type
 * @param {string[]} knownTypes - List of known operation types
 * @returns {string|null} Suggestion message or null
 */
export function suggestOperationType(unknownType, knownTypes) {
  return suggestDidYouMean(unknownType, knownTypes, {
    maxDistance: 4,       // Allow more distance for operation types
    maxSuggestions: 2,
    caseInsensitive: true // Operation types are uppercase by convention
  });
}

/**
 * Suggests parameter names similar to an unknown parameter
 * @param {string} unknownParam - The unknown parameter name
 * @param {string[]} knownParams - List of known parameter names
 * @returns {string|null} Suggestion message or null
 */
export function suggestParameterName(unknownParam, knownParams) {
  return suggestDidYouMean(unknownParam, knownParams, {
    maxDistance: 3,
    maxSuggestions: 2,
    caseInsensitive: false // Parameter names are case-sensitive
  });
}

/**
 * Checks if a string is a likely typo of another (helper for validation)
 * @param {string} input - Input string
 * @param {string} expected - Expected string
 * @param {number} [threshold=2] - Maximum distance to consider a typo
 * @returns {boolean}
 */
export function isLikelyTypo(input, expected, threshold = 2) {
  return levenshteinDistance(input.toUpperCase(), expected.toUpperCase()) <= threshold;
}

export default {
  levenshteinDistance,
  findSimilar,
  suggestDidYouMean,
  suggestOperationType,
  suggestParameterName,
  isLikelyTypo
};
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **New unit test**: `tests/unit/utils/suggestionUtils.test.js`

```javascript
describe('suggestionUtils', () => {
  describe('levenshteinDistance', () => {
    it('should return 0 for identical strings', () => {
      expect(levenshteinDistance('test', 'test')).toBe(0);
    });

    it('should return string length for empty comparison', () => {
      expect(levenshteinDistance('test', '')).toBe(4);
      expect(levenshteinDistance('', 'test')).toBe(4);
    });

    it('should calculate single edit distance', () => {
      expect(levenshteinDistance('test', 'tast')).toBe(1); // substitution
      expect(levenshteinDistance('test', 'tests')).toBe(1); // insertion
      expect(levenshteinDistance('test', 'tes')).toBe(1); // deletion
    });

    it('should calculate multiple edit distance', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    });
  });

  describe('findSimilar', () => {
    const candidates = ['LOCK_GRABBING', 'UNLOCK_GRABBING', 'SET_COMPONENT', 'REMOVE_COMPONENT'];

    it('should find similar strings within max distance', () => {
      const result = findSimilar('LOCK_GRABB', candidates, { maxDistance: 3 });
      expect(result).toContain('LOCK_GRABBING');
    });

    it('should return empty array when no matches within distance', () => {
      const result = findSimilar('COMPLETELY_DIFFERENT', candidates, { maxDistance: 3 });
      expect(result).toHaveLength(0);
    });

    it('should limit results to maxSuggestions', () => {
      const result = findSimilar('GRABBING', candidates, { maxDistance: 10, maxSuggestions: 2 });
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('should sort by distance (closest first)', () => {
      const result = findSimilar('LOCK_GRAB', candidates, { maxDistance: 5 });
      // LOCK_GRABBING should be first (closest)
      expect(result[0]).toBe('LOCK_GRABBING');
    });
  });

  describe('suggestDidYouMean', () => {
    it('should return null when no matches', () => {
      const result = suggestDidYouMean('xyz', ['abc', 'def']);
      expect(result).toBeNull();
    });

    it('should format single suggestion', () => {
      const result = suggestDidYouMean('LOCK_GRABB', ['LOCK_GRABBING'], { maxDistance: 5 });
      expect(result).toBe('Did you mean "LOCK_GRABBING"?');
    });

    it('should format multiple suggestions', () => {
      const result = suggestDidYouMean('GRAB', ['LOCK_GRABBING', 'UNLOCK_GRABBING'], { maxDistance: 10 });
      expect(result).toContain('Did you mean');
      expect(result).toContain('or');
    });
  });

  describe('suggestOperationType', () => {
    const knownTypes = ['LOCK_GRABBING', 'UNLOCK_GRABBING', 'SET_COMPONENT'];

    it('should suggest for typos', () => {
      expect(suggestOperationType('LOCK_GRABB', knownTypes)).toContain('LOCK_GRABBING');
    });

    it('should suggest for prefix typos', () => {
      expect(suggestOperationType('SET_COMP', knownTypes)).toContain('SET_COMPONENT');
    });
  });

  describe('suggestParameterName', () => {
    const knownParams = ['entity_id', 'component_type_id', 'value'];

    it('should suggest for similar parameter names', () => {
      expect(suggestParameterName('entity', knownParams)).toContain('entity_id');
    });

    it('should be case-sensitive', () => {
      // 'ENTITY_ID' should not match 'entity_id' with low threshold
      const result = suggestParameterName('ENTITY_ID', knownParams, { maxDistance: 1 });
      // May or may not match depending on exact distance
    });
  });

  describe('isLikelyTypo', () => {
    it('should detect likely typos', () => {
      expect(isLikelyTypo('LOCK_GRABB', 'LOCK_GRABBING')).toBe(true);
    });

    it('should reject unlikely typos', () => {
      expect(isLikelyTypo('DISPATCH_EVENT', 'LOCK_GRABBING')).toBe(false);
    });
  });
});
```

### Suggestion Quality

1. `LOCK_GRABB` → suggests `LOCK_GRABBING`
2. `SET_COMP` → suggests `SET_COMPONENT`
3. `entity` → suggests `entity_id`
4. `COMPLETELY_WRONG` → returns null (no suggestion)

### Invariants That Must Remain True

1. **No External Dependencies**: Levenshtein implemented locally
2. **Graceful Failure**: Returns null instead of throwing on no matches
3. **Performance Acceptable**: O(n*m) for distance, only used on error paths

---

## Estimated Effort

- **Size**: Small (S)
- **Complexity**: Low - well-known algorithm
- **Risk**: Very Low - new utility module, no integration

## Review Checklist

- [ ] Levenshtein distance correctly implemented
- [ ] findSimilar respects maxDistance and maxSuggestions
- [ ] Suggestions formatted grammatically ("Did you mean X or Y?")
- [ ] Case sensitivity options work correctly
- [ ] Unit tests comprehensive
- [ ] No external dependencies added
- [ ] JSDoc documentation complete
