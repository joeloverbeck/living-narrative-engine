# Monte Carlo Report Clarity Improvements

## Goal

Improve the clarity, accuracy, and actionability of Monte Carlo simulation reports by addressing four key areas of confusion identified in post-implementation review:

1. **Stricter result classifications** - Distinguish "theoretically impossible", "empirically unreachable", and "unobserved"
2. **Plain-English explanations** - Replace jargon with actionable descriptions for axis sign conflicts
3. **Zero-hit sensitivity handling** - Make sensitivity tables useful even when baseline hits are zero
4. **Percent-change display** - Fix misleading large percentages from tiny baselines

## Motivation

Monte Carlo reports are the primary tool for content creators to tune expression thresholds. Current reports contain ambiguous terminology and misleading statistics that hinder decision-making:

- "IMPOSSIBLE" is used for both theoretical impossibility AND empirical zero-hits, confusing consumers
- Axis sign conflict diagnostics use technical jargon without explaining the practical impact
- Sensitivity tables for zero-hit expressions appear authoritative but provide no actionable guidance
- Percent-change columns like "+5700%" are mathematically correct but practically useless

These issues were documented in `brainstorming/confusing-parts-monte-carlo-implementation.md`.

## Current Implementation (Reference)

### Key Files

- `src/expressionDiagnostics/models/DiagnosticResult.js` - Rarity category classification (lines 324-358)
- `src/expressionDiagnostics/statusTheme.js` - Status labels and visual indicators
- `src/expressionDiagnostics/services/NonAxisFeasibilityAnalyzer.js` - IMPOSSIBLE vs RARE classification (lines 322-341)
- `src/expressionDiagnostics/services/sectionGenerators/SensitivitySectionGenerator.js` - Sensitivity table formatting with percent-change (lines 94-202)
- `src/expressionDiagnostics/services/ReportFormattingService.js` - Percentage formatting utilities

### Current Classification Logic

**DiagnosticResult.js (lines 324-358):**
```javascript
if (this.#isImpossible) {
  return RARITY_CATEGORIES.IMPOSSIBLE;  // Static analysis proved impossibility
}
if (this.#triggerRate === 0) {
  return RARITY_CATEGORIES.UNOBSERVED;  // Sampling found no triggers
}
// ... other categories based on triggerRate thresholds
```

**NonAxisFeasibilityAnalyzer.js (lines 322-341):**
```javascript
#classify(passRate, maxValue, threshold, operator) {
  if (passRate === 0) {
    // Both theoretical AND empirical zero-hits return 'IMPOSSIBLE'
    return 'IMPOSSIBLE';  // ← PROBLEM: No distinction
  }
  // ...
}
```

### Current Sensitivity Display (SensitivitySectionGenerator.js lines 136-151)

```javascript
if (originalRate > 0 && point.passRate > 0) {
  const multiplier = point.passRate / originalRate;
  changeStr = multiplier > 1 ? `+${formatNumber((multiplier - 1) * 100)}%` : ...;
} else if (originalRate === 0 && point.passRate > 0) {
  changeStr = '+∞';  // Zero baseline → infinity
}
```

## Proposed Changes

### A. Three-Tier Result Classification System

**Replace the current binary impossible/unobserved distinction with explicit three-tier classification:**

#### Classification Definitions

| Classification | Symbol | Condition | Meaning |
|---------------|--------|-----------|---------|
| THEORETICALLY_IMPOSSIBLE | 🚫 | Static analysis proves no solution exists within bounds/gates | Math says it cannot happen |
| EMPIRICALLY_UNREACHABLE | ⛔ | `observed_max < threshold` AND `passRate === 0` | Sampling shows ceiling below threshold |
| UNOBSERVED | 🟡 | `passRate === 0` but no empirical ceiling detected | No hits found, but theory doesn't preclude it |

#### Implementation

**1. Extend `statusTheme.js` with new status:**

```javascript
theoretically_impossible: {
  emoji: '🚫',
  label: 'Theoretically Impossible',
  color: '#990000',  // Darker red than impossible
  description: 'Static analysis proves this cannot occur'
},
empirically_unreachable: {
  emoji: '⛔',
  label: 'Empirically Unreachable',
  color: '#CC3311',  // Current impossible color
  description: 'Observed maximum below threshold in sampled conditions'
},
unobserved: {
  emoji: '🟡',
  label: 'Unobserved',
  color: '#DDAA33',
  description: 'No triggers found, but not proven impossible'
}
```

**2. Modify `NonAxisFeasibilityAnalyzer.#classify()` to distinguish cases:**

