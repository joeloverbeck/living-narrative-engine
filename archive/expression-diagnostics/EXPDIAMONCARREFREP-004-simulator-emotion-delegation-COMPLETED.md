# EXPDIAMONCARREFREP-004: MonteCarloSimulator Delegates to EmotionCalculatorAdapter

## Summary
Replace `MonteCarloSimulator`'s duplicated emotion/sexual calculation methods with delegation to `EmotionCalculatorAdapter`. This removes ~150 lines of duplicated logic and ensures simulation uses the same calculation path as runtime.

## Reassessed Assumptions (Corrected)
- `MonteCarloSimulator` currently only depends on `dataRegistry` + `logger` (no `jsonLogicEvaluationService` in constructor).
- `EmotionCalculatorAdapter` already exists at `src/expressionDiagnostics/adapters/EmotionCalculatorAdapter.js` and is registered in DI, but `MonteCarloSimulator` does not yet receive it.
- Adapter signatures are:
  - `calculateEmotions(mood, sexualState = null, affectTraits = null)`
  - `calculateSexualArousal(sexualState)`
  - `calculateSexualStates(mood, sexualState, sexualArousal = null)`
- `MonteCarloSimulator` still needs `dataRegistry` for unseeded var validation; only the duplicated emotion/sexual math should be removed.

## Files to Modify

| File | Action | Changes |
|------|--------|---------|
| `src/expressionDiagnostics/services/MonteCarloSimulator.js` | Modify | Inject adapter, remove `#calculateEmotions`, `#calculateSexualArousal`, `#calculateSexualStates` |
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | Modify | Wire adapter as dependency of MonteCarloSimulator |
| `tests/unit/expressionDiagnostics/services/monteCarloSimulator*.test.js` | Modify | Provide adapter dependency, add constructor validation test |
| `tests/integration/expression-diagnostics/*.test.js` | Modify | Provide adapter dependency where simulator is constructed |

## Out of Scope

- **DO NOT** modify `#buildContext` method structure - only change which methods it calls
- **DO NOT** modify `#parseGate` or `#checkGates` - Addressed in EXPDIAMONCARREFREP-005
- **DO NOT** modify `#generateRandomState` - Addressed in EXPDIAMONCARREFREP-006
- **DO NOT** modify EmotionCalculatorAdapter itself
- **DO NOT** modify any UI/controller code

## Acceptance Criteria

### Tests That Must Pass
1. All existing tests in `tests/unit/expressionDiagnostics/services/monteCarloSimulator.test.js`
2. All existing tests in `tests/unit/expressionDiagnostics/services/monteCarloSimulator.gateEnforcement.test.js`
3. All existing tests in `tests/unit/expressionDiagnostics/services/monteCarloSimulator.temporalState.test.js`
4. All integration tests in `tests/integration/expression-diagnostics/`
5. New test: Verify simulator constructor accepts and validates `emotionCalculatorAdapter`

### Invariants That Must Remain True
1. Simulation trigger rates remain statistically equivalent (within variance)
2. Context structure unchanged: `{emotions, sexualStates, moodAxes, previousEmotions, sexualArousal, ...}`
3. Return value shapes from `simulate()` and `run()` unchanged
4. Constructor continues to validate all dependencies using `validateDependency()`
5. `dataRegistry` remains available for unseeded variable validation

## Implementation Notes

### Methods to Remove from MonteCarloSimulator
```javascript
// REMOVE these methods (lines 732-852 approximately):
#calculateEmotions(mood, affectTraits = null) { ... }
#calculateSexualArousal(sexual) { ... }
#calculateSexualStates(sexual, sexualArousal) { ... }
```

### Updated Constructor
```javascript
constructor({
  logger,
  dataRegistry,
  emotionCalculatorAdapter,  // NEW DEPENDENCY
  // ... other existing dependencies
}) {
  validateDependency(emotionCalculatorAdapter, 'IEmotionCalculatorAdapter', logger, {
    requiredMethods: ['calculateEmotions', 'calculateSexualArousal', 'calculateSexualStates']
  });
  this.#emotionCalculatorAdapter = emotionCalculatorAdapter;
  // ... rest of constructor
}
```

### Updated #buildContext
```javascript
#buildContext(currentState, previousState, affectTraits = null) {
  // BEFORE: used internal duplicated methods
  // const emotions = this.#calculateEmotions(currentState.mood, affectTraits);
  // const sexualArousal = this.#calculateSexualArousal(currentState.sexual);
  // const sexualStates = this.#calculateSexualStates(currentState.sexual, sexualArousal);

  // AFTER: delegates to adapter
  const emotions = this.#emotionCalculatorAdapter.calculateEmotions(
    currentState.mood,
    currentState.sexual,
    affectTraits
  );
  const sexualArousal = this.#emotionCalculatorAdapter.calculateSexualArousal(currentState.sexual);
  const sexualStates = this.#emotionCalculatorAdapter.calculateSexualStates(
    currentState.mood,
    currentState.sexual,
    sexualArousal
  );

  // Rest of #buildContext remains the same
  return {
    emotions,
    sexualStates,
    sexualArousal,
    moodAxes: this.#normalizeMoodAxes(currentState.mood),
    // ...
  };
}
```

### DI Registration Update
```javascript
// In expressionDiagnosticsRegistrations.js
container.registerFactory(tokens.IMonteCarloSimulator, (c) => {
  return new MonteCarloSimulator({
    logger: c.resolve(coreTokens.ILogger),
    dataRegistry: c.resolve(coreTokens.IDataRegistry),
    jsonLogicEvaluationService: c.resolve(coreTokens.IJsonLogicEvaluationService),
    emotionCalculatorAdapter: c.resolve(tokens.IEmotionCalculatorAdapter), // ADD THIS
    // ... other dependencies
  });
});
```

## Verification Commands
```bash
npm run test:unit -- --testPathPattern="monteCarloSimulator"
npm run test:integration -- --testPathPattern="expression-diagnostics"
npm run typecheck
npx eslint src/expressionDiagnostics/services/MonteCarloSimulator.js src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js
```

## Dependencies
- **Depends on**: EXPDIAMONCARREFREP-003 (EmotionCalculatorAdapter must exist first)
- **Blocks**: None (can proceed to other tracks)

## Status
Completed.

## Outcome
- Delegated emotion/sexual calculations in `MonteCarloSimulator` to `EmotionCalculatorAdapter`, removing duplicated methods.
- Wired the adapter into DI and updated unit/integration tests to provide the adapter, adding constructor validation coverage.
- Adjusted scope to reflect the real constructor signature and adapter method signatures (no `jsonLogicEvaluationService` dependency).
