# AFFTRAANDAFFAXI-010: Update MonteCarloSimulator

## Summary

Update the `MonteCarloSimulator` to generate random affect traits when sampling states, and pass traits to emotion calculation. This enables statistical testing of trait-gated expressions like compassion and guilt.

**Note**: As of AFFTRAANDAFFAXI-009, `mood.component.json` now has **8 axes** including `affiliation`. This ticket must also update the simulator to include the 8th axis.

## Priority: Medium | Effort: Medium

## Rationale

The Monte Carlo simulator tests expression trigger probability by sampling random mood/sexual states. To accurately test trait-gated emotions, it must also sample random trait values and include them in emotion calculations. Without this, simulations of "compassion" or "guilt" expressions would always use default traits (50), missing the trait gates' filtering effect.

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/MonteCarloSimulator.js` | **Modify** - Add trait generation and context building |
| `tests/unit/expressionDiagnostics/services/monteCarloSimulator.test.js` | **Modify** - Add tests for trait sampling |

## Out of Scope

- **DO NOT** modify WitnessState - that's AFFTRAANDAFFAXI-009
- **DO NOT** modify WitnessStateFinder - that's AFFTRAANDAFFAXI-011
- **DO NOT** modify UI components - that's AFFTRAANDAFFAXI-012/013
- **DO NOT** modify EmotionCalculatorService - that's AFFTRAANDAFFAXI-006/007
- **DO NOT** change simulation statistics calculation

## Implementation Details

### 1. Update #generateRandomState Method (~line 206)

Add affect traits generation to the existing method:

**Current return structure:**
```javascript
return {
  current: { mood: currentMood, sexual: currentSexual },
  previous: { mood: previousMood, sexual: previousSexual },
};
```

**Updated to include traits:**
```javascript
#generateRandomState(distribution) {
  // 8 mood axes (affiliation added in AFFTRAANDAFFAXI-009)
  const moodAxes = ['valence', 'arousal', 'agency_control', 'threat', 'engagement', 'future_expectancy', 'self_evaluation', 'affiliation'];
  const traitAxes = ['affective_empathy', 'cognitive_empathy', 'harm_aversion'];

  // Generate previous state first (fully random)
  const previousMood = {};
  const previousSexual = {};

  // Previous mood axes use [-100, 100] integer scale
  for (const axis of moodAxes) {
    previousMood[axis] = Math.round(this.#sampleValue(distribution, -100, 100));
  }

  // Previous sexual axes
  previousSexual.sex_excitation = Math.round(this.#sampleValue(distribution, 0, 100));
  previousSexual.sex_inhibition = Math.round(this.#sampleValue(distribution, 0, 100));
  previousSexual.baseline_libido = Math.round(this.#sampleValue(distribution, -50, 50));

  // Generate affect traits (stable - same for current and previous)
  // Traits are personality characteristics, not momentary states
  const affectTraits = {};
  for (const axis of traitAxes) {
    affectTraits[axis] = Math.round(this.#sampleValue(distribution, 0, 100));
  }

  // Generate current state as previous + gaussian delta
  const currentMood = {};
  const currentSexual = {};

  const MOOD_DELTA_SIGMA = 15;
  for (const axis of moodAxes) {
    const delta = this.#sampleGaussianDelta(MOOD_DELTA_SIGMA);
    const raw = previousMood[axis] + delta;
    currentMood[axis] = Math.round(Math.max(-100, Math.min(100, raw)));
  }

  const SEXUAL_DELTA_SIGMA = 12;
  const LIBIDO_DELTA_SIGMA = 8;

  const excitationDelta = this.#sampleGaussianDelta(SEXUAL_DELTA_SIGMA);
  currentSexual.sex_excitation = Math.round(
    Math.max(0, Math.min(100, previousSexual.sex_excitation + excitationDelta))
  );

  const inhibitionDelta = this.#sampleGaussianDelta(SEXUAL_DELTA_SIGMA);
  currentSexual.sex_inhibition = Math.round(
    Math.max(0, Math.min(100, previousSexual.sex_inhibition + inhibitionDelta))
  );

  const libidoDelta = this.#sampleGaussianDelta(LIBIDO_DELTA_SIGMA);
  currentSexual.baseline_libido = Math.round(
    Math.max(-50, Math.min(50, previousSexual.baseline_libido + libidoDelta))
  );

  return {
    current: { mood: currentMood, sexual: currentSexual },
    previous: { mood: previousMood, sexual: previousSexual },
    affectTraits, // Same for current and previous (personality is stable)
  };
}
```

### 2. Update #buildContext Method (~line 429)

Pass affect traits to emotion calculation:

```javascript
/**
 * Build evaluation context from current and previous states
 *
 * @private
 * @param {{mood: object, sexual: object}} currentState - Current mood and sexual state
 * @param {{mood: object, sexual: object}} previousState - Previous mood and sexual state
 * @param {{affective_empathy: number, cognitive_empathy: number, harm_aversion: number}} [affectTraits] - Affect traits
 * @returns {object} Context object
 */
#buildContext(currentState, previousState, affectTraits = null) {
  // Calculate current emotions from current mood using prototypes
  // Note: Now passes affectTraits for gate checking
  const emotions = this.#calculateEmotions(currentState.mood, affectTraits);

  // Calculate current sexualArousal from raw sexual state
  const sexualArousal = this.#calculateSexualArousal(currentState.sexual);

  // Calculate current sexual states
  const sexualStates = this.#calculateSexualStates(currentState.sexual, sexualArousal);

  // Calculate previous emotions from previous mood
  const previousEmotions = this.#calculateEmotions(previousState.mood, affectTraits);

  // Calculate previous sexual arousal and states
  const previousSexualArousal = this.#calculateSexualArousal(previousState.sexual);
  const previousSexualStates = this.#calculateSexualStates(
    previousState.sexual,
    previousSexualArousal
  );

  const previousMoodAxes = previousState.mood;

  return {
    mood: currentState.mood,
    moodAxes: currentState.mood,
    emotions,
    sexualStates,
    sexualArousal,
    previousEmotions,
    previousSexualStates,
    previousMoodAxes,
    previousSexualArousal,
    // Include affectTraits in context for trait-based expression prerequisites
    affectTraits: affectTraits ?? {
      affective_empathy: 50,
      cognitive_empathy: 50,
      harm_aversion: 50,
    },
  };
}
```

### 3. Update #calculateEmotions Method (~line 534)

Add affect traits support to emotion calculation:

```javascript
/**
 * Calculate emotion intensities from mood axes
 *
 * @private
 * @param {object} mood - Mood axes in [-100, 100] scale
 * @param {{affective_empathy: number, cognitive_empathy: number, harm_aversion: number}|null} [affectTraits] - Affect traits
 * @returns {object}
 */
#calculateEmotions(mood, affectTraits = null) {
  const lookup = this.#dataRegistry.get('lookups', 'core:emotion_prototypes');
  if (!lookup?.entries) return {};

  // Normalize mood from [-100, 100] to [-1, 1]
  const normalizedMood = {};
  for (const [axis, value] of Object.entries(mood)) {
    normalizedMood[axis] = value / 100;
  }

  // Normalize affect traits from [0, 100] to [0, 1]
  const traits = affectTraits ?? {
    affective_empathy: 50,
    cognitive_empathy: 50,
    harm_aversion: 50,
  };
  const normalizedTraits = {
    affective_empathy: traits.affective_empathy / 100,
    cognitive_empathy: traits.cognitive_empathy / 100,
    harm_aversion: traits.harm_aversion / 100,
  };

  // Combine normalized axes for gate checking and weight calculation
  const allNormalizedAxes = { ...normalizedMood, ...normalizedTraits };

  const emotions = {};
  for (const [id, prototype] of Object.entries(lookup.entries)) {
    // Check gates first - emotion intensity is 0 if any gate fails
    // Gates can now reference trait axes (e.g., "affective_empathy >= 0.25")
    if (!this.#checkGates(prototype.gates, allNormalizedAxes)) {
      emotions[id] = 0;
      continue;
    }

    if (prototype.weights) {
      let sum = 0;
      let weightSum = 0;
      for (const [axis, weight] of Object.entries(prototype.weights)) {
        // Check both mood axes and trait axes
        if (allNormalizedAxes[axis] !== undefined) {
          sum += allNormalizedAxes[axis] * weight;
          weightSum += Math.abs(weight);
        }
      }
      emotions[id] =
        weightSum > 0 ? Math.max(0, Math.min(1, sum / weightSum)) : 0;
    }
  }
  return emotions;
}
```

### 4. Update #evaluateWithTracking Method (~line 380)

Pass traits through the evaluation chain:

```javascript
/**
 * Evaluate expression with clause tracking
 *
 * @private
 * @param {object} expression - The expression to evaluate
 * @param {{mood: object, sexual: object}} currentState - Current mood/sexual state
 * @param {{mood: object, sexual: object}} previousState - Previous mood/sexual state
 * @param {{affective_empathy: number, cognitive_empathy: number, harm_aversion: number}|null} affectTraits - Affect traits
 * @param {Array|null} clauseTracking - Tracking array for clause failures
 * @returns {{triggered: boolean}}
 */
#evaluateWithTracking(expression, currentState, previousState, affectTraits, clauseTracking) {
  // Build context from current, previous states, and traits
  const context = this.#buildContext(currentState, previousState, affectTraits);

  // ... rest of method unchanged
}
```

### 5. Update simulate Method (~line 97)

Pass traits from generated state:

```javascript
// In the simulation loop:
for (let i = processed; i < chunkEnd; i++) {
  const { current, previous, affectTraits } = this.#generateRandomState(distribution);
  const result = this.#evaluateWithTracking(
    expression,
    current,
    previous,
    affectTraits,
    clauseTracking
  );

  if (result.triggered) {
    triggerCount++;
  }
}
```

### 6. Update #buildKnownContextKeys Method (~line 1046)

Add affect traits and affiliation to known context keys:

```javascript
#buildKnownContextKeys() {
  // Static top-level keys that are always seeded
  const topLevel = new Set([
    'mood',
    'moodAxes',
    'emotions',
    'sexualStates',
    'sexualArousal',
    'previousEmotions',
    'previousSexualStates',
    'previousMoodAxes',
    'previousSexualArousal',
    'affectTraits', // NEW: Affect traits are now seeded
  ]);

  // ... rest of method (update mood/moodAxes/previousMoodAxes to include 'affiliation')

  // All 8 mood axes (affiliation added in AFFTRAANDAFFAXI-009)
  nestedKeys.mood = new Set([
    'valence', 'arousal', 'agency_control', 'threat',
    'engagement', 'future_expectancy', 'self_evaluation', 'affiliation',
  ]);
  nestedKeys.moodAxes = new Set([...nestedKeys.mood]);
  nestedKeys.previousMoodAxes = new Set([...nestedKeys.mood]);

  // Add affect traits as nested keys category
  nestedKeys.affectTraits = new Set([
    'affective_empathy',
    'cognitive_empathy',
    'harm_aversion',
  ]);

  return { topLevel, nestedKeys, scalarKeys };
}
```

## Acceptance Criteria

### Tests That Must Pass

1. **All existing MonteCarloSimulator tests pass**:
   ```bash
   npm run test:unit -- --testPathPattern="monteCarloSimulator" --verbose
   ```

2. **TypeScript type checking passes**:
   ```bash
   npm run typecheck
   ```

3. **ESLint passes**:
   ```bash
   npx eslint src/expressionDiagnostics/services/MonteCarloSimulator.js
   ```

### Invariants That Must Remain True

1. **Backwards compatible**: Expressions without trait gates work identically
2. **Trait sampling**: Random traits generated in [0, 100] range
3. **Trait stability**: Same traits used for current and previous (personality doesn't change)
4. **Gate evaluation**: Trait gates properly block emotion calculation
5. **Context complete**: affectTraits always present in context object
6. **8 mood axes**: All mood axes including `affiliation` are sampled and available

## Verification Commands

```bash
# Run existing tests (must all pass)
npm run test:unit -- --testPathPattern="monteCarloSimulator" --verbose

