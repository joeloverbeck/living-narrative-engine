# PROREDANAV2-008: Create GateImplicationEvaluator Service (B2) - COMPLETED

## Description

Create a service that determines deterministic nesting via interval subset checking. This enables detecting when one prototype's gates are strictly more restrictive than another's.

## Files to Touch

### Create
- `src/expressionDiagnostics/services/prototypeOverlap/GateImplicationEvaluator.js`
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/gateImplicationEvaluator.test.js`

## Out of Scope

- Integration with OverlapClassifier (PROREDANAV2-010)
- DI registration (PROREDANAV2-013)
- GateBandingSuggestionBuilder (PROREDANAV2-015)
- Integration with orchestrator
- Using results in recommendations

## Changes Required

### 1. Create GateImplicationEvaluator Class

```javascript
/**
 * Determines if one set of gate constraints implies another.
 * A implies B iff for every axis: A.lower >= B.lower AND A.upper <= B.upper
 * (A's interval is a subset of B's interval)
 */
class GateImplicationEvaluator {
  #logger;

  constructor({ logger }) {
    this.#logger = logger;
  }

  evaluate(intervalsA, intervalsB) {
    // Returns implication result
  }
}
```

### 2. Implement Subset Checking Logic

```javascript
// A implies B means: whenever A's gates pass, B's gates also pass
// This happens when A's interval is a SUBSET of B's interval
// (A is more restrictive)

function isSubset(intervalA, intervalB) {
  // A's lower bound must be >= B's lower bound (A starts no earlier)
  // A's upper bound must be <= B's upper bound (A ends no later)
  return intervalA.lower >= intervalB.lower && intervalA.upper <= intervalB.upper;
}
```

### 3. Evaluate All Axes

```javascript
evaluate(intervalsA, intervalsB) {
  let A_implies_B = true;
  let B_implies_A = true;
  const counterExampleAxes = [];
  const evidence = [];

  // Get all unique axes from both
  const allAxes = new Set([...intervalsA.keys(), ...intervalsB.keys()]);

  for (const axis of allAxes) {
    const intA = intervalsA.get(axis) || { lower: -Infinity, upper: +Infinity };
    const intB = intervalsB.get(axis) || { lower: -Infinity, upper: +Infinity };

    const A_subset_B = isSubset(intA, intB);
    const B_subset_A = isSubset(intB, intA);

    if (!A_subset_B) A_implies_B = false;
    if (!B_subset_A) B_implies_A = false;

    const relation = getRelation(intA, intB); // 'wider' | 'narrower' | 'disjoint' | 'equal'

    evidence.push({ axis, A: intA, B: intB, relation });

    if (!A_subset_B && !B_subset_A) {
      counterExampleAxes.push(axis);
    }
  }

  return { A_implies_B, B_implies_A, counterExampleAxes, evidence };
}
```

### 4. Determine Relation Type

```javascript
function getRelation(intA, intB) {
  if (intA.lower === intB.lower && intA.upper === intB.upper) return 'equal';
  if (intA.lower >= intB.lower && intA.upper <= intB.upper) return 'narrower'; // A is subset
  if (intB.lower >= intA.lower && intB.upper <= intA.upper) return 'wider'; // B is subset
  if (intA.upper < intB.lower || intB.upper < intA.lower) return 'disjoint';
  return 'overlapping'; // partial overlap
}
```

### 5. Return Structure

```javascript
{
  A_implies_B: boolean,
  B_implies_A: boolean,
  counterExampleAxes: string[],  // axes where implication fails in both directions
  evidence: Array<{
    axis: string,
    A: { lower, upper },
    B: { lower, upper },
    relation: 'wider' | 'narrower' | 'disjoint' | 'equal' | 'overlapping'
  }>
}
```

## Acceptance Criteria

### Tests That Must Pass

Using actual prototype gate definitions:

1. **frustration implies confusion**: frustration has stricter gates, so frustration_implies_confusion = true
2. **contentment implies relief**: Verify expected relationship based on actual gates
3. **humiliation implies embarrassment**: humiliation has stricter gates
4. **No implication for disjoint**: Two prototypes with non-overlapping gates → both implications false
5. **Mutual implication for equal**: Identical intervals → A_implies_B AND B_implies_A both true
6. **counterExampleAxes populated**: When implication fails, identify which axes caused failure
7. **Evidence array complete**: Evidence entry for every axis in either prototype
8. **Relation types correct**:
   - 'equal' when bounds match exactly
   - 'narrower' when A is proper subset
   - 'wider' when B is proper subset
   - 'disjoint' when no overlap
   - 'overlapping' when partial overlap

### Boundary Tests

9. **One-sided constraint**: A has `arousal >= 0.5`, B has no arousal constraint → A_implies_B = true
10. **Unsatisfiable interval**: When input has unsatisfiable interval, implication logic handles gracefully
11. **Empty intervals**: Empty inputs → mutual implication (both true)

### Invariants That Must Remain True

- A_implies_B and B_implies_A are always boolean (never undefined)
- evidence array always present (may be empty)
- counterExampleAxes always an array (may be empty)
- Service is stateless
- Does not modify input interval Maps

## Estimated Size

~150 lines of code + ~250 lines of tests

## Dependencies

- PROREDANAV2-007 (GateConstraintExtractor produces input format)

## Verification Commands

```bash
# Run unit tests
npm run test:unit -- --testPathPattern=gateImplicationEvaluator

