# Expression System Prototype Key Robustness

## Context

### Location in Codebase
- `src/expressions/expressionContextBuilder.js` - Builds evaluation context for expression prerequisites
- `src/emotions/emotionCalculatorService.js` - Calculates emotion/sexual state intensities and provides prototype keys
- `src/expressions/expressionEvaluatorService.js` - Evaluates expression prerequisites using JSON Logic
- `src/expressions/expressionPersistenceListener.js` - Orchestrates expression evaluation on action events

### What the Module Does
The expression system evaluates emotional expressions by:
1. **EmotionCalculatorService** loads prototype lookups (`core:emotion_prototypes`, `core:sexual_prototypes`) from data registry
2. **ExpressionContextBuilder** requests prototype keys and calculated states from EmotionCalculatorService
3. **ExpressionContextBuilder** validates state coverage matches prototype keys
4. **ExpressionEvaluatorService** evaluates JSON Logic prerequisites against the context

### Critical Flow
```
Event → ExpressionPersistenceListener.handleEvent()
         → ExpressionContextBuilder.buildContext()
              → EmotionCalculatorService.getEmotionPrototypeKeys()
              → EmotionCalculatorService.getSexualPrototypeKeys()
              → #assertStateCoverage(emotions, emotionKeys)
              → #assertStateCoverage(sexualStates, sexualKeys)
         → ExpressionEvaluatorService.evaluate()
```

## Problem

### What Failed
Tests in `tests/integration/expressions/expressionFlow.integration.test.js` failed with:
```
Error: [ExpressionContextBuilder] sexualStates prototype lookup returned no keys.
```

### How It Failed
1. **Root cause**: Expressions in `emotions-anger`, `emotions-positive-affect`, `emotions-attention` mods don't reference any `sexualStates.*` variables
2. **Test utility behavior**: `collectExpressionStateKeys()` returns empty `sexualKeys` array when no expressions use sexual state variables
3. **Mock setup**: Test set `getSexualPrototypeKeys.mockReturnValue([])` - an empty array
4. **Validation failure**: `ExpressionContextBuilder.#assertStateCoverage()` throws when `expectedKeys.length === 0`

### Why It Was Hard to Debug
1. **Error message lacked context**: Said "prototype lookup returned no keys" but didn't say WHY (lookup missing? empty? mock issue?)
2. **Multi-layer indirection**: Failure chain spans 4 methods across 2 classes
3. **Silent failures upstream**: `EmotionCalculatorService` returns `[]` without throwing when lookup is missing
4. **Test vs production confusion**: Error appeared to be a production code issue but was actually test infrastructure

### Link to Tests
- `tests/integration/expressions/expressionFlow.integration.test.js` (fixed with fallback sexual keys)
- Related: `tests/common/expressionTestUtils.js` (`collectExpressionStateKeys`, `buildStateMap`)

## Truth Sources

### Domain Rules
- Prototype lookups are defined in:
  - `data/mods/core/lookups/emotion_prototypes.lookup.json`
  - `data/mods/core/lookups/sexual_prototypes.lookup.json`
- All expressions require a valid context with all prototype keys populated

### Contracts
- `EmotionCalculatorService.getEmotionPrototypeKeys()` returns `string[]` of emotion names
- `EmotionCalculatorService.getSexualPrototypeKeys()` returns `string[]` of sexual state names
- `ExpressionContextBuilder.buildContext()` requires non-empty prototype key arrays

### External Dependencies
- `json-logic-js` for prerequisite evaluation
- Data registry for lookup storage and retrieval

## Desired Behavior

### Normal Cases
1. Data registry contains both `core:emotion_prototypes` and `core:sexual_prototypes` lookups
2. Lookups have non-empty `entries` objects with prototype definitions
3. `getEmotionPrototypeKeys()` returns array of emotion names (e.g., `['anger', 'rage', 'joy', ...]`)
4. `getSexualPrototypeKeys()` returns array of sexual state names (e.g., `['sex_excitation', 'sex_inhibition', 'baseline_libido']`)
5. Context builds successfully with all states populated

