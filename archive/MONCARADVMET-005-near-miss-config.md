# MONCARADVMET-005: Add Near-Miss Configuration and Domain Detection

## Status: ✅ COMPLETED

## Summary

Create the configuration infrastructure for near-miss rate calculation, including domain-specific epsilon values and variable path detection to determine which epsilon to use.

## Priority: Medium | Effort: Low

## Rationale

Near-miss detection requires knowing how close to the threshold counts as "near." Different domains have different scales:
- **Emotions** [0, 1]: ε = 0.05 (5% of range)
- **Mood axes** [-100, 100]: ε = 5 (2.5% of range)
- **Sexual states** [0, 100]: ε = 5 (5% of range)

This ticket creates the configuration and domain detection; actual near-miss tracking is MONCARADVMET-006.

## Dependencies

- **MONCARADVMET-001** - Requires `variablePath` to be extracted and stored ✅ (verified)

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/config/advancedMetricsConfig.js` | **Create** |
| `tests/unit/expressionDiagnostics/config/advancedMetricsConfig.test.js` | **Create** |

## Out of Scope

- **DO NOT** modify `HierarchicalClauseNode.js` - that's MONCARADVMET-006
- **DO NOT** modify `MonteCarloSimulator.js` evaluation - that's MONCARADVMET-006
- **DO NOT** add near-miss counting logic - that's MONCARADVMET-006
- **DO NOT** modify UI components
- **DO NOT** add last-mile or other metrics

## Definition of Done

- [x] `src/expressionDiagnostics/config/` directory created
- [x] `advancedMetricsConfig.js` created with epsilon values
- [x] `detectDomain()` function implemented
- [x] `getEpsilonForVariable()` function implemented
- [x] `isAdvancedMetricsEnabled()` function implemented
- [x] `isMetricEnabled()` function implemented
- [x] Test file created with all test cases
- [x] All tests pass (19 tests)
- [x] No type errors
- [x] Exports work correctly when imported

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Implemented exactly as planned** with minor TypeScript-friendly adjustments:

1. **Created `src/expressionDiagnostics/config/advancedMetricsConfig.js`**
   - Configuration object with domain-specific epsilon values
   - `detectDomain()` function with pattern matching
   - `getEpsilonForVariable()` for epsilon lookup
   - `isAdvancedMetricsEnabled()` and `isMetricEnabled()` helpers

2. **Created `tests/unit/expressionDiagnostics/config/advancedMetricsConfig.test.js`**
   - 19 comprehensive unit tests
   - 100% statement/line/function coverage
   - 93.33% branch coverage

**Minor deviations from ticket code:**
- Added JSDoc type definitions (`DomainName`, `NearMissEpsilonConfig`, `AdvancedMetricsConfig`, `DomainPattern`) for TypeScript compliance
- Changed `isMetricEnabled()` from dynamic property lookup to explicit `switch` statement for type safety
- Added type casts to `domainPatterns` array entries for TypeScript

### Tests Added

| Test | Rationale |
|------|-----------|
| `detectDomain() identifies emotions domain` | Core domain detection for emotions.* paths |
| `detectDomain() identifies mood axes domain` | Domain detection for mood.* paths |
| `detectDomain() identifies sexual states domain` | Domain detection for sexualStates.* and sexual.* |
| `detectDomain() identifies traits domain` | Domain detection for traits.* and personalityTraits.* |
| `detectDomain() returns default for unknown paths` | Fallback behavior for unrecognized paths |
| `detectDomain() returns default for null/undefined` | Null safety |
| `detectDomain() returns default for non-string inputs` | Type safety |
| `detectDomain() returns default for empty string` | Edge case handling |
| `getEpsilonForVariable() returns correct epsilon` | Epsilon lookup per domain |
| `getEpsilonForVariable() returns default for unknown` | Default fallback |
| `getEpsilonForVariable() returns default for invalid` | Input validation |
| `isAdvancedMetricsEnabled() returns enabled state` | Global flag check |
| `isAdvancedMetricsEnabled() reflects changes` | Runtime config changes |
| `isMetricEnabled() checks individual metrics` | Per-metric flags |
| `isMetricEnabled() returns false for unknown` | Unknown metric handling |
| `isMetricEnabled() returns false when disabled` | Global disable respect |
| `advancedMetricsConfig has positive epsilons` | Invariant validation |
| `advancedMetricsConfig has required keys` | Config completeness |
| `advancedMetricsConfig has default epsilon` | Fallback availability |

### Verification

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/config/ --verbose
# 19 passing tests, 100% coverage

npm run typecheck 2>&1 | grep advancedMetricsConfig
# No errors

npx eslint src/expressionDiagnostics/config/advancedMetricsConfig.js
# No errors
```
