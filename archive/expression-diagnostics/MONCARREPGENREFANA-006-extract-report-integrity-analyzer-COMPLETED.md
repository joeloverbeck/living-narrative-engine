# MONCARREPGENREFANA-006: Extract ReportIntegrityAnalyzer

**STATUS: COMPLETED**

## Summary

Extract 7 integrity warning collection methods from MonteCarloReportGenerator into a dedicated ReportIntegrityAnalyzer service. This includes the public `collectReportIntegrityWarnings` method which will delegate to the new service.

## Priority: High | Effort: Medium | Risk: MEDIUM

## Assumptions Corrections (from codebase verification)

**Original ticket claimed 12 methods - actual count is 7.** The following were incorrectly listed:

| Method Listed | Actual Status |
|--------------|---------------|
| `#checkMcConfirmation(condition, storedContexts, moodConstraints)` | **NOT integrity** - Actually `#checkMcConfirmation(axis, blockers)` used in prototype fit display |
| `#checkEmotionMcConfirmation(condition, contexts, moodConstraints)` | **NOT integrity** - Actually `#checkEmotionMcConfirmation(prototypeId, blockers)` used in prototype fit display |
| `#resolveGateTraceTarget(context, type, prototypeId)` | **NOT integrity** - Actually `#resolveGateTraceTarget(varPath)` used in multiple sections |
| `#normalizeContextAxes(context)` | **Does not exist** - Already in StatisticalComputationService |
| `#normalizeAxisValue(value, domain)` | **Does not exist** anywhere |

## Rationale

These methods:
- Cohesive responsibility for integrity analysis
- Dedicated test file exists (warnings.test.js)
- Used by public API `collectReportIntegrityWarnings`
- Require integration testing for full warning collection flow

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/ReportIntegrityAnalyzer.js` | **Create** - New service (~300 lines) |
| `tests/unit/expressionDiagnostics/services/reportIntegrityAnalyzer.test.js` | **Create** - Unit tests |
| `tests/integration/expression-diagnostics/reportIntegrityAnalyzer.integration.test.js` | **Create** - Integration tests |
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | **Modify** - Remove methods, delegate public API |
| `src/expressionDiagnostics/workers/MonteCarloReportWorker.js` | **Modify** - Create service |
| `src/expressionDiagnostics/services/index.js` | **Modify** - Export new service |

## Out of Scope

- **DO NOT** change ReportFormattingService
- **DO NOT** change public API signature of `collectReportIntegrityWarnings`
- **DO NOT** change blocker tree operations
- **DO NOT** change section generators
- **DO NOT** modify DI registrations
- **DO NOT** extract `#checkMcConfirmation`, `#checkEmotionMcConfirmation`, `#resolveGateTraceTarget` (not integrity methods)

## Methods to Extract (Corrected: 7 methods)

```javascript
// Warning collection
#collectReportIntegrityWarnings(params) → becomes public collect(params)
#collectSweepIntegrityWarnings(params)
#buildSweepWarningContext({ blockers, globalSensitivityData })
#buildSweepWarningsForResult(result, context)
#mergeReportIntegrityWarnings(existing, incoming)

// Analysis helpers
#analyzeEmotionCondition(condition, axisConstraints)
#contextMatchesConstraints(context, moodConstraints)
```

## Implementation Details

### Service Structure

```javascript
/**
 * @file ReportIntegrityAnalyzer - Collects and analyzes report integrity warnings
 */
class ReportIntegrityAnalyzer {
  #formattingService;
  #statisticalService;
  #treeTraversal;
  #prototypeConstraintAnalyzer;
  #logger;

  constructor({
    formattingService,
    statisticalService,
    treeTraversal,
    prototypeConstraintAnalyzer = null,
    logger
  }) {
    if (!formattingService) {
      throw new Error('ReportIntegrityAnalyzer requires formattingService');
    }
    if (!statisticalService) {
      throw new Error('ReportIntegrityAnalyzer requires statisticalService');
    }
    if (!treeTraversal) {
      throw new Error('ReportIntegrityAnalyzer requires treeTraversal');
    }
    this.#formattingService = formattingService;
    this.#statisticalService = statisticalService;
    this.#treeTraversal = treeTraversal;
    this.#prototypeConstraintAnalyzer = prototypeConstraintAnalyzer;
    this.#logger = logger;
  }

  /**
   * Collects all integrity warnings for the report.
   * @param {object} params - Same params as MonteCarloReportGenerator.collectReportIntegrityWarnings
   * @returns {Array<object>}
   */
  collect(params) { /* delegates to #collectReportIntegrityWarnings */ }

  // Private methods (7 total)
  #collectReportIntegrityWarnings(params) { }
  #collectSweepIntegrityWarnings(params) { }
  #buildSweepWarningContext(params) { }
  #buildSweepWarningsForResult(result, context) { }
  #mergeReportIntegrityWarnings(existing, incoming) { }
  #analyzeEmotionCondition(condition, axisConstraints) { }
  #contextMatchesConstraints(context, moodConstraints) { }
}

export default ReportIntegrityAnalyzer;
```

