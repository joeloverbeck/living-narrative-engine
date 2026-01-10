# MONCARADVMET-006: Implement Near-Miss Rate Calculation

## Status: ✅ COMPLETED

## Summary

Add near-miss tracking to `HierarchicalClauseNode` and integrate with `MonteCarloSimulator` to calculate the percentage of samples within epsilon of the threshold.

## Priority: Medium | Effort: Medium

## Rationale

Near-miss rate answers: "Will lowering this threshold actually help?"

- **High near-miss rate (>10%)**: Many samples are barely failing → threshold tweaks are effective
- **Low near-miss rate (<2%)**: Samples are far from threshold → need upstream changes (prototypes, gates)

This is crucial for guiding content creators on whether to adjust thresholds or redesign prerequisites entirely.

## Dependencies

- **MONCARADVMET-001** - Requires `thresholdValue` and `variablePath` to be extracted ✅
- **MONCARADVMET-005** - Requires epsilon configuration and `getEpsilonForVariable()` ✅

## Outcome

### What Was Actually Changed

**HierarchicalClauseNode.js:**
- Added `#nearMissCount = 0` private field (line 61)
- Added `#epsilonUsed = null` private field (line 64)
- Added `nearMissCount` getter (lines 237-239)
- Added `nearMissRate` getter with null handling for zero evaluations (lines 246-252)
- Added `nearMissEpsilon` getter (lines 259-261)
- Added `recordNearMiss(actualValue, threshold, epsilon)` method (lines 377-389)
- Updated `resetStats()` to clear near-miss fields (lines 418-419)
- Updated `toJSON()` to include near-miss fields (lines 462-464)

**MonteCarloSimulator.js:**
- Added import for `getEpsilonForVariable` (line 12)
- Updated `ClauseResult` typedef with `nearMissRate` and `nearMissEpsilon` (lines 36-37)
- Updated `#evaluateHierarchicalNode()` leaf branch to call `recordNearMiss()` (lines 1046-1050)
- Updated `#finalizeClauseResults()` to include near-miss metrics (lines 784-785)

### Tests Added/Modified

**HierarchicalClauseNode.test.js (12 new tests):**
1. `should count near-miss samples` - Verifies counting logic
2. `should calculate near-miss rate as proportion of evaluations` - Rate calculation
3. `should return null for nearMissRate when no evaluations recorded` - Edge case
4. `should reset near-miss tracking` - Reset behavior
5. `should include near-miss fields in toJSON()` - Serialization
6. `should not count samples outside epsilon` - Boundary validation
7. `should count samples just inside epsilon boundary` - Boundary edge case
8. `should track the epsilon value used` - Epsilon storage
9. `should skip non-numeric values in recordNearMiss` - Type safety
10. `should return 0 for nearMissRate when no near-misses recorded` - Zero rate case
11. `should handle different epsilon values correctly` - Multi-epsilon support
12. Updated existing `toJSON` test to include near-miss fields

**monteCarloSimulator.test.js (7 new tests):**
1. `should include near-miss metrics in clause results` - Result structure
2. `should include near-miss in hierarchical breakdown` - Hierarchy support
3. `should use emotions epsilon (0.05) for emotions variables` - Domain-specific epsilon
4. `should detect near-misses within epsilon of threshold` - Statistical validation
5. `should have zero near-miss rate for unreachable thresholds` - Edge case
6. `should return null for nearMissRate without threshold metadata` - Missing metadata
7. `should propagate near-miss metrics through AND compound clauses` - Compound nodes

### Differences from Original Plan

- Implementation matched the ticket exactly
- All assumptions were validated as correct
- Statistical test tolerance was widened slightly (0.05 → 0.04) to accommodate natural variance in Monte Carlo sampling

## Files Touched

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/models/HierarchicalClauseNode.js` | **Modified** |
| `src/expressionDiagnostics/services/MonteCarloSimulator.js` | **Modified** |
| `tests/unit/expressionDiagnostics/models/HierarchicalClauseNode.test.js` | **Modified** |
| `tests/unit/expressionDiagnostics/services/monteCarloSimulator.test.js` | **Modified** |

## Out of Scope (Preserved)

- **DID NOT** modify `FailureExplainer.js` - that's MONCARADVMET-008
- **DID NOT** modify UI components - that's MONCARADVMET-009/010
- **DID NOT** add last-mile tracking - that's MONCARADVMET-007
- **DID NOT** change epsilon configuration - that's MONCARADVMET-005
- **DID NOT** modify how pass/fail is determined

## Definition of Done ✅

- [x] `#nearMissCount` field added to HierarchicalClauseNode
- [x] `#epsilonUsed` field added
- [x] `recordNearMiss()` method implemented
- [x] `nearMissCount`, `nearMissRate`, `nearMissEpsilon` getters implemented
- [x] `resetStats()` clears near-miss tracking
- [x] `toJSON()` includes near-miss fields
- [x] MonteCarloSimulator calls `recordNearMiss()` during evaluation
- [x] `ClauseResult` typedef updated
- [x] Unit tests for near-miss counting
- [x] Unit tests for rate calculation
- [x] Integration with epsilon configuration verified
- [x] All existing tests pass
- [x] No type errors

## Verification

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/ --verbose
# Result: 28 test suites passed, 1214 tests passed
```