```javascript
#classify(passRate, maxValue, threshold, operator) {
  if (passRate === 0) {
    const isUpperBoundOp = operator === '>=' || operator === '>';
    const isLowerBoundOp = operator === '<=' || operator === '<';

    // Check for empirical ceiling
    if (isUpperBoundOp && maxValue < threshold - this.#epsilon) {
      return 'EMPIRICALLY_UNREACHABLE';  // Ceiling detected
    }
    if (isLowerBoundOp && maxValue > threshold + this.#epsilon) {
      return 'EMPIRICALLY_UNREACHABLE';  // Floor detected
    }
    return 'UNOBSERVED';  // No ceiling/floor evidence
  }
  // ... existing rare/ok logic
}
```

**3. Update `DiagnosticResult.js` to expose classification reason:**

Add a `rarityReason` getter that returns a structured explanation:

```javascript
get rarityReason() {
  if (this.#isImpossible) {
    return {
      classification: 'THEORETICALLY_IMPOSSIBLE',
      explanation: 'Static bounds analysis proves no valid solution exists'
    };
  }
  if (this.#triggerRate === 0) {
    if (this.#hasEmpiricalCeiling) {
      return {
        classification: 'EMPIRICALLY_UNREACHABLE',
        explanation: `Observed max (${this.#maxObserved.toFixed(3)}) < threshold (${this.#threshold}) by ${(this.#threshold - this.#maxObserved).toFixed(3)}`
      };
    }
    return {
      classification: 'UNOBSERVED',
      explanation: 'No triggers found in sampling, but not proven impossible'
    };
  }
  // ... existing categories
}
```

#### Report Wording

**Replace current ambiguous labels with explicit phrasing:**

| Current | Proposed |
|---------|----------|
| `⛔ IMPOSSIBLE` (for any zero-hit) | `🚫 THEORETICALLY IMPOSSIBLE: Static analysis proves no solution` |
| `⛔ IMPOSSIBLE` (for empirical ceiling) | `⛔ EMPIRICALLY UNREACHABLE: max(0.608) < threshold(0.620) by 0.012` |
| `🟡 UNOBSERVED` | `🟡 UNOBSERVED: 0 hits in N samples, but no ceiling detected` |

### B. Plain-English Axis Sign Conflict Explanations

**Replace technical jargon with actionable descriptions.**

#### Current Problem

Reports show:
```
positive_weight_low_max … lostRawSum … lostIntensity…
```

Without explaining what this means for the content creator.

#### Proposed Solution

**1. Add `AxisSignConflictExplainer` service:**

```javascript
class AxisSignConflictExplainer {
  /**
   * Generate plain-English explanation of axis sign conflict
   * @param {Object} conflict - The detected conflict details
   * @returns {string} Human-readable explanation
   */
  explain(conflict) {
    const {
      conflictType,
      axisName,
      prototypeSign,
      moodRegimeMax,
      requiredForThreshold,
      lostIntensity
    } = conflict;

    return [
      `**What this means**: This mood regime caps ${axisName} below the level ` +
      `this prototype needs for high intensity.`,
      ``,
      `**Specifics**:`,
      `- Prototype needs positive ${axisName} contribution`,
      `- Current regime max: ${moodRegimeMax.toFixed(2)}`,
      `- Required for threshold: ${requiredForThreshold.toFixed(2)}`,
      `- Intensity lost: ${lostIntensity.toFixed(3)} (${(lostIntensity * 100).toFixed(1)}% of max)`,
    ].join('\n');
  }
}
```

**2. Add distance-to-threshold decomposition:**

Show whether the recommendation is actually material:

```markdown
### Distance to Threshold Analysis

| Metric | Value | Notes |
|--------|-------|-------|
| threshold | 0.620 | Expression requirement |
| P95 | 0.562 | 95th percentile observed |
| max | 0.608 | Maximum observed |
| threshold - P95 | 0.058 | Gap from typical high values |
| threshold - max | 0.012 | Gap from absolute best case |
| recoverable intensity | 0.100 | If axis caps removed |
| **conclusion** | **Insufficient** | Even full recovery (+0.100) wouldn't bridge P95 gap (0.058) |
```

**3. Update `BlockerSectionGenerator` to include plain-English explanation:**

```javascript
formatAxisSignConflict(conflict) {
  const technicalDetails = this.#formatTechnicalDetails(conflict);
  const plainEnglish = this.#explainer.explain(conflict);
  const distanceAnalysis = this.#formatDistanceToThreshold(conflict);

  return [
    `#### Axis Sign Conflict: ${conflict.axisName}`,
    ``,
    plainEnglish,
    ``,
    `<details>`,
    `<summary>Technical Details</summary>`,
    ``,
    technicalDetails,
    `</details>`,
    ``,
    distanceAnalysis
  ].join('\n');
}
```

### C. Zero-Hit Sensitivity Table Improvements

**Transform zero-hit sensitivity sections from misleading to actionable.**

#### Current Problem

Zero-hit cases show sensitivity tables with "+∞" changes that look authoritative but provide no actionable guidance.

#### Proposed Solution

**1. Replace sensitivity grid with clause quantiles when baseline is zero:**

```markdown
### No Triggers Found - Alternative Analysis

