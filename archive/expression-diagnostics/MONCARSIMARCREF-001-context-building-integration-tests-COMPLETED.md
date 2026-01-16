# MONCARSIMARCREF-001: Context Building Integration Tests

## Summary

Create integration tests that pin down the current behavior of context building methods in `MonteCarloSimulator.js`. These tests serve as safety nets before extracting the `ContextBuilder` module in MONCARSIMARCREF-006.

## Status: Completed

## Priority: Critical | Effort: Medium

## Rationale

The context building subsystem constructs evaluation contexts with raw mood/sexual axes, derived emotions/sexual states, optional gate traces, and mood-regime histogram/sample data. Before extracting this into a separate module, we must capture the exact current behavior to prevent regressions.

The report identifies context building as Priority 1 for extraction due to its "isolated responsibility, minimal coupling, easy win" characteristics. However, integration tests MUST exist first.

## Dependencies

- None (this is a Phase 1 prerequisite ticket)

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/integration/expression-diagnostics/monteCarloContextBuilding.integration.test.js` | **Create** |
| `tests/fixtures/expressionDiagnostics/contextBuildingFixtures.js` | **Create** |

## Out of Scope

- **DO NOT** modify `MonteCarloSimulator.js` or any production code
- **DO NOT** modify existing unit tests
- **DO NOT** create tests for expression evaluation (that's MONCARSIMARCREF-002)
- **DO NOT** create tests for gate evaluation (that's MONCARSIMARCREF-003)
- **DO NOT** create tests for prototype handling (that's MONCARSIMARCREF-004)
- **DO NOT** test sensitivity analysis methods
- **DO NOT** refactor or extract any modules yet

## Implementation Details

### Methods to Pin Down

The following private methods will be extracted to `ContextBuilder` - tests must capture their exact behavior:

1. `#buildContext()` - Main context construction
2. `#buildKnownContextKeys()` - Context key enumeration for var-path validation
3. `#normalizeGateContext()` - Gate axis normalization (mood: [-1..1], sexual/traits: [0..1])
4. `#normalizeMoodAxisValue()` - Mood constraint normalization (divide by 100)
5. `#recordMoodRegimeAxisHistograms()` - Histogram recording
6. `#recordMoodRegimeSampleReservoir()` - Sample storage recording
7. `#initializeMoodRegimeAxisHistograms()` - Histogram initialization
8. `#initializeMoodRegimeSampleReservoir()` - Sample reservoir initialization

### Test Structure

```javascript
/**
 * @file Integration tests pinning ContextBuilder behavior before refactoring
 * @see reports/monte-carlo-simulator-architecture-refactoring.md
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
// ... imports for DI container, fixtures

describe('MonteCarloSimulator - Context Building Behavior', () => {
  let simulator;
  let container;
  let mockDataRegistry;
  let mockLogger;

  beforeAll(async () => {
    // Initialize DI container
    // Set up mock dependencies
  });

  afterAll(() => {
    // Cleanup
  });

  describe('Context Structure', () => {
    it('should build context with required fields and derived values', async () => {
      // Pin: mood, moodAxes alias, sexualAxes, emotions, sexualStates,
      // sexualArousal, previous* fields, affectTraits fallback (legacy 3-trait default),
      // gateTrace.
    });

    it('should keep raw mood and sexual axes ranges intact', async () => {
      // Pin: mood axes in [-100, 100], sexual axes in [0, 100],
      // baseline_libido in [-50, 50].
    });
  });

  describe('Gate Context Normalization', () => {
    it('should normalize mood axes to [-1, 1] and sexual/trait axes to [0, 1]', async () => {
      // Pin: normalized gate context uses axisNormalizationUtils behavior.
    });
  });

  describe('Mood Regime Histograms + Reservoir', () => {
    it('should initialize and record histogram bins for tracked gate axes', async () => {
      // Pin: tracked axes come from prototype gates; sample counts update.
    });

    it('should cap sample reservoir storage at configured limit', async () => {
      // Pin: storedCount <= limit, sampleCount increments.
    });
  });

  describe('Known Context Keys', () => {
    it('should accept prototype-backed emotion/sexual keys without warnings', async () => {
      // Pin: dynamic keys from data registry are valid.
    });

    it('should warn on unknown roots or nested keys', async () => {
      // Pin: unseeded var warnings surfaced.
    });
  });
});
```