### Public API Preservation

In MonteCarloReportGenerator:
```javascript
/**
 * Public API - delegates to ReportIntegrityAnalyzer
 */
collectReportIntegrityWarnings(params) {
  return this.#integrityAnalyzer.collect(params);
}
```

## Acceptance Criteria

### Tests That Must Pass

1. **New ReportIntegrityAnalyzer unit tests:**
   ```bash
   npm run test:unit -- tests/unit/expressionDiagnostics/services/reportIntegrityAnalyzer.test.js --verbose
   ```

2. **New integration tests:**
   ```bash
   npm run test:integration -- tests/integration/expression-diagnostics/reportIntegrityAnalyzer.integration.test.js --verbose
   ```

3. **Existing warnings tests still pass:**
   ```bash
   npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.warnings.test.js --verbose
   ```

4. **Snapshot test unchanged:**
   ```bash
   npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReportSnapshot.integration.test.js --verbose
   ```

### Invariants That Must Remain True

1. **Public API unchanged**: `collectReportIntegrityWarnings` signature and behavior identical
2. **Warning format unchanged**: Same warning object structure returned
3. **Dependency injection**: Service receives formattingService via constructor
4. **Logger optional**: Service works with or without logger

## Verification Commands

```bash
# Run new unit tests
npm run test:unit -- tests/unit/expressionDiagnostics/services/reportIntegrityAnalyzer.test.js --verbose

# Run new integration tests
npm run test:integration -- tests/integration/expression-diagnostics/reportIntegrityAnalyzer.integration.test.js --verbose

# Verify warnings tests still pass
npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.warnings.test.js --verbose

# Verify snapshot unchanged
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReportSnapshot.integration.test.js --verbose

# Lint new files
npx eslint src/expressionDiagnostics/services/ReportIntegrityAnalyzer.js
```

## Definition of Done

- [x] ReportIntegrityAnalyzer.js created with all 7 methods
- [x] Unit tests cover all methods including edge cases
- [x] Integration test covers full warning collection flow
- [x] MonteCarloReportGenerator.js delegates to service
- [x] MonteCarloReportWorker.js updated to create service
- [x] index.js exports new service
- [x] Snapshot test passes unchanged
- [x] warnings.test.js passes
- [x] ~480 lines removed from MonteCarloReportGenerator.js

## Dependencies

- **Requires**: MONCARREPGENREFANA-001 (ReportFormattingService must exist) ✅
- **Blocks**: MONCARREPGENREFANA-007 (directory structure depends on utilities being complete)

## Outcome

### Implementation Summary

Successfully extracted 7 methods from `MonteCarloReportGenerator.js` into a new `ReportIntegrityAnalyzer` service:

| File | Action | Result |
|------|--------|--------|
| `src/expressionDiagnostics/services/ReportIntegrityAnalyzer.js` | Created | ~680 lines (larger than estimated due to full method extraction) |
| `tests/unit/expressionDiagnostics/services/reportIntegrityAnalyzer.test.js` | Created | 23 unit tests, 89.94% coverage |
| `tests/integration/expression-diagnostics/reportIntegrityAnalyzer.integration.test.js` | Created | 8 integration tests |
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | Modified | Added delegation to new service |
| `src/expressionDiagnostics/services/index.js` | Modified | Added export |
| `src/expressionDiagnostics/workers/MonteCarloReportWorker.js` | No changes | Service auto-created by MonteCarloReportGenerator |

### Key Decisions

1. **Internal Service Creation**: MonteCarloReportGenerator creates ReportIntegrityAnalyzer internally if not injected, avoiding worker modifications
2. **DataExtractor Dependency**: Added `dataExtractor` as constructor parameter for `extractBaselineTriggerRate()` and `getGateTraceSignals()` methods
3. **Delegation Pattern**: Public `collect()` method delegates to private `#collectReportIntegrityWarnings()` for API compatibility

### Test Results

```
Unit tests (reportIntegrityAnalyzer.test.js): 23 passed
Integration tests (reportIntegrityAnalyzer.integration.test.js): 8 passed
Existing warnings tests (monteCarloReportGenerator.warnings.test.js): 3 passed
Snapshot tests (monteCarloReportSnapshot.integration.test.js): 8 passed
```

### Public API Preserved

The `collectReportIntegrityWarnings()` method signature and behavior remain unchanged. Existing code using the API requires no modifications.
