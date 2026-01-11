# EXPDIAMONCARREFREP-011: Add MonteCarloSimulator Temporal State Tests

## Summary
Add missing tests for temporal state handling in `MonteCarloSimulator`. The report identified that `previousEmotions`, `previousSexualStates`, and `previousMoodAxes` handling are not explicitly tested.

## Files to Modify

| File | Action | Changes |
|------|--------|---------|
| `tests/unit/expressionDiagnostics/services/monteCarloSimulator.temporalState.test.js` | Modify | Add comprehensive temporal state test cases |

## Out of Scope

- **DO NOT** modify any production code
- **DO NOT** modify other test files
- **DO NOT** add integration tests

## Acceptance Criteria

### Tests That Must Be Added

#### Previous Emotions Handling
1. Test: `previousEmotions` calculated from `previousMood` input
2. Test: `previousEmotions` is empty object when `previousMood` not provided
3. Test: `previousEmotions` values are in [0, 1] range (normalized)
4. Test: All emotion prototypes evaluated for `previousEmotions`

#### Previous Sexual States Handling
1. Test: `previousSexualStates` calculated from `previousSexual` input
2. Test: `previousSexualStates` is empty object when `previousSexual` not provided
3. Test: `previousSexualStates` values are in [0, 1] range

#### Previous Mood Axes Handling
1. Test: `previousMoodAxes` correctly passed through to context
2. Test: `previousMoodAxes` normalized from [-100, 100] to [-1, 1]

#### Temporal Expression Evaluation
1. Test: Expression `emotions.joy > previousEmotions.joy` evaluates correctly when increasing
2. Test: Expression `emotions.joy > previousEmotions.joy` evaluates correctly when decreasing
3. Test: Expression `emotions.fear < previousEmotions.fear` evaluates correctly
4. Test: Complex temporal expression with multiple previous references

#### Edge Cases
1. Test: First sample has no previous state (null/undefined handling)
2. Test: Identical current and previous states
3. Test: Maximum delta between current and previous states

### Test Coverage Target
- Temporal state methods >= 85% coverage
- All temporal context fields validated

### Invariants That Must Remain True
1. Tests follow existing patterns in `monteCarloSimulator.temporalState.test.js`
2. Tests use mock dependencies consistently
3. No production code modifications

## Implementation Notes

### Test Structure Template
```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MonteCarloSimulator from '../../../../src/expressionDiagnostics/services/MonteCarloSimulator.js';

describe('MonteCarloSimulator - Temporal State Extended', () => {
  let simulator;
  let mockLogger;
  let mockDataRegistry;
  let mockJsonLogicEvaluationService;
  let mockEmotionCalculatorAdapter;

  beforeEach(() => {
    // Setup mocks...
    mockDataRegistry = {
      get: jest.fn((category, id) => {
        if (id === 'core:emotion_prototypes') {
          return {
            entries: {
              joy: { weights: { valence: 1.0 }, gates: [] },
              fear: { weights: { arousal: 1.0, valence: -0.5 }, gates: [] },
            }
          };
        }
        return null;
      }),
    };

    // ... other mocks

    simulator = new MonteCarloSimulator({
      logger: mockLogger,
      dataRegistry: mockDataRegistry,
      jsonLogicEvaluationService: mockJsonLogicEvaluationService,
      emotionCalculatorAdapter: mockEmotionCalculatorAdapter,
    });
  });

  describe('previousEmotions calculation', () => {
    it('calculates previousEmotions from previousMood', () => {
      const result = simulator.run({
        expression: { logic: true },
        samples: 1,
        distribution: 'fixed',
        fixedState: {
          current: { mood: { valence: 50 }, sexual: {} },
          previous: { mood: { valence: 30 }, sexual: {} },
        },
      });

      const context = result.storedContexts[0];
      expect(context.previousEmotions).toBeDefined();
      expect(context.previousEmotions.joy).toBeDefined();
    });

    it('returns empty previousEmotions when previousMood not provided', () => {
      const result = simulator.run({
        expression: { logic: true },
        samples: 1,
        distribution: 'fixed',
        fixedState: {
          current: { mood: { valence: 50 }, sexual: {} },
          previous: null,
        },
      });

      const context = result.storedContexts[0];
      expect(context.previousEmotions).toEqual({});
    });
  });

  describe('temporal expression evaluation', () => {
    it('correctly evaluates emotions.joy > previousEmotions.joy when increasing', () => {
      mockJsonLogicEvaluationService.evaluate = jest.fn((logic, context) => {
        // Verify context has both current and previous emotions
        expect(context.emotions.joy).toBeGreaterThan(context.previousEmotions.joy);
        return true;
      });

      const result = simulator.run({
        expression: {
          logic: { '>': [{ var: 'emotions.joy' }, { var: 'previousEmotions.joy' }] }
        },
        samples: 10,
        distribution: 'fixed',
        fixedState: {
          current: { mood: { valence: 80 }, sexual: {} },
          previous: { mood: { valence: 20 }, sexual: {} },
        },
      });

      expect(result.triggerRate).toBe(1.0);
    });

    it('correctly evaluates when emotions decrease', () => {
      const result = simulator.run({
        expression: {
          logic: { '<': [{ var: 'emotions.joy' }, { var: 'previousEmotions.joy' }] }
        },
        samples: 10,
        distribution: 'fixed',
        fixedState: {
          current: { mood: { valence: 20 }, sexual: {} },
          previous: { mood: { valence: 80 }, sexual: {} },
        },
      });

      expect(result.triggerRate).toBe(1.0);
    });
  });

  describe('previousMoodAxes normalization', () => {
    it('normalizes previousMoodAxes from [-100,100] to [-1,1]', () => {
      const result = simulator.run({
        expression: { logic: true },
        samples: 1,
        distribution: 'fixed',
        fixedState: {
          current: { mood: { valence: 50 }, sexual: {} },
          previous: { mood: { valence: 100 }, sexual: {} },
        },
      });

      const context = result.storedContexts[0];
      expect(context.previousMoodAxes.valence).toBe(1.0); // 100/100
    });
  });

  describe('edge cases', () => {
    it('handles identical current and previous states', () => {
      const fixedMood = { valence: 50, arousal: 50 };
      const result = simulator.run({
        expression: {
          logic: { '==': [{ var: 'emotions.joy' }, { var: 'previousEmotions.joy' }] }
        },
        samples: 10,
        distribution: 'fixed',
        fixedState: {
          current: { mood: fixedMood, sexual: {} },
          previous: { mood: fixedMood, sexual: {} },
        },
      });

      expect(result.triggerRate).toBe(1.0);
    });
  });
});
```

## Verification Commands
```bash
npm run test:unit -- --testPathPattern="monteCarloSimulator.temporalState" --coverage
```

## Dependencies
- **Depends on**: None (can run independently)
- **Blocks**: None
