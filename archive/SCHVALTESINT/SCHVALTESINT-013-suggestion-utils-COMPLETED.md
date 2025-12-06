# SCHVALTESINT-013: Create suggestionUtils.js for "Did You Mean?" Matching

**Epic**: SCHVALTESINT - Schema Validation Test Integration
**Priority**: LOW
**Phase**: 5 - Enhanced Error Messages
**Dependencies**: None (can proceed in parallel)
**Blocks**: SCHVALTESINT-014
**Status**: ✅ COMPLETED

---

## Objective

Create `suggestionUtils.js` that provides fuzzy matching and "Did you mean?" suggestions for unknown operation types and parameter names using Levenshtein distance.

## Files Created

| File                                       | Purpose                                  |
| ------------------------------------------ | ---------------------------------------- |
| `src/utils/suggestionUtils.js`             | Fuzzy matching and suggestion generation |
| `tests/unit/utils/suggestionUtils.test.js` | Unit tests (36 tests)                    |

### Files Read (for reference)

| File                              | Purpose                                  |
| --------------------------------- | ---------------------------------------- |
| `src/utils/preValidationUtils.js` | KNOWN_OPERATION_TYPES to suggest against |

---

## Implementation Details

### Functions Implemented

1. **`levenshteinDistance(a, b)`** - Classic dynamic programming Levenshtein distance
2. **`findSimilar(input, candidates, options)`** - Find similar strings within max distance
3. **`suggestDidYouMean(input, candidates, options)`** - Generate "Did you mean?" messages
4. **`suggestOperationType(unknownType, knownTypes)`** - Operation type suggestions (maxDistance: 5)
5. **`suggestParameterName(unknownParam, knownParams)`** - Parameter name suggestions (case-sensitive)
6. **`isLikelyTypo(input, expected, threshold)`** - Check if input is likely typo of expected

### Edge Cases Handled (from spec 4.2)

| Input        | Expected Suggestion           | Status   |
| ------------ | ----------------------------- | -------- |
| `LOCK_GRABB` | "Did you mean LOCK_GRABBING?" | ✅ Works |
| `SET_COMP`   | "Did you mean SET_COMPONENT?" | ✅ Works |
| `entity`     | "Did you mean entity_id?"     | ✅ Works |

---

## Acceptance Criteria

### Tests That Must Pass

- ✅ 36 unit tests passing in `tests/unit/utils/suggestionUtils.test.js`
- ✅ ESLint passes with no errors
- ✅ All edge cases from spec 4.2 work correctly

### Invariants That Remain True

1. ✅ **No External Dependencies**: Levenshtein implemented locally
2. ✅ **Graceful Failure**: Returns null instead of throwing on no matches
3. ✅ **Performance Acceptable**: O(n\*m) for distance, only used on error paths

---

## Review Checklist

- [x] Levenshtein distance correctly implemented
- [x] findSimilar respects maxDistance and maxSuggestions
- [x] Suggestions formatted grammatically ("Did you mean X or Y?")
- [x] Case sensitivity options work correctly
- [x] Unit tests comprehensive (36 tests)
- [x] No external dependencies added
- [x] JSDoc documentation complete

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Originally Planned:**

- Create `suggestionUtils.js` with Levenshtein-based fuzzy matching
- Create unit tests

**Actually Changed:**

- Created `src/utils/suggestionUtils.js` with 6 exported functions
- Created `tests/unit/utils/suggestionUtils.test.js` with 36 comprehensive tests

**Minor Adjustments:**

1. Increased `suggestOperationType` maxDistance from 4 to 5 to support "SET_COMP" → "SET_COMPONENT" (distance 5)
2. Added edge case handling for empty/null inputs
3. Ensured no mutation of findSimilar results in suggestDidYouMean

**API Unchanged:** All functions match the ticket specification exactly.
