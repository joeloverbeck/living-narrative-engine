# MONCARREPGENREFANA-012: Create Report Generator Factory

## Summary

Create a factory function that wires extracted services together for use by the worker thread. This replaces manual service construction in MonteCarloReportWorker while preserving current report output.

## Status: Completed

## Priority: Medium | Effort: Low | Risk: LOW

## Rationale

The worker thread creates MonteCarloReportGenerator directly without the DI container. A factory function:
- Encapsulates all service wiring in one place
- Ensures consistent service composition
- Simplifies worker thread code
- Prepares for final orchestrator refactor

## Reassessed Assumptions (2026-01-15)

- MonteCarloReportGenerator already constructs its own services when not injected; the factory should still supply explicit wiring for parity and clarity.
- ReportIntegrityAnalyzer requires `formattingService`, `statisticalService`, `treeTraversal`, and `dataExtractor` (plus optional logger/prototype analyzer). It is not logger-only.
- BlockerTreeTraversal is currently dependency-free.
- SensitivitySectionGenerator in MonteCarloReportGenerator depends on a private sweep-warning builder; the factory should **not** override it unless a public builder is introduced.
- Worker integration tests already exist at `tests/integration/expression-diagnostics/monteCarloReportWorker.integration.test.js` and must be updated to use the factory.

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/reportGeneratorFactory.js` | **Create** - Factory function (~100 lines) |
| `tests/unit/expressionDiagnostics/services/reportGeneratorFactory.test.js` | **Create** - Unit tests |
| `src/expressionDiagnostics/workers/MonteCarloReportWorker.js` | **Modify** - Use factory |
| `src/expressionDiagnostics/services/index.js` | **Modify** - Export factory |
| `tests/integration/expression-diagnostics/monteCarloReportWorker.integration.test.js` | **Modify** - Use factory |

## Out of Scope

- **DO NOT** change MonteCarloReportGenerator.js (that's MONCARREPGENREFANA-013)
- **DO NOT** change any extracted service files
- **DO NOT** modify DI registrations (that's part of MONCARREPGENREFANA-013)
- **DO NOT** change any section generators

## Implementation Details

### Factory Function

```javascript
/**
 * @file reportGeneratorFactory - Creates fully wired MonteCarloReportGenerator
 *
 * This factory is used by the worker thread to create the report generator
 * without access to the DI container.
 */
import MonteCarloReportGenerator from './MonteCarloReportGenerator.js';
import ReportFormattingService from './ReportFormattingService.js';
import WitnessFormatter from './WitnessFormatter.js';
import StatisticalComputationService from './StatisticalComputationService.js';
import ReportDataExtractor from './ReportDataExtractor.js';
import BlockerTreeTraversal from './BlockerTreeTraversal.js';
import ReportIntegrityAnalyzer from './ReportIntegrityAnalyzer.js';
import {
  PrototypeSectionGenerator,
  BlockerSectionGenerator,
  CoreSectionGenerator,
} from './sectionGenerators/index.js';

/**
 * Creates a fully wired MonteCarloReportGenerator.
 *
 * @param {object} options
 * @param {object} options.logger - Required logger instance
 * @param {object} [options.prototypeConstraintAnalyzer] - Optional prototype analyzer
 * @param {object} [options.prototypeFitRankingService] - Optional ranking service
 * @param {object} [options.prototypeSynthesisService] - Optional synthesis service
 * @returns {MonteCarloReportGenerator}
 */
export function createReportGenerator({
  logger,
  prototypeConstraintAnalyzer = null,
  prototypeFitRankingService = null,
  prototypeSynthesisService = null,
}) {
  if (!logger) {
    throw new Error('createReportGenerator requires logger');
  }

  // Create utility services
  const formattingService = new ReportFormattingService();
  const witnessFormatter = new WitnessFormatter({ formattingService });
  const statisticalService = new StatisticalComputationService();
  const dataExtractor = new ReportDataExtractor({
    logger,
    prototypeConstraintAnalyzer,
  });
  const treeTraversal = new BlockerTreeTraversal();
  const integrityAnalyzer = new ReportIntegrityAnalyzer({
    formattingService,
    statisticalService,
    treeTraversal,
    dataExtractor,
    prototypeConstraintAnalyzer,
    logger,
  });

  // Create section generators
  const prototypeSectionGenerator = new PrototypeSectionGenerator({
    formattingService,
    prototypeConstraintAnalyzer,
    prototypeFitRankingService,
    prototypeSynthesisService,
    logger,
  });

  const blockerSectionGenerator = new BlockerSectionGenerator({
    formattingService,
    treeTraversal,
    dataExtractor,
    logger,
  });

  const coreSectionGenerator = new CoreSectionGenerator({
    formattingService,
    witnessFormatter,
    statisticalService,
    dataExtractor,
    logger,
  });

  // Create the main generator with all services wired
  return new MonteCarloReportGenerator({
    logger,
    prototypeConstraintAnalyzer,
    prototypeFitRankingService,
    prototypeSynthesisService,
    // Injected services (optional in constructor)
    formattingService,
    witnessFormatter,
    statisticalService,
    dataExtractor,
    treeTraversal,
    integrityAnalyzer,
    prototypeSectionGenerator,
    blockerSectionGenerator,
    coreSectionGenerator,
  });
}

export default createReportGenerator;
```

### Worker Integration

In MonteCarloReportWorker.js:
```javascript
import { createReportGenerator } from '../services/reportGeneratorFactory.js';

// Replace:
// const generator = new MonteCarloReportGenerator({ logger, ... });

// With:
const generator = createReportGenerator({
  logger: workerLogger,
  prototypeConstraintAnalyzer,
  prototypeFitRankingService,
  prototypeSynthesisService,
});
```

## Acceptance Criteria

### Tests That Must Pass

1. **New factory unit tests:**
   ```bash
   npm run test:unit -- tests/unit/expressionDiagnostics/services/reportGeneratorFactory.test.js --verbose
   ```

2. **Worker integration tests:**
   ```bash
   npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReportWorker.integration.test.js --verbose
   ```

3. **Snapshot test unchanged:**
   ```bash
   npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReportSnapshot.integration.test.js --verbose
   ```

### Invariants That Must Remain True

1. **Report output identical**: Snapshot test must pass unchanged
2. **Worker parity**: Worker produces identical output to main thread
3. **Optional services**: Factory works with or without prototype services
4. **Service wiring**: All services correctly composed; sensitivity warnings remain unchanged

## Verification Commands

```bash
# Run new unit tests
npm run test:unit -- tests/unit/expressionDiagnostics/services/reportGeneratorFactory.test.js --verbose

# Verify worker tests
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReportWorker.integration.test.js --verbose

# Verify snapshot unchanged
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReportSnapshot.integration.test.js --verbose

# Lint new files
npx eslint src/expressionDiagnostics/services/reportGeneratorFactory.js
```

## Definition of Done

- [x] reportGeneratorFactory.js created
- [x] Unit tests verify factory creates valid generator
- [x] Unit tests verify optional dependencies handled
- [x] MonteCarloReportWorker.js uses factory
- [x] index.js exports factory
- [x] Worker integration tests pass
- [x] Snapshot test passes unchanged
- [x] All existing tests pass

## Dependencies

- **Requires**: MONCARREPGENREFANA-008 through 011 (all section generators)
- **Blocks**: MONCARREPGENREFANA-013 (final orchestrator needs factory pattern established)

## Outcome

- Created a report generator factory that wires extracted services and leaves sensitivity warnings to MonteCarloReportGenerator's private builder.
- Updated worker and worker integration tests to use the factory, plus added unit coverage for the factory itself.
