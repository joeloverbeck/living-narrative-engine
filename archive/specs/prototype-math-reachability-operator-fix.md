# Prototype Math Reachability Operator Fix

## Problem Statement

The Monte Carlo report's "Prototype Math Analysis" section incorrectly determines reachability for `<=` and `<` comparison operators. The current implementation uses a single formula (`maxAchievable >= threshold`) that is only mathematically correct for `>=` operators.

### Concrete Example

**Condition**: `emotions.dissociation <= 0.65`
- **Max Achievable**: 0.505
- **Threshold**: 0.65
- **Current Result**: ⚠️ UNREACHABLE
- **Correct Result**: ✅ REACHABLE (always satisfied)

**Why the current result is wrong**: If the maximum achievable value for dissociation is 0.505, then `dissociation <= 0.65` is **guaranteed to always be true**—it's not unreachable, it's *always satisfied*.

### Root Cause Analysis

**Location**: `src/expressionDiagnostics/services/PrototypeConstraintAnalyzer.js`, line 145

```javascript
isReachable: maxAchievable >= threshold && gateStatus.allSatisfiable,
```

This calculation:
1. Does not receive the comparison operator as input
2. Uses `>=` logic universally regardless of the actual operator
3. Produces inverted results for `<=` and `<` operators

**Evidence**: The operator IS captured in `MonteCarloReportGenerator.js` (line 1649) but is only passed to the formatting function (line 1625), not to the analysis function (line 1685-1690).

---

## Correct Semantics by Operator

| Operator | Condition | Satisfiable When... | Gap Interpretation |
|----------|-----------|---------------------|-------------------|
| `>=` | `value >= threshold` | `maxAchievable >= threshold` | positive = unreachable |
| `>` | `value > threshold` | `maxAchievable > threshold` | positive = unreachable |
| `<=` | `value <= threshold` | `minAchievable <= threshold` (always true for emotions 0-1 if threshold > 0) | negative = always satisfied |
| `<` | `value < threshold` | `minAchievable < threshold` (always true for emotions 0-1 if threshold > 0) | negative = always satisfied |

