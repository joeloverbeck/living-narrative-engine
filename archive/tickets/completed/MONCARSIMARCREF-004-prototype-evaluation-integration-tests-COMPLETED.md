# MONCARSIMARCREF-004: Prototype Evaluation Integration Tests

Status: Completed

## Summary

Create integration tests that pin down the current behavior of prototype evaluation in `src/expressionDiagnostics/services/MonteCarloSimulator.js`. These tests serve as safety nets before extracting the `PrototypeEvaluator` module in MONCARSIMARCREF-009.

## Priority: High | Effort: Medium

## Rationale

The prototype evaluation subsystem handles emotion/sexual prototype handling, reference collection, stats management, and sibling conditioning. Prototypes define the achievable emotion configurations based on mood axes, making this critical for accurate probability estimation. This is Priority 4 for extraction because it's "specialized, clear boundaries."

## Dependencies

- **MONCARSIMARCREF-001** (Context building tests)
- **MONCARSIMARCREF-002** (Expression evaluation tests)
- **MONCARSIMARCREF-003** (Gate evaluation tests - gates affect prototype compatibility)

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/integration/expression-diagnostics/monteCarloPrototypeEvaluation.integration.test.js` | **Create** |
| `tests/fixtures/expressionDiagnostics/prototypeEvaluationFixtures.js` | **Create** |

## Out of Scope

- **DO NOT** modify `MonteCarloSimulator.js` or any production code unless tests expose a defect that must be fixed
- **DO NOT** modify existing unit tests
- **DO NOT** create tests for context building (that's MONCARSIMARCREF-001)
- **DO NOT** create tests for expression evaluation (that's MONCARSIMARCREF-002)
- **DO NOT** create tests for gate evaluation (that's MONCARSIMARCREF-003)
- **DO NOT** create tests for violation analysis (that's MONCARSIMARCREF-005)
- **DO NOT** refactor or extract any modules yet

## Implementation Details

### Methods to Pin Down

The following private methods will be extracted to `PrototypeEvaluator` - tests must capture their exact behavior:

1. `#preparePrototypeEvaluationTargets()` - Target preparation
2. `#initializePrototypeEvaluationSummary()` - Summary initialization
3. `#updatePrototypeEvaluationSummary()` - Summary updates
4. `#createPrototypeEvaluationStats()` - Stats object creation
5. `#evaluatePrototypeSample()` - Prototype evaluation per sample
6. `#recordPrototypeEvaluation()` - Prototype outcome recording
7. `#getPrototype()` - Prototype lookup from data registry
8. `#collectPrototypeReferencesFromLogic()` - Prototype reference collection from `emotions.*` / `sexualStates.*` var paths in comparison operators
9. `#extractPrototypeReferences()` - Prototype ID extraction

Note: `#recordSiblingConditionedStats()` belongs to hierarchical clause tracking, not prototype evaluation.

### Test Structure

