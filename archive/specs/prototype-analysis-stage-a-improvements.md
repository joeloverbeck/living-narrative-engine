# Prototype Analysis Stage A Improvements

## Overview

This specification addresses edge cases and behavioral issues in the Stage A candidate filtering cascade identified during external review. The issues center on how the `CandidatePairFilter` handles near-zero weights and empty axis sets.

## Background

The prototype overlap analysis system uses a three-filter cascade in Stage A (Route A):
1. **Active Axis Overlap** (Jaccard similarity)
2. **Sign Agreement**
3. **Cosine Similarity**

External review identified two concrete issues:

1. **Jaccard(∅, ∅) returns 0** - Two prototypes with no active axes are treated as "maximally dissimilar"
2. **Sign agreement brittleness near zero** - Weights just above the epsilon threshold can cause spurious sign disagreements

## Issue Analysis

### Issue 1: Jaccard Empty-Set Handling

**Current behavior** (`CandidatePairFilter.js`, lines 534-535):
```javascript
#computeJaccard(setA, setB) {
  if (setA.size === 0 && setB.size === 0) {
    return 0; // No meaningful overlap for empty sets
  }
  // ...
}
```

**Problem**: Mathematically, Jaccard(∅, ∅) = 0/0 is undefined. Returning 0 means two prototypes with all weights below `activeAxisEpsilon` are treated as dissimilar, even if their weight vectors are identical.

**Real-world scenario**:
- Prototype A: `{valence: 0.05, arousal: 0.03}` (all below epsilon=0.08)
- Prototype B: `{valence: 0.05, arousal: 0.03}` (identical)
- Active axes for both: ∅
- Current result: Jaccard = 0 → rejected by Route A

**Mitigation assessment**: Route C (behavioral prescan) can catch such pairs via Monte Carlo sampling, but only if `enableMultiRouteFiltering: true` and within `maxPrescanPairs: 1000` limit.

**Severity**: LOW - Multi-route filtering provides a safety net.

**Recommended fix**: Return `1.0` (perfect overlap) when both sets are empty, treating identical empty sets as semantically equivalent. Add a configuration option if users prefer the current conservative behavior.

### Issue 2: Sign Agreement Brittleness Near Zero

**Current behavior** (`CandidatePairFilter.js`, lines 553-573):
```javascript
const signA = Math.sign(weightA);
const signB = Math.sign(weightB);
if (signA === signB) { matchingCount++; }
```

**Problem**: `Math.sign(0.09)` returns `1` and `Math.sign(-0.09)` returns `-1`. Two prototypes with weights just above epsilon but with opposite signs are marked as disagreeing, even when both weights are near-zero and functionally negligible.

**Real-world scenario**:
- Prototype A: `{valence: 0.09}` (just above epsilon=0.08)
- Prototype B: `{valence: -0.09}` (just above epsilon=0.08)
- Sign agreement: 0% (complete disagreement)
- But both values are functionally "neutral" in terms of affect impact

**Severity**: MEDIUM - Can cause false rejections of behaviorally similar prototypes.

**Recommended fix**: Implement "soft sign" comparison that treats weights within a configurable tolerance as neutral (sign 0), only counting true positive/negative directions for significant weights.

## Specification

### 1. Soft Sign Agreement Implementation

#### 1.1 Add Configuration Property

**File**: `src/expressionDiagnostics/config/prototypeOverlapConfig.js`

```javascript
/**
 * Threshold for "soft sign" comparison in sign agreement calculation.
 * Weights with |w| < this value are treated as neutral (sign 0).
 * Should be >= activeAxisEpsilon to avoid overlap with inactive axes.
 * Set to 0 to disable soft sign (use Math.sign behavior).
 */
softSignThreshold: 0.15,
```

**Rationale**: A threshold of 0.15 ensures that "near-zero" weights between epsilon (0.08) and 0.15 are treated as neutral, avoiding spurious sign disagreements.

#### 1.2 Modify Sign Agreement Calculation

