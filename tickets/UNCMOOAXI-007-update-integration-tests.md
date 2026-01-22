# UNCMOOAXI-007: Update Integration Tests

## Summary

Add integration tests to verify the uncertainty axis works correctly end-to-end across the expression evaluation pipeline, Monte Carlo simulation, and prototype intensity calculation.

## Priority: Medium | Effort: Medium

## Rationale

Integration tests verify that uncertainty:
- Flows through the full expression evaluation pipeline
- Is correctly sampled in Monte Carlo random state generation
- Properly affects emotion prototype intensity calculations
- Gates function correctly with uncertainty conditions

## Dependencies

- **UNCMOOAXI-001** through **UNCMOOAXI-006** must be complete (all implementation + unit tests)

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/integration/expression-diagnostics/uncertaintyAxis.integration.test.js` | **Create** - New integration test file |

## Out of Scope

- **DO NOT** modify source files
- **DO NOT** modify unit tests - that's UNCMOOAXI-006
- **DO NOT** modify existing integration tests (unless they have hardcoded axis counts)

## Implementation Details

### New File: tests/integration/expression-diagnostics/uncertaintyAxis.integration.test.js

```javascript
/**
 * @file Integration tests for uncertainty mood axis
 * Verifies uncertainty axis works correctly across expression evaluation pipeline.
 * @see specs/uncertainty-mood-axis.md
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createIntegrationTestEnvironment } from '../../helpers/integrationTestEnvironment.js';
import { MOOD_AXES } from '../../../src/constants/moodAffectConstants.js';

describe('Uncertainty Axis Integration', () => {
  let testEnv;
  let container;

  beforeAll(async () => {
    testEnv = await createIntegrationTestEnvironment();
    container = testEnv.container;
  });

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  describe('MOOD_AXES Integration', () => {
    it('should include uncertainty in MOOD_AXES constant', () => {
      expect(MOOD_AXES).toContain('uncertainty');
      expect(MOOD_AXES).toHaveLength(10);
    });
  });

  describe('Random State Generation', () => {
    it('should include uncertainty in Monte Carlo random states', () => {
      const generator = container.resolve('IRandomStateGenerator');
      const state = generator.generateState();

      expect(state.moodAxes).toHaveProperty('uncertainty');
      expect(typeof state.moodAxes.uncertainty).toBe('number');
      expect(state.moodAxes.uncertainty).toBeGreaterThanOrEqual(-100);
      expect(state.moodAxes.uncertainty).toBeLessThanOrEqual(100);
    });

    it('should generate diverse uncertainty values across multiple states', () => {
      const generator = container.resolve('IRandomStateGenerator');
      const values = new Set();

      for (let i = 0; i < 100; i++) {
        const state = generator.generateState();
        values.add(state.moodAxes.uncertainty);
      }

      // Should have reasonable diversity (not all same value)
      expect(values.size).toBeGreaterThan(10);
    });
  });

  describe('Expression Context Building', () => {
    it('should include uncertainty in expression context moodAxes', () => {
      const contextBuilder = container.resolve('IExpressionContextBuilder');
      const mockEntity = {
        id: 'test:entity',
        components: {
          'core:mood': {
            valence: 10,
            arousal: 20,
            agency_control: 30,
            threat: -10,
            engagement: 50,
            future_expectancy: 0,
            self_evaluation: 0,
            affiliation: 0,
            inhibitory_control: 0,
            uncertainty: 75
          }
        }
      };

      const context = contextBuilder.build(mockEntity);

      expect(context.moodAxes).toHaveProperty('uncertainty');
      expect(context.moodAxes.uncertainty).toBe(75);
    });
  });

  describe('Gate Evaluation with Uncertainty', () => {
    it('should evaluate uncertainty gates correctly', () => {
      const evaluator = container.resolve('IGateEvaluator');

      // High uncertainty - should pass uncertainty >= 0.30
      const highUncertaintyContext = {
        moodAxes: { uncertainty: 50 }
      };
      expect(evaluator.evaluateGate('uncertainty >= 0.30', highUncertaintyContext)).toBe(true);

      // Low uncertainty - should fail uncertainty >= 0.30
      const lowUncertaintyContext = {
        moodAxes: { uncertainty: 10 }
      };
      expect(evaluator.evaluateGate('uncertainty >= 0.30', lowUncertaintyContext)).toBe(false);
    });
  });

  describe('Prototype Intensity Calculation', () => {
    it('should calculate confusion intensity using uncertainty weight', () => {
      const calculator = container.resolve('IPrototypeIntensityCalculator');

      // High uncertainty state - confusion should be high
      const confusedState = {
        moodAxes: {
          uncertainty: 80,
          engagement: 40,
          arousal: 20,
          agency_control: -10,
          valence: -5,
          inhibitory_control: 20,
          threat: 0,
          future_expectancy: 0,
          self_evaluation: 0,
          affiliation: 0
        }
      };

      const intensity = calculator.calculate('confusion', confusedState);
      expect(intensity).toBeGreaterThan(0.5);
    });

    it('should differentiate confusion from frustration based on uncertainty', () => {
      const calculator = container.resolve('IPrototypeIntensityCalculator');

      // High uncertainty, low agency - should favor confusion over frustration
      const confusedState = {
        moodAxes: {
          uncertainty: 80,
          agency_control: -20,
          valence: -20,
          engagement: 40,
          arousal: 30,
          threat: 10,
          future_expectancy: -10,
          self_evaluation: 0,
          affiliation: 0,
          inhibitory_control: 10
        }
      };

      // Low uncertainty, low agency - should favor frustration over confusion
      const frustratedState = {
        moodAxes: {
          uncertainty: 10,
          agency_control: -60,
          valence: -50,
          engagement: 60,
          arousal: 50,
          threat: 20,
          future_expectancy: -20,
          self_evaluation: -10,
          affiliation: -10,
          inhibitory_control: -20
        }
      };

      const confusionInConfused = calculator.calculate('confusion', confusedState);
      const confusionInFrustrated = calculator.calculate('confusion', frustratedState);

      // Confusion should be higher in the confused state
      expect(confusionInConfused).toBeGreaterThan(confusionInFrustrated);
    });
  });

  describe('Epistemic Prototypes', () => {
    it('should have all epistemic prototypes with uncertainty weights', () => {
      const dataRegistry = container.resolve('IDataRegistry');
      const prototypes = dataRegistry.getLookup('core:emotion_prototypes');

      const epistemicPrototypes = [
        'confusion',
        'curiosity',
        'suspicion',
        'awe',
        'perplexity',
        'wonder',
        'doubt',
        'bewilderment',
        'disorientation'
      ];

      for (const name of epistemicPrototypes) {
        const prototype = prototypes.entries[name];
        expect(prototype).toBeDefined();
        expect(prototype.weights).toHaveProperty('uncertainty');
        expect(prototype.weights.uncertainty).toBeGreaterThan(0);
      }
    });
  });
});
```

### Additional Test: Verify Axis Coverage in Existing Integration Tests

Check if any existing integration tests have hardcoded axis counts:

```bash
# Find integration tests that may need updates
grep -rn "toHaveLength(9)" tests/integration/
grep -rn "\.length.*9" tests/integration/ | grep -i mood
grep -rn "toBe(9)" tests/integration/
```

## Acceptance Criteria

### Tests That Must Pass

```bash
# New integration tests pass
npm run test:integration -- tests/integration/expression-diagnostics/uncertaintyAxis.integration.test.js --verbose

# All expression diagnostics integration tests pass
npm run test:integration -- --testPathPattern="expression-diagnostics" --verbose

# Full integration test suite passes
npm run test:integration
```

### Invariants That Must Remain True

1. **Test Independence**: New tests don't affect existing integration tests
2. **Real Services**: Tests use actual resolved services, not mocks
3. **Environment Cleanup**: Test environment properly cleaned up
4. **Coverage**: All key uncertainty pathways tested

## Verification Commands

```bash
# Run new integration tests
npm run test:integration -- tests/integration/expression-diagnostics/uncertaintyAxis.integration.test.js --verbose

# Run all integration tests
npm run test:integration

# Lint new test file
npx eslint tests/integration/expression-diagnostics/uncertaintyAxis.integration.test.js

# Full CI check
npm run test:ci
```

## Definition of Done

- [ ] `uncertaintyAxis.integration.test.js` created
- [ ] Tests verify MOOD_AXES includes uncertainty
- [ ] Tests verify random state generation includes uncertainty
- [ ] Tests verify expression context includes uncertainty
- [ ] Tests verify gate evaluation with uncertainty conditions
- [ ] Tests verify prototype intensity calculation with uncertainty
- [ ] Tests verify all 9 epistemic prototypes have uncertainty weights
- [ ] Tests verify confusion vs frustration differentiation
- [ ] `npm run test:integration` passes completely
- [ ] `npm run test:ci` passes completely
- [ ] Test file properly linted
