# EXPDIAMONCARREFREP-010: Extract ReportOrchestrator from Controller

## Summary
Extract report generation orchestration logic from `ExpressionDiagnosticsController` into a dedicated `ReportOrchestrator` service. This keeps report workflow coordination (sensitivity + report assembly) out of the UI controller while preserving current inputs/outputs.

## Current State (Reassessed)
- `ExpressionDiagnosticsController#handleGenerateReport()` pulls `expressionName`, `summary`, `storedContexts`, `prerequisites`, and `staticAnalysis` from controller state, computes sensitivity/global sensitivity via `SensitivityAnalyzer`, calls `MonteCarloReportGenerator.generate(...)`, then calls `MonteCarloReportModal.showReport(...)`.
- The controller guard is `#currentResult` + `#selectedExpression`, not `#lastSimulationResult`.
- `MonteCarloReportModal` exposes `showReport(...)` (not `show(...)`).
- `MonteCarloReportGenerator` expects `expressionName`, `summary`, `simulationResult`, `blockers`, `prerequisites`, `sensitivityData`, `globalSensitivityData`, and `staticAnalysis`.
- `MonteCarloReportGenerator` and `MonteCarloReportModal` are instantiated in `src/expression-diagnostics.js` (not via DI), and there is no DI token for `IMonteCarloReportGenerator`.

Reference: `reports/expression-diagnostics-monte-carlo-refactor-report.md`.

## Files to Create

| File | Action | Description |
|------|--------|-------------|
| `src/expressionDiagnostics/services/ReportOrchestrator.js` | Create | New service for report workflow orchestration |
| `tests/unit/expressionDiagnostics/services/reportOrchestrator.test.js` | Create | Unit tests for the orchestrator |

## Files to Modify

| File | Action | Changes |
|------|--------|---------|
| `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` | Modify | Delegate `#handleGenerateReport` to orchestrator |

## Out of Scope

- **DO NOT** modify `MonteCarloReportGenerator` itself
- **DO NOT** modify `MonteCarloReportModal` rendering
- **DO NOT** change the report markdown format
- **DO NOT** modify sensitivity analysis logic (done in EXPDIAMONCARREFREP-008)

## Acceptance Criteria

### Tests That Must Pass
1. All existing tests in `tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js`
2. All integration tests in `tests/integration/expression-diagnostics/monteCarloReport.integration.test.js`
3. New test: `ReportOrchestrator.generateReport()` returns markdown string
4. New test: `ReportOrchestrator` coordinates with `SensitivityAnalyzer`
5. New test: `ReportOrchestrator` coordinates with `MonteCarloReportGenerator`
6. New test: `ReportOrchestrator` handles missing simulation result gracefully

### Invariants That Must Remain True
1. Report markdown output unchanged
2. Modal display behavior unchanged
3. Report generation workflow unchanged (sensitivity → static analysis → markdown)

## Implementation Notes

### Current Controller Logic to Extract

From `ExpressionDiagnosticsController.js`:
```javascript
// #handleGenerateReport orchestrates:
async #handleGenerateReport() {
  // 1. Guard: Ensure results + expression are present
  if (!this.#currentResult || !this.#selectedExpression) {
    this.#logger.warn('Cannot generate report: no simulation results');
    return;
  }

  // 2. Gather inputs
  const expressionName = this.#getExpressionName(this.#selectedExpression.id);
  const summary = this.#mcSummary?.textContent || '';
  const staticAnalysis = {
    gateConflicts: this.#currentResult.gateConflicts || [],
    unreachableThresholds: this.#currentResult.unreachableThresholds || [],
  };

  // 3. Compute sensitivity + generate report markdown
  const reportMarkdown = this.#reportOrchestrator.generateReport({
    expressionName,
    summary,
    simulationResult: this.#rawSimulationResult,
    blockers: this.#currentBlockers,
    prerequisites: this.#selectedExpression?.prerequisites ?? null,
    staticAnalysis,
  });

  // 4. Display in modal
  this.#reportModal.showReport(reportMarkdown);
}
```

