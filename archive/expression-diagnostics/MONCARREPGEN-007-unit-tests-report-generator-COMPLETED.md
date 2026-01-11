# MONCARREPGEN-007: Unit Tests - Report Generator

## Summary

Create comprehensive unit tests for `MonteCarloReportGenerator` covering all report sections, flag detection logic, and edge cases.

## Priority: High | Effort: Medium

## Rationale

Unit tests ensure:
- Report format matches specification exactly
- Flag detection thresholds are correct
- Edge cases (0% trigger rate, missing data) are handled
- Rarity categories match defined thresholds
- Number formatting is consistent

## Dependencies

- **MONCARREPGEN-001** - MonteCarloReportGenerator class must exist

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js` | **Create** |

## Out of Scope

- **DO NOT** modify MonteCarloReportGenerator.js
- **DO NOT** create integration tests - that's MONCARREPGEN-009
- **DO NOT** test modal functionality - that's MONCARREPGEN-008
- **DO NOT** test actual simulation - use mock data only

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js --verbose --coverage
```

### Coverage Requirements

- **Statements**: >= 90%
- **Branches**: >= 85%
- **Functions**: >= 90%
- **Lines**: >= 90%

### Invariants That Must Remain True

1. **Mock isolation**: Tests use only mock data, no real simulation
2. **No side effects**: Tests don't modify any external state
3. **Deterministic**: Tests produce same results on every run
4. **Fast execution**: All tests complete in < 5 seconds

## Definition of Done

- [x] Test file created at correct path
- [x] All imports resolved correctly
- [x] Mock fixtures created for simulation result and blockers
- [x] Constructor tests: valid logger, missing logger, invalid logger
- [x] Generate method tests: all sections present, expression name, timestamp
- [x] Flag tests: all 6 flags with positive and negative cases
- [x] Rarity tests: all 5 categories with boundary values
- [x] Edge cases: empty blockers, missing data, null values, 100% rate
- [x] Format tests: percentages, CI, sample count, distribution
- [x] All tests pass
- [x] Coverage meets thresholds
- [x] Test file passes ESLint
- [x] Tests run in < 5 seconds

---

## Outcome

### Status: COMPLETED

### Implementation Summary

Created comprehensive unit test suite for `MonteCarloReportGenerator` at `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js` with 77 passing tests.

### Test Categories Implemented

1. **Constructor Tests** (8 tests)
   - Valid logger creation
   - Missing logger handling
   - Empty dependencies handling
   - Missing required logger methods (info, warn, error, debug)

2. **Generate Method Tests** (6 tests)
   - All required sections present
   - Expression name in header
   - Timestamp in header
   - Summary text handling
   - Default message for empty summary
   - Debug logging verification

3. **Flag Detection Tests** (18 tests)
   - `[CEILING]`: status-based detection with positive/negative/undefined cases
   - `[DECISIVE]`: isDecisive and isSingleClause conditions
   - `[TUNABLE]`: nearMissRate > 0.10 threshold
   - `[UPSTREAM]`: nearMissRate < 0.02 threshold
   - `[OUTLIERS-SKEW]`: p50 < avg * 0.5 calculation
   - `[SEVERE-TAIL]`: p90 > avg * 2 calculation
   - Multiple flags display and "None" fallback

4. **Rarity Category Tests** (10 tests)
   - impossible (0%)
   - extremely_rare (< 0.00001)
   - rare (< 0.0005)
   - normal (< 0.02)
   - frequent (>= 0.02)
   - Boundary value testing for each category

5. **Edge Case Tests** (13 tests)
   - Empty/undefined blockers
   - Missing advancedAnalysis
   - Missing hierarchicalBreakdown
   - Null/undefined values handling
   - 100% trigger rate
   - Missing optional fields (CI, distribution, sampleCount)
   - Missing blocker properties

6. **Format Verification Tests** (10 tests)
   - Percentage formatting (0-100 scale)
   - Confidence interval display
   - Sample count display
   - Distribution type display
   - Failure/near-miss rate formatting
   - N/A handling for missing/NaN values

7. **Blocker Section Content Tests** (6 tests)
   - Condition details from hierarchicalBreakdown
   - Distribution analysis section
   - Ceiling analysis section
   - Near-miss analysis section
   - Last-mile analysis section
   - Recommendation section

8. **Legend Section Tests** (6 tests)
   - Global metric definitions
   - Per-clause metric definitions
   - Tunability level definitions
   - Severity level definitions
   - Recommended action definitions
   - Problem flag definitions

### Coverage Results

| Metric     | Achieved | Required | Status |
|------------|----------|----------|--------|
| Statements | 99%      | >= 90%   | ✅     |
| Branches   | 98.2%    | >= 85%   | ✅     |
| Functions  | 100%     | >= 90%   | ✅     |
| Lines      | 98.95%   | >= 90%   | ✅     |

### Technical Notes

1. **Flag Detection Testing Strategy**: Created `extractFlagsSection()` helper to isolate the Flags section from the Legend section (which contains flag definitions), preventing false positives in negative test cases.

2. **Mock Fixture Design**: Default mock blocker values specifically chosen to NOT trigger any flags:
   - `nearMissRate: 0.05` (between 0.02-0.10, neither TUNABLE nor UPSTREAM)
   - `violationP50: 0.15` (>= avgViolation * 0.5, NOT OUTLIERS-SKEW)
   - `violationP90: 0.40` (<= avgViolation * 2, NOT SEVERE-TAIL)
   - `isSingleClause: false` and `isDecisive: false` (NOT DECISIVE)
   - `ceilingAnalysis.status: 'achievable'` (NOT CEILING)

3. **N/A Display Testing**: Implementation uses `?? 0` for most numeric values before formatting, so N/A only appears for specific fields like `thresholdValue` where the implementation uses `?? 'N/A'`.

### Files Created

- `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js` (1167 lines)

### Verification

```bash
# Tests pass
npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js
# Result: 77 passed, 77 total

# Lint passes
npx eslint tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js
# Result: No errors

# Execution time
# Time: 0.833s (< 5 seconds requirement)
```
