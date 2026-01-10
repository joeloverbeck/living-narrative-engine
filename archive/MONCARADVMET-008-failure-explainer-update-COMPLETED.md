# MONCARADVMET-008: Update FailureExplainer with New Metrics

**STATUS: COMPLETED** (2026-01-10)

## Summary

Update `FailureExplainer` to consume and utilize the new advanced metrics (percentiles, near-miss rate, last-mile rate, max observed) for improved explanation generation and clause prioritization.

## Priority: Medium | Effort: Medium

## Rationale

The new metrics enable smarter explanations:
- **Last-mile rate** → "Tune this first" recommendations
- **Near-miss rate** → "Threshold tweaks will/won't help" guidance
- **Ceiling gap** → "Threshold is unreachable" warnings
- **Percentiles** → "Most failures are minor vs severe" insights

This ticket makes the metrics actionable by incorporating them into human-readable analysis.

## Dependencies

- **MONCARADVMET-003** - Requires percentile data in ClauseResult
- **MONCARADVMET-006** - Requires near-miss data in ClauseResult
- **MONCARADVMET-007** - Requires last-mile data in ClauseResult
- **MONCARADVMET-004** - Requires max observed and ceiling gap in ClauseResult

## Files Touched

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/FailureExplainer.js` | **Modified** |
| `tests/unit/expressionDiagnostics/services/failureExplainer.test.js` | **Modified** |

## Out of Scope

- **DO NOT** modify `MonteCarloSimulator.js` - metrics are already computed
- **DO NOT** modify `HierarchicalClauseNode.js` - data model is complete
- **DO NOT** modify UI components - that's MONCARADVMET-009/010
- **DO NOT** change the ClauseResult structure
- **DO NOT** modify expression schema or validation

## Definition of Done

- [x] `analyzeHierarchicalBlockers()` returns `advancedAnalysis` object
- [x] `#analyzeAdvancedMetrics()` implemented with all sub-analyses
- [x] `#calculatePriorityScore()` implemented with last-mile weighting
- [x] `#generateRecommendation()` implemented with action types
- [x] Blockers sorted by priority score
- [x] `generateSummary()` mentions decisive blockers and ceiling effects
- [x] Unit tests for percentile analysis
- [x] Unit tests for near-miss analysis
- [x] Unit tests for ceiling analysis
- [x] Unit tests for last-mile analysis
- [x] Unit tests for priority scoring
- [x] Unit tests for recommendations
- [x] All existing tests pass
- [x] No type errors

---

## Outcome

### What Was Originally Planned

The ticket specified adding the following new functionality to `FailureExplainer.js`:

1. `#analyzeAdvancedMetrics()` - Aggregate analysis method
2. `#analyzePercentiles()` - Heavy-tail detection
3. `#analyzeNearMiss()` - Tunability assessment
4. `#analyzeCeiling()` - Threshold reachability check
5. `#analyzeLastMile()` - Decisive blocker detection
6. `#calculatePriorityScore()` - Last-mile weighted scoring
7. `#generateRecommendation()` - Actionable recommendations
8. Update `analyzeHierarchicalBlockers()` to include `advancedAnalysis` and sort by priority
9. Update `generateSummary()` to mention decisive blockers and ceiling effects

### What Was Actually Changed

**No additional code changes were required.** Upon investigation, all planned functionality was already implemented as part of an earlier development pass.

#### Implementation Already Present in `FailureExplainer.js`

| Method | Lines | Status |
|--------|-------|--------|
| `#analyzeAdvancedMetrics()` | 637-645 | Already exists |
| `#analyzePercentiles()` | 423-450 | Already exists |
| `#analyzeNearMiss()` | 459-487 | Already exists |
| `#analyzeCeiling()` | 496-523 | Already exists |
| `#analyzeLastMile()` | 532-571 | Already exists |
| `#calculatePriorityScore()` | 661-687 | Already exists |
| `#generateRecommendation()` | 580-628 | Already exists |
| `analyzeHierarchicalBlockers()` updates | 167-206 | Already exists |
| `generateSummary()` updates | 122-144 | Already exists |

#### Tests Already Present in `failureExplainer.test.js`

The test file contains a complete "Advanced Metrics Analysis (MONCARADVMET-008)" describe block (lines 1397-2086) with:

- Percentile Analysis tests (4 tests)
- Near-Miss Analysis tests (4 tests)
- Ceiling Analysis tests (4 tests)
- Last-Mile Analysis tests (5 tests)
- Recommendations tests (4 tests)
- Priority Scoring tests (4 tests)
- generateSummary() with Advanced Metrics tests (3 tests)
- Backward Compatibility tests (2 tests)

### Verification

```bash
# Unit tests: 96 passed
npm run test:unit -- tests/unit/expressionDiagnostics/services/failureExplainer.test.js --verbose

# All expressionDiagnostics tests: 1463 passed
npm run test:unit -- --testPathPatterns="expressionDiagnostics" --verbose

# Type check: No errors
npm run typecheck
```

### Conclusion

This ticket was written as a specification before implementation. The implementation was completed during an earlier development iteration, and all acceptance criteria have been met. The ticket is now closed with no additional work required.
