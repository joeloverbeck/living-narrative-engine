# MONCARSIMARCREF-005: Violation Analysis Integration Tests

## Summary

Create integration tests that pin down the current behavior of violation analysis outputs from `MonteCarloSimulator.js` (nearest-miss summaries, clause failure ceiling data, and leaf-level violation magnitudes). These tests serve as safety nets before extracting the `ViolationEstimator` module in MONCARSIMARCREF-011.

## Priority: High | Effort: Medium

## Status

Completed.

## Rationale

The violation analysis subsystem handles failure estimation, failed leaf collection, ceiling data extraction, and violation summaries surfaced via `simulate()` results. This information is critical for the diagnostics UI to show users why expressions fail and how far off they are from success. This is Priority 6 for extraction as "isolated analysis."

## Dependencies

- **MONCARSIMARCREF-001** (Context building tests)
- **MONCARSIMARCREF-002** (Expression evaluation tests - violation analysis uses evaluation results)

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/integration/expression-diagnostics/monteCarloViolationAnalysis.integration.test.js` | **Create** |
| `tests/fixtures/expressionDiagnostics/violationAnalysisFixtures.js` | **Create** |

## Out of Scope

- **DO NOT** modify `MonteCarloSimulator.js` or any production code
- **DO NOT** modify existing unit tests
- **DO NOT** create tests for context building (that's MONCARSIMARCREF-001)
- **DO NOT** create tests for expression evaluation (that's MONCARSIMARCREF-002)
- **DO NOT** create tests for gate evaluation (that's MONCARSIMARCREF-003)
- **DO NOT** create tests for prototype handling (that's MONCARSIMARCREF-004)
- **DO NOT** test sensitivity analysis methods
- **DO NOT** refactor or extract any modules yet

## Implementation Details

### Methods to Pin Down (Observed Behavior)

The following private methods are planned for extraction to `ViolationEstimator`. Tests must capture their **observable behavior via `simulate()` outputs** (not direct method calls):

1. `#estimateViolation()` - Main violation estimation
2. `#estimateLeafViolation()` - Leaf-level violation estimation (>=, <=, <, > with strict-operator offset)
3. `#collectFailedLeaves()` - Recursive failed leaf collection
4. `#getFailedLeavesSummary()` - Failed leaves summary generation (capped at 5)
5. `#extractViolationInfo()` - Violation information extraction (absolute delta)
6. `#countFailedClauses()` - Failed clause counting (counts failed leaves, no AND/OR short-circuit)
7. `#countFailedLeavesInTree()` - Tree-based failure counting (counts all failing leaves)
8. `#extractCeilingData()` - Ceiling value extraction (worst leaf by gap)
9. `#safeEvalOperand()` - Safe operand evaluation (null on malformed/unknown)

**Important observed constraints**:
- `#estimateViolation()` only handles `>=` and returns `0.1` for unknown patterns; it is currently unused because hierarchical trees are always built for clauses.
- `#estimateLeafViolation()` handles `>=`, `<=`, `<`, `>`; strict inequalities add `0.01` to the gap when failing.
- `#extractViolationInfo()` uses absolute delta and does **not** include the operator in the summary.
- `#getFailedLeavesSummary()` returns `{ description, actual, threshold, violation }` entries and caps the list to 5.
- Non-hierarchical clauses (if ever present) report `actual/threshold/violation` as `null` in failed-leaf summaries.

### Test Structure (Updated Focus)

```javascript
/**
 * @file Integration tests pinning ViolationEstimator behavior before refactoring
 * @see reports/monte-carlo-simulator-architecture-refactoring.md
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
// ... imports

describe('MonteCarloSimulator - Violation Analysis Behavior', () => {
  let simulator;
  let container;

  beforeAll(async () => {
    // Initialize DI container with seeded random state
  });

  afterAll(() => {
    // Cleanup
  });

  describe('Leaf Violation Estimation', () => {
    it('estimates >= violations via leaf tracking', async () => {
      // Pin: gap = threshold - actual
    });

    it('estimates <= violations via leaf tracking', async () => {
      // Pin: gap = actual - threshold
    });

    it('adds strict inequality offset for < and > failures', async () => {
      // Pin: gap + 0.01 for strict operators
    });
  });

  describe('Failed Leaves Summary', () => {
    it('includes description + actual/threshold/violation for leaf failures', async () => {
      // Pin: extracted values
    });

    it('caps failed leaves summary at 5 entries', async () => {
      // Pin: truncation behavior
    });

    it('returns nulls when operands cannot be evaluated', async () => {
      // Pin: safe operand evaluation
    });
  });

  describe('Failed Leaf Counting', () => {
    it('counts failed leaves in a tree without AND/OR short-circuiting', async () => {
      // Pin: count of failed leaves
    });
  });

  describe('Ceiling Data Extraction', () => {
    it('extracts ceiling data from leaf clauses', async () => {
      // Pin: ceilingGap/maxObserved/thresholdValue
    });

    it('chooses the worst ceiling gap from compound clauses', async () => {
      // Pin: worst leaf selection
    });
  });

  describe('Passing Clauses', () => {
    it('returns null violation percentiles when no failures occur', async () => {
      // Pin: violationP50/violationP90 null
    });
  });
});
```

