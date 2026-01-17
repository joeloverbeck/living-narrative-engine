# PROFITBLOSCODIS-007: FitFeasibilityConflict Data Model

**Status: COMPLETED**

## Summary

Create the data model type definitions for fit vs feasibility conflict warnings, including JSDoc typedefs and optional factory/validation helpers.

## Outcome

### Planned vs Actual

The implementation followed the ticket specification exactly. All planned files were created/modified as specified:

| Planned | Actual | Notes |
|---------|--------|-------|
| Create `FitFeasibilityConflict.js` | ✅ Created | Enhanced validation beyond spec |
| Create unit tests | ✅ Created | 93 comprehensive tests |
| Update `index.js` exports | ✅ Updated | All 4 exports added |

### Enhancements Beyond Spec

1. **Additional validation in `createFitFeasibilityConflict`**:
   - Validates `topPrototypes` is an array
   - Validates each `topPrototypes` item has required fields (prototypeId, score)
   - Validates `impossibleClauseIds` is an array
   - Validates `suggestedFixes` is an array
   - Provides detailed error messages with array indices

2. **Defensive copying**: All input arrays are defensively copied to prevent mutation

3. **Comprehensive test coverage**: 93 tests covering:
   - All acceptance criteria from ticket
   - Edge cases (NaN scores, null values, empty strings)
   - Defensive copying verification
   - Invariant guarantees

### Test Results

```
Test Suites: 2 passed, 2 total
Tests:       93 passed, 93 total
```

All acceptance criteria tests pass:
- ✅ Type constant tests (5 tests)
- ✅ Factory function tests (12 tests)
- ✅ Default value tests (3 tests)
- ✅ Immutability tests (6 tests)
- ✅ Validation helper tests (7 tests)
- ✅ PrototypeScore factory tests (10 tests)
- ✅ Additional validation tests (30+ tests)
- ✅ Defensive copying tests (3 tests)
- ✅ Invariant tests (4 tests)

### Commands Verified

```bash
npx eslint src/expressionDiagnostics/models/FitFeasibilityConflict.js  # ✅ Pass
npm run test:unit -- --testPathPatterns="FitFeasibilityConflict"       # ✅ 93 tests pass
```

---

## Original Ticket Content

## Files to Touch

### Create
- `src/expressionDiagnostics/models/FitFeasibilityConflict.js`
- `tests/unit/expressionDiagnostics/models/FitFeasibilityConflict.test.js`

### Modify
- `src/expressionDiagnostics/models/index.js` (add export)

## Out of Scope

- ❌ Conflict detection logic (PROFITBLOSCODIS-005)
- ❌ Any service implementation
- ❌ Report rendering (PROFITBLOSCODIS-008)
- ❌ DI token/registration

## Implementation Details

### FitFeasibilityConflict.js

```javascript
/**
 * @typedef {'fit_vs_clause_impossible' | 'gate_contradiction'} ConflictType
 */

/**
 * @typedef {object} PrototypeScore
 * @property {string} prototypeId
 * @property {number} score
 */

/**
 * @typedef {object} FitFeasibilityConflict
 * @property {ConflictType} type
 * @property {PrototypeScore[]} topPrototypes
 * @property {string[]} impossibleClauseIds
 * @property {string} explanation
 * @property {string[]} suggestedFixes
 */

/**
 * Valid conflict type values
 */
export const CONFLICT_TYPES = Object.freeze([
  'fit_vs_clause_impossible',
  'gate_contradiction',
]);

/**
 * Create a FitFeasibilityConflict object with validation
 * @param {Partial<FitFeasibilityConflict>} props
 * @returns {FitFeasibilityConflict}
 */
export function createFitFeasibilityConflict(props) {
  // Validate required fields
  if (!props.type || !CONFLICT_TYPES.includes(props.type)) {
    throw new Error(`type must be one of: ${CONFLICT_TYPES.join(', ')}`);
  }
  if (!props.explanation || typeof props.explanation !== 'string') {
    throw new Error('explanation is required and must be a string');
  }

  return Object.freeze({
    type: props.type,
    topPrototypes: Object.freeze(
      (props.topPrototypes ?? []).map(p => Object.freeze({ ...p }))
    ),
    impossibleClauseIds: Object.freeze([...(props.impossibleClauseIds ?? [])]),
    explanation: props.explanation,
    suggestedFixes: Object.freeze([...(props.suggestedFixes ?? [])]),
  });
}

/**
 * Validate a conflict type value
 * @param {string} type
 * @returns {boolean}
 */
export function isValidConflictType(type) {
  return CONFLICT_TYPES.includes(type);
}

/**
 * Create a PrototypeScore object
 * @param {string} prototypeId
 * @param {number} score
 * @returns {PrototypeScore}
 */
export function createPrototypeScore(prototypeId, score) {
  if (!prototypeId || typeof prototypeId !== 'string') {
    throw new Error('prototypeId is required and must be a string');
  }
  if (typeof score !== 'number' || Number.isNaN(score)) {
    throw new Error('score is required and must be a number');
  }
  return Object.freeze({ prototypeId, score });
}
```

## Acceptance Criteria

### Tests That Must Pass

1. **Type constant tests**:
   - `CONFLICT_TYPES` array exported
   - Contains exactly: 'fit_vs_clause_impossible', 'gate_contradiction'
   - Array is frozen

2. **Factory function tests**:
   - `createFitFeasibilityConflict()` exported
   - Throws on missing type
   - Throws on invalid type
   - Throws on missing explanation
   - Returns frozen object
   - Applies defaults for optional arrays

3. **Default value tests**:
   - `topPrototypes` defaults to empty array
   - `impossibleClauseIds` defaults to empty array
   - `suggestedFixes` defaults to empty array

4. **Immutability tests**:
   - Returned object is frozen
   - `topPrototypes` array is frozen
   - Each prototype score object is frozen
   - `impossibleClauseIds` array is frozen
   - `suggestedFixes` array is frozen

5. **Validation helper tests**:
   - `isValidConflictType('fit_vs_clause_impossible')` → true
   - `isValidConflictType('gate_contradiction')` → true
   - `isValidConflictType('invalid')` → false

6. **PrototypeScore factory tests**:
   - `createPrototypeScore('flow', 0.85)` succeeds
   - Throws on missing prototypeId
   - Throws on non-number score
   - Returns frozen object

### Commands That Must Succeed

```bash
npm run typecheck
npx eslint src/expressionDiagnostics/models/FitFeasibilityConflict.js
npm run test:unit -- --testPathPattern="FitFeasibilityConflict"
```

## Invariants That Must Remain True

1. `type` must be one of the 2 valid conflict types
2. Factory returns frozen object (deeply immutable)
3. Required fields: type, explanation
4. `topPrototypes` is always an array (never undefined)
5. `impossibleClauseIds` is always an array (never undefined)
6. `suggestedFixes` is always an array (never undefined)

## Dependencies

- None (can be developed in parallel)

## Blocked By

- None

## Blocks

- PROFITBLOSCODIS-008 (ConflictWarningSectionGenerator)
