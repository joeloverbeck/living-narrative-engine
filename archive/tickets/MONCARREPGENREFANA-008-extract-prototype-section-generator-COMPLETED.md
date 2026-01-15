# MONCARREPGENREFANA-008: Extract PrototypeSectionGenerator

## Summary

Extract the prototype section generation logic from `MonteCarloReportGenerator` into a dedicated `PrototypeSectionGenerator` service. This covers prototype fit analysis, implied prototypes, gap detection, and prototype math formatting for emotion/sexual threshold clauses.

## Status: Completed

## Priority: Medium | Effort: High | Risk: HIGHER

## Rationale

These methods:
- Form a cohesive domain for prototype analysis
- Are already exercised by `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.prototypeFit.test.js`
- Depend on injected prototype services + shared formatting/statistics/data-extraction helpers
- Generate complex report sections

## Files to Touch (Updated)

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/sectionGenerators/PrototypeSectionGenerator.js` | **Create** - New service (~400 lines) |
| `tests/unit/expressionDiagnostics/services/sectionGenerators/prototypeSectionGenerator.test.js` | **Create** - Unit tests |
| `src/expressionDiagnostics/services/sectionGenerators/index.js` | **Modify** - Add export |
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | **Modify** - Remove methods, add service usage |

## Out of Scope

- **DO NOT** change other section generators
- **DO NOT** change ReportIntegrityAnalyzer
- **DO NOT** change statistical computation methods
- **DO NOT** modify injected prototype services (prototypeConstraintAnalyzer, prototypeFitRankingService, prototypeSynthesisService)
- **DO NOT** modify DI registrations (services created internally for now)

## Methods to Extract (Updated)

```javascript
#performPrototypeFitAnalysis()
#generatePrototypeFitSection()
#generateImpliedPrototypeSection()
#generateGapDetectionSection()
#generatePrototypeMathSection()
#formatPrototypeAnalysis()
#generatePrototypeRecommendations()
#formatPrototypeRegimeStats()
#formatPrototypeRegimeRows()
#formatWeightsTable()
#formatGateStatus()
#formatGateCompatibilityBlock()
#buildFeasibilitySummary()
#formatFeasibilityBlock()
#resolveGateTraceTarget()
```

## Implementation Details (Updated)

### Service Structure

```javascript
/**
 * @file PrototypeSectionGenerator - Generates prototype-related report sections
 */
import ReportFormattingService from '../ReportFormattingService.js';

class PrototypeSectionGenerator {
  #formattingService;
  #prototypeConstraintAnalyzer;
  #prototypeFitRankingService;
  #statisticalService;
  #dataExtractor;
  #treeTraversal;
  #witnessFormatter;
  #logger;

  constructor({
    formattingService,
    prototypeConstraintAnalyzer = null,
    prototypeFitRankingService = null,
    statisticalService = null,
    dataExtractor = null,
    treeTraversal = null,
    witnessFormatter = null,
    logger = null,
  }) {
    if (!formattingService) {
      throw new Error('PrototypeSectionGenerator requires formattingService');
    }
    this.#formattingService = formattingService;
    this.#prototypeConstraintAnalyzer = prototypeConstraintAnalyzer;
    this.#prototypeFitRankingService = prototypeFitRankingService;
    this.#statisticalService = statisticalService;
    this.#dataExtractor = dataExtractor;
    this.#treeTraversal = treeTraversal;
    this.#witnessFormatter = witnessFormatter;
    this.#logger = logger;
  }

  /**
   * Generates the prototype fit section.
   * @param {object} context - Report generation context
   * @returns {string} Markdown section
   */
  generatePrototypeFitSection(context) { /* ... */ }

  // ... other methods
}

export default PrototypeSectionGenerator;
```

### Context Object Pattern

Section generators receive a context object containing:
```javascript
{
  expressionName,
  simulationResult,
  blockers,
  summary,
  prerequisites,
  sensitivityData,
  globalSensitivityData,
  staticAnalysis,
  // ... derived data passed by orchestrator
}
```

## Acceptance Criteria (Updated)

### Tests That Must Pass

1. **New PrototypeSectionGenerator unit tests:**
   ```bash
   npm run test:unit -- tests/unit/expressionDiagnostics/services/sectionGenerators/prototypeSectionGenerator.test.js --verbose
   ```

2. **Existing prototype fit tests still pass:**
   ```bash
   npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.prototypeFit.test.js --verbose
   ```

3. **Snapshot test unchanged:**
   ```bash
   npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReportSnapshot.integration.test.js --verbose
   ```

### Invariants That Must Remain True

1. **Report output identical**: Snapshot test must pass unchanged
2. **Optional services**: Works with or without prototype services
3. **Section format unchanged**: Same markdown structure and anchors
4. **Dependency injection**: Receives formattingService and optional prototype services

## Verification Commands (Updated)

```bash
# Run new unit tests
npm run test:unit -- tests/unit/expressionDiagnostics/services/sectionGenerators/prototypeSectionGenerator.test.js --verbose

# Verify prototype fit tests still pass
npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.prototypeFit.test.js --verbose

# Verify snapshot unchanged
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReportSnapshot.integration.test.js --verbose

# Lint new files
npx eslint src/expressionDiagnostics/services/sectionGenerators/PrototypeSectionGenerator.js
```

## Definition of Done (Updated)

- [x] PrototypeSectionGenerator.js created with prototype-related methods + helpers
- [x] Unit tests cover core behaviors
- [x] sectionGenerators/index.js exports new class
- [x] MonteCarloReportGenerator.js uses new service
- [x] Snapshot test passes unchanged
- [x] prototypeFit.test.js passes
- [x] Prototype section methods removed from MonteCarloReportGenerator.js

## Outcome

- Extracted prototype fit, implied prototype, gap detection, and prototype math formatting into `PrototypeSectionGenerator` with supporting helpers and dependencies.
- Delegated report generation to the new generator; worker wiring left unchanged because the generator is created inside `MonteCarloReportGenerator`.
- Added targeted unit tests for the new generator; no new integration test added beyond the existing snapshot.

## Dependencies

- **Requires**: MONCARREPGENREFANA-007 (directory structure)
- **Requires**: MONCARREPGENREFANA-001 (ReportFormattingService)
- **Blocks**: MONCARREPGENREFANA-012 (factory needs all generators)