### Test Fixtures (Adjusted for Raw Mood Axes)

```javascript
// violationAnalysisFixtures.js

export const simpleViolationExpression = {
  id: 'test:simple_violation',
  description: 'Expression likely to fail on simple threshold',
  prerequisites: [
    { logic: { '>=': [{ var: 'moodAxes.valence' }, 70] } }
  ]
};

export const andViolationExpression = {
  id: 'test:and_violation',
  description: 'AND expression with multiple potential failures',
  prerequisites: [
    {
      logic: {
        and: [
          { '>=': [{ var: 'moodAxes.valence' }, 70] },
          { '>=': [{ var: 'moodAxes.arousal' }, 30] },
          { '>=': [{ var: 'moodAxes.threat' }, 40] }
        ]
      }
    }
  ]
};

export const orViolationExpression = {
  id: 'test:or_violation',
  description: 'OR expression where one branch might pass',
  prerequisites: [
    {
      logic: {
        or: [
          { '>=': [{ var: 'moodAxes.valence' }, 70] },
          { '>=': [{ var: 'moodAxes.arousal' }, 30] }
        ]
      }
    }
  ]
};

export const nestedViolationExpression = {
  id: 'test:nested_violation',
  description: 'Nested expression with violations at multiple levels',
  prerequisites: [
    {
      logic: {
        and: [
          { '>=': [{ var: 'moodAxes.valence' }, 70] },
          {
            or: [
              { '>=': [{ var: 'moodAxes.arousal' }, 30] },
              { '<=': [{ var: 'moodAxes.threat' }, 20] }
            ]
          }
        ]
      }
    }
  ]
};

export const alwaysPassExpression = {
  id: 'test:always_pass_violation',
  description: 'Expression that should always pass',
  prerequisites: [
    { logic: { '>=': [{ var: 'moodAxes.valence' }, -100] } }
  ]
};

export const ceilingViolationExpression = {
  id: 'test:ceiling_violation',
  description: 'Expression for ceiling gap extraction',
  prerequisites: [
    { logic: { '>=': [{ var: 'moodAxes.valence' }, 80] } }
  ]
};

export const multiOperatorExpression = {
  id: 'test:multi_operator',
  description: 'Expression using multiple comparison operators',
  prerequisites: [
    {
      logic: {
        and: [
          { '>=': [{ var: 'moodAxes.valence' }, 70] },
          { '>': [{ var: 'moodAxes.arousal' }, 30] },
          { '<=': [{ var: 'moodAxes.threat' }, 20] },
          { '<': [{ var: 'moodAxes.affiliation' }, 40] }
        ]
      }
    }
  ]
};

// Expected violation result structure
export const expectedViolationStructure = {
  failedLeaves: [
    {
      description: 'string',
      actual: 'number|null',
      threshold: 'number|null',
      violation: 'number|null'
    }
  ],
  failedLeafCount: 'integer >= 0'
};
```

## Acceptance Criteria

### Tests That Must Pass

```bash
# Run the new integration test file
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloViolationAnalysis.integration.test.js --verbose --coverage=false

# Optional: full regression suite
npm run test:ci
```

### Specific Test Requirements

1. **Leaf Violation Tests** (>=, <=, and strict < or >).
2. **Failed Leaves Summary Tests** (value extraction, cap to 5, null handling).
3. **Failed Leaf Counting** (counts failing leaves, no short-circuit).
4. **Ceiling Tests** (leaf data + worst-gap selection).
5. **Passing Clauses** (no violation percentiles when all pass).

### Invariants That Must Remain True

1. **No production code changes** - Only test files created
2. **All existing tests pass** - `npm run test:ci` green
3. **Violations are non-negative** - violation >= 0
4. **Failed count matches failed leaves array length** (for nearest miss)
5. **Failed leaves summary is capped at 5** when more are present
6. **Tests are deterministic** - Use seeded random state generator
7. **Tests are independent** - No order dependencies

## Verification Commands

```bash
# Create and run the integration tests
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloViolationAnalysis.integration.test.js --verbose

# Verify no regressions
npm run test:ci

```

## Definition of Done

- [x] `monteCarloViolationAnalysis.integration.test.js` created
- [x] `violationAnalysisFixtures.js` created with focused test expressions
- [x] Leaf violation tests pass
- [x] Failed leaves summary tests pass (including cap and null handling)
- [x] Failed leaf counting test passes
- [x] Ceiling tests pass
- [x] Passing clause violation-percentile test passes
- [x] All tests use seeded random state for determinism
- [x] Targeted integration test run passes
- [x] No production code modified

## Outcome

Updated the ticket assumptions to reflect the current behavior (hierarchical-only violation tracking, five-leaf cap, strict-operator offset, and ceiling extraction rules). Added focused violation analysis fixtures and integration tests that assert nearest-miss summaries and clause failure ceiling data, with no production code changes.
