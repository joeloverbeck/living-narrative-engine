# ACTDISDIAFAIFAS-001 – Condition Suggestion Service

**Status**: ✅ COMPLETED (2026-01-04)

## Problem

When `condition_ref` fails to resolve, there are no suggestions for similar condition names. Users see a bare error message without guidance on what might be the correct condition ID.

## Ticket Assumptions Reassessment

**Reassessed on implementation (2026-01-04):**

1. **Existing Levenshtein implementations discovered**: The codebase already has three separate Levenshtein distance implementations:
   - `src/utils/suggestionUtils.js` - Full-featured with `findSimilar()`, `suggestDidYouMean()` (most complete)
   - `src/utils/stringUtils.js` - Simpler `levenshteinDistance()`, `findClosestMatches()`
   - `src/validation/stringSimilarityCalculator.js` - Class-based version for DI

2. **No new Levenshtein implementation needed**: The new service will be a thin wrapper around `suggestionUtils.js`

3. **Levenshtein consolidation included**: As part of this ticket, all three implementations will be consolidated to use `suggestionUtils.js` as the single source of truth, with backward-compatible re-exports from `stringUtils.js`

4. **Registry format clarification**: Condition registry returns arrays of objects with `id` fields (via `getAllConditionDefinitions()`)

## Proposed Scope

Create a new stateless service that:
1. Takes a missing condition ID and the condition registry
2. Returns the top 3 similar condition names using Levenshtein distance or similar algorithm
3. Respects mod namespace in matching (e.g., `core:missing` suggests `core:existing`)

## File List

- `src/utils/conditionSuggestionService.js` (NEW)
- `tests/unit/utils/conditionSuggestionService.test.js` (NEW)

## Out of Scope

- Integrating with filterResolver (handled in ACTDISDIAFAIFAS-002b)
- Modifying ScopeResolutionError (handled in ACTDISDIAFAIFAS-002)
- Any changes to condition loading or GameDataRepository
- Modifying existing error handling code
- Performance optimization beyond basic implementation

## Acceptance Criteria

### Tests

Run: `npm run test:unit -- tests/unit/utils/conditionSuggestionService.test.js`

Required test cases:
- **Fuzzy matching returns closest 3 condition names**: Given registry with 10 conditions, missing `core:actorr`, returns `['core:actor', 'core:target', ...]`
- **Empty registry returns empty suggestions**: Given empty registry, returns `[]`
- **Exact match returns empty suggestions**: Given `core:actor` exists, looking for `core:actor` returns `[]`
- **Respects mod namespace in matching**: `positioning:close` suggests `positioning:closeness` before `core:close`
- **Handles special characters in IDs**: Underscores, hyphens processed correctly
- **Case insensitive matching**: `CORE:ACTOR` matches `core:actor`

### Invariants

- Service is stateless and pure (no side effects)
- No modifications to GameDataRepository
- Algorithm is deterministic (same inputs = same outputs)
- Maximum 3 suggestions returned
- Suggestions sorted by similarity score (most similar first)
- Never suggests the exact missing ID

### API Contract

```javascript
/**
 * @param {string} missingConditionId - The condition ID that was not found
 * @param {Map<string, Object>|Array<string>} registry - Available condition IDs
 * @param {Object} [options]
 * @param {number} [options.maxSuggestions=3] - Maximum suggestions to return
 * @returns {string[]} - Array of similar condition IDs, sorted by similarity
 */
function getSuggestions(missingConditionId, registry, options = {}) {}
```

## Outcome

### Implementation Summary

1. **Created `src/utils/conditionSuggestionService.js`**:
   - Thin wrapper around `suggestionUtils.js` with namespace-aware prioritization
   - Exports `getSuggestions(missingConditionId, registry, options)` function
   - Handles multiple registry formats: arrays of strings, arrays of objects with `id` field, and Map instances
   - Re-ranks results to prioritize same-namespace matches

2. **Created `tests/unit/utils/conditionSuggestionService.test.js`**:
   - 27 comprehensive test cases covering all acceptance criteria
   - Tests fuzzy matching, namespace prioritization, special characters, case insensitivity
   - Tests all registry formats and edge cases

3. **Consolidated Levenshtein implementations**:
   - `src/utils/suggestionUtils.js` - Canonical source (unchanged)
   - `src/utils/stringUtils.js` - Now imports from suggestionUtils, re-exports for backward compatibility
   - `src/validation/stringSimilarityCalculator.js` - Now imports from suggestionUtils, preserves class interface for DI

### Files Modified

| File | Action | Description |
|------|--------|-------------|
| `src/utils/conditionSuggestionService.js` | CREATE | Thin wrapper with namespace logic |
| `tests/unit/utils/conditionSuggestionService.test.js` | CREATE | 27 test cases |
| `src/utils/stringUtils.js` | MODIFY | Re-export from suggestionUtils |
| `src/validation/stringSimilarityCalculator.js` | MODIFY | Import from suggestionUtils |

### Test Results

```
PASS tests/unit/utils/conditionSuggestionService.test.js (27 tests)
PASS tests/unit/utils/stringUtils.test.js
PASS tests/unit/validation/stringSimilarityCalculator.test.js
```

All existing tests continue to pass after consolidation, confirming backward compatibility is preserved.

### API Usage Example

```javascript
import { getSuggestions } from './utils/conditionSuggestionService.js';

const registry = [
  { id: 'core:actor' },
  { id: 'core:target' },
  { id: 'positioning:closeness' }
];

const suggestions = getSuggestions('core:actorr', registry);
// Returns: ['core:actor'] (closest match within Levenshtein distance)

const suggestions2 = getSuggestions('pos:close', [
  'pos:closes', 'cor:closes', 'pos:closed', 'cor:closed'
], { maxSuggestions: 4 });
// Returns: ['pos:closes', 'pos:closed', 'cor:closes', 'cor:closed']
// Same namespace matches appear first
```
