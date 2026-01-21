# PROREDANAV2-011: Implement NESTED_SIBLINGS, NEEDS_SEPARATION, KEEP_DISTINCT

## Description

Implement the remaining classification types for non-merge, non-subsumed pairs. These classifications help distinguish between prototypes that are related but should remain separate vs. those that are truly distinct.

## Files to Touch

### Modify
- `src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js`

### Create
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/overlapClassifier.remaining.test.js`

## Out of Scope

- CONVERT_TO_EXPRESSION (PROREDANAV2-012)
- Generating gate banding suggestions (PROREDANAV2-015)
- Evidence payload changes
- UI changes

## Changes Required

### 1. Implement NESTED_SIBLINGS Check

Triggers when nesting exists but merge not satisfied:
```javascript
#checkNestedSiblings(metrics) {
  // If we got here, merge and subsumed checks already failed

  const { passRates } = metrics.behavior;
  const gateImplication = metrics.gateImplication;

  // Check for deterministic nesting (one-way implication)
  const hasDeterministicNesting = gateImplication && (
    (gateImplication.A_implies_B && !gateImplication.B_implies_A) ||
    (!gateImplication.A_implies_B && gateImplication.B_implies_A)
  );

  // Check for behavioral nesting (conditional probability asymmetry)
  const threshold = this.#config.nestedConditionalThreshold;
  const hasBehavioralNesting = (
    (passRates.pB_given_A >= threshold && passRates.pA_given_B < threshold) ||
    (passRates.pA_given_B >= threshold && passRates.pB_given_A < threshold)
  );

  return hasDeterministicNesting || hasBehavioralNesting;
}
```

### 2. Implement NEEDS_SEPARATION Check

Triggers when high overlap but not nested:
```javascript
#checkNeedsSeparation(metrics) {
  const { gateOverlap, intensity } = metrics.behavior;
  const gateImplication = metrics.gateImplication;

  // Must have significant gate overlap
  if (gateOverlap.gateOverlapRatio < 0.70) return false;

  // Must NOT be nested (would have been caught by nested_siblings)
  const isNested = gateImplication && (
    gateImplication.A_implies_B || gateImplication.B_implies_A
  );
  if (isNested) return false;

  // High correlation but meanAbsDiff not tiny enough for merge
  if (Number.isNaN(intensity.pearsonCorrelation)) return false;
  if (intensity.pearsonCorrelation < 0.8) return false; // Some correlation
  if (intensity.meanAbsDiff <= this.#config.maxMeanAbsDiffForMerge) return false; // Would be merge

  return true;
}
```

### 3. Implement KEEP_DISTINCT Check

Default fallback with explicit criteria:
```javascript
#isKeepDistinct(metrics) {
  const { gateOverlap, passRates } = metrics.behavior;
  const config = this.#config;

  // Any of these makes it clearly distinct
  if (gateOverlap.gateOverlapRatio < 0.25) return true;
  if (passRates.coPassCount < config.minCoPassSamples) return true;

  // Default: if we got here and nothing else matched, keep distinct
  return true;
}
```

### 4. Add Metadata to Classification Results

Include information about why each classification was chosen:
```javascript
#buildClassificationResult(type, metrics) {
  const result = {
    type,
    v2Type: type,
    legacyType: this.#mapToLegacyType(type),
    thresholds: { /* relevant thresholds used */ },
    metrics: { /* key metrics that drove decision */ }
  };

  if (type === 'nested_siblings') {
    result.nestingDirection = this.#determineNestingDirection(metrics);
  }

  return result;
}
```

## Acceptance Criteria

### Tests That Must Pass

1. **NESTED_SIBLINGS with deterministic nesting**:
   - A_implies_B=true, B_implies_A=false, but merge criteria not met → nested_siblings

2. **NESTED_SIBLINGS with behavioral nesting**:
   - pB_given_A=0.98, pA_given_B=0.60, no gate implication → nested_siblings

3. **interest↔curiosity pattern**:
   - Curiosity implies interest (narrower gates) → nested_siblings

4. **embarrassment↔humiliation pattern**:
   - Humiliation implies embarrassment (more extreme) → nested_siblings

5. **NEEDS_SEPARATION criteria**:
   - gateOverlapRatio >= 0.70
   - NOT nested
   - Some correlation but not merge-worthy
   - → needs_separation

6. **KEEP_DISTINCT with low overlap**:
   - gateOverlapRatio < 0.25 → keep_distinct

7. **KEEP_DISTINCT with low co-pass**:
   - coPassCount < minCoPassSamples → keep_distinct

8. **freeze↔submission pattern**:
   - Tiny gate overlap → keep_distinct

9. **Priority order**:
   - nested_siblings checked before needs_separation
   - needs_separation checked before keep_distinct

10. **Nesting direction identified**:
    - For nested_siblings, result includes which prototype is narrower

### Invariants That Must Remain True

- Priority order: merge → subsumed → (convert_to_expression) → nested_siblings → needs_separation → keep_distinct
- Every pair gets exactly one classification
- Classification always returns valid result
- No infinite loops in classification logic

## Estimated Size

~120 lines of code changes + ~200 lines of tests

## Dependencies

- PROREDANAV2-010 (merge/subsumed must be implemented first)

## Verification Commands

```bash
# Run remaining classification tests
npm run test:unit -- --testPathPattern=overlapClassifier.remaining

# Run all classifier tests
npm run test:unit -- --testPathPattern=overlapClassifier

# Lint
npx eslint src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js
```
