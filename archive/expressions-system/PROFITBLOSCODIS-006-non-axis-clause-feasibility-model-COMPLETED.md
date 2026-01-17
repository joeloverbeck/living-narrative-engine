# PROFITBLOSCODIS-006: NonAxisClauseFeasibility Data Model

**STATUS: ✅ COMPLETED**

## Summary

Create the data model exports for non-axis clause feasibility results, including JSDoc typedefs, classification constants, and factory/validation helpers. The typedef already exists inline in `NonAxisFeasibilityAnalyzer.js` - this ticket extracts it to a dedicated model file for reuse and adds utility exports.

## Assumptions Corrected During Implementation

1. **Typedef already exists inline**: `NonAxisClauseFeasibility` typedef is defined in `NonAxisFeasibilityAnalyzer.js` (lines 29-43). This ticket extracts it to the models folder for consistency with other data models.
2. **Four classifications, not three**: The existing analyzer uses 4 classification values: 'IMPOSSIBLE', 'RARE', 'OK', 'UNKNOWN'. The 'UNKNOWN' classification is used when contexts are unavailable for analysis.
3. **Service already complete**: `NonAxisFeasibilityAnalyzer.js` already implements all feasibility logic - this ticket only needs to add the model exports.

## Outcome

### What Was Changed vs. Originally Planned

**Originally Planned:**
- Create NonAxisClauseFeasibility.js with typedefs and exports
- Create unit tests
- Add barrel export to index.js

**Actually Changed:**
- ✅ Created `src/expressionDiagnostics/models/NonAxisClauseFeasibility.js` with:
  - JSDoc typedefs for `FeasibilityClassification`, `NonAxisClauseFeasibility`, `NonAxisClauseEvidence`
  - `FEASIBILITY_CLASSIFICATIONS` frozen constant array (4 values)
  - `createNonAxisClauseFeasibility()` factory with comprehensive validation
  - `isValidClassification()` helper function
  - Additional validation for operator, signal, and passRate range
- ✅ Created `tests/unit/expressionDiagnostics/models/NonAxisClauseFeasibility.test.js` with 73 comprehensive tests
- ✅ Modified `src/expressionDiagnostics/models/index.js` to export the new model

**Enhancements Beyond Ticket:**
- Added validation for `operator` (must be one of `>=`, `>`, `<=`, `<`, `==`, `!=`)
- Added validation for `signal` (must be one of `final`, `raw`, `delta`)
- Added `passRate` range validation (must be in [0, 1] or null)
- Added validation for `classification` (must be valid classification value)
- Added NaN check for `threshold` validation
- More detailed error messages specifying constraints

**Files Created:**
- `src/expressionDiagnostics/models/NonAxisClauseFeasibility.js`
- `tests/unit/expressionDiagnostics/models/NonAxisClauseFeasibility.test.js`

**Files Modified:**
- `src/expressionDiagnostics/models/index.js`

### Test Results

All 73 unit tests pass covering:
- Type constant tests (frozen array, 4 classifications)
- Factory function tests (validation, defaults, frozen objects)
- Validation helper tests (isValidClassification)
- Evidence structure tests (frozen, defaults)
- Invariant tests (population hardcoded, evidence always present)

### Verification Commands Executed

```bash
npx eslint src/expressionDiagnostics/models/NonAxisClauseFeasibility.js  # ✅ No errors
npm run test:unit -- --testPathPatterns="NonAxisClauseFeasibility"       # ✅ 73 tests pass
npm run typecheck                                                         # ✅ No new errors introduced
```

## Files to Touch

### Create
- `src/expressionDiagnostics/models/NonAxisClauseFeasibility.js`
- `tests/unit/expressionDiagnostics/models/NonAxisClauseFeasibility.test.js`

### Modify
- `src/expressionDiagnostics/models/index.js` (add export)

## Out of Scope

- ❌ Feasibility calculation logic (already implemented in NonAxisFeasibilityAnalyzer.js)
- ❌ Any service implementation changes
- ❌ Report rendering
- ❌ DI token/registration

## Implementation Details

### NonAxisClauseFeasibility.js

