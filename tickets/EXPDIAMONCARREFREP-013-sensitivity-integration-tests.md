# EXPDIAMONCARREFREP-013: Add Controller Sensitivity Computation Integration Tests

## Summary
Add integration tests verifying the controller properly coordinates sensitivity analysis with the extracted `SensitivityAnalyzer` service. These tests validate the end-to-end flow from simulation through sensitivity computation.

## Files to Create

| File | Action | Description |
|------|--------|-------------|
| `tests/integration/expression-diagnostics/sensitivityAnalysis.integration.test.js` | Create | Integration tests for sensitivity flow |

## Out of Scope

- **DO NOT** modify any production code
- **DO NOT** modify unit tests
- **DO NOT** modify other integration test files
- **DO NOT** test UI rendering (focus on data flow)

## Acceptance Criteria

### Tests That Must Be Added

#### End-to-End Sensitivity Flow
1. Test: Run simulation → compute sensitivity → verify grid structure
2. Test: Sensitivity data contains expected threshold ranges
3. Test: Sensitivity grid values are in [0, 1] range
4. Test: Multiple conditions produce separate sensitivity entries

#### Global Sensitivity Integration
1. Test: Global sensitivity aggregates across expression-level thresholds
2. Test: Global sensitivity respects expression hierarchy
3. Test: Global sensitivity handles empty blockers gracefully

#### Data Flow to Report Generator
1. Test: Sensitivity data flows correctly to `MonteCarloReportGenerator`
2. Test: Report includes sensitivity section when data available
3. Test: Report handles missing sensitivity data gracefully

#### Wilson Interval Integration
1. Test: Wilson intervals calculated for all conditions
2. Test: Interval widths decrease with more samples
3. Test: 95% confidence intervals (z=1.96) used by default

### Test Coverage Target
- Integration coverage for sensitivity data path >= 80%

### Invariants That Must Remain True
1. Tests follow project integration test patterns
2. Tests use real DI container (not mocks for services under test)
3. Tests may mock external dependencies (DataRegistry, LLM)
4. No production code modifications

## Implementation Notes

