# EXPDIAMONCARREFREP-013: Add Sensitivity Analysis Integration Tests

## Summary
Add integration tests that validate the end-to-end sensitivity analysis flow from Monte Carlo simulation output through blocker analysis, `SensitivityAnalyzer`, and report generation. Focus on service integration and data flow (not UI rendering).

## Status
Completed.

## Files to Create

| File | Action | Description |
|------|--------|-------------|
| `tests/integration/expression-diagnostics/sensitivityAnalysis.integration.test.js` | Create | Integration tests for sensitivity flow |

## Out of Scope

- **DO NOT** modify unrelated production code
- **DO NOT** modify unit tests unless a new invariant is uncovered
- **DO NOT** modify other integration test files
- **DO NOT** test UI rendering (focus on data flow)

## Acceptance Criteria

### Tests That Must Be Added

#### End-to-End Sensitivity Flow
1. Test: Run simulation (with stored contexts) → analyze blockers → compute sensitivity → verify grid structure
2. Test: Sensitivity grid values are in [0, 1] range
3. Test: Multiple qualifying conditions produce separate sensitivity entries

#### Global Sensitivity Integration
1. Test: Global sensitivity uses prerequisites logic and returns expression-level grids
2. Test: Global sensitivity handles empty blockers or missing prerequisites gracefully

#### Data Flow to Report Generator
1. Test: Sensitivity data flows correctly to `MonteCarloReportGenerator`
2. Test: Report includes sensitivity section when data available
3. Test: Report handles missing sensitivity data gracefully

### Test Coverage Target
- Cover the sensitivity data path end-to-end (simulation → blockers → sensitivity → report).

### Invariants That Must Remain True
1. Tests follow project integration test patterns
2. Tests use real service implementations (no mocks for services under test)
3. Tests may stub external dependencies (DataRegistry, LLM)
4. Production code changes only if required to fix the sensitivity integration flow

## Implementation Notes

### Test Structure Template (aligned with existing integration patterns)
```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import MonteCarloSimulator from '../../../../src/expressionDiagnostics/services/MonteCarloSimulator.js';
import FailureExplainer from '../../../../src/expressionDiagnostics/services/FailureExplainer.js';
import SensitivityAnalyzer from '../../../../src/expressionDiagnostics/services/SensitivityAnalyzer.js';

describe('Sensitivity Analysis Integration', () => {
  let sensitivityAnalyzer;
  let monteCarloSimulator;
  let failureExplainer;

  beforeEach(async () => {
    // Instantiate real services with stubbed DataRegistry
    // (See hierarchicalBlockers.integration.test.js for similar setup.)
  });

  afterEach(() => {
    // Cleanup shared resources
  });

  describe('end-to-end sensitivity flow', () => {
    it('computes sensitivity grid after simulation', async () => {
      // Setup: Load test expression
      const expression = {
        id: 'test:sensitivity_expression',
        prerequisites: [
          { logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } },
        ],
      };

      // Act: Run simulation and analyze blockers
      const simulationResult = await monteCarloSimulator.simulate(expression, {
        sampleCount: 200,
        distribution: 'gaussian',
        storeSamplesForSensitivity: true,
      });
      const blockers = failureExplainer.analyzeHierarchicalBlockers(
        simulationResult.clauseFailures
      );

      // Act: Compute sensitivity
      const sensitivityData = sensitivityAnalyzer.computeSensitivityData(
        simulationResult.storedContexts,
        blockers
      );

      // Assert: Grid structure is valid
      expect(Array.isArray(sensitivityData)).toBe(true);
      expect(sensitivityData.length).toBeGreaterThan(0);
      expect(sensitivityData[0]).toHaveProperty('grid');
      expect(Array.isArray(sensitivityData[0].grid)).toBe(true);
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

      const simulationResult = await monteCarloSimulator.simulate(expression, {
        sampleCount: 200,
        distribution: 'gaussian',
        storeSamplesForSensitivity: true,
      });
      const blockers = failureExplainer.analyzeHierarchicalBlockers(
        simulationResult.clauseFailures
      );

      const sensitivityData = sensitivityAnalyzer.computeSensitivityData(
        simulationResult.storedContexts,
        blockers
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

      const simulationResult = await monteCarloSimulator.simulate(expression, {
        sampleCount: 300,
        distribution: 'gaussian',
        storeSamplesForSensitivity: true,
      });
      const blockers = failureExplainer.analyzeHierarchicalBlockers(
        simulationResult.clauseFailures
      );

      const globalSensitivity = sensitivityAnalyzer.computeGlobalSensitivityData(
        simulationResult.storedContexts,
        blockers,
        expression.prerequisites
      );

      // Assert: Global data captures all conditions
      expect(globalSensitivity).toBeDefined();
      expect(globalSensitivity.conditions).toHaveLength(3);
    });
  });

  describe('report generator integration', () => {
    it('sensitivity data flows to report generator', async () => {
      const reportOrchestrator = new ReportOrchestrator({
        logger,
        sensitivityAnalyzer,
        monteCarloReportGenerator,
      });

      const expression = {
        id: 'test:report_flow',
        prerequisites: [
          { logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } },
        ],
      };

      const simulationResult = await monteCarloSimulator.simulate(expression, {
        sampleCount: 200,
        distribution: 'gaussian',
        storeSamplesForSensitivity: true,
      });
      const blockers = failureExplainer.analyzeHierarchicalBlockers(
        simulationResult.clauseFailures
      );

      const reportMarkdown = reportOrchestrator.generateReport({
        expressionName: 'Test Expression',
        simulationResult,
        prerequisites: expression.prerequisites,
        blockers,
        summary: '',
      });

      // Assert: Report contains sensitivity section
      expect(reportMarkdown).toContain('Sensitivity');
    });
  });
});
```

## Verification Commands
```bash
npm run test:integration -- --testPathPatterns="sensitivityAnalysis.integration" --coverage=false
```

## Outcome
- Updated assumptions to match current service APIs and integration patterns.
- Added sensitivity integration coverage via a new integration test file using real services and stubbed data registry.
- No production code changes were required.

## Dependencies
- **Depends on**: EXPDIAMONCARREFREP-008 (SensitivityAnalyzer), EXPDIAMONCARREFREP-009 (unit tests)
- **Blocks**: None
