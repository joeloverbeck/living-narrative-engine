# MONCARREPGENREFANA-000: Baseline Test Infrastructure

## Status: COMPLETED

## Summary

Create snapshot and worker integration tests to establish a safety net before any refactoring begins. These tests will detect any unintended changes to report output during the extraction process.

## Priority: Critical | Effort: Low | Risk: LOW

## Rationale

The MonteCarloReportGenerator produces complex markdown reports. Before extracting any methods, we need:
1. **Snapshot tests**: Capture exact report output to detect any formatting changes
2. **Worker tests**: Verify the worker thread pattern works correctly as it will need factory updates

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/integration/expression-diagnostics/monteCarloReportSnapshot.integration.test.js` | **Create** - Snapshot tests with known fixtures |
| `tests/integration/expression-diagnostics/monteCarloReportWorker.integration.test.js` | **Create** - Worker thread integration tests |
| `tests/fixtures/expressionDiagnostics/snapshotFixtures/` | **Create** - Directory for snapshot test fixtures |
| `tests/fixtures/expressionDiagnostics/snapshotFixtures/standardSimulationResult.json` | **Create** - Standard simulation result fixture |
| `tests/fixtures/expressionDiagnostics/snapshotFixtures/standardBlockers.json` | **Create** - Standard blockers fixture |

## Out of Scope

- **DO NOT** modify `MonteCarloReportGenerator.js` - this is read-only for reference
- **DO NOT** modify `MonteCarloReportWorker.js` - this is read-only for reference
- **DO NOT** modify any existing test files
- **DO NOT** create any new service files
- **DO NOT** change any DI registrations

## Implementation Details

### Snapshot Test Strategy

The snapshot test should:
1. Use deterministic fixtures (no random data)
2. Cover all major report sections
3. Include prototype fit, sensitivity, and blocker analysis sections
4. Use Jest's `toMatchSnapshot()` for full report comparison

### Worker Test Strategy

The worker test should:
1. Verify worker can create MonteCarloReportGenerator
2. Verify report output matches main-thread generation
3. Test error handling for invalid input

### Fixture Requirements

Create fixtures that exercise:
- Basic simulation result with trigger rate, sample count, confidence intervals
- Blockers with hierarchical breakdown and OR/AND trees
- Sensitivity data with sweep results
- Prerequisites with emotion thresholds

## Acceptance Criteria

### Tests That Must Pass

1. **New snapshot integration tests:**
   ```bash
   npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReportSnapshot.integration.test.js --verbose
   ```

2. **New worker integration tests:**
   ```bash
   npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReportWorker.integration.test.js --verbose
   ```

3. **All existing tests unchanged:**
   ```bash
   npm run test:integration -- tests/integration/expression-diagnostics/ --verbose
   ```

### Invariants That Must Remain True

1. **No source changes**: MonteCarloReportGenerator.js must be identical before and after
2. **Snapshot stability**: Generated snapshots capture deterministic output
3. **Worker parity**: Worker thread produces identical output to main thread
4. **Fixture isolation**: Test fixtures don't depend on external mod data

## Verification Commands

```bash
# Run new snapshot tests
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReportSnapshot.integration.test.js --verbose

# Run new worker tests
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReportWorker.integration.test.js --verbose

# Verify no existing tests broke
npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator --verbose
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReport.integration.test.js --verbose

# Update snapshots if needed (first run only)
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReportSnapshot.integration.test.js --updateSnapshot
```

## Definition of Done

- [x] Snapshot test file created with comprehensive fixtures
- [x] Worker test file created with parity verification
- [x] Fixtures directory created with deterministic test data
- [x] Snapshots generated and committed
- [x] All existing expressionDiagnostics tests still pass
- [x] Documentation in test files explains snapshot update process

## Blocking

This ticket blocks ALL subsequent MONCARREPGENREFANA tickets. The snapshot tests are the safety net for the entire refactoring effort.

## Notes

- Snapshots should be regenerated if intentional formatting changes are made
- Worker tests will need updates when factory pattern is introduced (MONCARREPGENREFANA-012)
- Consider adding performance baseline measurements for future comparison

---

## Outcome

### What Was Actually Changed

**Files Created:**
1. `tests/fixtures/expressionDiagnostics/snapshotFixtures/standardSimulationResult.json` - Deterministic simulation result fixture with triggerRate, sampleCount, confidenceInterval, clauseFailures, storedContexts, and samplingCoverage data
2. `tests/fixtures/expressionDiagnostics/snapshotFixtures/standardBlockers.json` - Deterministic blockers fixture with 3 blockers (including AND and OR hierarchical breakdowns), advancedAnalysis sections, and prerequisites
3. `tests/integration/expression-diagnostics/monteCarloReportSnapshot.integration.test.js` - 8 snapshot tests covering:
   - Standard simulation full report
   - Prototype fit analysis full report
   - Sensitivity analysis full report
   - Zero trigger rate scenario
   - High trigger rate scenario
   - Integrity warnings
   - Empty blockers edge case
   - OR-only breakdown edge case
4. `tests/integration/expression-diagnostics/monteCarloReportWorker.integration.test.js` - 11 worker integration tests covering:
   - Worker-style dependency creation
   - Report section generation via worker pattern
   - Prototype lookups in worker context
   - Worker vs main thread structural parity
   - Error handling (missing simulationResult, undefined blockers, empty payload, malformed data)
   - Sensitivity analysis via worker pattern
   - Factory pattern preparation (documents current instantiation pattern)

**Key Implementation Notes:**
- Timestamps in reports are normalized to `[TIMESTAMP]` for deterministic snapshot comparison
- Worker tests use structural comparison (not exact string matching) because `ReportOrchestrator` adds sensitivity sections that `MonteCarloReportGenerator.generate()` doesn't produce directly
- All fixtures are self-contained and don't depend on external mod data

### Test Results

| Test Suite | Tests | Status |
|------------|-------|--------|
| monteCarloReportSnapshot.integration.test.js | 8 | PASS |
| monteCarloReportWorker.integration.test.js | 11 | PASS |
| All expression-diagnostics integration tests | 160 | PASS |
| MonteCarloReportGenerator unit tests | 195 | PASS |

### Deviations from Original Plan

1. **Timestamp normalization required**: Reports include dynamic timestamps that change on each run. Added `normalizeTimestamps()` helper to replace timestamps with `[TIMESTAMP]` placeholder for deterministic snapshots.

2. **Worker parity is structural, not exact**: The worker pattern uses `ReportOrchestrator.generateReport()` which invokes `SensitivityAnalyzer` and produces additional sensitivity sections. Main thread tests use `MonteCarloReportGenerator.generate()` directly. Parity tests verify structural equivalence (same core sections, same key content) rather than exact string match.

### Ready for Refactoring

The baseline test infrastructure is now in place. Future refactoring of MonteCarloReportGenerator will be validated against:
- 8 snapshot tests that capture exact report output (normalized for timestamps)
- 11 worker integration tests that verify the service graph works correctly
- 160 existing integration tests
- 195 existing unit tests

Any formatting changes during refactoring will cause snapshot tests to fail, providing immediate feedback on unintended changes.