### ReportOrchestrator Interface
```javascript
/**
 * @file Orchestrates report generation workflow for expression diagnostics
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

class ReportOrchestrator {
  #logger;
  #sensitivityAnalyzer;
  #monteCarloReportGenerator;

  constructor({ logger, sensitivityAnalyzer, monteCarloReportGenerator }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });
    validateDependency(sensitivityAnalyzer, 'ISensitivityAnalyzer', logger, {
      requiredMethods: ['computeSensitivityData', 'computeGlobalSensitivityData']
    });
    validateDependency(monteCarloReportGenerator, 'IMonteCarloReportGenerator', logger, {
      requiredMethods: ['generate']
    });

    this.#logger = logger;
    this.#sensitivityAnalyzer = sensitivityAnalyzer;
    this.#monteCarloReportGenerator = monteCarloReportGenerator;
  }

  /**
   * Generate a complete Monte Carlo analysis report.
   * @param {Object} params - Report parameters
   * @param {Object} params.simulationResult - Result from MonteCarloSimulator.simulate()
   * @param {Array} params.blockers - Hierarchical blocker data
   * @param {Object} params.prerequisites - Expression prerequisites
   * @param {Object} params.staticAnalysis - Static analysis results (optional)
   * @returns {string} Report markdown
   */
  generateReport({ simulationResult, blockers, prerequisites, staticAnalysis = null }) {
    if (!simulationResult) {
      this.#logger.warn('ReportOrchestrator: No simulation result provided');
      return '';
    }

    const storedContexts = simulationResult.storedContexts ?? [];

    // 1. Compute sensitivity data
    const sensitivityData = this.#sensitivityAnalyzer.computeSensitivityData(
      storedContexts, blockers
    );
    const globalSensitivityData = this.#sensitivityAnalyzer.computeGlobalSensitivityData(
      storedContexts, blockers, prerequisites
    );

    // 2. Generate report
    const reportMarkdown = this.#monteCarloReportGenerator.generate({
      simulationResult,
      sensitivityData,
      globalSensitivityData,
      staticAnalysis,
      blockers,
    });

    this.#logger.info('ReportOrchestrator: Report generated successfully');
    return reportMarkdown;
  }
}

export default ReportOrchestrator;
```

### Controller Update
```javascript
// In ExpressionDiagnosticsController
constructor({
  // ... existing deps
}) {
  this.#reportOrchestrator = new ReportOrchestrator({
    logger,
    sensitivityAnalyzer,
    monteCarloReportGenerator: reportGenerator,
  });
}

async #handleGenerateReport() {
  if (!this.#lastSimulationResult) {
    this.#logger.warn('No simulation result available');
    return;
  }

  const staticAnalysis = this.#collectStaticAnalysis();

  // Delegate to orchestrator
  const reportMarkdown = this.#reportOrchestrator.generateReport({
    expressionName,
    summary,
    simulationResult: this.#rawSimulationResult,
    blockers: this.#currentBlockers,
    prerequisites: this.#selectedExpression?.prerequisites ?? null,
    staticAnalysis,
  });

  this.#reportModal.showReport(reportMarkdown);
}
```

## Verification Commands
```bash
npm run test:unit -- --testPathPattern="reportOrchestrator"
npm run test:unit -- --testPathPattern="ExpressionDiagnosticsController"
npm run test:integration -- --testPathPattern="monteCarloReport"
npm run typecheck
npx eslint src/expressionDiagnostics/services/ReportOrchestrator.js src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js
```

## Dependencies
- **Depends on**: EXPDIAMONCARREFREP-008 (SensitivityAnalyzer must exist), EXPDIAMONCARREFREP-009 (tests)
- **Blocks**: None

## Status
Completed

## Outcome
- Created `ReportOrchestrator` and moved sensitivity/report assembly there while keeping controller guards and modal display behavior.
- Kept report generator + modal construction unchanged (no DI token added) to avoid expanding scope beyond the controller extraction.