### Edge Cases
1. **Expression doesn't reference all prototype keys**: Still works - context includes all prototypes, expression only uses some
2. **Prior state is null/undefined**: Zeroed state object created with all prototype keys set to 0
3. **Mood data is incomplete**: Missing axes default to 0

### Failure Modes (what errors to raise/return)

#### Failure Mode 1: Lookup Not Found in Data Registry
**When**: `dataRegistry.get('lookups', 'core:emotion_prototypes')` returns `undefined`

**Current behavior**: Logs warning, returns `null`, later returns `[]` from `getPrototypeKeys()`

**Desired behavior**: Throw `InvalidArgumentError` with actionable message:
```javascript
throw new InvalidArgumentError(
  `EmotionCalculatorService: Required lookup "${lookupId}" not found in data registry. ` +
  `This typically means mods were not loaded before creating expression services. ` +
  `Ensure mod initialization completes before resolving EmotionCalculatorService.`
);
```

#### Failure Mode 2: Lookup Has No Entries
**When**: Lookup exists but `lookup.entries` is empty or not an object

**Current behavior**: Logs warning, returns `null`

**Desired behavior**: Throw `InvalidArgumentError`:
```javascript
throw new InvalidArgumentError(
  `EmotionCalculatorService: Lookup "${lookupId}" has no valid entries. ` +
  `Expected an object with prototype definitions, got ${typeof lookup.entries}.`
);
```

#### Failure Mode 3: Prototype Keys Array is Empty
**When**: `Object.keys(prototypes)` returns empty array

**Current behavior**: Returns `[]`, later `ExpressionContextBuilder` throws cryptic error

**Desired behavior**: Throw in `getPrototypeKeys()`:
```javascript
throw new InvalidArgumentError(
  `EmotionCalculatorService: ${type} prototype lookup "${lookupId}" is empty. ` +
  `No prototype definitions found. Check the lookup file for valid entries.`
);
```

#### Failure Mode 4: State Coverage Mismatch
**When**: Calculated state Map size doesn't match expected prototype key count

**Current behavior**: Good error message with expected/actual/missing keys

**Desired enhancement**: Add hint about possible causes:
```javascript
throw new Error(
  `[ExpressionContextBuilder] ${kind} evaluation missing prototype keys. ` +
  `Expected ${expectedCount}, got ${actualCount}. Missing: ${missingKeys.join(', ')}. ` +
  `This may indicate a mismatch between prototype lookup and calculator logic.`
);
```

## Invariants

Properties that must always hold:

1. **Non-empty prototype keys**: `getEmotionPrototypeKeys().length > 0` and `getSexualPrototypeKeys().length > 0` - ALWAYS (or throw)
2. **State coverage**: `emotions.size === emotionKeys.length` and `sexualStates.size === sexualKeys.length`
3. **Prototype consistency**: Keys returned by `getPrototypeKeys()` must match keys in calculated state Map
4. **No silent failures**: If prototype loading fails, throw immediately - never return empty arrays silently

## API Contracts

### What Stays Stable
- `ExpressionContextBuilder.buildContext(actorId, moodData, sexualStateData, previousState)` - signature unchanged
- `EmotionCalculatorService.getEmotionPrototypeKeys()` - returns `string[]`
- `EmotionCalculatorService.getSexualPrototypeKeys()` - returns `string[]`
- `EmotionCalculatorService.calculateEmotions()` - returns `Map<string, number>`
- `EmotionCalculatorService.calculateSexualStates()` - returns `Map<string, number>`

### What Is Allowed to Change
- Error message content and format (improving with more context)
- Internal validation method implementations
- When and how errors are thrown (earlier is better)
- Logging behavior (adding more diagnostics)
- Addition of new validation methods (e.g., `validateSystemReady()`)

## Testing Plan

### Tests That Must Be Updated/Added

