# EXPDIAMONCARREFREP-009: Add SensitivityAnalyzer Unit Tests

## Summary
Create comprehensive unit tests for the extracted `SensitivityAnalyzer` service. These tests validate sensitivity computation logic in isolation from the controller.

## Files to Create

| File | Action | Description |
|------|--------|-------------|
| `tests/unit/expressionDiagnostics/services/sensitivityAnalyzer.test.js` | Create | Unit tests for SensitivityAnalyzer |

## Out of Scope

- **DO NOT** modify any production code
- **DO NOT** create integration tests (that's EXPDIAMONCARREFREP-013)
- **DO NOT** modify controller tests
- **DO NOT** modify SensitivityAnalyzer implementation

## Acceptance Criteria

### Tests That Must Be Added

#### Constructor Validation
1. Test: Constructor validates `logger` dependency
2. Test: Constructor validates `monteCarloSimulator` dependency
3. Test: Throws error for missing dependencies

#### computeSensitivityData()
1. Test: Returns valid sensitivity grid for simple condition
2. Test: Returns empty grid when no storedContexts provided
3. Test: Handles multiple conditions in prerequisites
4. Test: Correctly extracts conditions from JSON Logic prerequisites
5. Test: Integrates with `monteCarloSimulator.computeThresholdSensitivity()`

#### computeGlobalSensitivityData()
1. Test: Aggregates sensitivity across multiple expressions
2. Test: Handles empty blockers array
3. Test: Returns correct structure with threshold ranges

#### flattenLeaves()
1. Test: Flattens single-level hierarchy
2. Test: Flattens multi-level AND/OR hierarchy
3. Test: Returns empty array for empty input
4. Test: Handles leaf nodes with `clauseDescription` property

#### calculateWilsonInterval()
1. Test: Returns correct interval for 50% success rate
2. Test: Returns correct interval for 0% success rate
3. Test: Returns correct interval for 100% success rate
4. Test: Uses default z=1.96 when not specified
5. Test: Accepts custom z-score parameter
6. Test: Handles edge case of total=0 (no division by zero)

### Test Coverage Target
- Statement coverage >= 90%
- Branch coverage >= 85%
- Function coverage >= 95%

### Invariants That Must Remain True
1. Tests follow Jest `describe/it` conventions
2. Tests use mock dependencies (not real MonteCarloSimulator)
3. Tests are independent and can run in isolation
4. No production code modifications

## Implementation Notes

### Test Structure Template
```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import SensitivityAnalyzer from '../../../../src/expressionDiagnostics/services/SensitivityAnalyzer.js';

describe('SensitivityAnalyzer', () => {
  let analyzer;
  let mockLogger;
  let mockMonteCarloSimulator;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockMonteCarloSimulator = {
      computeThresholdSensitivity: jest.fn().mockReturnValue({
        grid: [[0.5, 0.6, 0.7]],
        thresholds: [0.3, 0.5, 0.7],
      }),
    };

    analyzer = new SensitivityAnalyzer({
      logger: mockLogger,
      monteCarloSimulator: mockMonteCarloSimulator,
    });
  });

  describe('constructor', () => {
    it('validates logger dependency', () => {
      expect(() => new SensitivityAnalyzer({
        logger: null,
        monteCarloSimulator: mockMonteCarloSimulator,
      })).toThrow();
    });

    it('validates monteCarloSimulator dependency', () => {
      expect(() => new SensitivityAnalyzer({
        logger: mockLogger,
        monteCarloSimulator: null,
      })).toThrow();
    });
  });

  describe('computeSensitivityData()', () => {
    it('returns valid sensitivity grid for simple condition', () => {
      const storedContexts = [{ emotions: { joy: 0.5 } }];
      const blockers = [];
      const prerequisites = { '>': [{ var: 'emotions.joy' }, 0.3] };

      const result = analyzer.computeSensitivityData(storedContexts, blockers, prerequisites);

      expect(result).toHaveProperty('grid');
      expect(result).toHaveProperty('thresholds');
    });

    it('returns empty grid when no storedContexts provided', () => {
      const result = analyzer.computeSensitivityData([], [], {});

      expect(result.grid).toEqual([]);
    });
  });

  describe('calculateWilsonInterval()', () => {
    it('returns correct interval for 50% success rate', () => {
      const result = analyzer.calculateWilsonInterval(50, 100);

      expect(result.center).toBeCloseTo(0.5, 2);
      expect(result.lower).toBeLessThan(0.5);
      expect(result.upper).toBeGreaterThan(0.5);
    });

    it('handles edge case of total=0', () => {
      const result = analyzer.calculateWilsonInterval(0, 0);

      expect(result.lower).toBe(0);
      expect(result.upper).toBe(0);
      expect(result.center).toBe(0);
    });
  });

  describe('flattenLeaves()', () => {
    it('flattens multi-level hierarchy', () => {
      const blockers = [{
        type: 'and',
        children: [
          { type: 'leaf', clauseDescription: 'condition A' },
          {
            type: 'or',
            children: [
              { type: 'leaf', clauseDescription: 'condition B' },
              { type: 'leaf', clauseDescription: 'condition C' },
            ]
          }
        ]
      }];

      const leaves = analyzer.flattenLeaves(blockers);

      expect(leaves).toHaveLength(3);
      expect(leaves.map(l => l.clauseDescription)).toEqual([
        'condition A', 'condition B', 'condition C'
      ]);
    });
  });
});
```

### Mock Fixtures
```javascript
// Common test fixtures
const createMockStoredContext = (overrides = {}) => ({
  emotions: { joy: 0.5, fear: 0.2, anger: 0.1, ...overrides.emotions },
  sexualStates: { aroused: 0.3, ...overrides.sexualStates },
  moodAxes: { valence: 0.5, arousal: 0.4, ...overrides.moodAxes },
});

const createMockBlocker = (description, failureRate = 0.5) => ({
  type: 'leaf',
  clauseDescription: description,
  failureRate,
});
```

## Verification Commands
```bash
npm run test:unit -- --testPathPattern="sensitivityAnalyzer" --coverage
```

## Dependencies
- **Depends on**: EXPDIAMONCARREFREP-008 (SensitivityAnalyzer must exist first)
- **Blocks**: EXPDIAMONCARREFREP-010 (report orchestrator uses sensitivity analyzer)