# Lint
npx eslint src/expressionDiagnostics/services/prototypeOverlap/GateImplicationEvaluator.js

# Typecheck
npm run typecheck
```

---

## Outcome

### Implementation Summary

**Completed**: 2026-01-20

**Files Created**:
- `src/expressionDiagnostics/services/prototypeOverlap/GateImplicationEvaluator.js` (~320 lines)
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/gateImplicationEvaluator.test.js` (~400 lines)

### Key Implementation Details

1. **Interval Format Correction**: Used actual codebase format `{ lower: number|null, upper: number|null, unsatisfiable: boolean }` instead of ticket's `Infinity` notation. `null` represents unbounded (-∞ or +∞).

2. **Unsatisfiable Interval Handling**: Added vacuous truth handling - empty sets (unsatisfiable intervals) imply anything:
   - A unsatisfiable → A_implies_B = true (vacuously)
   - B unsatisfiable → B_implies_A = true (vacuously)
   - Both unsatisfiable → mutual implication, relation = 'equal'

3. **Missing Axis Handling**: Missing axis in either map treated as fully unconstrained `{ lower: null, upper: null, unsatisfiable: false }`.

4. **DI Token**: Token `IGateImplicationEvaluator` already exists in `tokens-diagnostics.js` (line 103). DI registration deferred to PROREDANAV2-013.

### Test Results

- **41 tests passing**
- **All 303 tests in prototypeOverlap directory pass** (no regressions)
- Test coverage includes:
  - Constructor validation (3 tests)
  - Basic implication (4 tests)
  - Disjoint gates (2 tests)
  - Equal intervals (2 tests)
  - counterExampleAxes (2 tests)
  - Evidence array (2 tests)
  - Relation types (5 tests)
  - One-sided constraints (4 tests)
  - Unsatisfiable intervals (4 tests)
  - Mixed axes (2 tests)
  - Null bounds handling (3 tests)
  - Edge cases (6 tests)
  - Logging (2 tests)

### Verification

```bash
# All verification commands pass:
npx jest tests/unit/expressionDiagnostics/services/prototypeOverlap/gateImplicationEvaluator.test.js  # 41 passed
npx eslint src/expressionDiagnostics/services/prototypeOverlap/GateImplicationEvaluator.js  # Clean
npx eslint tests/unit/expressionDiagnostics/services/prototypeOverlap/gateImplicationEvaluator.test.js  # Clean
```

### Next Steps

- PROREDANAV2-010: Integration with OverlapClassifier
- PROREDANAV2-013: DI registration
- PROREDANAV2-015: GateBandingSuggestionBuilder