```javascript
/**
 * @file Integration tests pinning PrototypeEvaluator behavior before refactoring
 * @see reports/monte-carlo-simulator-architecture-refactoring.md
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
// ... imports

describe('MonteCarloSimulator - Prototype Evaluation Behavior', () => {
  let simulator;
  let container;
  let mockDataRegistry;

  beforeAll(async () => {
    // Initialize DI container with seeded random state
    // Set up mock data registry with prototype definitions
  });

  afterAll(() => {
    // Cleanup
  });

  describe('Prototype Reference Collection', () => {
    it('should collect prototype references from expression logic', async () => {
      // Pin: extract prototype IDs from emotions.* / sexualStates.* var paths
    });

    it('should handle expressions with no prototype references', async () => {
      // Pin: empty array when no prototypes
    });

    it('should collect multiple prototype references', async () => {
      // Pin: multiple prototypes in single expression
    });

    it('should deduplicate prototype references', async () => {
      // Pin: same prototype referenced multiple times
    });
  });

  describe('Prototype Lookup', () => {
    it('should retrieve emotion prototypes from data registry', async () => {
      // Pin: core:emotion_prototypes lookup
    });

    it('should retrieve sexual prototypes from data registry', async () => {
      // Pin: core:sexual_prototypes lookup
    });

    it('should handle missing prototype gracefully', async () => {
      // Pin: error/null behavior
    });
  });

  describe('Prototype Evaluation Targets', () => {
    it('should prepare correct evaluation targets from expression', async () => {
      // Pin: target list structure
    });

    it('should include all referenced prototypes', async () => {
      // Pin: completeness
    });

    it('should include prototype weights in targets', async () => {
      // Pin: weight information
    });
  });

  describe('Prototype Evaluation Summary', () => {
    it('should initialize summary with correct structure', async () => {
      // Pin: summary object shape
    });

    it('should update summary per sample correctly', async () => {
      // Pin: incremental updates
    });
  });

  describe('Per-Sample Prototype Evaluation', () => {
    it('should evaluate prototype fit for given context', async () => {
      // Pin: fit score computation
    });

    it('should consider mood axes in prototype fit', async () => {
      // Pin: mood influence
    });

    it('should record prototype evaluation outcome', async () => {
      // Pin: outcome recording
    });
  });

  describe('Prototype Statistics', () => {
    it('should create stats object with correct fields', async () => {
      // Pin: stats object structure
    });

    it('should accumulate pass/fail counts', async () => {
      // Pin: count accumulation
    });

    it('should compute pass rate from counts', async () => {
      // Pin: gatePassCount / moodSampleCount (derived in downstream consumers)
    });
  });

  describe('Prototype-Gate Interaction', () => {
    it('should reflect gate constraints in prototype evaluation', async () => {
      // Pin: gates affect achievable prototypes
    });

    it('should compute prototype compatibility under gates', async () => {
      // Pin: compatibility metric
    });
  });

  describe('Edge Cases', () => {
    it('should handle prototype with all-zero weights', async () => {
      // Pin: degenerate prototype behavior
    });

    it('should handle prototype with extreme weights', async () => {
      // Pin: weights outside normal range
    });

    it('should handle expressions referencing non-existent prototype', async () => {
      // Pin: error handling
    });
  });
});
```

### Test Fixtures

```javascript
// prototypeEvaluationFixtures.js

export const singlePrototypeExpression = {
  id: 'test:single_prototype',
  description: 'Expression referencing single emotion prototype',
  prerequisites: [
    { logic: { '>=': [{ var: 'emotions.joy' }, 0.7] } }
  ]
};

export const multiplePrototypeExpression = {
  id: 'test:multiple_prototypes',
  description: 'Expression with OR of prototype conditions',
  prerequisites: [
    {
      logic: {
        or: [
          { '>=': [{ var: 'emotions.joy' }, 0.8] },
          { '>=': [{ var: 'emotions.trust' }, 0.7] }
        ]
      }
    }
  ]
};

export const andPrototypeExpression = {
  id: 'test:and_prototypes',
  description: 'Expression requiring multiple prototypes simultaneously',
  prerequisites: [
    {
      logic: {
        and: [
          { '>=': [{ var: 'emotions.joy' }, 0.6] },
          { '<=': [{ var: 'emotions.fear' }, 0.3] }
        ]
      }
    }
  ]
};

export const sexualPrototypeExpression = {
  id: 'test:sexual_prototype',
  description: 'Expression referencing sexual state prototype',
  prerequisites: [
    { logic: { '>=': [{ var: 'sexualStates.aroused' }, 0.5] } }
  ]
};

export const mixedPrototypeExpression = {
  id: 'test:mixed_prototypes',
  description: 'Expression mixing emotion and mood conditions',
  prerequisites: [
    {
      logic: {
        and: [
          { '>=': [{ var: 'emotions.joy' }, 0.6] },
          { '>=': [{ var: 'mood.valence' }, 0.5] }
        ]
      }
    }
  ]
};

export const gatedPrototypeExpression = {
  id: 'test:gated_prototype',
  description: 'Prototype expression with gate constraints',
  prerequisites: [
    { logic: { '>=': [{ var: 'emotions.anger' }, 0.7] } }
  ],
  gates: {
    threat: { min: 0.6, max: 1.0 }
  }
};

export const noPrototypeExpression = {
  id: 'test:no_prototype',
  description: 'Expression with no prototype references',
  prerequisites: [
    { logic: { '>=': [{ var: 'mood.valence' }, 0.5] } }
  ]
};

// Mock prototype definitions for tests
export const mockEmotionPrototypes = {
  entries: {
    joy: {
      weights: { valence: 1.0, energy: 0.5, dominance: 0.3, novelty: 0.2, threat: -0.5 },
      gates: []
    },
    trust: {
      weights: { valence: 0.8, energy: 0.2, dominance: 0.4, novelty: -0.2, threat: -0.3 },
      gates: []
    },
    fear: {
      weights: { valence: -0.7, energy: 0.6, dominance: -0.5, novelty: 0.4, threat: 0.9 },
      gates: []
    },
    anger: {
      weights: { valence: -0.5, energy: 0.8, dominance: 0.6, novelty: 0.3, threat: 0.7 },
      gates: []
    }
  }
};

export const mockSexualPrototypes = {
  entries: {
    aroused: {
      weights: { sex_excitation: 1.0, sex_inhibition: -0.5, baseline_libido: 0.3 },
      gates: []
    }
  }
};

// Expected prototype result structure
export const expectedPrototypeResultStructure = {
  prototypeStats: {
    prototypeName: {
      moodSampleCount: 'integer',
      gatePassCount: 'integer',
      gateFailCount: 'integer',
      rawScoreSum: 'number',
      valueSum: 'number',
      valueSumGivenGate: 'number'
    }
  },
  siblingConditionedStats: {
    'prototypeA|prototypeB': {
      conditionalPassRate: 'number in [0, 1]'
    }
  }
};
```