### Test Fixtures

```javascript
// contextBuildingFixtures.js

export const simpleContextExpression = {
  id: 'test:simple_context',
  description: 'Expression referencing emotion + sexual prototypes',
  prerequisites: [
    {
      logic: {
        and: [
          { '>=': [{ var: 'emotions.joy' }, 0.1] },
          { '>=': [{ var: 'sexualStates.aroused' }, 0.1] },
          { '>=': [{ var: 'moodAxes.valence' }, -100] },
        ],
      },
    },
  ],
};

export const unknownVarExpression = {
  id: 'test:unknown_context_key',
  description: 'Expression with unknown context key for warnings',
  prerequisites: [
    { logic: { '>=': [{ var: 'unknown.axis' }, 0.1] } },
  ],
};

export const moodRegimeExpression = {
  id: 'test:mood_regime_context',
  description: 'Expression that triggers mood-regime histogram tracking',
  prerequisites: [
    { logic: { '>=': [{ var: 'moodAxes.valence' }, -100] } },
    { logic: { '>=': [{ var: 'emotions.joy' }, 0.1] } },
    { logic: { '>=': [{ var: 'sexualStates.aroused' }, 0.1] } },
  ],
};

export const prototypeLookups = {
  emotions: {
    joy: {
      weights: { valence: 1 },
      gates: ['valence >= 0.5'],
    },
  },
  sexualStates: {
    aroused: {
      weights: { sex_excitation: 1 },
      gates: ['sex_excitation >= 0.5'],
    },
  },
};
```

## Acceptance Criteria

### Tests That Must Pass

```bash
# Run the new integration test file
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloContextBuilding.integration.test.js --verbose

# Ensure no regressions in existing tests
npm run test:ci
```

### Specific Test Requirements

1. **Context Structure Tests** (minimum 2 tests)
   - Required fields + derived values (including previous*, sexualArousal, affectTraits fallback, gateTrace)
   - Raw axis ranges preserved (mood in [-100,100], sexual in [0,100], baseline_libido in [-50,50])

2. **Gate Context Normalization Tests** (minimum 1 test)
   - Normalized mood axes [-1,1] and sexual/trait axes [0,1] via gate evaluation path

3. **Histogram + Reservoir Tests** (minimum 2 tests)
   - Histogram initialization/recording for tracked gate axes
   - Reservoir storage respects configured limit

4. **Known Context Keys Tests** (minimum 2 tests)
   - Prototype-backed emotion/sexual keys accepted without warnings
   - Unknown roots or nested keys yield warnings

### Invariants That Must Remain True

1. **No production code changes** - Only test files created
2. **All existing tests pass** - New integration test file green
3. **Tests capture current behavior** - Not expected/ideal behavior
4. **Tests are deterministic** - Use seeded random state generator
5. **Tests are independent** - No order dependencies between tests

## Verification Commands

```bash
# Create and run the integration tests
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloContextBuilding.integration.test.js --coverage=false --verbose

# Coverage (optional for single-file run)
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloContextBuilding.integration.test.js --coverage=false
```

## Definition of Done

- [x] `monteCarloContextBuilding.integration.test.js` created
- [x] `contextBuildingFixtures.js` created with context expressions + prototype lookups
- [x] Context structure tests pass (2+ tests)
- [x] Gate context normalization tests pass (1+ tests)
- [x] Histogram/reservoir tests pass (2+ tests)
- [x] Known context keys tests pass (2+ tests)
- [x] All tests use seeded random state for determinism
- [x] New integration test passes (`npm run test:integration -- tests/integration/expression-diagnostics/monteCarloContextBuilding.integration.test.js --coverage=false`)
- [x] No production code modified
- [x] Test file follows project patterns (imports, describe blocks, etc.)

## Outcome

- Added integration coverage for context construction, gate normalization, histograms/reservoirs, and known key validation.
- Introduced fixtures for prototype lookups and context-building expressions.
- Updated assumptions to reflect current normalization ranges and legacy affect-trait defaults.
