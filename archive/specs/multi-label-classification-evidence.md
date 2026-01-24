# Multi-Label Classification Evidence Enhancement

## Summary

Enhance the prototype overlap classification system to emit multi-label evidence instead of returning only the first matching classification. This enables better decision support by showing all applicable classifications and their confidence scores.

## Problem Statement

The current `OverlapClassifier` uses a "first match wins" approach where classification types are checked in priority order and only the first match is returned. This design:

1. Hides potentially relevant secondary classifications
2. Loses evidence about other applicable classification types
3. Limits decision support for users reviewing prototype pairs

**Example**: A pair might satisfy both `nested_siblings` and `needs_separation` criteria, but only `nested_siblings` (higher priority) is reported.

## Current Architecture

### Classification Flow (OverlapClassifier.js)

```javascript
// Current: Returns first match only
for (const classificationType of CLASSIFICATION_PRIORITY) {
  const checkResult = this.#checkClassification(classificationType, metrics, thresholds);
  if (checkResult.matches) {
    return this.#buildClassificationResult(classificationType, ...);
  }
}
```

### Priority Order

```javascript
const CLASSIFICATION_PRIORITY = [
  'merge_recommended',
  'subsumed_recommended',
  'convert_to_expression',
  'nested_siblings',
  'needs_separation',
  'keep_distinct',  // Fallback
];
```

## Proposed Solution

### 1. Add Multi-Label Evidence Collection

Modify `OverlapClassifier` to evaluate **all** classification types and return evidence for each matching type, while still preserving the primary classification for backward compatibility.

### 2. New Return Structure

```javascript
// Enhanced classification result
{
  type: 'nested_siblings',           // Primary classification (backward compatible)
  thresholds: { ... },               // Existing thresholds object
  metrics: { ... },                  // Existing metrics object
  narrowerPrototype: 'a',            // Existing field for nesting types

  // NEW: Multi-label evidence
  allMatchingClassifications: [
    {
      type: 'nested_siblings',
      confidence: 0.98,
      evidence: {
        source: 'behavioral',        // 'deterministic' | 'behavioral'
        pB_given_A: 0.99,
        pA_given_B: 0.45
      },
      isPrimary: true
    },
    {
      type: 'needs_separation',
      confidence: 0.72,
      evidence: {
        gateOverlapRatio: 0.85,
        pearsonCorrelation: 0.88,
        meanAbsDiff: 0.15           // Above merge threshold
      },
      isPrimary: false
    },
    {
      type: 'convert_to_expression',
      confidence: 0.65,
      evidence: {
        hasNesting: true,
        structuralMatch: true,
        pattern: 'low-threat-steady-state'
      },
      isPrimary: false
    }
  ]
}
```

### 3. Confidence Scoring

Each classification type should report a confidence score based on how strongly the pair matches its criteria:

| Classification | Confidence Calculation |
|----------------|----------------------|
| `merge_recommended` | Combine: correlation strength, MAD proximity to threshold, gate overlap |
| `subsumed_recommended` | Dominance strength × exclusive rate inverse |
| `nested_siblings` | Conditional probability asymmetry (max(pB_given_A, pA_given_B)) |
| `needs_separation` | Correlation × (1 - MAD normalized proximity to merge threshold) |
| `convert_to_expression` | Nesting confidence × structural pattern match quality |

### 4. Implementation Details

#### 4.1 New Method: `#evaluateAllClassifications()`

```javascript
#evaluateAllClassifications(metrics, thresholds) {
  const matches = [];

  for (const classificationType of CLASSIFICATION_PRIORITY) {
    if (classificationType === 'keep_distinct') continue;

    const checkResult = this.#checkClassification(classificationType, metrics, thresholds);
    if (checkResult.matches) {
      matches.push({
        type: classificationType,
        confidence: this.#computeConfidence(classificationType, metrics, thresholds),
        evidence: this.#extractEvidence(classificationType, metrics, checkResult),
        subsumedPrototype: checkResult.subsumedPrototype
      });
    }
  }

  return matches;
}
```

#### 4.2 New Method: `#computeConfidence()`

Implement per-classification confidence calculation based on how strongly criteria are met (not just boolean pass/fail).

#### 4.3 New Method: `#extractEvidence()`

Extract the key metrics/data that support each classification match.

#### 4.4 Modify `#buildClassificationResult()`

Extend to include `allMatchingClassifications` array.

## Backward Compatibility

The enhancement **must** preserve backward compatibility:

1. **Primary `type` field unchanged**: The first-match behavior remains the default for the `type` field
2. **Existing fields preserved**: All current result fields remain in their existing locations
3. **New field is additive**: `allMatchingClassifications` is a new optional field
4. **UI graceful degradation**: UI should work with or without multi-label evidence

## Files to Modify

### Core Implementation

1. **`src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js`**
   - Add `#evaluateAllClassifications()` method
   - Add `#computeConfidence()` method (per classification type)
   - Add `#extractEvidence()` method
   - Modify `classify()` to call new methods
   - Modify `#buildClassificationResult()` to include `allMatchingClassifications`

2. **`src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js`**
   - Update result handling to pass through `allMatchingClassifications`
   - No changes needed for backward compatibility paths

