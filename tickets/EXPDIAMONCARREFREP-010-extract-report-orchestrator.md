# EXPDIAMONCARREFREP-010: Extract ReportOrchestrator from Controller

## Summary
Extract report generation orchestration logic from `ExpressionDiagnosticsController` into a dedicated `ReportOrchestrator` service. This separates the workflow coordination from UI handling.

## Files to Create

| File | Action | Description |
|------|--------|-------------|
| `src/expressionDiagnostics/services/ReportOrchestrator.js` | Create | New service for report workflow orchestration |
| `tests/unit/expressionDiagnostics/services/reportOrchestrator.test.js` | Create | Unit tests for the orchestrator |

## Files to Modify

| File | Action | Changes |
|------|--------|---------|
| `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` | Modify | Delegate `#handleGenerateReport` to orchestrator |
| `src/dependencyInjection/tokens/tokens-diagnostics.js` | Modify | Add `IReportOrchestrator` token |
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | Modify | Register orchestrator |

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
3. Controller line count reduced by ~100 lines
4. Report generation workflow unchanged (sensitivity → static analysis → markdown)

## Implementation Notes

### Current Controller Logic to Extract

From `ExpressionDiagnosticsController.js`:
```javascript
// #handleGenerateReport orchestrates:
async #handleGenerateReport() {
  // 1. Guard: Check simulation result exists
  if (!this.#lastSimulationResult) {
    this.#logger.warn('No simulation result available');
    return;
  }

  // 2. Compute sensitivity data
  const sensitivityData = this.#computeSensitivityData(...);
  const globalSensitivityData = this.#computeGlobalSensitivityData(...);

  // 3. Collect static analysis
  const staticAnalysis = this.#collectStaticAnalysis();

  // 4. Generate report markdown
  const reportMarkdown = this.#monteCarloReportGenerator.generate({
    simulationResult: this.#lastSimulationResult,
    sensitivityData,
    globalSensitivityData,
    staticAnalysis,
    blockers: this.#lastBlockers,
  });

  // 5. Display in modal
  this.#reportModal.show(reportMarkdown);
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
   * @param {Object} params.simulationResult - Result from MonteCarloSimulator.run()
   * @param {Array} params.storedContexts - Stored simulation contexts
   * @param {Array} params.blockers - Hierarchical blocker data
   * @param {Object} params.prerequisites - Expression prerequisites
   * @param {Object} params.staticAnalysis - Static analysis results (optional)
   * @returns {string} Report markdown
   */
  generateReport({ simulationResult, storedContexts, blockers, prerequisites, staticAnalysis = null }) {
    if (!simulationResult) {
      this.#logger.warn('ReportOrchestrator: No simulation result provided');
      return '';
    }

    // 1. Compute sensitivity data
    const sensitivityData = this.#sensitivityAnalyzer.computeSensitivityData(
      storedContexts, blockers, prerequisites
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
  reportOrchestrator,  // NEW
}) {
  this.#reportOrchestrator = reportOrchestrator;
}

async #handleGenerateReport() {
  if (!this.#lastSimulationResult) {
    this.#logger.warn('No simulation result available');
    return;
  }

  const staticAnalysis = this.#collectStaticAnalysis();

  // Delegate to orchestrator
  const reportMarkdown = this.#reportOrchestrator.generateReport({
    simulationResult: this.#lastSimulationResult,
    storedContexts: this.#lastStoredContexts,
    blockers: this.#lastBlockers,
    prerequisites: this.#currentPrerequisites,
    staticAnalysis,
  });

  if (reportMarkdown) {
    this.#reportModal.show(reportMarkdown);
  }
}
```

### DI Registration
```javascript
// In tokens-diagnostics.js
IReportOrchestrator: 'IReportOrchestrator',

// In expressionDiagnosticsRegistrations.js
container.registerFactory(tokens.IReportOrchestrator, (c) => {
  return new ReportOrchestrator({
    logger: c.resolve(coreTokens.ILogger),
    sensitivityAnalyzer: c.resolve(tokens.ISensitivityAnalyzer),
    monteCarloReportGenerator: c.resolve(tokens.IMonteCarloReportGenerator),
  });
});
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
