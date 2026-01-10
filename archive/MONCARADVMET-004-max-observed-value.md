# MONCARADVMET-004: Add Max Observed Value Tracking

## Summary

Track the maximum observed value for each clause's primary variable across all simulation samples. This enables ceiling detection: if `maxObserved < threshold`, the threshold is effectively unreachable.

## Priority: High | Effort: Medium

## Status: ✅ COMPLETED

## Rationale

Static analysis (`IntensityBoundsCalculator`) detects theoretically unreachable thresholds. This empirical metric confirms whether values *actually* approach the threshold in simulated conditions. Combined with p99, it provides robust ceiling detection:

- `maxObserved >= threshold`: Threshold is attainable (at least in extreme cases)
- `maxObserved < threshold` with small gap: Near-misses possible
- `maxObserved << threshold`: Threshold is unreachable; redesign required

## Dependencies

- **MONCARADVMET-001** - Requires threshold extraction for ceiling gap calculation

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/models/HierarchicalClauseNode.js` | **Modify** |
| `src/expressionDiagnostics/services/MonteCarloSimulator.js` | **Modify** |
| `tests/unit/expressionDiagnostics/models/HierarchicalClauseNode.test.js` | **Modify** |
| `tests/unit/expressionDiagnostics/services/monteCarloSimulator.test.js` | **Modify** |

## Out of Scope

- **DO NOT** modify `FailureExplainer.js` - that's MONCARADVMET-008
- **DO NOT** modify UI components - that's MONCARADVMET-009/010
- **DO NOT** add near-miss or last-mile metrics - those are separate tickets
- **DO NOT** modify `IntensityBoundsCalculator` (theoretical bounds)
- **DO NOT** change evaluation pass/fail logic

## Definition of Done

- [x] `#maxObservedValue` field added to HierarchicalClauseNode
- [x] `#observedValues` array added for p99 calculation
- [x] `recordObservedValue(value)` method implemented
- [x] `maxObservedValue`, `observedP99`, `ceilingGap` getters implemented
- [x] `resetStats()` clears observed value tracking
- [x] `toJSON()` includes new fields
- [x] `#extractActualValue()` implemented in MonteCarloSimulator
- [x] Observed values recorded during leaf evaluation
- [x] `ClauseResult` typedef updated (via toJSON serialization)
- [x] Unit tests for observed value tracking
- [x] Unit tests for ceiling gap calculation
- [x] All existing tests pass
- [x] No type errors

## Outcome

### What Was Implemented vs Planned

The implementation followed the ticket plan closely with no discrepancies:

**HierarchicalClauseNode.js Changes:**
- Added `#maxObservedValue = -Infinity` private field
- Added `#observedValues = []` private field for p99 calculation
- Added `recordObservedValue(value)` method that skips non-numeric/NaN values
- Added `maxObservedValue` getter (returns null if no observations)
- Added `observedP99` getter using `#getObservedPercentile(0.99)` private method
- Added `ceilingGap` getter (threshold - maxObservedValue)
- Added `#getObservedPercentile(p)` private method with linear interpolation (reused pattern from `getViolationPercentile`)
- Updated `resetStats()` to clear both new fields
- Updated `toJSON()` to include `maxObservedValue`, `observedP99`, `ceilingGap`

**MonteCarloSimulator.js Changes:**
- Added `#extractActualValue(logic, context)` private method
- Modified `#evaluateHierarchicalNode()` to call `recordObservedValue()` for leaf nodes on every evaluation

### Tests Added

**HierarchicalClauseNode.test.js (12 new tests):**

| Test | Rationale |
|------|-----------|
| `should track maximum observed value` | Core functionality verification |
| `should handle negative values correctly` | Edge case for mood axes [-100, 100] |
| `should return null when no values observed` | Initial state handling |
| `should calculate p99 of observed values` | Percentile calculation accuracy |
| `should calculate ceiling gap correctly` | Core ceiling detection logic |
| `should have negative ceilingGap when threshold is achievable` | Sign interpretation verification |
| `should return null ceilingGap when threshold not set` | Edge case handling |
| `should return null ceilingGap when no observations` | Edge case handling |
| `should reset observed value tracking` | State management verification |
| `should include observed value fields in toJSON()` | Serialization completeness |
| `should skip non-numeric values in recordObservedValue` | Edge case for boolean conditions |
| `should return single value for p99 when only one observation` | Edge case for single sample |

**monteCarloSimulator.test.js (9 new tests):**

| Test | Rationale |
|------|-----------|
| `should extract and record observed values during leaf evaluation` | Integration verification |
| `should record observed values for all evaluations (pass and fail)` | Both pass/fail cases |
| `should include maxObservedValue in clause results` | Output field presence |
| `should include observedP99 in clause results` | Output field presence |
| `should include ceilingGap in clause results` | Output field presence |
| `should have observedP99 <= maxObservedValue` | Mathematical invariant |
| `should calculate positive ceilingGap for unreachable thresholds` | Ceiling detection accuracy |
| `should extract values from reversed operand order` | Pattern matching completeness |
| `should not record observed values for boolean conditions` | Edge case handling |

### Tests Modified

**HierarchicalClauseNode.test.js:**
- Updated `should serialize a leaf node` test to include the three new fields (`maxObservedValue`, `observedP99`, `ceilingGap`) in expected output

### Verification

All 1177 unit tests pass with coverage:
- HierarchicalClauseNode.js: 99.05% statements, 91.52% branches
- MonteCarloSimulator.js: 89.83% statements, 81.48% branches