### Test Structure Template
```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { buildTestContainer } from '../../../helpers/testContainerBuilder.js';
import { tokens as diagnosticTokens } from '../../../../src/dependencyInjection/tokens/tokens-diagnostics.js';

describe('Sensitivity Analysis Integration', () => {
  let container;
  let controller;
  let sensitivityAnalyzer;
  let monteCarloSimulator;

  beforeEach(async () => {
    container = await buildTestContainer({
      withMockDataRegistry: true,
      withTestExpressions: true,
    });

    controller = container.resolve(diagnosticTokens.IExpressionDiagnosticsController);
    sensitivityAnalyzer = container.resolve(diagnosticTokens.ISensitivityAnalyzer);
    monteCarloSimulator = container.resolve(diagnosticTokens.IMonteCarloSimulator);
  });

  afterEach(() => {
    container.dispose();
  });

  describe('end-to-end sensitivity flow', () => {
    it('computes sensitivity grid after simulation', async () => {
      // Setup: Load test expression
      const expression = {
        id: 'test:sensitivity_expression',
        prerequisites: {
          '>': [{ var: 'emotions.joy' }, 0.5]
        }
      };

      // Act: Run simulation
      const simulationResult = monteCarloSimulator.run({
        expression,
        samples: 100,
        distribution: 'gaussian',
      });

      // Act: Compute sensitivity
      const sensitivityData = sensitivityAnalyzer.computeSensitivityData(
        simulationResult.storedContexts,
        simulationResult.blockers,
        expression.prerequisites
      );

      // Assert: Grid structure is valid
      expect(sensitivityData).toHaveProperty('grid');
      expect(sensitivityData).toHaveProperty('thresholds');
      expect(sensitivityData.thresholds).toBeInstanceOf(Array);
      expect(sensitivityData.thresholds.length).toBeGreaterThan(0);
    });

    it('sensitivity grid values are in [0, 1] range', async () => {
      const expression = {
        id: 'test:bounded_expression',
        prerequisites: {
          'and': [
            { '>': [{ var: 'emotions.joy' }, 0.3] },
            { '<': [{ var: 'emotions.fear' }, 0.7] },
          ]
        }
      };

      const simulationResult = monteCarloSimulator.run({
        expression,
        samples: 100,
        distribution: 'gaussian',
      });

      const sensitivityData = sensitivityAnalyzer.computeSensitivityData(
        simulationResult.storedContexts,
        simulationResult.blockers,
        expression.prerequisites
      );

      // Assert: All grid values are bounded
      for (const row of sensitivityData.grid) {
        for (const value of row) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe('global sensitivity integration', () => {
    it('aggregates sensitivity across expression-level thresholds', async () => {
      const expression = {
        id: 'test:multi_condition',
        prerequisites: {
          'and': [
            { '>': [{ var: 'emotions.joy' }, 0.5] },
            { '>': [{ var: 'emotions.excitement' }, 0.3] },
            { '<': [{ var: 'emotions.fear' }, 0.4] },
          ]
        }
      };

      const simulationResult = monteCarloSimulator.run({
        expression,
        samples: 200,
        distribution: 'gaussian',
      });

      const globalSensitivity = sensitivityAnalyzer.computeGlobalSensitivityData(
        simulationResult.storedContexts,
        simulationResult.blockers,
        expression.prerequisites
      );

      // Assert: Global data captures all conditions
      expect(globalSensitivity).toBeDefined();
      expect(globalSensitivity.conditions).toHaveLength(3);
    });
  });

  describe('Wilson interval integration', () => {
    it('interval widths decrease with more samples', async () => {
      const expression = {
        id: 'test:interval_width',
        prerequisites: { '>': [{ var: 'emotions.joy' }, 0.5] }
      };

      // Run with few samples
      const smallResult = monteCarloSimulator.run({
        expression,
        samples: 50,
        distribution: 'gaussian',
      });
      const smallSensitivity = sensitivityAnalyzer.computeSensitivityData(
        smallResult.storedContexts,
        smallResult.blockers,
        expression.prerequisites
      );

      // Run with more samples
      const largeResult = monteCarloSimulator.run({
        expression,
        samples: 500,
        distribution: 'gaussian',
      });
      const largeSensitivity = sensitivityAnalyzer.computeSensitivityData(
        largeResult.storedContexts,
        largeResult.blockers,
        expression.prerequisites
      );

      // Assert: Larger sample size produces tighter intervals
      const smallWidth = smallSensitivity.interval.upper - smallSensitivity.interval.lower;
      const largeWidth = largeSensitivity.interval.upper - largeSensitivity.interval.lower;
      expect(largeWidth).toBeLessThan(smallWidth);
    });
  });

  describe('report generator integration', () => {
    it('sensitivity data flows to report generator', async () => {
      const reportOrchestrator = container.resolve(diagnosticTokens.IReportOrchestrator);

      const expression = {
        id: 'test:report_flow',
        prerequisites: { '>': [{ var: 'emotions.joy' }, 0.5] }
      };

      const simulationResult = monteCarloSimulator.run({
        expression,
        samples: 100,
        distribution: 'gaussian',
      });

      const reportMarkdown = reportOrchestrator.generateReport({
        simulationResult,
        storedContexts: simulationResult.storedContexts,
        blockers: simulationResult.blockers,
        prerequisites: expression.prerequisites,
      });

      // Assert: Report contains sensitivity section
      expect(reportMarkdown).toContain('Sensitivity');
    });
  });
});
```

## Verification Commands
```bash
npm run test:integration -- --testPathPattern="sensitivityAnalysis.integration"
```

## Dependencies
- **Depends on**: EXPDIAMONCARREFREP-008 (SensitivityAnalyzer), EXPDIAMONCARREFREP-009 (unit tests)
- **Blocks**: None
