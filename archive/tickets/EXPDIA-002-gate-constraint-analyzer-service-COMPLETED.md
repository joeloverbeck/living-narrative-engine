# EXPDIA-002: Create GateConstraintAnalyzer Service

## Status: ✅ COMPLETED

## Summary

Implement static gate conflict detection that analyzes expression prerequisites to find mutually exclusive gate constraints. This service identifies cases where an expression can never fire because its required emotions/sexual states have conflicting gate requirements.

## Priority: High | Effort: Medium

## Rationale

Gate conflicts are the most common cause of "impossible" expressions. For example, if an expression requires both `fear` (which gates on `threat >= 0.30`) and `confidence` (which gates on `threat <= 0.20`), no mood configuration can satisfy both. Early detection saves content authors significant debugging time.

## Dependencies

- **EXPDIA-001** (AxisInterval, GateConstraint models) must be completed first ✅

## Files to Touch

| File | Change Type | Status |
|------|-------------|--------|
| `src/expressionDiagnostics/services/GateConstraintAnalyzer.js` | **Create** | ✅ |
| `src/expressionDiagnostics/services/index.js` | **Create** (barrel export) | ✅ |
| `tests/unit/expressionDiagnostics/services/gateConstraintAnalyzer.test.js` | **Create** | ✅ |
| `tests/fixtures/expressionDiagnostics/impossibleGateConflict.expression.json` | **Create** | ✅ |

## Out of Scope

- **DO NOT** implement IntensityBoundsCalculator - that's EXPDIA-003
- **DO NOT** implement MonteCarloSimulator - that's EXPDIA-007
- **DO NOT** create DI registration - that's EXPDIA-005
- **DO NOT** create UI components - that's EXPDIA-006
- **DO NOT** modify EmotionCalculatorService or ExpressionEvaluatorService

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/services/gateConstraintAnalyzer.test.js --verbose
```

### Unit Test Coverage Requirements

**gateConstraintAnalyzer.test.js:**
- ✅ Constructor throws if dataRegistry is missing
- ✅ Constructor throws if logger is missing
- ✅ `analyze()` returns no conflicts for expression with no prerequisites
- ✅ `analyze()` returns no conflicts for compatible gates
- ✅ `analyze()` detects conflicting gates on same axis
- ✅ `analyze()` identifies all conflicting prototypes
- ✅ `analyze()` handles missing prototype gracefully
- ✅ `analyze()` handles malformed gate strings gracefully
- ✅ `analyze()` correctly identifies mood axis bounds
- ✅ `analyze()` correctly identifies sexual axis bounds
- ✅ `analyze()` extracts prototypes from nested AND/OR logic

### Invariants That Must Remain True

1. ✅ **Detects conflicting gates** - Returns hasConflict=true when gates require min > max
2. ✅ **Returns empty conflicts array** when no conflicts exist
3. ✅ **Handles missing gates gracefully** - Returns all-valid intervals for prototypes without gates
4. ✅ **Never throws** - Logs warnings for parse errors, continues analysis
5. ✅ **Does not modify inputs** - Expression and prototype data remain unchanged

## Definition of Done

- [x] `GateConstraintAnalyzer.js` created with all methods implemented
- [x] `services/index.js` barrel export created
- [x] Test fixture `impossibleGateConflict.expression.json` created
- [x] Unit tests cover all public methods
- [x] Tests cover edge cases (missing prototypes, malformed gates)
- [x] JSDoc documentation complete
- [x] All tests pass (25/25)
- [x] No modifications to existing emotion/expression services

---

## Outcome

### Discrepancies Corrected Before Implementation

The following issues were found in the original ticket and corrected:

1. **IDataRegistry method name**: Ticket specified `getLookupData(lookupId)` but actual interface uses `get('lookups', lookupId)`. Fixed in implementation.

2. **ILogger validation methods**: Ticket used `['debug', 'warn', 'error']` but project pattern requires `['info', 'warn', 'error', 'debug']`. Fixed in implementation.

3. **Missing directories**: `src/expressionDiagnostics/services/` and `tests/fixtures/expressionDiagnostics/` did not exist and were created.

### Implementation Summary

- Created `GateConstraintAnalyzer` service with full gate conflict detection
- Implemented JSON Logic parsing for emotion/sexual prototype extraction from prerequisites
- Added support for nested AND/OR logic structures
- Proper axis bounds: [-1, 1] for mood axes, [0, 1] for sexual axes
- Comprehensive error handling with warning logs for malformed gates

### Test Coverage

- **25 unit tests** covering all acceptance criteria
- **100% coverage** on GateConstraintAnalyzer.js
- Additional edge case tests beyond requirements:
  - Empty prerequisites array
  - Prerequisites with no emotion/sexual requirements
  - Multiple emotions sharing same axis
  - Mixed emotion and sexual prototype requirements
  - Deeply nested logic extraction
  - Various robustness tests for null/undefined inputs

### Files Created

1. `src/expressionDiagnostics/services/GateConstraintAnalyzer.js` (224 lines)
2. `src/expressionDiagnostics/services/index.js` (8 lines)
3. `tests/unit/expressionDiagnostics/services/gateConstraintAnalyzer.test.js` (500 lines)
4. `tests/fixtures/expressionDiagnostics/impossibleGateConflict.expression.json` (17 lines)

### Verification

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/services/gateConstraintAnalyzer.test.js
# Result: 25 passed, 25 total
```
