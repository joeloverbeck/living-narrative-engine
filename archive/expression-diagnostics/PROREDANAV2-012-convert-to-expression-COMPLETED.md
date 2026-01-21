# PROREDANAV2-012: Implement CONVERT_TO_EXPRESSION with GateImplicationEvaluator Integration

**Status**: COMPLETED
**Completed**: 2026-01-20

---

## Summary

Integrated `GateImplicationEvaluator` into the prototype overlap analysis pipeline and implemented the `convert_to_expression` classification type.

---

## Analysis Summary

### Determination: GateImplicationEvaluator Integration IS Beneficial

After analyzing the codebase:

1. **GateImplicationEvaluator provides deterministic nesting detection** - Analyzes gate intervals mathematically to determine if one prototype's gates are a subset of another's
2. **The v2 spec expects deterministic gate analysis** - Section 7.2.1 defines gate implication as primary nesting check
3. **The structural heuristic for CONVERT_TO_EXPRESSION requires gate evidence** - Looking for low-threat patterns (threat <= 0.20)
4. **Integration is straightforward** - `BehavioralOverlapEvaluator` already has access to `prototypeA.gates` and `prototypeB.gates`

### Integration Approach

Rather than implementing a watered-down version without gateImplication, we:
1. Integrated `GateConstraintExtractor` and `GateImplicationEvaluator` into `BehavioralOverlapEvaluator`
2. Passed `gateImplication` data to the classifier
3. Implemented the full `#checkConvertToExpression()` with structural heuristic support

---

## Implementation Details

### Files Modified

| File | Changes |
|------|---------|
| `src/dependencyInjection/registrations/prototypeOverlapRegistrations.js` | Added DI registrations for `GateConstraintExtractor` and `GateImplicationEvaluator`; updated `BehavioralOverlapEvaluator` factory with new dependencies |
| `src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js` | Added `gateImplication` to classifier call |
| `src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js` | Implemented `#checkConvertToExpression()`, `#hasNesting()`, `#matchesConversionStructure()`; updated `#extractMetrics()` and logging |

### Files Created

| File | Purpose |
|------|---------|
| `tests/unit/expressionDiagnostics/services/prototypeOverlap/overlapClassifier.convertToExpression.test.js` | 17 test cases covering feature flag gating, nesting detection, structural heuristics, priority ordering, and edge cases |

### Key Implementation

```javascript
#checkConvertToExpression(metrics) {
  // Feature flag gate
  if (!this.#config.enableConvertToExpression) {
    return { matches: false };
  }

  // Must have nesting (deterministic or behavioral)
  const nestingResult = this.#hasNesting(metrics);
  if (!nestingResult.hasNesting) {
    return { matches: false };
  }

  // Check structural heuristic (low-threat steady state pattern)
  const structuralMatch = this.#matchesConversionStructure(metrics);
  if (structuralMatch.matches) {
    return structuralMatch;
  }

  return { matches: false };
}
```

### Classification Logic

The `convert_to_expression` classification requires:
1. **Feature flag enabled**: `config.enableConvertToExpression`
2. **Nesting detected**: Either deterministic (gate implication asymmetry) or behavioral (conditional probability asymmetry ≥ 0.97)
3. **Structural heuristic match**: Low-threat steady state pattern (threat upper bound ≤ 0.20)

---

## Test Coverage

17 test cases covering:
- Feature flag gating (disabled/enabled)
- Nesting detection (symmetric, no data)
- Deterministic A→B and B→A with low-threat
- Missing/high threat threshold cases
- Classification priority over nested_siblings
- Behavioral nesting alone insufficient
- Edge cases (exactly 0.20, NaN passRates, missing passRates)

---

## Verification Results

- ✅ `overlapClassifier.convertToExpression.test.js`: 17/17 tests pass
- ✅ `overlapClassifier.test.js`: All existing tests pass (no regressions)
- ✅ `overlapClassifier.types.test.js`: 16/16 tests pass
- ✅ ESLint: No errors on modified files

---

## Outcome Section

**Originally planned in ticket:**
- Name-based heuristic checking prototype IDs
- Structural heuristic using gateImplication

**Actually implemented:**
- Full GateImplicationEvaluator integration into pipeline
- Structural heuristic for low-threat steady state detection (threat <= 0.20)
- **NOT implemented**: Name hints (prototype IDs not passed to classifier - would require additional pipeline changes)

**Scope adjustment rationale:**
- User directed integration of GateImplicationEvaluator
- Name hints deferred since prototype IDs not available in classifier
- Structural heuristic is the primary intended filtering mechanism per v2 spec
- Name hints were secondary/optional in original ticket
