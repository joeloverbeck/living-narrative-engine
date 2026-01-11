# EXPDIAMONCARREFREP-003: Extract EmotionCalculatorAdapter for MonteCarloSimulator

## Summary
Create an adapter that wraps `EmotionCalculatorService` to provide the interface needed by `MonteCarloSimulator`. This prepares for delegation of emotion/sexual state calculations from the simulator to the core emotion service, eliminating ~200 lines of duplicated logic.

## Status
Completed

### Assumptions Reassessed
- `EmotionCalculatorService` signatures do **not** match the draft in this ticket. It currently expects:
  - `calculateEmotions(moodData, sexualArousal, sexualState, affectTraits)`
  - `calculateSexualStates(moodData, sexualArousal, sexualState)`
  - `calculateSexualArousal(sexualState)`
- The service already normalizes mood axes from `[-100, 100]` to `[-1, 1]`. The adapter must **not** normalize mood data again.
- The service returns `Map<string, number>` for emotions/sexual states; MonteCarloSimulator currently expects plain objects. The adapter should convert Maps to objects to preserve the simulator’s data shape when it is wired in.

## Files to Create

| File | Action | Description |
|------|--------|-------------|
| `src/expressionDiagnostics/adapters/EmotionCalculatorAdapter.js` | Create | New adapter class wrapping EmotionCalculatorService |
| `tests/unit/expressionDiagnostics/adapters/emotionCalculatorAdapter.test.js` | Create | Unit tests for the adapter |

## Files to Modify

| File | Action | Changes |
|------|--------|---------|
| `src/dependencyInjection/tokens/tokens-diagnostics.js` | Modify | Add `IEmotionCalculatorAdapter` token |
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | Modify | Register adapter factory |

## Out of Scope

- **DO NOT** modify `MonteCarloSimulator.js` - That's EXPDIAMONCARREFREP-004
- **DO NOT** modify `EmotionCalculatorService.js` - The adapter wraps it, doesn't change it
- **DO NOT** modify any UI/controller code
- **DO NOT** add new emotion calculation logic - adapter is pure delegation

## Acceptance Criteria

### Tests That Must Pass
1. New unit test: Adapter correctly delegates `calculateEmotions(mood, sexualState, affectTraits)` to `EmotionCalculatorService.calculateEmotions` with raw mood data (no extra normalization)
2. New unit test: Adapter correctly delegates `calculateSexualArousal(sexualState)`
3. New unit test: Adapter correctly delegates `calculateSexualStates(mood, sexualState, sexualArousal)`
4. New unit test: Adapter converts `Map` results from the service into plain objects
5. New unit test: Adapter constructor validates dependencies using `validateDependency()`
6. All existing tests continue to pass

### Invariants That Must Remain True
1. Adapter is a thin delegation layer; it must not alter calculation logic
2. Constructor uses `validateDependency()` per project conventions
3. DI token follows naming convention: `IEmotionCalculatorAdapter`
4. Adapter does not modify the wrapped service's behavior (aside from Map-to-object conversion for call sites expecting objects)

## Implementation Notes

### Adapter Interface
```javascript
/**
 * @file Adapter wrapping EmotionCalculatorService for MonteCarloSimulator
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

class EmotionCalculatorAdapter {
  #emotionCalculatorService;
  #logger;

  constructor({ emotionCalculatorService, logger }) {
    validateDependency(emotionCalculatorService, 'IEmotionCalculatorService', logger, {
      requiredMethods: ['calculateEmotions', 'calculateSexualArousal', 'calculateSexualStates']
    });
    this.#emotionCalculatorService = emotionCalculatorService;
    this.#logger = logger;
  }

  /**
   * Calculate emotions from mood, sexual state, and optional affect traits.
   * Mood normalization is handled by EmotionCalculatorService.
   * @param {Object} mood - Mood axes with values in [-100, 100]
   * @param {Object|null} sexualState - Optional sexual state axes
   * @param {Object|null} affectTraits - Optional affect trait modifiers
   * @returns {Object} Emotion intensities keyed by emotion ID
   */
  calculateEmotions(mood, sexualState = null, affectTraits = null) {
    const results = this.#emotionCalculatorService.calculateEmotions(
      mood,
      null,
      sexualState,
      affectTraits
    );
    return this.#mapToObject(results);
  }

  /**
   * Calculate sexual arousal from sexual state.
   * @param {Object} sexual - Sexual state axes
   * @returns {number} Arousal value in [0, 1]
   */
  calculateSexualArousal(sexual) {
    return this.#emotionCalculatorService.calculateSexualArousal(sexual);
  }

  /**
   * Calculate sexual states from mood, sexual state, and arousal.
   * @param {Object} mood - Mood axes with values in [-100, 100]
   * @param {Object|null} sexualState - Sexual state axes
   * @param {number|null} sexualArousal - Arousal value in [0, 1]
   * @returns {Object} Sexual state intensities keyed by state ID
   */
  calculateSexualStates(mood, sexualState, sexualArousal = null) {
    const results = this.#emotionCalculatorService.calculateSexualStates(
      mood,
      sexualArousal,
      sexualState
    );
    return this.#mapToObject(results);
  }

  #mapToObject(map) {
    if (!map || typeof map[Symbol.iterator] !== 'function') {
      return {};
    }

    const obj = {};
    for (const [key, value] of map) {
      obj[key] = value;
    }
    return obj;
  }
}

export default EmotionCalculatorAdapter;
```

### DI Registration
```javascript
// In tokens-diagnostics.js
export const tokens = {
  // ... existing tokens
  IEmotionCalculatorAdapter: 'IEmotionCalculatorAdapter',
};

// In expressionDiagnosticsRegistrations.js
container.registerFactory(tokens.IEmotionCalculatorAdapter, (c) => {
  return new EmotionCalculatorAdapter({
    emotionCalculatorService: c.resolve(coreTokens.IEmotionCalculatorService),
    logger: c.resolve(coreTokens.ILogger),
  });
});
```

## Verification Commands
```bash
npm run test:unit -- --testPathPattern="emotionCalculatorAdapter"
npm run typecheck
npx eslint src/expressionDiagnostics/adapters/EmotionCalculatorAdapter.js
```

## Dependencies
- **Depends on**: None (can start after gate parsing track)
- **Blocks**: EXPDIAMONCARREFREP-004 (simulator delegation to adapter)

## Outcome
- Updated adapter design to match `EmotionCalculatorService` signatures (no extra mood normalization; Map-to-object conversion for consumers expecting plain objects).
- Added DI token + registration and unit tests for delegation + conversion behavior, keeping MonteCarloSimulator untouched.
