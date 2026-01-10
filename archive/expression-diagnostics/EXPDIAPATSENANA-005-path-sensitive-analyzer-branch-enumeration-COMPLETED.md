# EXPDIAPATSENANA-005: PathSensitiveAnalyzer Service - Branch Enumeration

## Status: ✅ COMPLETED

## Summary

Create the `PathSensitiveAnalyzer` service with the core branch enumeration logic. This ticket implements the algorithm to parse JSON Logic trees, identify OR nodes, and enumerate all execution paths through OR branches.

## Priority: High | Effort: Medium

## Rationale

The core innovation of path-sensitive analysis is treating OR branches independently rather than merging all gates. This ticket implements the foundational logic to:
1. Parse JSON Logic prerequisite trees
2. Identify OR nodes (fork points)
3. Enumerate all distinct execution paths
4. Handle branch explosion limits

## Dependencies

- **EXPDIAPATSENANA-004** (PathSensitiveResult model) ✅
- **EXPDIAPATSENANA-001** (AnalysisBranch model) ✅
- Existing `IGateConstraintAnalyzer` service ✅
- Existing `IIntensityBoundsCalculator` service ✅
- Existing `IDataRegistry` service ✅

## Files Touched

| File | Change Type | Status |
|------|-------------|--------|
| `src/expressionDiagnostics/services/PathSensitiveAnalyzer.js` | **Create** | ✅ |
| `src/expressionDiagnostics/services/index.js` | **Modify** (add export) | ✅ |
| `src/dependencyInjection/tokens/tokens-diagnostics.js` | **Modify** (add token) | ✅ |
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | **Modify** (add registration) | ✅ |
| `tests/unit/expressionDiagnostics/services/pathSensitiveAnalyzer.test.js` | **Create** | ✅ |

## Out of Scope

- **DO NOT** implement constraint calculation per branch - that's EXPDIAPATSENANA-006
- **DO NOT** implement knife-edge detection - that's EXPDIAPATSENANA-006
- **DO NOT** implement feasibility volume calculation - that's EXPDIAPATSENANA-009
- **DO NOT** modify existing GateConstraintAnalyzer or IntensityBoundsCalculator
- **DO NOT** create UI components - that's EXPDIAPATSENANA-008
- **DO NOT** modify existing models (AxisInterval, GateConstraint, DiagnosticResult)

## Definition of Done

- [x] `PathSensitiveAnalyzer.js` created with branch enumeration logic
- [x] `services/index.js` updated with export
- [x] DI token added to `tokens-diagnostics.js`
- [x] Service registered in `expressionDiagnosticsRegistrations.js`
- [x] Unit tests cover branch enumeration algorithm
- [x] Tests verify OR/AND/leaf node handling
- [x] Tests verify maxBranches limit enforcement
- [x] Tests verify prototype extraction
- [x] JSDoc documentation complete
- [x] All tests pass
- [x] No modifications to existing services

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Implementation matched the plan exactly.** All files specified in the ticket were created/modified as planned:

1. **PathSensitiveAnalyzer.js** - Created with full branch enumeration logic
   - Constructor validates all 4 dependencies (dataRegistry, gateConstraintAnalyzer, intensityBoundsCalculator, logger)
   - `analyze()` method returns `PathSensitiveResult` with enumerated branches
   - Private methods for tree building, path enumeration, prototype extraction, and description generation
   - `DEFAULT_OPTIONS` exported for testing

2. **DI Token** - Added `IPathSensitiveAnalyzer` to `tokens-diagnostics.js`

3. **DI Registration** - Added factory to `expressionDiagnosticsRegistrations.js`

4. **Service Export** - Added to `services/index.js`

5. **Unit Tests** - Created comprehensive test suite with 47 tests covering:
   - Constructor validation (4 tests)
   - Analyze method validation (4 tests)
   - Branch enumeration with no OR nodes (2 tests)
   - Single OR node enumeration (2 tests)
   - Multiple OR nodes (Cartesian product) (2 tests)
   - Nested OR handling (2 tests)
   - maxBranches limit enforcement (4 tests)
   - Edge cases (7 tests)
   - Prototype extraction (5 tests)
   - Branch descriptions (5 tests)
   - Static exports (2 tests)
   - Result structure (3 tests)
   - Integration with PathSensitiveResult (5 tests)

### Bug Fix During Implementation

During test execution, discovered and fixed a bug in the `#enumerateBranches` method:
- **Issue**: The warning for branch limit reached was never triggered because `branches.length` was always 0 during enumeration (branches were only added after `enumeratePaths()` completed)
- **Fix**: Introduced `pathCount` counter that increments when leaf nodes are reached, correctly tracking path count during enumeration

### Test Results

```
Test Suites: 1 passed, 1 total
Tests:       47 passed, 47 total
Coverage:    90.4% statements, 75.34% branches, 100% functions, 92.43% lines
```

### ESLint Notes

Three private class members (`#dataRegistry`, `#gateConstraintAnalyzer`, `#intensityBoundsCalculator`) are injected but not used in this ticket. They are stored for use in EXPDIAPATSENANA-006 (constraint analysis). ESLint disable comments were added to suppress these warnings.

### Verification

All acceptance criteria met:
- Unit tests pass
- DI registration works
- Service exports correctly
- Branch enumeration handles all cases (no OR, single OR, multiple OR, nested OR)
- maxBranches limit enforced with warning logged
- Prototype extraction works for both `emotions.X` and `sexualStates.X` patterns
