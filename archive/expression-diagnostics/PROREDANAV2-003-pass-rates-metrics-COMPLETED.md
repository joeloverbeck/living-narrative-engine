# PROREDANAV2-003: Add Pass Rate and Conditional Probability Metrics (A1)

## Description

Add computation of passARate, passBRate, pA_given_B, and pB_given_A to BehavioralOverlapEvaluator. These metrics enable detection of behavioral nestedness between prototypes.

## Files to Touch

### Modify
- `src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js`

### Create
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/behavioralOverlapEvaluator.passRates.test.js`

## Out of Scope

- coPassCount guardrails (PROREDANAV2-004)
- RMSE and pctWithinEps metrics (PROREDANAV2-005)
- High threshold metrics (PROREDANAV2-006)
- Any classifier changes
- Gate structure analysis
- OverlapRecommendationBuilder changes

## Changes Required

### 1. Track Pass Counts

In the sampling loop, track:
```javascript
// Derived from existing counters (no new tracking needed)
// passACount = onBothCount + pOnlyCount (already tracked)
// passBCount = onBothCount + qOnlyCount (already tracked)
```

### 2. Add passRates Object to Output

Add new `passRates` object to the return value of `evaluate()`:

```javascript
passRates: {
  passARate: passACount / N,
  passBRate: passBCount / N,
  pA_given_B: passBCount > 0 ? onBothCount / passBCount : NaN,
  pB_given_A: passACount > 0 ? onBothCount / passACount : NaN,
}
```

### 3. Update JSDoc

Document the new output fields with clear explanations:
- `passARate` - P(gates_A pass) unconditionally
- `passBRate` - P(gates_B pass) unconditionally
- `pA_given_B` - P(gates_A pass | gates_B pass) - if ~1, B implies A behaviorally
- `pB_given_A` - P(gates_B pass | gates_A pass) - if ~1, A implies B behaviorally

## Acceptance Criteria

### Tests That Must Pass

1. **passRates object presence**: evaluate() returns object with passRates field
2. **Count arithmetic invariant**: `passACount == onBothCount + pOnlyCount`
3. **Count arithmetic invariant**: `passBCount == onBothCount + qOnlyCount`
4. **Rate bounds**: passARate and passBRate in [0, 1]
5. **Conditional probability bounds**: pA_given_B and pB_given_A in [0, 1] or NaN
6. **NaN when denominator zero**: When passBCount=0, pA_given_B=NaN
7. **NaN when denominator zero**: When passACount=0, pB_given_A=NaN
8. **Deterministic test**: With 10 injected contexts (4 both, 3 A-only, 2 B-only, 1 neither):
   - passACount = 7, passBCount = 6
   - passARate = 0.7, passBRate = 0.6
   - pA_given_B = 4/6 ≈ 0.667
   - pB_given_A = 4/7 ≈ 0.571

### Invariants That Must Remain True

- Existing gateOverlap output unchanged
- Existing intensity output unchanged
- Existing divergenceExamples output unchanged
- Progress callback behavior unchanged
- Event loop yielding unchanged
- Sample count validation unchanged

## Estimated Size

~80 lines of code changes + ~150 lines of tests

## Dependencies

- PROREDANAV2-001 (config must exist, though no new config used in this ticket)

## Verification Commands

```bash
# Run new pass rates tests
npm run test:unit -- --testPathPattern=behavioralOverlapEvaluator.passRates

# Run all BehavioralOverlapEvaluator tests
npm run test:unit -- --testPathPattern=behavioralOverlapEvaluator

# Lint
npx eslint src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js

# Typecheck
npm run typecheck
```