#### Unit Tests

1. **`tests/unit/emotions/emotionCalculatorService.prototypeKeys.test.js`** (NEW)
   - Test `getEmotionPrototypeKeys()` throws when lookup missing
   - Test `getSexualPrototypeKeys()` throws when lookup missing
   - Test throws when lookup has empty entries
   - Test throws when lookup entries is not an object
   - Test returns correct keys when lookup is valid

2. **`tests/unit/expressions/expressionContextBuilder.validation.test.js`** (UPDATE)
   - Add test for improved error messages with root cause hints
   - Add test for empty prototype keys scenario

#### Integration Tests

3. **`tests/integration/expressions/expressionFlow.integration.test.js`** (ALREADY FIXED)
   - Fallback sexual keys added to handle expressions without sexual state references
   - No further changes needed

#### Regression Tests

4. **`tests/integration/expressions/prototypeKeyFailFast.integration.test.js`** (NEW)
   - Test that missing `core:emotion_prototypes` lookup causes clear error
   - Test that missing `core:sexual_prototypes` lookup causes clear error
   - Test error message includes lookup ID and actionable guidance
   - Test that error occurs at service creation or first use, not later

### Property Tests to Consider

1. **Prototype key non-emptiness**: For any valid data registry with loaded mods, `getPrototypeKeys()` returns >=1 key
2. **State-key correspondence**: For any calculated state Map, `map.size === getPrototypeKeys().length`
3. **Idempotent prototype loading**: Multiple calls to `getPrototypeKeys()` return identical arrays

## Implementation Recommendations

### Priority 1: Fail-Fast in EmotionCalculatorService

Modify `getEmotionPrototypeKeys()` and `getSexualPrototypeKeys()` to throw instead of returning empty arrays:

```javascript
getEmotionPrototypeKeys() {
  const prototypes = this.#ensureEmotionPrototypes();
  if (!prototypes) {
    throw new InvalidArgumentError(
      `EmotionCalculatorService: Emotion prototypes unavailable. ` +
      `Lookup "${EMOTION_PROTOTYPES_LOOKUP_ID}" not found in data registry. ` +
      `Ensure mods are loaded before using expression services.`
    );
  }
  const keys = Object.keys(prototypes);
  if (keys.length === 0) {
    throw new InvalidArgumentError(
      `EmotionCalculatorService: Emotion prototype lookup is empty. ` +
      `Lookup "${EMOTION_PROTOTYPES_LOOKUP_ID}" exists but contains no entries.`
    );
  }
  return keys;
}
```

### Priority 2: Add Pre-Flight Validation

Add optional `validateExpressionSystemReady()` method for tests and app initialization:

```javascript
// In ExpressionContextBuilder or new service
validateExpressionSystemReady() {
  try {
    const emotionKeys = this.#emotionCalculatorService.getEmotionPrototypeKeys();
    const sexualKeys = this.#emotionCalculatorService.getSexualPrototypeKeys();
    return { valid: true, emotionKeyCount: emotionKeys.length, sexualKeyCount: sexualKeys.length };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}
```

### Priority 3: Improve Test Utilities

Update `tests/common/expressionTestUtils.js` to provide fallback helper:

```javascript
export const ensurePrototypeKeys = (collectedKeys, fallbackKeys) => {
  if (collectedKeys.length > 0) {
    return collectedKeys;
  }
  return fallbackKeys;
};

export const DEFAULT_SEXUAL_KEYS = ['sex_excitation', 'sex_inhibition', 'baseline_libido'];
```

## Open Questions

1. Should `EmotionCalculatorService` validate prototype availability at construction time, or at first use?
   - **Recommendation**: At first use (lazy) to allow test mocking, but fail loudly

2. Should we add a configuration option for strict vs lenient mode?
   - **Recommendation**: No - fail-fast should be the only behavior

3. Should we deprecate returning empty arrays in any calculator method?
   - **Recommendation**: Yes - empty arrays should always indicate an error condition