We found 0 witnesses in 10,000 samples. Sensitivity sweeps on stored contexts
cannot estimate expression trigger rate.

#### Clause Quantile Distribution

| Clause | P50 | P90 | P95 | Max | Threshold | Gap to Threshold |
|--------|-----|-----|-----|-----|-----------|------------------|
| emotions.confusion | 0.412 | 0.558 | 0.598 | 0.608 | 0.620 | -0.012 |
| arousal | 0.340 | 0.455 | 0.498 | 0.525 | 0.400 | +0.125 ✓ |

#### Suggested Threshold Adjustments for Target Pass Rates

| Target Pass Rate | emotions.confusion | arousal |
|------------------|-------------------|---------|
| 1% | ≤ 0.598 | ≤ 0.498 |
| 5% | ≤ 0.558 | ≤ 0.455 |
| 10% | ≤ 0.512 | ≤ 0.420 |

**Interpretation**: To achieve 5% pass rate, lower `emotions.confusion` threshold
from 0.620 to ≤ 0.558 (Δ -0.062).
```

**2. Add constructed witness attempt:**

When zero hits occur, attempt to construct a witness by finding the "nearest miss":

```markdown
#### Nearest Miss Analysis

The closest sample to triggering achieved:
- **Overall proximity**: 0.988 (98.8% of way to trigger)
- **Blocking clause**: emotions.confusion = 0.608 (needed ≥ 0.620)
- **If emotions.confusion were 0.620**: Expression would trigger

**Constructed witness** (hypothetical state that would trigger):
```json
{
  "emotions": { "confusion": 0.620, "joy": 0.45 },
  "arousal": 0.52,
  "engagement": 0.61
}
```
*Note: This state was not observed in sampling but represents the minimal
change needed from the nearest miss.*
```

**3. Modify `SensitivitySectionGenerator.formatSensitivityResult()`:**

```javascript
formatSensitivityResult(result, originalThreshold, originalRate) {
  if (originalRate === 0) {
    return this.#formatZeroHitAlternative(result);
  }
  return this.#formatStandardSensitivityTable(result, originalThreshold, originalRate);
}

#formatZeroHitAlternative(result) {
  const lines = [
    '### No Triggers Found - Alternative Analysis',
    '',
    'We found 0 witnesses. Sensitivity sweeps on stored contexts cannot estimate expression trigger rate.',
    '',
    '#### Clause Quantile Distribution',
    '',
    this.#formatClauseQuantiles(result),
    '',
    '#### Suggested Threshold Adjustments for Target Pass Rates',
    '',
    this.#formatThresholdSuggestions(result),
    '',
    '#### Nearest Miss Analysis',
    '',
    this.#formatNearestMiss(result)
  ];
  return lines.join('\n');
}
```

### D. Percent-Change Display Improvements

**Fix misleading large percentages from tiny baselines.**

#### Current Problem

```
+5700% clause pass rate change (because baseline was 0.02%)
```

This is mathematically correct but practically useless.

#### Proposed Solution

**1. Show absolute deltas primarily, percent-change as secondary:**

| Current | Proposed |
|---------|----------|
| `+5700%` | `0.02% → 1.16% (+1.14 pp)` |
| `+∞` | `0.00% → 0.45% (+0.45 pp, from zero)` |

**2. Modify `SensitivitySectionGenerator` percent-change logic:**

```javascript
#formatChangeColumn(originalRate, newRate) {
  const absoluteDelta = newRate - originalRate;
  const absoluteDeltaPp = (absoluteDelta * 100).toFixed(2);

  // Primary: absolute delta in percentage points
  let primary = absoluteDelta >= 0
    ? `+${absoluteDeltaPp} pp`
    : `${absoluteDeltaPp} pp`;

  // Secondary: percent change (only if meaningful)
  let secondary = '';
  if (originalRate > 0.001) {  // Only show % change if baseline > 0.1%
    const pctChange = ((newRate - originalRate) / originalRate) * 100;
    if (Math.abs(pctChange) < 1000) {  // Cap at ±1000%
      secondary = pctChange >= 0
        ? ` (×${(newRate / originalRate).toFixed(1)})`
        : ` (×${(newRate / originalRate).toFixed(2)})`;
    }
  } else if (originalRate === 0 && newRate > 0) {
    secondary = ' (from zero)';
  }

  return `${primary}${secondary}`;
}
```

**3. Update table format:**

```markdown
| Threshold | Pass Rate | Change |
|-----------|-----------|--------|
| 0.55 | 0.02% | baseline |
| 0.50 | 1.16% | +1.14 pp (×58) |
| 0.45 | 4.23% | +4.21 pp (×212) |
| 0.40 | 8.91% | +8.89 pp |
```

Note: Multiplier hidden when > 1000× or baseline is zero.

## Data Model Changes

### New Types

```typescript
// Classification tier for expression feasibility
type FeasibilityClassification =
  | 'THEORETICALLY_IMPOSSIBLE'  // Static analysis proves impossibility
  | 'EMPIRICALLY_UNREACHABLE'   // Observed ceiling below threshold
  | 'UNOBSERVED'                // No hits but no ceiling evidence
  | 'RARE'                      // < 0.1% pass rate
  | 'OK';                       // Passes sometimes

