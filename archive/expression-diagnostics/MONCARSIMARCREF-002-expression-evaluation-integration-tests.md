# MONCARSIMARCREF-002: Expression Evaluation Integration Tests

## Summary

Create integration tests that pin down the current behavior of expression evaluation in `MonteCarloSimulator.js`, focused on JSON Logic evaluation, prerequisite conjunction, and clause tracking outputs. These tests act as safety nets before extracting the `ExpressionEvaluator` module in MONCARSIMARCREF-007 and complement the existing hierarchical breakdown coverage.

## Status

Completed

## Priority: Critical | Effort: High

## Rationale

The expression evaluation subsystem is the core of the Monte Carlo simulator, handling JSON Logic evaluation, clause tracking, hierarchical tree building, and result finalization. This is Priority 2 for extraction because it's "core functionality, enables unit testing."

Existing integration tests (for example `tests/integration/expression-diagnostics/hierarchicalBlockers.integration.test.js`) already exercise the hierarchical tree and breakdown output. This ticket narrows scope to baseline evaluation behavior, deterministic trigger rates, and clause tracking fields that should remain stable during refactoring.

## Dependencies

- **MONCARSIMARCREF-001** (Context Building integration tests already exist in `tests/integration/expression-diagnostics/monteCarloContextBuilding.integration.test.js`.)

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/integration/expression-diagnostics/monteCarloExpressionEvaluation.integration.test.js` | **Create** |
| `tests/fixtures/expressionDiagnostics/expressionEvaluationFixtures.js` | **Create** |

## Out of Scope

- **DO NOT** modify `MonteCarloSimulator.js` or any production code
- **DO NOT** modify existing unit tests
- **DO NOT** create tests for gate evaluation (that's MONCARSIMARCREF-003)
- **DO NOT** create tests for prototype handling (that's MONCARSIMARCREF-004)
- **DO NOT** create tests for violation analysis (that's MONCARSIMARCREF-005)
- **DO NOT** test context building in detail (that's MONCARSIMARCREF-001)
- **DO NOT** refactor or extract any modules yet
- **DO NOT** add direct coverage for `#evaluateThresholdCondition` (it's used by sensitivity analysis, not core expression evaluation)

## Implementation Details

### Methods to Pin Down

The following private methods are part of the evaluation path and should be covered via integration-level behavior assertions:

1. `#evaluateWithTracking()` - Main evaluation with clause tracking
2. `#evaluateHierarchicalNode()` - Tree node evaluation (164 lines)
3. `#finalizeClauseResults()` - Result finalization (111 lines)
4. `#evaluateLeafCondition()` - Leaf condition evaluation with JSON Logic
5. `#buildHierarchicalTree()` - Constructs logical clause tree
6. `#evaluateAllPrerequisites()` - Batch prerequisite evaluation
7. `#evaluatePrerequisite()` - Single prerequisite evaluation

### Test Structure

```javascript
/**
 * @file Integration tests pinning ExpressionEvaluator behavior before refactoring
 * @see reports/monte-carlo-simulator-architecture-refactoring.md
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
// ... imports

describe('MonteCarloSimulator - Expression Evaluation Behavior', () => {
  let simulator;
  let container;

  beforeAll(async () => {
    // Initialize DI container with seeded random state
  });

  afterAll(() => {
    // Cleanup
  });

  describe('Basic Expression Evaluation', () => {
    it('evaluates comparison operators via JSON Logic (>=, <=, >, <, ==)', async () => {
      // Pin: triggerRate for each operator with deterministic samples
    });
  });

  describe('Prerequisite Conjunction + Clause Tracking', () => {
    it('evaluates multiple prerequisites as AND and tracks clause failures', async () => {
      // Pin: triggerCount, failureRate, clauseIndex, clauseDescription
    });

    it('builds hierarchical breakdown for compound logic', async () => {
      // Pin: hierarchicalBreakdown nodeType and children length
    });
  });

  describe('Edge Cases', () => {
    it('handles empty prerequisites as always true', async () => {
      // Pin: [] → 100% trigger rate
    });

    it('treats undefined variables as false without throwing', async () => {
      // Pin: missing var path results in failed clause
    });
  });

  describe('Variable Resolution', () => {
    it('resolves mood axes, emotions, and sexual state variables', async () => {
      // Pin: mixed variable paths resolve in a single evaluation
    });
  });
});
```

### Test Fixtures

