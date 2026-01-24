# PROANAOVEV3-010: OverlapClassifier V3 Rules

## Summary

Replace `OverlapClassifier` correlation-gated classification rules with agreement-based rules, completely removing the v2 classification logic.

## Motivation

Current correlation-gated merge/subsume rules never fire (0 merge, 0 subsumed in 193 candidates). Agreement-based rules using MAE, RMSE, and conditional probability CIs provide more appropriate classification signals. The v2 approach is being entirely replaced.

## Files to Modify

### Service
- `src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js`

### Unit Tests
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/overlapClassifier.test.js` (update existing)
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/overlapClassifier.v3.test.js` (new)

## Implementation Details

### V3 Classification Rules (Priority Order)

**1. MERGE_RECOMMENDED**
```javascript
const isMerge =
  metrics.maeGlobal <= config.maxMaeGlobalForMerge &&
  metrics.activationJaccard >= config.minActivationJaccardForMerge &&
  !isDead(vectorA) && !isDead(vectorB) &&
  Math.abs(metrics.pA_given_B - metrics.pB_given_A) < config.symmetryTolerance;
```

**2. SUBSUMED_RECOMMENDED** (A subsumed by B)
```javascript
const aIsSubsumed =
  metrics.pB_given_A_lower >= config.minConditionalProbCILowerForNesting &&
  metrics.pA_given_B < 1 - config.asymmetryRequired &&
  profileA.gateVolume < profileB.gateVolume &&
  exclusiveRateA <= config.maxExclusiveForSubsumption;
```

**3. CONVERT_TO_EXPRESSION**
```javascript
const isExpressionConversion =
  hasNesting(metrics) &&
  narrowerProfile.isExpressionCandidate &&
  metrics.maeCoPass <= config.maxMaeDeltaForExpression;
```

**4. NESTED_SIBLINGS**
```javascript
const isNested =
  (metrics.pB_given_A_lower >= config.minConditionalProbCILowerForNesting ||
   metrics.pA_given_B_lower >= config.minConditionalProbCILowerForNesting) &&
  metrics.pA_given_B !== metrics.pB_given_A;
```

**5. NEEDS_SEPARATION**
```javascript
const needsSeparation =
  metrics.activationJaccard >= 0.7 &&
  !hasNesting(metrics) &&
  metrics.maeCoPass > config.maxMaeDeltaForExpression;
```

**6. KEEP_DISTINCT** (fallback)

### Interface Changes

```javascript
/**
 * Classify overlap relationship using agreement-based metrics.
 * @param {object} evaluationResult - Contains agreementMetrics and profiles
 * @param {AgreementMetrics} evaluationResult.agreementMetrics - Agreement metrics
 * @param {PrototypeProfile} evaluationResult.profileA - Profile for prototype A
 * @param {PrototypeProfile} evaluationResult.profileB - Profile for prototype B
 * @returns {ClassificationResult}
 */
classify(evaluationResult)
```

### V2 Code Removal

The following v2 code paths will be removed:
- Correlation-gated merge/subsume rules
- `#classifyWithCorrelation()` method
- V2 fallback logic

## Out of Scope

- Computing agreement metrics (ticket 004)
- Computing profiles (ticket 005)
- Integration with `PrototypeOverlapAnalyzer` (ticket 013)

## Acceptance Criteria

- [ ] MERGE_RECOMMENDED fires with agreement-based thresholds
- [ ] SUBSUMED_RECOMMENDED uses CI bounds
- [ ] CONVERT_TO_EXPRESSION uses profile signals
- [ ] NESTED_SIBLINGS uses asymmetric CI
- [ ] NEEDS_SEPARATION identifies high-overlap different-output pairs
- [ ] Classification priority order maintained
- [ ] V2 correlation-gated code removed
- [ ] Unit tests cover:
  - MERGE_RECOMMENDED with agreement metrics
  - SUBSUMED_RECOMMENDED with CI
  - CONVERT_TO_EXPRESSION with profile
  - NESTED_SIBLINGS with asymmetric CI
  - NEEDS_SEPARATION
  - Classification priority order
- [ ] 80%+ branch coverage on new code
- [ ] `npm run typecheck` passes
- [ ] `npx eslint src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js` passes

## Dependencies

- PROANAOVEV3-004 (AgreementMetricsCalculator) - provides metrics
- PROANAOVEV3-005 (PrototypeProfileCalculator) - provides profiles
- PROANAOVEV3-008 (V3 Config) - provides thresholds

## Estimated Complexity

Medium - replacing classification logic and removing v2 code paths.