## Acceptance Criteria

### Tests That Must Pass

```bash
# Run the new integration test file (subset run)
npm run test:integration -- --testPathPatterns tests/integration/expression-diagnostics/monteCarloPrototypeEvaluation.integration.test.js --coverage=false --verbose

# Ensure no regressions in existing tests
npm run test:ci
```

### Specific Test Requirements

1. **Prototype Reference Collection Tests** (minimum 3 tests)
   - Single reference collection
   - No references
   - Multiple references
   - Deduplication

2. **Prototype Lookup Tests** (minimum 2 tests)
   - Emotion prototype lookup
   - Sexual prototype lookup
   - Missing prototype handling

3. **Evaluation Targets Tests** (minimum 2 tests)
   - Target preparation
   - Completeness
   - Weight inclusion

4. **Evaluation Summary Tests** (minimum 2 tests)
   - Initialization
   - Updates

5. **Per-Sample Evaluation Tests** (minimum 2 tests)
   - Fit score computation
   - Mood influence
   - Outcome recording

6. **Statistics Tests** (minimum 2 tests)
   - Stats object creation
   - Count accumulation
   - Pass rate computation

7. **Prototype-Gate Interaction Tests** (minimum 1 test)
   - Gate influence

8. **Edge Case Tests** (minimum 2 tests)
   - Zero weights
   - Non-existent prototype

### Invariants That Must Remain True

1. **No production code changes** - Only test files created unless a defect is uncovered
2. **All existing tests pass** - `npm run test:ci` green
3. **Pass rates in [0, 1]** - Always valid probabilities
4. **Count consistency** - passCount + failCount = sampleCount
5. **Tests are deterministic** - Use seeded random state generator
6. **Tests are independent** - No order dependencies

## Verification Commands

```bash
# Create and run the integration tests
npm run test:integration -- --testPathPatterns tests/integration/expression-diagnostics/monteCarloPrototypeEvaluation.integration.test.js --coverage=false --verbose

# Verify no regressions
npm run test:ci

# Check test coverage contribution
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloPrototypeEvaluation.integration.test.js --coverage
```

## Definition of Done

- [x] `monteCarloPrototypeEvaluation.integration.test.js` created
- [x] `prototypeEvaluationFixtures.js` created with 7+ test expressions + mock prototypes
- [x] Prototype reference collection tests pass (3+ tests)
- [x] Prototype lookup tests pass (2+ tests)
- [x] Evaluation targets tests pass (2+ tests)
- [x] Evaluation summary tests pass (2+ tests)
- [x] Per-sample evaluation tests pass (2+ tests)
- [x] Statistics tests pass (2+ tests)
- [x] Prototype-gate interaction tests pass (1+ test)
- [x] Edge case tests pass (2+ tests)
- [x] All tests use seeded random state for determinism
- [ ] All existing tests still pass (`npm run test:ci`)
- [x] No production code modified unless needed to address a defect

## Outcome

- Updated assumptions to match current prototype reference collection (emotions/sexualStates var paths in comparison logic), corrected stats shape, and removed sibling-conditioned stats from scope.
- Added integration fixtures and tests that exercise reference collection, target prep, in-regime aggregation, gate pass/fail accounting, and edge cases without production changes.
- Ran targeted integration coverage (`monteCarloPrototypeEvaluation.integration.test.js`, plus gate evaluation sanity check); full `npm run test:ci` not executed here.