```javascript
// expressionEvaluationFixtures.js

export const simpleThresholdExpression = {
  id: 'test:simple_threshold',
  description: 'Simple threshold comparison',
  prerequisites: [
    { logic: { '>=': [{ var: 'mood.valence' }, 0.5] } }
  ]
};

export const andExpression = {
  id: 'test:and_expression',
  description: 'AND of multiple clauses',
  prerequisites: [
    {
      logic: {
        and: [
          { '>=': [{ var: 'mood.valence' }, 0.6] },
          { '>=': [{ var: 'mood.energy' }, 0.4] },
          { '<=': [{ var: 'mood.threat' }, 0.3] }
        ]
      }
    }
  ]
};

export const orExpression = {
  id: 'test:or_expression',
  description: 'OR of multiple clauses',
  prerequisites: [
    {
      logic: {
        or: [
          { '>=': [{ var: 'mood.valence' }, 0.9] },
          { '>=': [{ var: 'mood.energy' }, 0.9] }
        ]
      }
    }
  ]
};

export const nestedExpression = {
  id: 'test:nested_expression',
  description: 'Nested AND/OR expression',
  prerequisites: [
    {
      logic: {
        and: [
          { '>=': [{ var: 'mood.valence' }, 0.5] },
          {
            or: [
              { '>=': [{ var: 'emotions.joy' }, 0.7] },
              { '<=': [{ var: 'emotions.fear' }, 0.2] }
            ]
          }
        ]
      }
    }
  ]
};

export const alwaysTrueExpression = {
  id: 'test:always_true',
  description: 'Empty prerequisites - always triggers',
  prerequisites: []
};

export const alwaysFalseExpression = {
  id: 'test:always_false',
  description: 'Contradictory requirements - never triggers',
  prerequisites: [
    {
      logic: {
        and: [
          { '>=': [{ var: 'mood.valence' }, 0.9] },
          { '<=': [{ var: 'mood.valence' }, 0.1] }
        ]
      }
    }
  ]
};

export const allOperatorsExpression = {
  id: 'test:all_operators',
  description: 'Expression using all comparison operators',
  prerequisites: [
    {
      logic: {
        and: [
          { '>=': [{ var: 'mood.valence' }, 0.5] },
          { '>': [{ var: 'mood.energy' }, 0.3] },
          { '<=': [{ var: 'mood.threat' }, 0.4] },
          { '<': [{ var: 'mood.dominance' }, 0.8] }
        ]
      }
    }
  ]
};

export const deeplyNestedExpression = {
  id: 'test:deeply_nested',
  description: 'Three levels of nesting',
  prerequisites: [
    {
      logic: {
        and: [
          { '>=': [{ var: 'mood.valence' }, 0.4] },
          {
            or: [
              {
                and: [
                  { '>=': [{ var: 'emotions.joy' }, 0.6] },
                  { '<=': [{ var: 'emotions.fear' }, 0.3] }
                ]
              },
              { '>=': [{ var: 'emotions.trust' }, 0.8] }
            ]
          }
        ]
      }
    }
  ]
};

// Expected result structure template
export const expectedResultStructure = {
  triggerRate: 'number in [0, 1]',
  triggerCount: 'integer >= 0',
  sampleCount: 'integer > 0',
  confidenceInterval: {
    low: 'number in [0, 1]',
    high: 'number in [0, 1]'
  },
  clauseFailures: 'array of clause failure objects',
  hierarchicalBreakdown: 'tree structure'
};
```

## Acceptance Criteria

### Tests That Must Pass

```bash
# Run the new integration test file
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloExpressionEvaluation.integration.test.js --verbose

# Ensure no regressions in existing tests
npm run test:ci
```

### Specific Test Requirements

1. **Basic Evaluation Tests** (minimum 5 tests)
   - JSON Logic operators (>=, <=, >, <, ==)

2. **Prerequisite + Clause Tracking Tests** (minimum 2 tests)
   - Multiple prerequisites combine as AND
   - Clause tracking fields (failureRate, clauseIndex, clauseDescription)

3. **Hierarchical Breakdown Test** (minimum 1 test)
   - Compound logic produces hierarchicalBreakdown

4. **Edge Case Tests** (minimum 2 tests)
   - Empty prerequisites
   - Undefined variables

5. **Variable Resolution Test** (minimum 1 test)
   - Combined mood axes, emotions, sexual states

### Invariants That Must Remain True

1. **No production code changes** - Only test files created
2. **All existing tests pass** - `npm run test:ci` green
3. **Trigger rate in [0, 1]** - Always valid probability
4. **Confidence interval valid** - low ≤ triggerRate ≤ high
5. **Tests are deterministic** - Use seeded random state generator
6. **Tests are independent** - No order dependencies

## Verification Commands

```bash
# Create and run the integration tests
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloExpressionEvaluation.integration.test.js --verbose --coverage=false
```

## Definition of Done

- [x] `monteCarloExpressionEvaluation.integration.test.js` created
- [x] `expressionEvaluationFixtures.js` created with evaluation-focused expressions
- [x] Basic evaluation tests pass (5+ tests)
- [x] Prerequisite/clause tracking tests pass (2+ tests)
- [x] Hierarchical breakdown test passes
- [x] Edge case tests pass (2+ tests)
- [x] Variable resolution test passes
- [x] Tests use deterministic random state generator
- [x] No production code modified
- [x] Test file follows project patterns

## Outcome

- Added integration coverage for JSON Logic operator evaluation, prerequisite conjunction, clause tracking fields, and variable resolution; reused existing hierarchical coverage rather than duplicating it.
- Created new fixtures for evaluation-focused expressions and kept production code unchanged.
