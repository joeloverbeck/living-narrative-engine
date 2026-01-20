# PROREDANAV2-014: Expand Evidence Payload in OverlapRecommendationBuilder (D1)

## Description

Update the recommendation builder to include all new v2 metrics in the evidence payload. This provides comprehensive diagnostic information for each recommendation.

## Files to Touch

### Modify
- `src/expressionDiagnostics/services/prototypeOverlap/OverlapRecommendationBuilder.js`

### Create
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/overlapRecommendationBuilder.v2Evidence.test.js`

## Out of Scope

- GateBandingSuggestionBuilder suggestions (PROREDANAV2-015)
- Severity formula changes
- Confidence formula changes
- UI rendering
- Actually using evidence in classification (that's in classifier)

## Changes Required

### 1. Update build() Method Signature

Accept additional metrics:
```javascript
build(prototypeA, prototypeB, classification, candidateMetrics,
      behaviorMetrics, divergenceExamples, gateImplication, prototypeFamily) {
  // ...
}
```

### 2. Expand Evidence Object

```javascript
#buildEvidence(prototypeA, prototypeB, behaviorMetrics, divergenceExamples, gateImplication) {
  return {
    // Existing fields
    sharedDrivers: this.#extractSharedDrivers(prototypeA.weights, prototypeB.weights),
    keyDifferentiators: this.#identifyDifferentiators(prototypeA.weights, prototypeB.weights),
    divergenceExamples: divergenceExamples,

    // V2 fields - from spec D1
    pearsonCorrelation: behaviorMetrics.intensity?.pearsonCorrelation ?? NaN,

    gateOverlap: {
      onEitherRate: behaviorMetrics.gateOverlap?.onEitherRate,
      onBothRate: behaviorMetrics.gateOverlap?.onBothRate,
      pOnlyRate: behaviorMetrics.gateOverlap?.pOnlyRate,
      qOnlyRate: behaviorMetrics.gateOverlap?.qOnlyRate,
      gateOverlapRatio: behaviorMetrics.gateOverlap?.gateOverlapRatio
    },

    passRates: {
      passARate: behaviorMetrics.passRates?.passARate,
      passBRate: behaviorMetrics.passRates?.passBRate,
      pA_given_B: behaviorMetrics.passRates?.pA_given_B ?? NaN,
      pB_given_A: behaviorMetrics.passRates?.pB_given_A ?? NaN,
      coPassCount: behaviorMetrics.passRates?.coPassCount
    },

    intensitySimilarity: {
      meanAbsDiff: behaviorMetrics.intensity?.meanAbsDiff ?? NaN,
      rmse: behaviorMetrics.intensity?.rmse ?? NaN,
      pctWithinEps: behaviorMetrics.intensity?.pctWithinEps ?? NaN
    },

    highCoactivation: {
      thresholds: behaviorMetrics.highCoactivation?.thresholds || []
    },

    gateImplication: gateImplication ? {
      A_implies_B: gateImplication.A_implies_B,
      B_implies_A: gateImplication.B_implies_A,
      evidence: gateImplication.evidence || [],
      unparsedGates: gateImplication.unparsedGates || []
    } : null
  };
}
```

### 3. Update Recommendation Type Mapping

Map v2 classification types to recommendation types:
```javascript
#mapClassificationToType(classification) {
  const typeMap = {
    'merge': 'prototype_merge_suggestion',
    'merge_recommended': 'prototype_merge_suggestion',
    'subsumed': 'prototype_subsumption_suggestion',
    'subsumed_recommended': 'prototype_subsumption_suggestion',
    'nested_siblings': 'prototype_nested_siblings',
    'needs_separation': 'prototype_needs_separation',
    'keep_distinct': 'prototype_distinct_info',
    'convert_to_expression': 'prototype_expression_conversion',
    'not_redundant': 'prototype_overlap_info'
  };
  return typeMap[classification.type] || typeMap[classification.v2Type] || 'prototype_overlap_info';
}
```

### 4. Update Actions Based on Classification

```javascript
#buildActions(classification, prototypeA, prototypeB) {
  const actions = [];
  const type = classification.v2Type || classification.type;

  switch (type) {
    case 'merge_recommended':
      actions.push(`Consider merging ${prototypeA.id} and ${prototypeB.id}`);
      actions.push('Review shared drivers and intensity alignment');
      break;

    case 'nested_siblings':
      actions.push(`Consider hierarchy: ${classification.nestingDirection?.narrower} nested under ${classification.nestingDirection?.broader}`);
      actions.push('Review gate banding suggestions');
      break;

    case 'convert_to_expression':
      actions.push(`Consider converting ${classification.conversionHint?.candidatePrototype} to expression`);
      actions.push('Add delta gate for state transition detection');
      break;

    // ... other cases
  }

  return actions;
}
```

## Acceptance Criteria

### Tests That Must Pass

1. **Evidence structure complete**:
   - All D1 spec fields present in evidence object

2. **gateOverlap section**:
   - Contains onEitherRate, onBothRate, pOnlyRate, qOnlyRate, gateOverlapRatio

3. **passRates section**:
   - Contains passARate, passBRate, pA_given_B, pB_given_A, coPassCount

4. **intensitySimilarity section**:
   - Contains meanAbsDiff, rmse, pctWithinEps

5. **highCoactivation section**:
   - Contains thresholds array with t, pHighA, pHighB, pHighBoth, highJaccard, highAgreement

6. **gateImplication section**:
   - When provided: contains A_implies_B, B_implies_A, evidence, unparsedGates
   - When not provided: null

7. **NaN handling**:
   - Missing metrics gracefully default to NaN where appropriate

8. **v2 classification types mapped**:
   - merge_recommended → prototype_merge_suggestion
   - nested_siblings → prototype_nested_siblings
   - convert_to_expression → prototype_expression_conversion

9. **Actions appropriate for classification**:
   - Each v2 type has appropriate action suggestions

### Invariants That Must Remain True

- Existing evidence fields (sharedDrivers, keyDifferentiators, divergenceExamples) unchanged
- Severity and confidence computation unchanged
- Backward compatible with v1 classification types
- Evidence never undefined (at minimum empty objects)

## Estimated Size

~150 lines of code changes + ~200 lines of tests

## Dependencies

- PROREDANAV2-003 through PROREDANAV2-006 (behavioral metrics to include)
- PROREDANAV2-012 (classification types to map)

## Verification Commands

```bash
# Run evidence tests
npm run test:unit -- --testPathPattern=overlapRecommendationBuilder.v2Evidence

# Run all recommendation builder tests
npm run test:unit -- --testPathPattern=overlapRecommendationBuilder

# Lint
npx eslint src/expressionDiagnostics/services/prototypeOverlap/OverlapRecommendationBuilder.js
```
