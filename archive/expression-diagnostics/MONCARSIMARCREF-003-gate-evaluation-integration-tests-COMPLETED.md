# MONCARSIMARCREF-003: Gate Evaluation Integration Tests

## Summary

Create integration tests that pin down observable gate evaluation behavior in `MonteCarloSimulator.js` (gate clamp planning, gate compatibility, and gate outcome recording). These tests serve as safety nets before extracting the `GateEvaluator` module in MONCARSIMARCREF-008.

## Priority: Critical | Effort: Medium

## Status: Completed

## Rationale

The gate evaluation subsystem handles constraint evaluation, gate clamp regime planning, compatibility checking, and outcome recording. Gates are critical for determining which emotion/mood configurations are achievable under given constraints. This is Priority 3 for extraction because "complex logic benefits from isolation."

Gates interact heavily with mood regimes and prototypes, making this a high-risk area for regressions. These integration tests must validate the simulator outputs that reflect gate evaluation (not private methods).

## Dependencies

- **MONCARSIMARCREF-001** (Context building tests)
- **MONCARSIMARCREF-002** (Expression evaluation tests - gates affect expression results)

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/integration/expression-diagnostics/monteCarloGateEvaluation.integration.test.js` | **Create** |
| `tests/fixtures/expressionDiagnostics/gateEvaluationFixtures.js` | **Create** |

## Out of Scope

- **DO NOT** modify `MonteCarloSimulator.js` or any production code
- **DO NOT** modify existing unit tests
- **DO NOT** create tests for context building (that's MONCARSIMARCREF-001)
- **DO NOT** create tests for expression evaluation (that's MONCARSIMARCREF-002)
- **DO NOT** create tests for prototype handling (that's MONCARSIMARCREF-004)
- **DO NOT** create tests for violation analysis (that's MONCARSIMARCREF-005)
- **DO NOT** refactor or extract any modules yet

## Implementation Details

### Behavior to Pin Down

Tests must capture simulator outputs that reflect gate evaluation:

1. `gateClampRegimePlan` - gate predicates and tracked axes for prototype gates
2. `gateCompatibility` - compatibility results for prototype gates under mood regime constraints
3. `clauseFailures` gate stats - gate pass/fail counts and lost-pass tracking for leaf clauses

**Notes**
- Gate constraints live on prototypes (data registry lookups), not on expressions.
- `#checkGates()` and `#evaluateGatePass()` are currently unused; do not test them directly.

### Test Structure

```javascript
/**
 * @file Integration tests pinning GateEvaluator behavior before refactoring
 * @see reports/monte-carlo-simulator-architecture-refactoring.md
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
// ... imports

describe('MonteCarloSimulator - Gate Evaluation Behavior', () => {
  let simulator;
  let container;

  beforeAll(async () => {
    // Initialize DI container with seeded random state
  });

  afterAll(() => {
    // Cleanup
  });

  describe('Gate Clamp Regime Planning', () => {
    it('should build regime plan with correct structure', async () => {
      // Pin: regime plan shape
    });

    it('should identify constrained axes and thresholds', async () => {
      // Pin: which axes are limited by gates
    });
  });

  describe('Gate Compatibility', () => {
    it('should compute compatibility for compatible gates', async () => {
      // Pin: compatible → non-zero compatibility score
    });

    it('should compute zero compatibility for incompatible gates', async () => {
      // Pin: incompatible → 0.0 compatibility
    });

    it('should compute compatibility for overlapping gates', async () => {
      // Pin: overlapping → compatible
    });
  });

  describe('Gate Outcome Recording', () => {
    it('should record gate pass outcomes', async () => {
      // Pin: pass recorded
    });

    it('should record gate fail outcomes', async () => {
      // Pin: fail recorded
    });

    it('should track lost passes when gates suppress raw threshold passes', async () => {
      // Pin: raw pass vs gated fail
    });
  });
});
```

### Test Fixtures

```javascript
// gateEvaluationFixtures.js

export const gateClampPlanExpression = {
  id: 'test:gate_plan',
  description: 'Expression referencing emotion + sexual prototypes with gates',
  prerequisites: [
    { logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } },
    { logic: { '>=': [{ var: 'sexualStates.aroused' }, 0.4] } },
  ],
};

export const gateCompatibilityExpression = {
  id: 'test:gate_compatibility',
  description: 'Expression with mood regime constraints and gated prototypes',
  prerequisites: [
    { logic: { '<=': [{ var: 'moodAxes.valence' }, 20] } },
    { logic: { '>=': [{ var: 'emotions.serenity' }, 0.4] } },
    { logic: { '>=': [{ var: 'emotions.panic' }, 0.4] } },
  ],
};

export const gateOutcomeExpression = {
  id: 'test:gate_outcome',
  description: 'Expression that records gate pass/fail and lost passes',
  prerequisites: [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } }],
};

export const gateEvaluationPrototypes = {
  emotions: {
    joy: {
      weights: { valence: 1 },
      gates: ['threat >= 0.7'],
    },
    serenity: {
      weights: { valence: 1 },
      gates: ['valence >= 0.1'],
    },
    panic: {
      weights: { valence: 1 },
      gates: ['valence >= 0.8'],
    },
  },
  sexualStates: {
    aroused: {
      weights: { sex_excitation: 1 },
      gates: ['sex_excitation >= 0.6'],
    },
  },
};
```

## Acceptance Criteria

### Tests That Must Pass

```bash
# Run the new integration test file
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloGateEvaluation.integration.test.js --coverage=false --verbose
```

### Specific Test Requirements

1. **Gate Clamp Regime Planning Tests** (minimum 2 tests)
   - Regime plan structure
   - Constrained axes + denormalized thresholds

2. **Gate Compatibility Tests** (minimum 2 tests)
   - Compatible prototype gates under regime
   - Incompatible prototype gates under regime

3. **Outcome Recording Tests** (minimum 2 tests)
   - Gate pass/fail counts recorded for leaf clauses
   - Lost pass tracking when gate suppresses raw pass

### Invariants That Must Remain True

1. **No production code changes** - Only test files created
2. **All existing tests pass** - `npm run test:ci` green
3. **Gate compatibility in [0, 1]** - Always valid
4. **Gate outcomes accumulate correctly** - passCount + failCount = sampleCount
5. **Tests are deterministic** - Use seeded random state generator
6. **Tests are independent** - No order dependencies

## Verification Commands

```bash
# Create and run the integration tests
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloGateEvaluation.integration.test.js --coverage=false --verbose
```

## Definition of Done

- [x] `monteCarloGateEvaluation.integration.test.js` created
- [x] `gateEvaluationFixtures.js` created with gate expressions + prototypes
- [x] Gate clamp regime planning tests pass (2+ tests)
- [x] Gate compatibility tests pass (2+ tests)
- [x] Outcome recording tests pass (2+ tests)
- [x] All tests use seeded random state for determinism
- [x] No production code modified

## Outcome

- Added gate evaluation fixtures and a focused integration test file covering gate clamp plans, gate compatibility, and gate outcome/lost-pass stats.
- Scoped tests to simulator outputs and prototype-based gates, removing direct/private-method expectations from the original plan.
