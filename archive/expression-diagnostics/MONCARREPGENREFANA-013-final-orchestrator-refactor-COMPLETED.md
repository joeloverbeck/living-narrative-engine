# MONCARREPGENREFANA-013: Final Orchestrator Refactor

## Summary

MonteCarloReportGenerator is already partially refactored (services + section generators extracted), but it still duplicates report-integrity warning logic that now lives in ReportIntegrityAnalyzer. This ticket focuses on delegating warning collection to the analyzer and removing redundant internal warning helpers, while keeping the sweep-warning callback needed by SensitivitySectionGenerator.

## Priority: High | Effort: Low | Risk: LOW

## Assumptions Reassessment (Based on Current Code + Report)

- MonteCarloReportGenerator is ~1,700 lines (not 6,394) and already wires ReportFormattingService, WitnessFormatter, StatisticalComputationService, ReportDataExtractor, BlockerTreeTraversal, ReportIntegrityAnalyzer, and section generators.
- ReportIntegrityAnalyzer already contains the warning logic duplicated in MonteCarloReportGenerator.
- reportGeneratorFactory.js exists and already wires the extracted services; worker-thread wiring is not blocked.
- DI tokens/registrations for the extracted services do not exist yet, but DI is not required for the current generator usage (UI registrations and the factory instantiate directly).
- SensitivitySectionGenerator depends on a sweepWarningBuilder provided by MonteCarloReportGenerator; this helper must remain available.

## Rationale

Remove redundant integrity-warning logic from MonteCarloReportGenerator and rely on ReportIntegrityAnalyzer as the single warning source, keeping report output identical and public APIs unchanged.

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | **Modify** - Delegate warnings to ReportIntegrityAnalyzer |

## Out of Scope

- **DO NOT** change any extracted service files or section generator files
- **DO NOT** change reportGeneratorFactory.js
- **DO NOT** add DI tokens/registrations in this ticket
- **DO NOT** change public API signatures
- **DO NOT** move recommendation/conditional pass rate/last-mile sections yet

## Implementation Details

- In `generate()`, replace internal warning collection with `ReportIntegrityAnalyzer.collect()`.
- Keep the sweep-warning helper used by SensitivitySectionGenerator (per-result warnings remain local).
- Remove redundant internal warning helpers that are no longer used.

## Acceptance Criteria

1. **Warnings sourced from ReportIntegrityAnalyzer** during report generation.
2. **Report output identical** (snapshot test unchanged).
3. **Public API unchanged**: `generate()` and `collectReportIntegrityWarnings()` signatures unchanged.
4. **Constructor backwards compatible** with the original injected dependencies.
5. **Sensitivity sweep warnings unchanged** in output formatting.

## Tests That Must Pass

1. **Unit tests (MonteCarlo report generator):**
   ```bash
   npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator --verbose --coverage=false
   ```

2. **Integration tests (expression diagnostics reports):**
   ```bash
   npm run test:integration -- tests/integration/expression-diagnostics/ --verbose --coverage=false
   ```

3. **Snapshot unchanged:**
   ```bash
   npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReportSnapshot.integration.test.js --verbose --coverage=false
   ```

## Verification Commands

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator --verbose --coverage=false
npm run test:integration -- tests/integration/expression-diagnostics/ --verbose --coverage=false
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReportSnapshot.integration.test.js --verbose --coverage=false
npx eslint src/expressionDiagnostics/services/MonteCarloReportGenerator.js
```

## Definition of Done

- [x] MonteCarloReportGenerator delegates warning collection to ReportIntegrityAnalyzer
- [x] Redundant warning helpers removed from MonteCarloReportGenerator
- [x] Report output unchanged (snapshot test passes)
- [x] Unit + integration tests pass (see commands above)
- [x] No public API changes

## Dependencies

- **Requires**: MONCARREPGENREFANA extractions already in place (services + section generators)

## Notes

This ticket intentionally does **not** complete the full line-count reduction. Remaining section generators for recommendations and last-mile analysis will be handled in a follow-up ticket.

## Outcome

- Delegated report-integrity warnings to ReportIntegrityAnalyzer and removed the duplicate warning-collection block from MonteCarloReportGenerator.
- Cleaned out unused private helpers that became dead code after the warning refactor.
- Added the missing `evaluateConstraint` import to keep last-mile decomposition stable.
- No DI changes; output and public API preserved.

## Status

Completed.