# Type check
npm run typecheck

# Lint
npx eslint src/expressionDiagnostics/services/MonteCarloSimulator.js

# Verify affectTraits in context
grep -n "affectTraits" src/expressionDiagnostics/services/MonteCarloSimulator.js
```

## Definition of Done

- [x] `#generateRandomState` generates random affectTraits [0..100]
- [x] `#generateRandomState` generates all 8 mood axes including `affiliation`
- [x] Traits are stable across current/previous states
- [x] `#buildContext` includes affectTraits in returned context
- [x] `#calculateEmotions` uses traits for gate checking and weights
- [x] `#evaluateWithTracking` passes traits through chain
- [x] `#buildKnownContextKeys` includes affectTraits and `affiliation` in mood Sets
- [x] All existing tests pass
- [x] JSDoc documentation updated
- [x] `npm run typecheck` passes (pre-existing errors only)
- [x] `npx eslint` passes (no errors, only warnings)

---

## Outcome

**Status**: ✅ COMPLETED (2026-01-10)

### Implementation Summary

Successfully updated `MonteCarloSimulator` to support affect traits and the 8th mood axis (`affiliation`):

1. **`#generateRandomState`**: Now generates 8 mood axes (including `affiliation`) and 3 affect trait axes (`affective_empathy`, `cognitive_empathy`, `harm_aversion`). Traits are sampled in [0, 100] range and remain stable across current/previous states (personality doesn't delta).

2. **`#buildContext`**: Accepts optional `affectTraits` parameter and includes it in the returned context. Uses default values (50 for all traits) when not provided for backwards compatibility.

3. **`#calculateEmotions`**: Normalizes affect traits from [0, 100] to [0, 1] and combines them with normalized mood axes for gate checking and weight calculations. Trait gates (e.g., `affective_empathy >= 0.25`) now properly filter emotion calculation.

4. **`#evaluateWithTracking`**: Updated signature to accept `affectTraits` parameter and passes it through to `#buildContext`.

5. **`simulate` method**: Destructures `affectTraits` from `#generateRandomState` result and passes it to `#evaluateWithTracking`.

6. **`#buildKnownContextKeys`**: Added `'affectTraits'` to topLevel Set, `'affiliation'` to all mood Sets, and created new nested keys for affect traits.

### Tests Added

Added comprehensive tests to `monteCarloSimulator.test.js`:

- **Affiliation mood axis access**: Tests for `moodAxes.affiliation` and `previousMoodAxes.affiliation`
- **Affect traits context variable access**: Tests for all three trait axes, trait-gated emotion checking, personality stability, and default values
- **Affect traits validation**: Tests for valid paths and warnings on unknown keys

### Verification Results

- **All 105 tests pass**: `npm run test:unit -- --testPathPatterns="monteCarloSimulator"`
- **ESLint**: No errors (only pre-existing JSDoc warnings)
- **TypeScript**: Pre-existing errors only (not introduced by this ticket)

### Files Modified

| File | Changes |
|------|---------|
| `src/expressionDiagnostics/services/MonteCarloSimulator.js` | All 6 methods updated per Implementation Details |
| `tests/unit/expressionDiagnostics/services/monteCarloSimulator.test.js` | Added ~100 lines of new tests for affect traits and affiliation axis |
