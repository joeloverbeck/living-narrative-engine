# AXIGAPDETSPE-007: Implement Multi-Axis Conflict Detection Method
**Status**: Completed

## Description

Implement the `#detectMultiAxisConflicts()` private method in AxisGapAnalyzer that flags prototypes using many axes with conflicting signs. These prototypes may be "overfitting" existing axes to express a concept that deserves its own dimension.

## Files to Modify

- `src/expressionDiagnostics/services/AxisGapAnalyzer.js`
  - Replace `#detectMultiAxisConflicts()` stub with full implementation
  - Add any necessary private helper methods
  - Expose a `__TEST_ONLY__detectMultiAxisConflicts()` helper (analyze() is still stubbed in AXIGAPDETSPE-008)

- `tests/unit/expressionDiagnostics/services/axisGapAnalyzer.test.js`
  - Add `describe('Multi-Axis Conflict Detection', ...)` test suite

## Out of Scope

- PCA analysis implementation (AXIGAPDETSPE-004)
- Hub detection implementation (AXIGAPDETSPE-005)
- Coverage gap detection implementation (AXIGAPDETSPE-006)
- Report synthesis / public `analyze()` (AXIGAPDETSPE-008)
- Pipeline integration (AXIGAPDETSPE-009)
- UI integration (AXIGAPDETSPE-010)
- Modifying prototype weight formats

## Implementation Details

### Algorithm

1. **For each prototype**, analyze its weight vector:

2. **Count active axes**: |weight| >= epsilon (use `activeAxisEpsilon` from config)

3. **Compute population statistics**:
   - `medianActiveAxes` = median of active axis counts across all prototypes
   - `iqr` = interquartile range of active axis counts

4. **For each prototype with high axis count**:
   - Count positive weights (weight > epsilon)
   - Count negative weights (weight < -epsilon)
   - `signBalance = |positive - negative| / total`
   - Lower balance = more conflicting (closer to 50/50 split)

5. **Flag prototype** if ALL conditions met:
   - `activeAxisCount > median + IQR × multiAxisUsageThreshold` (default: 1.5)
   - `signBalance < multiAxisSignBalanceThreshold` (default: 0.4)

### Return Shape

```javascript
[
  {
    prototypeId: string,
    activeAxisCount: number,
    signBalance: number,          // 0.0 (balanced) to 1.0 (all same sign)
    positiveAxes: string[],       // Axis names with positive weights
    negativeAxes: string[],       // Axis names with negative weights
  },
  // ... more conflicts
]
```

### Sign Balance Formula

```
signBalance = |positiveCount - negativeCount| / totalActiveCount
```

- `signBalance = 0.0` means exactly 50/50 positive/negative (maximum conflict)
- `signBalance = 1.0` means all weights have same sign (no conflict)

### Helper Methods Needed

```javascript
#countActiveAxes(weights)        // Returns count of |weight| >= epsilon
#computeSignBalance(weights)     // Returns 0.0-1.0 balance score
#computeMedianAndIQR(counts)     // Returns { median, iqr }
#categorizeAxes(weights)         // Returns { positive: [], negative: [] }
```

## Acceptance Criteria

### Tests That Must Pass

1. **Multi-Axis Conflict Detection test suite**:
   - `should flag prototypes with balanced positive/negative weights`
     - Create prototype with 4 positive, 4 negative weights
     - Verify prototype appears in conflict list
     - Verify `signBalance < 0.4`

   - `should not flag prototypes with single dominant sign`
     - Create prototype with 7 positive, 1 negative weight
     - Verify prototype NOT in conflict list (signBalance > 0.4)

   - `should not flag prototypes with few active axes`
     - Create prototype with only 3 active axes (balanced)
     - Verify prototype NOT in conflict list (below median threshold)

   - `should compute sign balance correctly`
     - 3 positive, 1 negative → signBalance = |3-1|/4 = 0.5
     - 2 positive, 2 negative → signBalance = |2-2|/4 = 0.0
     - Verify computed values match expected

   - `should correctly identify positive and negative axes`
     - Verify `positiveAxes` contains correct axis names
     - Verify `negativeAxes` contains correct axis names

   - `should compute median and IQR correctly`
     - Known distribution of axis counts
     - Verify median and IQR match expected

   - `should return empty array with single prototype`
     - Pass single prototype (can't compute population statistics)
     - Verify returns `[]`

### Invariants That Must Remain True

1. Method remains private (`#detectMultiAxisConflicts`)
2. `signBalance` is always between 0.0 and 1.0
3. For returned conflicts, `activeAxisCount` is a positive integer
4. `positiveAxes` and `negativeAxes` are disjoint sets
5. Sum of lengths of `positiveAxes` and `negativeAxes` equals `activeAxisCount`
6. Prototypes with few axes (below threshold) are never flagged regardless of balance
7. `npm run typecheck` passes
8. `npx eslint src/expressionDiagnostics/services/AxisGapAnalyzer.js` passes

## Dependencies

- AXIGAPDETSPE-003 (service scaffold must exist)

## Outcome

Implemented multi-axis conflict detection with median/IQR gating and sign balance checks, added test-only accessors and unit coverage for conflicts, while leaving the public `analyze()` stub and other detection methods unchanged as planned.

## Estimated Diff Size

~140 lines of implementation + ~120 lines of tests = ~260 lines total
