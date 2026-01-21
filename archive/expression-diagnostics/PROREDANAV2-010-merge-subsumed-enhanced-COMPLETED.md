# PROREDANAV2-010: Implement MERGE_RECOMMENDED and SUBSUMED_RECOMMENDED

## Description

Implement enhanced merge and subsumed classification criteria using new metrics from Phase 2 and gate implication from Phase 3. This updates the classification logic to use stricter, more accurate criteria.

## Files to Touch

### Modify
- `src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js`

### Create
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/overlapClassifier.mergeSubsumed.test.js`

## Out of Scope

- NESTED_SIBLINGS classification (PROREDANAV2-011)
- NEEDS_SEPARATION and KEEP_DISTINCT (PROREDANAV2-011)
- CONVERT_TO_EXPRESSION (PROREDANAV2-012)
- GateBandingSuggestionBuilder
- Evidence payload changes in OverlapRecommendationBuilder

## Changes Required

### 1. Update MERGE_RECOMMENDED Check

Must pass ALL criteria:
```javascript
#checkMergeRecommended(metrics) {
  const { gateOverlap, passRates, intensity, highCoactivation } = metrics.behavior;
  const config = this.#config;

  // Existing checks (with updated thresholds)
  if (gateOverlap.onEitherRate < config.minOnEitherRateForMerge) return false;
  if (gateOverlap.gateOverlapRatio < config.strongGateOverlapRatio) return false; // NEW: was minGateOverlapRatio

  // NEW: Co-pass count guardrail
  if (passRates.coPassCount < config.minCoPassSamples) return false;

  // Updated correlation threshold
  if (Number.isNaN(intensity.pearsonCorrelation)) return false;
  if (intensity.pearsonCorrelation < config.strongCorrelationForMerge) return false;

  // Existing intensity check
  if (intensity.meanAbsDiff > config.maxMeanAbsDiffForMerge) return false;

  // NEW: pctWithinEps check
  if (Number.isNaN(intensity.pctWithinEps)) return false;
  if (intensity.pctWithinEps < config.minPctWithinEpsForMerge) return false;

  // Existing dominance check (neither dominates)
  if (intensity.dominanceP >= config.minDominanceForSubsumption) return false;
  if (intensity.dominanceQ >= config.minDominanceForSubsumption) return false;

  // OPTIONAL: High Jaccard signal at t=0.6
  const threshold06 = highCoactivation?.thresholds?.find(t => t.t === 0.6);
  if (threshold06 && config.minHighJaccardForMergeAtT?.['0.6']) {
    if (threshold06.highJaccard < config.minHighJaccardForMergeAtT['0.6']) {
      // This is optional - log warning but don't fail
      this.#logger.debug('Merge candidate has low highJaccard at t=0.6');
    }
  }

  return true;
}
```

### 2. Update SUBSUMED_RECOMMENDED Check

Gate implication OR behavioral conditional:
```javascript
#checkSubsumedRecommended(metrics) {
  const { gateOverlap, passRates, intensity } = metrics.behavior;
  const gateImplication = metrics.gateImplication; // From Phase 3
  const config = this.#config;

  // Co-pass guardrail
  if (passRates.coPassCount < config.minCoPassSamples) return false;

  // Correlation requirement
  if (Number.isNaN(intensity.pearsonCorrelation)) return false;
  if (intensity.pearsonCorrelation < config.minCorrelationForSubsumption) return false;

  // Check for nesting (either deterministic or behavioral)
  const hasGateNesting = gateImplication && (
    (gateImplication.A_implies_B && !gateImplication.B_implies_A) ||
    (!gateImplication.A_implies_B && gateImplication.B_implies_A)
  );

  const hasBehavioralNesting = (
    (passRates.pB_given_A >= config.nestedConditionalThreshold &&
     passRates.pA_given_B < 0.995) ||
    (passRates.pA_given_B >= config.nestedConditionalThreshold &&
     passRates.pB_given_A < 0.995)
  );

  if (!hasGateNesting && !hasBehavioralNesting) return false;

  // Broader prototype must have some exclusive rate
  const broaderHasExclusive = gateImplication?.A_implies_B
    ? gateOverlap.qOnlyRate >= config.minExclusiveForBroader
    : gateOverlap.pOnlyRate >= config.minExclusiveForBroader;

  if (!broaderHasExclusive) return false;

  return true;
}
```

### 3. Track Which Prototype is Subsumed

```javascript
// Determine which is subsumed (the narrower/stricter one)
if (this.#checkSubsumedRecommended(metrics)) {
  const subsumedPrototype = gateImplication?.A_implies_B ? 'A' : 'B';
  return {
    type: 'subsumed_recommended',
    subsumedPrototype,
    // ... other fields
  };
}
```

## Acceptance Criteria

### Tests That Must Pass

1. **MERGE all criteria checked**:
   - onEitherRate >= threshold
   - gateOverlapRatio >= strongGateOverlapRatio
   - coPassCount >= minCoPassSamples
   - pearsonCorrelation >= strongCorrelationForMerge
   - meanAbsDiff <= maxMeanAbsDiffForMerge
   - pctWithinEps >= minPctWithinEpsForMerge
   - Neither dominance exceeds threshold

2. **MERGE fails on any criterion**:
   - Test each criterion independently causing failure

3. **MERGE respects NaN guardrail**:
   - When pearsonCorrelation=NaN → not merge
   - When pctWithinEps=NaN → not merge

4. **SUBSUMED with gate implication**:
   - A_implies_B=true, B_implies_A=false → subsumed with A being narrower

5. **SUBSUMED with behavioral conditional**:
   - pB_given_A=0.98, pA_given_B=0.5 → subsumed

6. **SUBSUMED requires exclusive rate**:
   - Even with nesting, if broader has no exclusive cases → not subsumed

7. **numbness↔apathy style pair**:
   - High overlap + high correlation + low meanAbsDiff → merge_recommended

8. **Priority respected**:
   - Merge checked before subsumed

### Invariants That Must Remain True

- If merge_recommended, subsumed_recommended never returned
- coPassCount guardrail prevents false positives
- Existing tests for clear merge/subsumed cases still pass
- subsumedPrototype correctly identifies which prototype is narrower

## Estimated Size

~150 lines of code changes + ~250 lines of tests

## Dependencies

- PROREDANAV2-003 (passRates with pA_given_B, pB_given_A)
- PROREDANAV2-004 (coPassCount guardrail)
- PROREDANAV2-005 (pctWithinEps metric)
- PROREDANAV2-006 (highCoactivation metrics)
- PROREDANAV2-008 (gateImplication results)
- PROREDANAV2-009 (classification infrastructure)

## Verification Commands

```bash
# Run new merge/subsumed tests
npm run test:unit -- --testPathPattern=overlapClassifier.mergeSubsumed

# Run all classifier tests
npm run test:unit -- --testPathPattern=overlapClassifier

# Lint
npx eslint src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js
```