3. **`src/domUI/prototype-analysis/PrototypeAnalysisController.js`**
   - Enhance `#renderRecommendationCard()` to display secondary classifications
   - Add expandable section for "Additional Evidence" showing other matching types
   - Update `#deriveSummaryFromType()` if needed for multi-type display

4. **`css/prototype-analysis.css`**
   - Add styles for secondary classification badges/pills
   - Add styles for evidence expansion panel

## Testing Requirements

### Unit Tests to Update

1. **`tests/unit/expressionDiagnostics/services/prototypeOverlap/overlapClassifier.test.js`**
   - Add tests verifying `allMatchingClassifications` array is populated
   - Add tests verifying primary classification still works correctly
   - Add tests for edge cases (single match, no secondary matches)

2. **`tests/unit/expressionDiagnostics/services/prototypeOverlap/overlapClassifier.types.test.js`**
   - Add tests for TypeScript-style type checking of new structure
   - Verify backward compatibility of existing type checks

3. **`tests/unit/expressionDiagnostics/services/prototypeOverlap/overlapClassifier.convertToExpression.test.js`**
   - Verify convert_to_expression appears in secondary matches when applicable

### New Unit Tests to Create

4. **`tests/unit/expressionDiagnostics/services/prototypeOverlap/overlapClassifier.multiLabel.test.js`**
   - Test confidence score calculation for each classification type
   - Test evidence extraction accuracy
   - Test ordering within `allMatchingClassifications` (should maintain priority order)
   - Test scenarios where pair matches 2, 3, or 4+ classifications
   - Test confidence threshold edge cases
   - Test metrics used in evidence match the criteria that triggered classification

### Integration Tests to Update

5. **`tests/integration/expressionDiagnostics/prototypeOverlap/prototypeOverlapAnalyzer.integration.test.js`**
   - Add tests verifying multi-label evidence flows through analyzer
   - Verify recommendation builder handles new structure

6. **`tests/integration/expressionDiagnostics/prototypeOverlap/multiRouteFiltering.integration.test.js`**
   - Add tests for multi-label scenarios in filtered pipelines

### New Integration Tests to Create

7. **`tests/integration/expressionDiagnostics/prototypeOverlap/multiLabelClassification.integration.test.js`**
   - End-to-end tests with real prototype pairs known to satisfy multiple classifications
   - Test with emotion prototypes that have documented multi-classification scenarios
   - Verify full pipeline from analyzer input to recommendation output

### UI Tests to Update/Create

8. **`tests/unit/domUI/prototype-analysis/prototypeAnalysisController.test.js`**
   - Test rendering with `allMatchingClassifications` present
   - Test rendering without `allMatchingClassifications` (backward compatibility)
   - Test expandable evidence panel interaction
   - Test secondary badge rendering

## Acceptance Criteria

1. **Primary classification unchanged**: `result.type` returns the same value as before for any given input
2. **Multi-label evidence populated**: `result.allMatchingClassifications` contains all matching types with confidence scores
3. **Confidence scores meaningful**: Scores between 0.0-1.0, higher = stronger match
4. **Evidence is traceable**: Each classification includes the specific metrics that caused the match
5. **Backward compatible**: All existing tests pass without modification (except new assertions)
6. **UI presents information hierarchically**: Primary classification prominent, secondary evidence discoverable but not overwhelming
7. **Performance acceptable**: No more than 10% increase in classification time per pair

## Out of Scope

- Allowing users to configure classification priority order
- Making classification thresholds user-configurable at runtime
- Machine learning-based classification confidence
- Changing the primary classification selection algorithm

## Implementation Notes

### Confidence Score Design Principles

1. **Normalized to [0, 1]**: All confidence scores should be in this range
2. **Threshold proximity**: Higher confidence when metric is well beyond threshold
3. **Multi-factor aggregation**: Classifications with multiple criteria should weight each factor
4. **Interpretable**: Confidence should reflect "how strongly does this pair exhibit the pattern"

### Example Confidence Calculations

**nested_siblings confidence:**
```javascript
// Behavioral nesting: based on conditional probability asymmetry
const asymmetry = Math.abs(pB_given_A - pA_given_B);
const maxConditional = Math.max(pB_given_A, pA_given_B);
const confidence = (asymmetry * 0.3) + (maxConditional * 0.7);
```

**needs_separation confidence:**
```javascript
// Based on how clearly it's "high overlap but too different to merge"
const overlapFactor = (gateOverlapRatio - 0.70) / 0.30;  // Normalized above threshold
const correlationFactor = (pearsonCorrelation - 0.80) / 0.20;
const separationFactor = (meanAbsDiff - maxMeanAbsDiffForMerge) / maxMeanAbsDiffForMerge;
const confidence = (overlapFactor * 0.3) + (correlationFactor * 0.3) + (separationFactor * 0.4);
```

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing consumers | High | Extensive backward compatibility testing |
| Performance degradation | Medium | Profile before/after, optimize if needed |
| UI information overload | Medium | Progressive disclosure design |
| Confidence scores misleading | Medium | Clear documentation of calculation method |

## Timeline Estimate

- Implementation: 2-3 days
- Testing: 1-2 days
- UI updates: 1 day
- Documentation: 0.5 days