// Structured classification result
interface ClassificationResult {
  classification: FeasibilityClassification;
  explanation: string;
  evidence?: {
    observedMax?: number;
    threshold?: number;
    gap?: number;
    sampleCount?: number;
  };
}

// Distance-to-threshold analysis
interface DistanceAnalysis {
  threshold: number;
  p95: number;
  max: number;
  gapFromP95: number;
  gapFromMax: number;
  recoverableIntensity?: number;
  conclusion: 'ATTAINABLE' | 'MARGINAL' | 'INSUFFICIENT';
}
```

### Modifications to Existing Models

**DiagnosticResult.js:**
- Add `#hasEmpiricalCeiling: boolean`
- Add `#maxObserved: number`
- Add `get rarityReason(): ClassificationResult`
- Modify `get rarityCategory` to use three-tier system

**NonAxisFeasibilityAnalyzer.js:**
- Add `#epsilon: number` (configurable tolerance)
- Modify `#classify()` to return `ClassificationResult`
- Add `#analyzeDistanceToThreshold()`

**SensitivitySectionGenerator.js:**
- Add `#formatZeroHitAlternative()`
- Add `#formatClauseQuantiles()`
- Add `#formatThresholdSuggestions()`
- Add `#formatNearestMiss()`
- Modify `#formatChangeColumn()` for absolute-primary display

## Implementation Plan

### Phase 1: Classification System (Files: 3)

1. **Extend `statusTheme.js`**
   - Add `theoretically_impossible` and `empirically_unreachable` statuses
   - Update color palette for three-tier distinction

2. **Modify `NonAxisFeasibilityAnalyzer.js`**
   - Implement three-tier `#classify()` logic
   - Add `#epsilon` configuration
   - Return `ClassificationResult` with evidence

3. **Update `DiagnosticResult.js`**
   - Add `rarityReason` getter
   - Track `#maxObserved` and `#hasEmpiricalCeiling`

### Phase 2: Plain-English Explanations (Files: 2)

1. **Create `AxisSignConflictExplainer.js`**
   - Implement `explain()` method for plain-English output
   - Add distance-to-threshold analysis logic

2. **Modify `BlockerSectionGenerator.js`**
   - Integrate `AxisSignConflictExplainer`
   - Add collapsible technical details
   - Include distance decomposition table

### Phase 3: Zero-Hit Handling (Files: 2)

1. **Modify `SensitivitySectionGenerator.js`**
   - Add `#formatZeroHitAlternative()` method
   - Add quantile table generation
   - Add threshold suggestion calculations
   - Add nearest miss formatting

2. **Modify `SensitivityAnalyzer.js` (if needed)**
   - Ensure quantile data is available for zero-hit cases
   - Track nearest miss during simulation

### Phase 4: Percent-Change Display (Files: 1)

1. **Modify `SensitivitySectionGenerator.js`**
   - Replace `#formatChangeColumn()` logic
   - Implement absolute-primary, percent-secondary format
   - Add multiplier cap at 1000×

### Phase 5: Integration & Testing (Files: TBD)

1. **Update report consumers**
   - Verify all components handle new classification types
   - Update any UI components displaying classifications

2. **Create/update tests**
   - Unit tests for each modified function
   - Integration tests for full report generation
   - Visual comparison tests for report output

## Testing Requirements

