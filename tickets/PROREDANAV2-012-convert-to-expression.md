# PROREDANAV2-012: Implement Feature-Flagged CONVERT_TO_EXPRESSION Classification

## Description

Implement the optional CONVERT_TO_EXPRESSION classification triggered by feature flag. This suggests converting certain nested prototypes to expressions with delta gates.

## Files to Touch

### Modify
- `src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js`

### Create
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/overlapClassifier.convertToExpression.test.js`

## Out of Scope

- Generating actual expression conversion suggestions
- Implementing delta gate logic
- Expression creation/modification
- UI for conversion workflow
- Gate banding suggestions

## Changes Required

### 1. Add Feature Flag Check

```javascript
#checkConvertToExpression(metrics) {
  // Feature flag gate
  if (!this.#config.enableConvertToExpression) {
    return false;
  }

  // Must be nested first (either would qualify for nested_siblings or subsumed)
  if (!this.#hasNesting(metrics)) {
    return false;
  }

  // Check name-based heuristic
  const prototypeAName = metrics.prototypeA?.id || '';
  const prototypeBName = metrics.prototypeB?.id || '';

  const nameHints = this.#config.changeEmotionNameHints || [];
  const matchesNameHint = nameHints.some(hint =>
    prototypeAName.includes(hint) || prototypeBName.includes(hint)
  );

  if (matchesNameHint) {
    return true;
  }

  // Check structural heuristic
  if (this.#matchesConversionStructure(metrics)) {
    return true;
  }

  return false;
}
```

### 2. Implement Structural Heuristic

```javascript
#matchesConversionStructure(metrics) {
  const gateImplication = metrics.gateImplication;
  if (!gateImplication) return false;

  // Look for low-threat steady state pattern
  const evidence = gateImplication.evidence || [];

  // Find threat axis evidence
  const threatEvidence = evidence.find(e => e.axis === 'threat');
  if (!threatEvidence) return false;

  // Check if narrower prototype enforces low threat
  const narrowerIsA = gateImplication.A_implies_B;
  const narrowerInterval = narrowerIsA ? threatEvidence.A : threatEvidence.B;

  // Low-threat steady state: threat upper bound <= 0.20
  if (narrowerInterval.upper > 0.20) return false;

  // Additional check: nested under another low-threat positive state
  // (This is simplified - real implementation may need more context)
  return true;
}

#hasNesting(metrics) {
  const { passRates } = metrics.behavior;
  const gateImplication = metrics.gateImplication;
  const threshold = this.#config.nestedConditionalThreshold;

  const hasDeterministicNesting = gateImplication && (
    gateImplication.A_implies_B !== gateImplication.B_implies_A
  );

  const hasBehavioralNesting = (
    (passRates.pB_given_A >= threshold && passRates.pA_given_B < threshold) ||
    (passRates.pA_given_B >= threshold && passRates.pB_given_A < threshold)
  );

  return hasDeterministicNesting || hasBehavioralNesting;
}
```

### 3. Add Conversion Metadata to Result

```javascript
if (type === 'convert_to_expression') {
  result.conversionHint = {
    matchedBy: matchesNameHint ? 'name_hint' : 'structural_heuristic',
    suggestedDeltaAxis: 'threat', // or detected from structure
    candidatePrototype: narrowerPrototypeId
  };
}
```

## Acceptance Criteria

### Tests That Must Pass

1. **Feature flag disabled**:
   - enableConvertToExpression=false → never returns convert_to_expression

2. **Feature flag enabled with name hint**:
   - enableConvertToExpression=true
   - Prototype name contains 'relief'
   - Has nesting
   - → convert_to_expression

3. **Feature flag enabled with structural match**:
   - enableConvertToExpression=true
   - Gates enforce threat <= 0.20
   - Has nesting
   - → convert_to_expression

4. **No nesting means no conversion**:
   - Even with name hint, if no nesting → not convert_to_expression

5. **contentment↔relief pattern**:
   - With flag enabled and 'relief' in hints
   - → convert_to_expression

6. **Priority position**:
   - convert_to_expression checked AFTER subsumed but BEFORE nested_siblings
   - So a pair that matches both gets convert_to_expression

7. **Custom name hints respected**:
   - Configure changeEmotionNameHints=['custom_name']
   - Prototype 'custom_name' matches

8. **Conversion metadata present**:
   - Result includes conversionHint object
   - matchedBy indicates how it matched
   - candidatePrototype identifies which one to convert

### Invariants That Must Remain True

- Feature flag completely gates the classification
- Never returns convert_to_expression for non-nested pairs
- Priority order maintained
- Existing classifications unaffected when flag disabled

## Estimated Size

~80 lines of code changes + ~150 lines of tests

## Dependencies

- PROREDANAV2-011 (nested_siblings logic to share)

## Verification Commands

```bash
# Run convert to expression tests
npm run test:unit -- --testPathPattern=overlapClassifier.convertToExpression

# Run all classifier tests
npm run test:unit -- --testPathPattern=overlapClassifier

# Lint
npx eslint src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js
```