**File**: `src/expressionDiagnostics/services/prototypeOverlap/CandidatePairFilter.js`

Create a new private method:

```javascript
/**
 * Compute sign with soft threshold for near-zero weights.
 * @param {number} weight - The weight value
 * @returns {-1|0|1} Soft sign: -1 (negative), 0 (neutral), 1 (positive)
 */
#softSign(weight) {
  const threshold = this.#config.softSignThreshold ?? 0;
  if (threshold === 0) {
    return Math.sign(weight);
  }
  if (Math.abs(weight) < threshold) {
    return 0; // Neutral
  }
  return Math.sign(weight);
}
```

Modify `#computeSignAgreement`:

```javascript
#computeSignAgreement(weightsA, weightsB, sharedAxes) {
  if (sharedAxes.size === 0) {
    return 0;
  }

  let matchingCount = 0;
  for (const axis of sharedAxes) {
    const weightA = weightsA[axis];
    const weightB = weightsB[axis];

    const signA = this.#softSign(weightA);
    const signB = this.#softSign(weightB);

    if (signA === signB) {
      matchingCount++;
    }
  }

  return matchingCount / sharedAxes.size;
}
```

### 2. Jaccard Empty-Set Handling (Optional Enhancement)

#### 2.1 Add Configuration Property

**File**: `src/expressionDiagnostics/config/prototypeOverlapConfig.js`

```javascript
/**
 * Value to return when computing Jaccard similarity of two empty sets.
 * - 1.0: Treat empty sets as perfectly overlapping (recommended)
 * - 0.0: Treat empty sets as non-overlapping (current behavior)
 * - NaN: Treat as undefined (explicit handling required)
 */
jaccardEmptySetValue: 1.0,
```

#### 2.2 Modify Jaccard Calculation

**File**: `src/expressionDiagnostics/services/prototypeOverlap/CandidatePairFilter.js`

```javascript
#computeJaccard(setA, setB) {
  if (setA.size === 0 && setB.size === 0) {
    // Configurable behavior for empty-empty case
    const emptyValue = this.#config.jaccardEmptySetValue ?? 1.0;
    return emptyValue;
  }

  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return intersection.size / union.size;
}
```

### 3. Testing Requirements

#### 3.1 Unit Tests for Soft Sign Agreement

**File**: `tests/unit/expressionDiagnostics/services/prototypeOverlap/candidatePairFilter.test.js`

Add new test suite:

```javascript
describe('Sign Agreement - Soft Sign', () => {
  it('treats near-zero weights as neutral (soft sign)', async () => {
    const { filter } = createFilter({
      activeAxisEpsilon: 0.08,
      softSignThreshold: 0.15,
      candidateMinActiveAxisOverlap: 0.0,
      candidateMinSignAgreement: 0.0,
      candidateMinCosineSimilarity: -1.0,
    });

    // Both weights are "near-zero" (above epsilon but below softSignThreshold)
    const p1 = createPrototype('p1', { valence: 0.09 });  // Would be +1 with Math.sign
    const p2 = createPrototype('p2', { valence: -0.09 }); // Would be -1 with Math.sign

    const result = await filter.filterCandidates([p1, p2]);

    // With soft sign, both are neutral (0), so they agree
    expect(result.candidates[0].candidateMetrics.signAgreement).toBe(1);
  });

  it('hard sign disagrees for weights opposite and above softSignThreshold', async () => {
    const { filter } = createFilter({
      activeAxisEpsilon: 0.08,
      softSignThreshold: 0.15,
      candidateMinActiveAxisOverlap: 0.0,
      candidateMinSignAgreement: 0.0,
      candidateMinCosineSimilarity: -1.0,
    });

    // Both weights are above softSignThreshold
    const p1 = createPrototype('p1', { valence: 0.5 });
    const p2 = createPrototype('p2', { valence: -0.5 });

    const result = await filter.filterCandidates([p1, p2]);

    // True sign disagreement
    expect(result.candidates[0].candidateMetrics.signAgreement).toBe(0);
  });

  it('soft sign treats zero as neutral', async () => {
    const { filter } = createFilter({
      activeAxisEpsilon: 0.0, // Allow axis with weight 0
      softSignThreshold: 0.15,
      candidateMinActiveAxisOverlap: 0.0,
      candidateMinSignAgreement: 0.0,
      candidateMinCosineSimilarity: -1.0,
    });

    const p1 = createPrototype('p1', { valence: 0 });
    const p2 = createPrototype('p2', { valence: 0.1 }); // Also neutral

    const result = await filter.filterCandidates([p1, p2]);

    expect(result.candidates[0].candidateMetrics.signAgreement).toBe(1);
  });

  it('mixed soft and hard signs are evaluated correctly', async () => {
    const { filter } = createFilter({
      activeAxisEpsilon: 0.08,
      softSignThreshold: 0.15,
      candidateMinActiveAxisOverlap: 0.0,
      candidateMinSignAgreement: 0.0,
      candidateMinCosineSimilarity: -1.0,
    });

    // 4 axes: 2 agree (arousal, dominance), 1 disagrees (valence), 1 neutral-vs-positive
    const p1 = createPrototype('p1', {
      valence: 0.8,    // +1
      arousal: 0.6,    // +1
      dominance: -0.5, // -1
      novelty: 0.1     // neutral (below 0.15)
    });
    const p2 = createPrototype('p2', {
      valence: -0.7,   // -1 (disagrees with p1)
      arousal: 0.4,    // +1 (agrees)
      dominance: -0.3, // -1 (agrees)
      novelty: 0.5     // +1
    });

    const result = await filter.filterCandidates([p1, p2]);

    // valence: disagree (+1 vs -1)
    // arousal: agree (+1 vs +1)
    // dominance: agree (-1 vs -1)
    // novelty: neutral (0) vs positive (+1) = disagree
    // Agreement: 2/4 = 0.5
    expect(result.candidates[0].candidateMetrics.signAgreement).toBeCloseTo(0.5, 5);
  });

  it('backward compatible when softSignThreshold is 0', async () => {
    const { filter } = createFilter({
      activeAxisEpsilon: 0.08,
      softSignThreshold: 0, // Disabled
      candidateMinActiveAxisOverlap: 0.0,
      candidateMinSignAgreement: 0.0,
      candidateMinCosineSimilarity: -1.0,
    });

    const p1 = createPrototype('p1', { valence: 0.09 });
    const p2 = createPrototype('p2', { valence: -0.09 });

    const result = await filter.filterCandidates([p1, p2]);

    // Original behavior: Math.sign disagrees
    expect(result.candidates[0].candidateMetrics.signAgreement).toBe(0);
  });
});
```

#### 3.2 Unit Tests for Jaccard Empty-Set Handling

Add to same test file:

```javascript
describe('Jaccard - Empty Set Handling', () => {
  it('returns configured value for Jaccard(empty, empty)', async () => {
    const { filter } = createFilter({
      activeAxisEpsilon: 0.1,
      jaccardEmptySetValue: 1.0, // Treat as perfect overlap
      candidateMinActiveAxisOverlap: 0.0,
      candidateMinSignAgreement: 0.0,
      candidateMinCosineSimilarity: -1.0,
    });

    const p1 = createPrototype('p1', { a: 0.01 }); // Below epsilon
    const p2 = createPrototype('p2', { a: 0.02 }); // Below epsilon

    const result = await filter.filterCandidates([p1, p2]);

    expect(result.candidates[0].candidateMetrics.activeAxisOverlap).toBe(1);
  });

  it('respects legacy behavior when jaccardEmptySetValue is 0', async () => {
    const { filter } = createFilter({
      activeAxisEpsilon: 0.1,
      jaccardEmptySetValue: 0.0, // Legacy behavior
      candidateMinActiveAxisOverlap: 0.0,
      candidateMinSignAgreement: 0.0,
      candidateMinCosineSimilarity: -1.0,
    });

    const p1 = createPrototype('p1', { a: 0.01 });
    const p2 = createPrototype('p2', { a: 0.02 });

    const result = await filter.filterCandidates([p1, p2]);

    expect(result.candidates[0].candidateMetrics.activeAxisOverlap).toBe(0);
  });
});
```

