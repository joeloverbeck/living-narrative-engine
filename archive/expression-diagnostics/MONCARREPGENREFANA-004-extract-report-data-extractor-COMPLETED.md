# MONCARREPGENREFANA-004: Extract ReportDataExtractor

## Summary

Extract 10 data extraction/traversal helper methods from MonteCarloReportGenerator into a dedicated ReportDataExtractor service. These methods extract specific data from simulation results, prerequisites, and sensitivity data.

**Note**: Originally planned for 11 methods, but `#getNestedValue` was already extracted to `StatisticalComputationService` in MONCARREPGENREFANA-003.

## Priority: High | Effort: Medium | Risk: MEDIUM

## Rationale

These extraction methods:
- Share common purpose of data retrieval
- No dependencies on other new services (except for `#flattenLeaves` which is passed as callback)
- Used by multiple section generators
- Require unit testing with realistic data structures

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/ReportDataExtractor.js` | **Create** - New service (~180 lines) |
| `tests/unit/expressionDiagnostics/services/reportDataExtractor.test.js` | **Create** - Unit tests |
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | **Modify** - Remove methods, add service usage |
| `src/expressionDiagnostics/services/index.js` | **Modify** - Export new service |

## Out of Scope

- **DO NOT** change ReportFormattingService
- **DO NOT** change StatisticalComputationService
- **DO NOT** change blocker tree traversal (that's MONCARREPGENREFANA-005)
- **DO NOT** change integrity analysis methods
- **DO NOT** change any section generators
- **DO NOT** modify DI registrations
- **DO NOT** modify MonteCarloReportWorker.js (not needed - creates Generator directly)

## Methods to Extract (10 methods)

```javascript
#extractAxisConstraints(prerequisites)
#extractBaselineTriggerRate(globalSensitivityData)
#extractEmotionConditions(blocker)  // receives flattenLeaves as callback
#extractEmotionConditionsFromPrereqs(prerequisites)
#extractEmotionConditionsFromLogic(logic, conditions)
#extractWorstCeilingFromLeaves(hb)  // receives flattenLeaves as callback
#getPrototypeContextPath(type, prototypeId)
#getPrototypeWeights(type, prototypeId)  // uses injected prototypeConstraintAnalyzer
#getGateTraceSignals(context, type, prototypeId)
#getLowestCoverageVariables(samplingCoverage, n)
```

**REMOVED from original plan**: `#getNestedValue` - already in StatisticalComputationService

## Implementation Details

### Service Structure

```javascript
/**
 * @file ReportDataExtractor - Extracts specific data from simulation results
 */
import { getTunableVariableInfo } from '../config/advancedMetricsConfig.js';
import { findBaselineGridPoint } from '../utils/sweepIntegrityUtils.js';

class ReportDataExtractor {
  #logger;
  #prototypeConstraintAnalyzer;

  constructor({ logger = null, prototypeConstraintAnalyzer = null } = {}) {
    this.#logger = logger;
    this.#prototypeConstraintAnalyzer = prototypeConstraintAnalyzer;
  }

  extractAxisConstraints(prerequisites) { /* ... */ }
  extractBaselineTriggerRate(globalSensitivityData) { /* ... */ }
  extractEmotionConditions(blocker, flattenLeavesFn) { /* ... */ }
  // ... other methods
}

export default ReportDataExtractor;
```

### Dependency Handling

Two methods (`extractEmotionConditions`, `extractWorstCeilingFromLeaves`) require access to `#flattenLeaves` which belongs to MONCARREPGENREFANA-005. These methods will receive `flattenLeaves` as a callback parameter to avoid circular dependencies.

## Acceptance Criteria

### Tests That Must Pass

1. **New ReportDataExtractor unit tests:**
   ```bash
   npm run test:unit -- tests/unit/expressionDiagnostics/services/reportDataExtractor.test.js --verbose
   ```

2. **Existing signals/constraints tests still pass:**
   ```bash
   npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.signals.test.js --verbose
   npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.constraintUnits.test.js --verbose
   ```

3. **Snapshot test unchanged:**
   ```bash
   npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReportSnapshot.integration.test.js --verbose
   ```

### Invariants That Must Remain True

1. **Report output identical**: Snapshot test must pass unchanged
2. **Null safety**: Methods handle missing data gracefully
3. **No circular dependencies**: Methods that need `flattenLeaves` receive it as callback

## Verification Commands

```bash
# Run new unit tests
npm run test:unit -- tests/unit/expressionDiagnostics/services/reportDataExtractor.test.js --verbose

# Verify snapshot unchanged
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReportSnapshot.integration.test.js --verbose

# Run all related tests
npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator --verbose

# Lint new files
npx eslint src/expressionDiagnostics/services/ReportDataExtractor.js
```

## Definition of Done

- [x] ReportDataExtractor.js created with 10 methods (~180 lines)
- [x] Unit tests cover all methods with edge cases
- [x] MonteCarloReportGenerator.js updated to use service
- [x] index.js exports new service
- [x] Snapshot test passes unchanged
- [x] All existing tests pass
- [x] ~180 lines removed from MonteCarloReportGenerator.js

## Dependencies

- **Requires**: MONCARREPGENREFANA-000 (baseline tests must exist)
- **Requires**: MONCARREPGENREFANA-003 completed (StatisticalComputationService with getNestedValue)
- **Blocks**: MONCARREPGENREFANA-009 (SensitivitySectionGenerator uses this)

## Notes

- This ticket can run in parallel with MONCARREPGENREFANA-001, 002, but AFTER 003
- Methods needing `flattenLeaves` receive it as callback to avoid coupling with ticket 005

---

## Outcome

**Status**: COMPLETED

**Implementation Date**: 2026-01-15

### Files Created
- `src/expressionDiagnostics/services/ReportDataExtractor.js` (~309 lines)
- `tests/unit/expressionDiagnostics/services/reportDataExtractor.test.js` (~500 lines)

### Files Modified
- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` - Added `#dataExtractor` field, constructor initialization, 10 delegating methods
- `src/expressionDiagnostics/services/index.js` - Added export for ReportDataExtractor

### Test Results
- **ReportDataExtractor unit tests**: 84/84 passed (100%)
- **Snapshot integration tests**: 8/8 passed (unchanged)
- **Signals tests**: 1/1 passed
- **Constraint units tests**: 1/1 passed

### Implementation Notes
1. All 10 methods successfully extracted and delegated
2. Callback pattern used for `extractEmotionConditions` and `extractWorstCeilingFromLeaves` to avoid coupling with ticket 005 (`#flattenLeaves`)
3. Constructor accepts optional `dataExtractor` parameter for testability
4. All null safety patterns preserved
5. No changes to report output (verified by snapshot tests)

### Metrics
- Lines added to ReportDataExtractor.js: ~309
- Lines added to tests: ~500
- Lines added to MonteCarloReportGenerator.js for delegation: ~60
- Net complexity reduction: Service now has single responsibility for data extraction