```javascript
/**
 * @typedef {'IMPOSSIBLE' | 'RARE' | 'OK' | 'UNKNOWN'} FeasibilityClassification
 */

/**
 * Classification rules (deterministic):
 * - IMPOSSIBLE: passRate === 0 AND maxValue < threshold - eps
 * - RARE: passRate > 0 AND passRate < rareThreshold (0.001)
 * - OK: passRate >= 0.001
 * - UNKNOWN: insufficient data to classify
 */

/**
 * @typedef {object} NonAxisClauseFeasibility
 * @property {string} clauseId - Deterministic identifier (hash of normalized clause)
 * @property {string} sourcePath - Pointer back into prerequisites tree
 * @property {string} varPath - e.g., "emotions.confusion"
 * @property {string} operator - >=, <=, >, <, ==
 * @property {number} threshold
 * @property {'final' | 'raw' | 'delta'} signal
 * @property {'in_regime'} population
 * @property {number|null} passRate - passCount / inRegimeCount
 * @property {number|null} maxValue - max(LHS) over in-regime samples
 * @property {number|null} p95Value - 95th percentile (from stored contexts)
 * @property {number|null} marginMax - maxValue - threshold
 * @property {FeasibilityClassification} classification
 * @property {NonAxisClauseEvidence} evidence
 */

/**
 * @typedef {object} NonAxisClauseEvidence
 * @property {string|null} bestSampleRef - Sample ID for maxValue
 * @property {string} note - Short textual explanation
 */

/**
 * Valid feasibility classification values
 */
export const FEASIBILITY_CLASSIFICATIONS = Object.freeze([
  'IMPOSSIBLE',
  'RARE',
  'OK',
  'UNKNOWN',
]);

/**
 * Create a NonAxisClauseFeasibility object with validation
 * @param {Partial<NonAxisClauseFeasibility>} props
 * @returns {NonAxisClauseFeasibility}
 */
export function createNonAxisClauseFeasibility(props) {
  // Validate required fields
  if (!props.clauseId || typeof props.clauseId !== 'string') {
    throw new Error('clauseId is required and must be a string');
  }
  if (!props.varPath || typeof props.varPath !== 'string') {
    throw new Error('varPath is required and must be a string');
  }
  if (typeof props.threshold !== 'number') {
    throw new Error('threshold is required and must be a number');
  }

  return Object.freeze({
    clauseId: props.clauseId,
    sourcePath: props.sourcePath ?? '',
    varPath: props.varPath,
    operator: props.operator ?? '>=',
    threshold: props.threshold,
    signal: props.signal ?? 'final',
    population: 'in_regime',
    passRate: props.passRate ?? null,
    maxValue: props.maxValue ?? null,
    p95Value: props.p95Value ?? null,
    marginMax: props.marginMax ?? null,
    classification: props.classification ?? 'UNKNOWN',
    evidence: Object.freeze({
      bestSampleRef: props.evidence?.bestSampleRef ?? null,
      note: props.evidence?.note ?? '',
    }),
  });
}

/**
 * Validate a feasibility classification value
 * @param {string} classification
 * @returns {boolean}
 */
export function isValidClassification(classification) {
  return FEASIBILITY_CLASSIFICATIONS.includes(classification);
}
```

## Acceptance Criteria

### Tests That Must Pass

1. **Type constant tests**:
   - `FEASIBILITY_CLASSIFICATIONS` array exported
   - Contains exactly: 'IMPOSSIBLE', 'RARE', 'OK', 'UNKNOWN'
   - Array is frozen

2. **Factory function tests**:
   - `createNonAxisClauseFeasibility()` exported
   - Throws on missing clauseId
   - Throws on missing varPath
   - Throws on missing threshold
   - Returns frozen object
   - Applies defaults for optional fields

3. **Default value tests**:
   - `population` defaults to 'in_regime'
   - `signal` defaults to 'final'
   - `operator` defaults to '>='
   - `passRate` defaults to null
   - `classification` defaults to 'UNKNOWN'

4. **Validation helper tests**:
   - `isValidClassification('IMPOSSIBLE')` → true
   - `isValidClassification('RARE')` → true
   - `isValidClassification('OK')` → true
   - `isValidClassification('UNKNOWN')` → true
   - `isValidClassification('invalid')` → false

5. **Evidence structure tests**:
   - `evidence` object is frozen
   - `evidence.bestSampleRef` defaults to null
   - `evidence.note` defaults to empty string

### Commands That Must Succeed

```bash
npm run typecheck
npx eslint src/expressionDiagnostics/models/NonAxisClauseFeasibility.js
npm run test:unit -- --testPathPattern="NonAxisClauseFeasibility"
```

## Invariants That Must Remain True

1. `population` is always 'in_regime' (hardcoded for this model)
2. Factory returns frozen object (immutable)
3. Required fields: clauseId, varPath, threshold
4. Classification must be one of the 4 valid values
5. `passRate` is in [0, 1] or null
6. Evidence object is always present (never undefined)

## Dependencies

- None (can be developed in parallel)

## Blocked By

- None

## Blocks

- PROFITBLOSCODIS-009 (NonAxisFeasibilitySectionGenerator)