#### 3.3 Integration Tests

**File**: `tests/integration/expressionDiagnostics/prototypeOverlap/softSignAgreement.integration.test.js`

Create new integration test file:

```javascript
/**
 * @file Integration tests for soft sign agreement in prototype overlap analysis
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
// ... standard integration test setup

describe('Soft Sign Agreement Integration', () => {
  describe('near-zero weight prototypes', () => {
    it('correctly identifies near-zero redundant prototypes as candidates', async () => {
      // Test with real prototype data from emotion_prototypes.lookup.json
      // that have weights near the soft sign threshold
    });

    it('does not falsely reject behaviorally similar prototypes due to sign quirks', async () => {
      // End-to-end test: create prototypes → run full analysis → verify classification
    });
  });
});
```

#### 3.4 Update Existing Tests

Review and update existing tests in:
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/candidatePairFilter.test.js`
  - The existing "handles zero-weight vectors" test (line 624-646) should be updated to expect `activeAxisOverlap: 1` after the change
  - Add backward-compatibility tests for `jaccardEmptySetValue: 0`

### 4. Documentation Updates

#### 4.1 Update Technical Report

**File**: `reports/prototype-analysis-system.md`

Add section under "2.2 Sign Agreement":

```markdown
**Soft Sign Configuration (v2.2)**:
The `softSignThreshold` config property enables "soft sign" comparison where weights with
|w| < threshold are treated as neutral (sign 0). This prevents spurious sign disagreements
for near-zero weights. Default: 0.15. Set to 0 to disable.
```

#### 4.2 Update Config JSDoc

Already included in specification section 1.1 and 2.1.

### 5. Implementation Order

1. Add `softSignThreshold` config property (default: 0.15)
2. Implement `#softSign()` method
3. Modify `#computeSignAgreement()` to use soft sign
4. Add unit tests for soft sign behavior
5. (Optional) Add `jaccardEmptySetValue` config property (default: 1.0)
6. (Optional) Modify `#computeJaccard()` for empty-set handling
7. (Optional) Add unit tests for empty-set behavior
8. Update existing tests that expect legacy behavior
9. Run full test suite to verify no regressions
10. Update documentation

### 6. Acceptance Criteria

- [ ] `softSignThreshold: 0.15` is the default in config
- [ ] Prototypes with opposite near-zero weights (|w| < 0.15) have sign agreement = 1
- [ ] Prototypes with opposite significant weights (|w| >= 0.15) have sign agreement = 0
- [ ] Setting `softSignThreshold: 0` restores legacy Math.sign behavior
- [ ] All existing tests pass (with necessary updates for expected values)
- [ ] New edge-case tests pass for soft sign scenarios
- [ ] (Optional) `jaccardEmptySetValue: 1.0` is the default
- [ ] (Optional) Empty-empty Jaccard returns 1.0 by default

### 7. Out of Scope

The following are explicitly out of scope for this spec:
- Changes to Route B (gate similarity) or Route C (behavioral prescan) filtering
- Changes to Stage B (behavioral evaluation) or Stage C (classification)
- Changes to cosine similarity calculation
- Performance optimizations

## Risk Assessment

**Low Risk**: These changes are additive with backward-compatible defaults available via configuration.

**Testing Risk**: Existing tests may fail if they assert specific sign agreement values for near-zero weights. These need to be identified and updated.

## References

- External review: ChatGPT analysis of `reports/prototype-analysis-system.md`
- Source files:
  - `src/expressionDiagnostics/services/prototypeOverlap/CandidatePairFilter.js`
  - `src/expressionDiagnostics/config/prototypeOverlapConfig.js`
- Test files:
  - `tests/unit/expressionDiagnostics/services/prototypeOverlap/candidatePairFilter.test.js`