For emotions and sexual states (range 0-1):
- **Min achievable**: Always 0 (emotions can't go negative)
- **Max achievable**: Computed from prototype weights and axis constraints

Therefore:
- `<=` with threshold > 0 is **always satisfiable** (since min is 0)
- `<` with threshold > 0 is **always satisfiable** (since min is 0)

---

## Solution Design

### 1. Update Method Signature

**File**: `src/expressionDiagnostics/services/PrototypeConstraintAnalyzer.js`

Add `operator` parameter to `analyzeEmotionThreshold`:

```javascript
/**
 * @param {string} prototypeId - Emotion or sexual state ID
 * @param {string} type - 'emotion' or 'sexual'
 * @param {number} threshold - Required threshold value
 * @param {Map<string, AxisConstraint>} axisConstraints - Axis constraints from expression
 * @param {string} [operator='>='] - Comparison operator from the clause
 * @returns {PrototypeAnalysisResult}
 */
analyzeEmotionThreshold(prototypeId, type, threshold, axisConstraints, operator = '>=')
```

### 2. Add Operator-Aware Reachability Logic

Add private method:

```javascript
/**
 * Calculate reachability based on operator semantics
 * @private
 * @param {number} maxAchievable - Maximum achievable intensity
 * @param {number} minAchievable - Minimum achievable intensity (0 for emotions)
 * @param {number} threshold - Required threshold
 * @param {string} operator - Comparison operator
 * @param {boolean} gatesPassable - Whether all gates are satisfiable
 * @returns {boolean}
 */
#calculateReachability(maxAchievable, minAchievable, threshold, operator, gatesPassable) {
  if (!gatesPassable) return false;

  switch (operator) {
    case '>=':
      return maxAchievable >= threshold;
    case '>':
      return maxAchievable > threshold;
    case '<=':
      // Satisfiable if min can be <= threshold
      return minAchievable <= threshold;
    case '<':
      // Satisfiable if min can be < threshold
      return minAchievable < threshold;
    default:
      return maxAchievable >= threshold;
  }
}
```

### 3. Update Gap Calculation

Add private method:

```javascript
/**
 * Calculate gap with operator-appropriate semantics
 * @private
 */
#calculateGap(maxAchievable, minAchievable, threshold, operator) {
  switch (operator) {
    case '>=':
    case '>':
      // Gap = how far below threshold the max is (positive = can't reach)
      return threshold - maxAchievable;
    case '<=':
    case '<':
      // Gap = how far above threshold the min is (positive = can't satisfy)
      return minAchievable - threshold;
    default:
      return threshold - maxAchievable;
  }
}
```

### 4. Update Explanation Generation

Modify `#generateExplanation` to produce appropriate messages:

- For `>=` unreachable: "Threshold 0.65 is NOT achievable (max: 0.505)"
- For `>=` reachable: "Threshold 0.40 is achievable (max: 0.721)"
- For `<=` always satisfied: "Condition always satisfied (max 0.505 < threshold 0.65)"
- For `<=` with tight margin: "Threshold 0.50 is achievable (min: 0.00 < threshold)"

### 5. Update MonteCarloReportGenerator

**File**: `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`

Update `#analyzeEmotionCondition` (line 1683) to pass operator:

```javascript
#analyzeEmotionCondition(condition, axisConstraints) {
  try {
    return this.#prototypeConstraintAnalyzer.analyzeEmotionThreshold(
      condition.prototypeId,
      condition.type,
      condition.threshold,
      axisConstraints,
      condition.operator ?? '>='  // Pass operator
    );
  } catch (err) {
    this.#logger.warn(
      `Failed to analyze ${condition.type} condition ${condition.prototypeId}:`,
      err.message
    );
    return null;
  }
}
```

### 6. Update Result Type Definition

Update `PrototypeAnalysisResult` typedef to include operator:

```javascript
/**
 * @typedef {object} PrototypeAnalysisResult
 * @property {string} prototypeId - The emotion/sexual state ID
 * @property {string} type - 'emotion' or 'sexual'
 * @property {string} operator - Comparison operator used
 * @property {number} threshold - Required threshold value
 * @property {number} maxAchievable - Max intensity achievable given constraints
 * @property {number} minAchievable - Min intensity achievable (0 for emotions)
 * @property {boolean} isReachable - Whether threshold can be reached
 * @property {number} gap - Operator-appropriate distance from satisfiability
 * ...
 */
```

---

## Test Cases

### Unit Tests

**File**: `tests/unit/expressionDiagnostics/services/prototypeConstraintAnalyzer.test.js`

```javascript
describe('analyzeEmotionThreshold - operator handling', () => {
  describe('>= operator', () => {
    it('should return REACHABLE when maxAchievable >= threshold', () => {
      const result = analyzer.analyzeEmotionThreshold('anger', 'emotion', 0.4, constraints, '>=');
      expect(result.isReachable).toBe(true);
      expect(result.gap).toBeLessThanOrEqual(0);
    });

    it('should return UNREACHABLE when maxAchievable < threshold', () => {
      const result = analyzer.analyzeEmotionThreshold('anger', 'emotion', 0.9, constraints, '>=');
      expect(result.isReachable).toBe(false);
      expect(result.gap).toBeGreaterThan(0);
    });
  });

  describe('<= operator', () => {
    it('should return REACHABLE when threshold > maxAchievable (always satisfied)', () => {
      const result = analyzer.analyzeEmotionThreshold('dissociation', 'emotion', 0.65, constraints, '<=');
      // Max achievable is 0.505, threshold is 0.65
      // Since max < threshold, condition is always satisfied
      expect(result.isReachable).toBe(true);
      expect(result.gap).toBeLessThan(0); // negative gap = safely satisfiable
    });

    it('should return REACHABLE when threshold > 0 (since min is 0)', () => {
      const result = analyzer.analyzeEmotionThreshold('rage', 'emotion', 0.55, constraints, '<=');
      expect(result.isReachable).toBe(true);
    });
  });

  describe('< operator', () => {
    it('should return REACHABLE when threshold > 0', () => {
      const result = analyzer.analyzeEmotionThreshold('panic', 'emotion', 0.4, constraints, '<');
      expect(result.isReachable).toBe(true);
    });
  });

  describe('> operator', () => {
    it('should return UNREACHABLE when maxAchievable <= threshold', () => {
      const result = analyzer.analyzeEmotionThreshold('anger', 'emotion', 0.75, constraints, '>');
      // Max achievable is ~0.72
      expect(result.isReachable).toBe(false);
    });
  });
});
```

### Integration Tests

**File**: `tests/integration/expression-diagnostics/prototypeReachability.integration.test.js`

Test against real expression files:
1. Load `hurt_anger.expression.json`
2. Verify `dissociation <= 0.65` is marked REACHABLE
3. Verify explanation mentions "always satisfied" or similar

---

## Verification Checklist

- [ ] Unit tests pass for all operator types
- [ ] Integration tests pass
- [ ] Manual verification: Run expression-diagnostics on `hurt_anger` and confirm `dissociation <= 0.65` shows REACHABLE
- [ ] Report output includes operator-appropriate explanations
- [ ] Gap values have correct sign convention per operator
- [ ] No regressions in existing `>=` operator behavior

---

## Backwards Compatibility

- Default operator is `>=` to maintain existing behavior for callers that don't specify operator
- Existing report format is preserved (icon + text changes based on reachability)
- No changes to schema or data files required

---

## Risks

**Low Risk**: This is a bug fix that makes the report more accurate. No external APIs change.

**Edge Cases**:
- Threshold = 0 with `<=`: Always satisfiable (min 0 <= 0)
- Threshold = 0 with `<`: Never satisfiable (min 0 is NOT < 0)
- Need to handle these correctly in implementation

---

## References

- Original analysis: `brainstorming/assessment-of-current-monte-carlo-implementation.md`
- Gate feasibility logic (correct implementation to model): `PrototypeConstraintAnalyzer.js` lines 282-298
- Operator extraction: `MonteCarloReportGenerator.js` line 1649
