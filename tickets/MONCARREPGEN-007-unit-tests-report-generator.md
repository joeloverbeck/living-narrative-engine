# MONCARREPGEN-007: Unit Tests - Report Generator

## Summary

Create comprehensive unit tests for `MonteCarloReportGenerator` covering all report sections, flag detection logic, and edge cases.

## Priority: High | Effort: Medium

## Rationale

Unit tests ensure:
- Report format matches specification exactly
- Flag detection thresholds are correct
- Edge cases (0% trigger rate, missing data) are handled
- Rarity categories match defined thresholds
- Number formatting is consistent

## Dependencies

- **MONCARREPGEN-001** - MonteCarloReportGenerator class must exist

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js` | **Create** |

## Out of Scope

- **DO NOT** modify MonteCarloReportGenerator.js
- **DO NOT** create integration tests - that's MONCARREPGEN-009
- **DO NOT** test modal functionality - that's MONCARREPGEN-008
- **DO NOT** test actual simulation - use mock data only

## Implementation Details

### Test File Structure

```javascript
/**
 * @file Unit tests for MonteCarloReportGenerator
 * @see specs/monte-carlo-report-generator.md
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import MonteCarloReportGenerator from '../../../../src/expressionDiagnostics/services/MonteCarloReportGenerator.js';

describe('MonteCarloReportGenerator', () => {
  let generator;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    generator = new MonteCarloReportGenerator({ logger: mockLogger });
  });

  // Test sections below...
});
```

### Mock Data Fixtures

```javascript
const createMockSimulationResult = (overrides = {}) => ({
  triggerRate: 0.15,
  triggerCount: 1500,
  sampleCount: 10000,
  confidenceInterval: { low: 0.14, high: 0.16 },
  distribution: 'uniform',
  clauseFailures: [],
  ...overrides,
});

const createMockBlocker = (overrides = {}) => ({
  clauseDescription: 'emotions.joy >= 0.5',
  failureRate: 0.85,
  averageViolation: 0.25,
  rank: 1,
  severity: 'high',
  advancedAnalysis: {
    percentileAnalysis: { status: 'normal', insight: 'Distribution is normal' },
    nearMissAnalysis: { status: 'moderate', tunability: 'moderate', insight: 'Some near misses' },
    ceilingAnalysis: { status: 'achievable', achievable: true, headroom: 0.1, insight: 'Threshold is reachable' },
    lastMileAnalysis: { status: 'moderate', isDecisive: false, insight: 'Not decisive' },
    recommendation: { action: 'tune_threshold', priority: 'medium', message: 'Consider adjusting threshold' },
  },
  hierarchicalBreakdown: {
    variablePath: 'emotions.joy',
    comparisonOperator: '>=',
    thresholdValue: 0.5,
    violationP50: 0.2,
    violationP90: 0.4,
    nearMissRate: 0.08,
    nearMissEpsilon: 0.05,
    maxObservedValue: 0.6,
    ceilingGap: -0.1,
    lastMileFailRate: 0.3,
    othersPassedCount: 5000,
    isSingleClause: false,
  },
  ...overrides,
});
```

### Test Categories

#### 1. Constructor Tests
```javascript
describe('Constructor', () => {
  it('should create instance with valid logger', () => {
    expect(generator).toBeInstanceOf(MonteCarloReportGenerator);
  });

  it('should throw if logger is missing', () => {
    expect(() => new MonteCarloReportGenerator({})).toThrow();
  });

  it('should throw if logger lacks required methods', () => {
    expect(() => new MonteCarloReportGenerator({ logger: {} })).toThrow();
  });
});
```

#### 2. Generate Method Tests
```javascript
describe('generate()', () => {
  it('should return string containing all required sections', () => {
    const result = createMockSimulationResult();
    const blockers = [createMockBlocker()];

    const report = generator.generate({
      expressionName: 'test:expression',
      simulationResult: result,
      blockers,
      summary: 'Test summary',
    });

    expect(typeof report).toBe('string');
    expect(report).toContain('# Monte Carlo Analysis Report');
    expect(report).toContain('## Executive Summary');
    expect(report).toContain('## Blocker Analysis');
    expect(report).toContain('## Legend');
  });

  it('should include expression name in header', () => {
    const report = generator.generate({
      expressionName: 'my_custom:expression',
      simulationResult: createMockSimulationResult(),
      blockers: [],
      summary: '',
    });

    expect(report).toContain('my_custom:expression');
  });

  it('should include timestamp in header', () => {
    const report = generator.generate({
      expressionName: 'test:exp',
      simulationResult: createMockSimulationResult(),
      blockers: [],
      summary: '',
    });

    // Check for ISO date format pattern
    expect(report).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
```

#### 3. Flag Detection Tests
```javascript
describe('Flag Detection', () => {
  describe('[CEILING] flag', () => {
    it('should add CEILING flag when ceilingAnalysis status is ceiling_detected', () => {
      const blocker = createMockBlocker({
        advancedAnalysis: {
          ...createMockBlocker().advancedAnalysis,
          ceilingAnalysis: { status: 'ceiling_detected' },
        },
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });

      expect(report).toContain('[CEILING]');
    });

    it('should NOT add CEILING flag when status is achievable', () => {
      const blocker = createMockBlocker();
      // Default mock has achievable status

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });

      expect(report).not.toContain('[CEILING]');
    });
  });

  describe('[DECISIVE] flag', () => {
    it('should add DECISIVE flag when lastMileAnalysis.isDecisive is true', () => {
      const blocker = createMockBlocker({
        advancedAnalysis: {
          ...createMockBlocker().advancedAnalysis,
          lastMileAnalysis: { status: 'decisive_blocker', isDecisive: true },
        },
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });

      expect(report).toContain('[DECISIVE]');
    });

    it('should add DECISIVE flag when isSingleClause is true', () => {
      const blocker = createMockBlocker({
        hierarchicalBreakdown: {
          ...createMockBlocker().hierarchicalBreakdown,
          isSingleClause: true,
        },
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });

      expect(report).toContain('[DECISIVE]');
    });
  });

  describe('[TUNABLE] flag', () => {
    it('should add TUNABLE flag when nearMissRate > 0.10', () => {
      const blocker = createMockBlocker({
        hierarchicalBreakdown: {
          ...createMockBlocker().hierarchicalBreakdown,
          nearMissRate: 0.15,
        },
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });

      expect(report).toContain('[TUNABLE]');
    });
  });

  describe('[UPSTREAM] flag', () => {
    it('should add UPSTREAM flag when nearMissRate < 0.02', () => {
      const blocker = createMockBlocker({
        hierarchicalBreakdown: {
          ...createMockBlocker().hierarchicalBreakdown,
          nearMissRate: 0.01,
        },
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });

      expect(report).toContain('[UPSTREAM]');
    });
  });

  describe('[OUTLIERS-SKEW] flag', () => {
    it('should add OUTLIERS-SKEW flag when p50 < avg * 0.5', () => {
      const blocker = createMockBlocker({
        averageViolation: 0.4,
        hierarchicalBreakdown: {
          ...createMockBlocker().hierarchicalBreakdown,
          violationP50: 0.1, // 0.1 < 0.4 * 0.5 = 0.2
        },
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });

      expect(report).toContain('[OUTLIERS-SKEW]');
    });
  });

  describe('[SEVERE-TAIL] flag', () => {
    it('should add SEVERE-TAIL flag when p90 > avg * 2', () => {
      const blocker = createMockBlocker({
        averageViolation: 0.2,
        hierarchicalBreakdown: {
          ...createMockBlocker().hierarchicalBreakdown,
          violationP90: 0.5, // 0.5 > 0.2 * 2 = 0.4
        },
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });

      expect(report).toContain('[SEVERE-TAIL]');
    });
  });
});
```

#### 4. Rarity Category Tests
```javascript
describe('Rarity Categories', () => {
  it('should show "impossible" for 0% trigger rate', () => {
    const result = createMockSimulationResult({ triggerRate: 0 });
    const report = generator.generate({
      expressionName: 'test',
      simulationResult: result,
      blockers: [],
      summary: '',
    });
    expect(report).toContain('impossible');
  });

  it('should show "extremely_rare" for < 0.001% trigger rate', () => {
    const result = createMockSimulationResult({ triggerRate: 0.000005 });
    const report = generator.generate({
      expressionName: 'test',
      simulationResult: result,
      blockers: [],
      summary: '',
    });
    expect(report).toContain('extremely_rare');
  });

  it('should show "rare" for < 0.05% trigger rate', () => {
    const result = createMockSimulationResult({ triggerRate: 0.0002 });
    const report = generator.generate({
      expressionName: 'test',
      simulationResult: result,
      blockers: [],
      summary: '',
    });
    expect(report).toContain('rare');
  });

  it('should show "normal" for < 2% trigger rate', () => {
    const result = createMockSimulationResult({ triggerRate: 0.01 });
    const report = generator.generate({
      expressionName: 'test',
      simulationResult: result,
      blockers: [],
      summary: '',
    });
    expect(report).toContain('normal');
  });

  it('should show "frequent" for >= 2% trigger rate', () => {
    const result = createMockSimulationResult({ triggerRate: 0.05 });
    const report = generator.generate({
      expressionName: 'test',
      simulationResult: result,
      blockers: [],
      summary: '',
    });
    expect(report).toContain('frequent');
  });
});
```

#### 5. Edge Case Tests
```javascript
describe('Edge Cases', () => {
  it('should handle empty blockers array', () => {
    const report = generator.generate({
      expressionName: 'test',
      simulationResult: createMockSimulationResult(),
      blockers: [],
      summary: 'No blockers',
    });

    expect(report).toContain('# Monte Carlo Analysis Report');
    expect(report).toContain('## Legend');
  });

  it('should handle missing advancedAnalysis', () => {
    const blocker = { ...createMockBlocker(), advancedAnalysis: undefined };

    expect(() => {
      generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });
    }).not.toThrow();
  });

  it('should handle missing hierarchicalBreakdown', () => {
    const blocker = { ...createMockBlocker(), hierarchicalBreakdown: undefined };

    expect(() => {
      generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });
    }).not.toThrow();
  });

  it('should handle null/undefined values gracefully', () => {
    const blocker = createMockBlocker({
      advancedAnalysis: {
        percentileAnalysis: null,
        nearMissAnalysis: null,
        ceilingAnalysis: null,
        lastMileAnalysis: null,
        recommendation: null,
      },
    });

    expect(() => {
      generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });
    }).not.toThrow();
  });

  it('should handle 100% trigger rate', () => {
    const result = createMockSimulationResult({
      triggerRate: 1.0,
      triggerCount: 10000,
    });

    const report = generator.generate({
      expressionName: 'test',
      simulationResult: result,
      blockers: [],
      summary: '',
    });

    expect(report).toContain('100');
  });
});
```

#### 6. Format Verification Tests
```javascript
describe('Format Verification', () => {
  it('should display percentages as 0-100 scale', () => {
    const result = createMockSimulationResult({ triggerRate: 0.15 });

    const report = generator.generate({
      expressionName: 'test',
      simulationResult: result,
      blockers: [],
      summary: '',
    });

    expect(report).toContain('15');
    expect(report).toContain('%');
  });

  it('should include confidence interval bounds', () => {
    const result = createMockSimulationResult({
      confidenceInterval: { low: 0.12, high: 0.18 },
    });

    const report = generator.generate({
      expressionName: 'test',
      simulationResult: result,
      blockers: [],
      summary: '',
    });

    expect(report).toMatch(/12.*%.*18.*%/s);
  });

  it('should include sample count', () => {
    const result = createMockSimulationResult({ sampleCount: 50000 });

    const report = generator.generate({
      expressionName: 'test',
      simulationResult: result,
      blockers: [],
      summary: '',
    });

    expect(report).toContain('50000');
  });

  it('should include distribution type', () => {
    const result = createMockSimulationResult({ distribution: 'gaussian' });

    const report = generator.generate({
      expressionName: 'test',
      simulationResult: result,
      blockers: [],
      summary: '',
    });

    expect(report).toContain('gaussian');
  });
});
```

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js --verbose --coverage
```

### Coverage Requirements

- **Statements**: >= 90%
- **Branches**: >= 85%
- **Functions**: >= 90%
- **Lines**: >= 90%

### Invariants That Must Remain True

1. **Mock isolation**: Tests use only mock data, no real simulation
2. **No side effects**: Tests don't modify any external state
3. **Deterministic**: Tests produce same results on every run
4. **Fast execution**: All tests complete in < 5 seconds

## Verification Commands

```bash
# Run tests with coverage
npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js --verbose --coverage

# Run in watch mode during development
npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js --watch

# Lint test file
npx eslint tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js
```

## Definition of Done

- [ ] Test file created at correct path
- [ ] All imports resolved correctly
- [ ] Mock fixtures created for simulation result and blockers
- [ ] Constructor tests: valid logger, missing logger, invalid logger
- [ ] Generate method tests: all sections present, expression name, timestamp
- [ ] Flag tests: all 6 flags with positive and negative cases
- [ ] Rarity tests: all 5 categories with boundary values
- [ ] Edge cases: empty blockers, missing data, null values, 100% rate
- [ ] Format tests: percentages, CI, sample count, distribution
- [ ] All tests pass
- [ ] Coverage meets thresholds
- [ ] Test file passes ESLint
- [ ] Tests run in < 5 seconds
