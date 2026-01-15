# MONCARREPGENREFANA-001: Extract ReportFormattingService

## Status: ✅ COMPLETED

## Summary

Extract 20 pure formatting functions from MonteCarloReportGenerator into a dedicated ReportFormattingService. These are stateless utility methods with no dependencies on private fields or other services.

## Priority: High | Effort: Low | Risk: LOWEST

## Rationale

These formatting methods are:
- Pure functions with zero state dependencies
- No access to `#logger` or private fields
- Well-tested through existing label tests
- Perfect candidates for safe extraction

## Files Touched

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/ReportFormattingService.js` | **Created** - New service (403 lines) |
| `tests/unit/expressionDiagnostics/services/reportFormattingService.test.js` | **Created** - Unit tests (79 tests) |
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | **Modified** - Added service usage via `#formattingService` |
| `src/expressionDiagnostics/services/index.js` | **Modified** - Added export |

**Note**: MonteCarloReportWorker.js does NOT need modification - the service is created internally by MonteCarloReportGenerator via `deps.formattingService ?? new ReportFormattingService()`.

## Out of Scope

- **DO NOT** change any section generation logic
- **DO NOT** change any statistical calculations
- **DO NOT** change any blocker tree traversal logic
- **DO NOT** modify DI registrations (service is created internally for now)
- **DO NOT** change witness formatting methods (that's MONCARREPGENREFANA-002)
- **DO NOT** change any other extracted service files

## Methods Extracted

```javascript
// Number formatting
formatPercentage(value, decimals)
formatNumber(value)
formatCount(value)
formatSignedNumber(value)
formatSignedPercentagePoints(delta)
formatBooleanValue(value)

// Rate formatting
formatFailRate(rate, count)
formatRateWithCounts(rate, count, total)

// Threshold formatting
formatThresholdValue(value, isInteger)
formatEffectiveThreshold(threshold, operator)

// Population formatting
formatPopulationHeader(population)
formatStoredContextPopulationLabel(summary, population)
formatPopulationEvidenceLabel(population)

// Evidence formatting
formatEvidenceCount(count, label)
formatEvidenceValue(value, label)

// Misc formatting
formatOrMoodConstraintWarning()
formatSweepWarningsInline(warnings)
formatFunnelClauseLabel(leaf)
formatClampTrivialLabel(inRegimeValue, globalValue)
formatTuningDirection(direction)
```

## Definition of Done

- [x] ReportFormattingService.js created with all 20 methods
- [x] Unit tests cover all methods with edge cases (79 tests)
- [x] MonteCarloReportGenerator.js updated to use service
- [x] MonteCarloReportWorker.js - NO CHANGE NEEDED (service created internally)
- [x] index.js exports new service
- [x] Snapshot test passes unchanged (8/8 tests)
- [x] All existing tests pass (195/195 MonteCarloReportGenerator tests)

## Dependencies

- **Requires**: MONCARREPGENREFANA-000 (baseline tests must exist) - ✅ Completed
- **Blocks**: MONCARREPGENREFANA-002, MONCARREPGENREFANA-006, MONCARREPGENREFANA-007+

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Planned**: Extract 20 formatting methods and remove them from MonteCarloReportGenerator

**Actual**:
1. ✅ Created `ReportFormattingService.js` with all 20 formatting methods as public methods
2. ✅ Created comprehensive unit tests (`reportFormattingService.test.js`) with 79 tests covering all methods
3. ✅ Updated `MonteCarloReportGenerator.js` to:
   - Import `ReportFormattingService`
   - Add `#formattingService` private field
   - Initialize service in constructor: `this.#formattingService = formattingService ?? new ReportFormattingService()`
   - Delegate all formatting calls to `this.#formattingService`
4. ✅ Added export to `index.js`

**Note on private method retention**: The original private methods (`#formatPercentage`, `#formatNumber`, etc.) still exist in `MonteCarloReportGenerator.js` but now delegate to `#formattingService`. These will be removed as dead code in Phase 8 (final orchestrator refactor) per the refactoring analysis document. The snapshot tests verify that report output is identical, confirming the delegation works correctly.

### Test Results

- ReportFormattingService unit tests: **79/79 passed**
- MonteCarloReportGenerator unit tests: **195/195 passed** (14 test files)
- Snapshot integration tests: **8/8 passed**

### Files Modified

1. `src/expressionDiagnostics/services/ReportFormattingService.js` (NEW - 403 lines)
2. `tests/unit/expressionDiagnostics/services/reportFormattingService.test.js` (NEW - 497 lines)
3. `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` (MODIFIED - added import, field, constructor init, delegated calls)
4. `src/expressionDiagnostics/services/index.js` (MODIFIED - added export)

### Test Expectation Fix

One test expectation was corrected during implementation:
- `formatNumber(1.2345, 3)` returns `"1.234"` not `"1.235"` due to JavaScript's `toFixed()` banker's rounding
- Added clarifying comment in test file