### Unit Tests

**Classification System:**
- `NonAxisFeasibilityAnalyzer.#classify()` returns correct tier for each case:
  - Theoretical impossibility from static analysis
  - Empirical ceiling detected (max < threshold)
  - True unobserved (no ceiling evidence)
  - Rare and OK cases unchanged
- `DiagnosticResult.rarityReason` returns structured explanation
- Edge cases: exact threshold match, epsilon boundary

**Axis Sign Conflict Explanations:**
- `AxisSignConflictExplainer.explain()` produces readable output
- Distance-to-threshold calculations are accurate
- Conclusion determination (ATTAINABLE/MARGINAL/INSUFFICIENT) is correct

**Zero-Hit Handling:**
- Quantile table generated correctly when baseline is zero
- Threshold suggestions are mathematically correct for target pass rates
- Nearest miss analysis identifies correct blocking clause
- Graceful fallback if quantile data unavailable

**Percent-Change Display:**
- Absolute delta calculation is correct
- Multiplier shown only when baseline > 0.1%
- Multiplier capped at 1000×
- Zero-baseline case shows "(from zero)" annotation

### Integration Tests

**Full Report Generation:**
- Generate reports for expressions with:
  - Zero triggers (verify alternative analysis appears)
  - Very low trigger rate (verify percent-change format)
  - Axis sign conflicts (verify plain-English explanation)
  - Theoretical impossibility vs empirical unreachability

**Regression Tests:**
- Existing reports remain unchanged for non-edge cases
- New classifications don't break downstream consumers
- Performance not significantly impacted

### Visual/Manual Tests

- Verify report readability with real expressions
- Confirm explanations are understandable by non-technical users
- Check formatting consistency across different edge cases

## Configuration

```javascript
const reportClarityConfig = {
  // Classification thresholds
  classification: {
    epsilon: 0.001,  // Tolerance for "exact" threshold match
    rareThreshold: 0.001,  // Pass rate below which is "RARE"
  },

  // Percent-change display
  percentChange: {
    showMultiplierAbove: 0.001,  // 0.1% baseline
    maxMultiplierDisplay: 1000,  // Cap at 1000×
    showAbsoluteAsPrimary: true,
  },

  // Zero-hit alternative analysis
  zeroHit: {
    showQuantiles: true,
    showThresholdSuggestions: true,
    showNearestMiss: true,
    targetPassRates: [0.01, 0.05, 0.10],  // 1%, 5%, 10%
  },

  // Axis sign conflict explanations
  axisConflict: {
    showPlainEnglish: true,
    showDistanceDecomposition: true,
    hideTechnicalDetails: false,  // Show in collapsible
  }
};
```

## Success Criteria

1. **Classification Clarity**: Users can immediately distinguish "can never happen" from "didn't happen in this sample"
2. **Actionable Axis Conflict Reports**: Non-technical users understand what axis sign conflicts mean and whether fixing them matters
3. **Zero-Hit Usefulness**: Reports for zero-trigger expressions provide concrete threshold suggestions
4. **Percent-Change Sanity**: No more +5700% changes; users see meaningful absolute deltas

## File Inventory

| File | Changes | LOC Impact |
|------|---------|------------|
| `src/expressionDiagnostics/statusTheme.js` | Add 2 status types | +20 |
| `src/expressionDiagnostics/models/DiagnosticResult.js` | Add rarityReason, tracking fields | +40 |
| `src/expressionDiagnostics/services/NonAxisFeasibilityAnalyzer.js` | Three-tier classify, evidence | +60 |
| `src/expressionDiagnostics/services/AxisSignConflictExplainer.js` | **NEW** | +150 |
| `src/expressionDiagnostics/services/sectionGenerators/BlockerSectionGenerator.js` | Integrate explainer | +30 |
| `src/expressionDiagnostics/services/sectionGenerators/SensitivitySectionGenerator.js` | Zero-hit handling, percent-change | +120 |
| Tests (unit) | New test files | +400 |
| Tests (integration) | Extended scenarios | +150 |

**Total estimated LOC**: ~970 lines

## Open Questions

1. **Should "empirically unreachable" use the observed P99 instead of max?** Max is more conservative but can be an outlier; P99 is more stable but might miss edge cases.

2. **What epsilon tolerance is appropriate for ceiling detection?** Too small catches noise; too large misses real ceilings.

3. **Should threshold suggestions account for correlation between clauses?** Current design assumes independence; correlated clauses might need joint analysis.

4. **How should the UI indicate which classification tier a result belongs to?** Current UI uses colors; may need additional visual cues for three tiers.
