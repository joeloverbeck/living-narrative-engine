# AFFTRAANDAFFAXI-011: Update WitnessStateFinder

## Summary

Update the `WitnessStateFinder` to generate and optimize affect traits when searching for witness states. This enables finding satisfying states for trait-gated expressions like compassion and guilt.

## Priority: Medium | Effort: Medium

## Rationale

The WitnessStateFinder uses simulated annealing to find mood/sexual states that trigger expressions. For trait-gated emotions, the finder must also search through trait space to find combinations that satisfy trait gates (e.g., `affective_empathy >= 0.25`). Without this, it cannot find witnesses for compassion or guilt expressions with low-empathy character configurations.

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/WitnessStateFinder.js` | **Modify** - Add trait optimization to search |
| `tests/unit/expressionDiagnostics/services/witnessStateFinder.test.js` | **Modify** - Add tests for trait search |

## Out of Scope

- **DO NOT** modify WitnessState - that's AFFTRAANDAFFAXI-009
- **DO NOT** modify MonteCarloSimulator - that's AFFTRAANDAFFAXI-010
- **DO NOT** modify UI components - that's AFFTRAANDAFFAXI-012/013
- **DO NOT** modify EmotionCalculatorService - that's AFFTRAANDAFFAXI-006/007
- **DO NOT** change the simulated annealing algorithm fundamentals

## Implementation Details

### 1. Update findWitness Method (~line 87)

Initialize with random traits from WitnessState:

```javascript
async findWitness(expression, config = {}) {
  const cfg = { ...this.#defaultConfig, ...config };
  const { onProgress } = cfg;

  this.#logger.debug(
    `WitnessStateFinder: Starting search for ${expression?.id || 'unknown'} (max ${cfg.maxIterations} iterations)`
  );

  // WitnessState.createRandom() now includes random affectTraits
  let currentState = WitnessState.createRandom();
  let currentFitness = this.#calculateFitness(expression, currentState);

  // ... rest of method unchanged
}
```

### 2. Update #buildContext Method (~line 368)

Include affect traits in context:

```javascript
/**
 * Build evaluation context from witness state.
 *
 * @param {WitnessState} state - Witness state to convert
 * @returns {object} Evaluation context
 * @private
 */
#buildContext(state) {
  // Convert mood to normalized form [-1, 1] for emotion calculations
  const normalizedMood = {};
  for (const axis of WitnessState.MOOD_AXES) {
    normalizedMood[axis] = state.mood[axis] / 100;
  }

  // Normalize affect traits from [0, 100] to [0, 1]
  const normalizedTraits = {};
  for (const axis of WitnessState.AFFECT_TRAIT_AXES) {
    normalizedTraits[axis] = state.affectTraits[axis] / 100;
  }

  // Calculate emotions from mood with trait support
  const emotions = this.#calculateEmotions(normalizedMood, normalizedTraits);

  // Calculate sexualArousal from raw sexual state
  const sexualArousal = this.#calculateSexualArousal(state.sexual);

  // Calculate sexual states
  const sexualStates = this.#calculateSexualStates(state.sexual, sexualArousal);

  return {
    mood: state.mood,
    moodAxes: state.mood,
    emotions,
    sexualStates,
    sexualArousal,
    // Include affect traits for trait-based expression prerequisites
    affectTraits: state.affectTraits,
  };
}
```

### 3. Update #calculateEmotions Method (~line 400)

Add affect traits support:

```javascript
/**
 * Calculate emotion intensities from mood.
 *
 * @param {object} normalizedMood - Normalized mood axes [-1, 1]
 * @param {object} normalizedTraits - Normalized affect traits [0, 1]
 * @returns {object} Emotion intensities
 * @private
 */
#calculateEmotions(normalizedMood, normalizedTraits = {}) {
  const lookup = this.#dataRegistry.get('lookups', 'core:emotion_prototypes');
  if (!lookup?.entries) return {};

  // Combine normalized axes for gate checking and weight calculation
  const allNormalizedAxes = { ...normalizedMood, ...normalizedTraits };

  const emotions = {};
  for (const [id, prototype] of Object.entries(lookup.entries)) {
    // Check gates first - gates can now reference trait axes
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

### 4. Add #checkGates Method (if not present)

```javascript
/**
 * Parse a gate string into its components.
 *
 * @private
 * @param {string} gate - Gate string to parse
 * @returns {{axis: string, operator: string, value: number} | null}
 */
#parseGate(gate) {
  const match = gate.match(/^(\w+)\s*(>=|<=|>|<|==)\s*(-?\d+\.?\d*)$/);
  if (!match) return null;
  return { axis: match[1], operator: match[2], value: parseFloat(match[3]) };
}

/**
 * Check if all gates pass for a prototype.
 *
 * @private
 * @param {string[] | undefined} gates - Array of gate strings
 * @param {object} normalizedAxes - Normalized axis values
 * @returns {boolean} - True if all gates pass or no gates defined
 */
#checkGates(gates, normalizedAxes) {
  if (!gates || !Array.isArray(gates) || gates.length === 0) return true;

  for (const gate of gates) {
    const parsed = this.#parseGate(gate);
    if (!parsed) continue;

    const { axis, operator, value } = parsed;
    const axisValue = normalizedAxes[axis];
    if (axisValue === undefined) continue;

    let passes;
    switch (operator) {
      case '>=':
        passes = axisValue >= value;
        break;
      case '<=':
        passes = axisValue <= value;
        break;
      case '>':
        passes = axisValue > value;
        break;
      case '<':
        passes = axisValue < value;
        break;
      case '==':
        passes = Math.abs(axisValue - value) < 0.0001;
        break;
      default:
        passes = true;
    }
    if (!passes) return false;
  }
  return true;
}
```

### 5. Update #generateNeighbor Method (~line 299)

Perturb affect traits along with mood and sexual:

```javascript
/**
 * Generate neighbor state with perturbation.
 *
 * @param {WitnessState} state - Current state
 * @param {number} temperature - Current temperature
 * @param {SearchConfig} config - Search configuration
 * @returns {WitnessState} New neighbor state
 * @private
 */
#generateNeighbor(state, temperature, config) {
  const mood = { ...state.mood };
  const sexual = { ...state.sexual };
  const affectTraits = { ...state.affectTraits };

  // Perturbation magnitude based on temperature
  const magnitude = temperature * (config.useDynamicsConstraints ? 10 : 50);

  // Perturb a random subset of mood axes
  for (const axis of WitnessState.MOOD_AXES) {
    if (Math.random() < 0.5) {
      const delta = (Math.random() - 0.5) * 2 * magnitude;
      const rawValue = mood[axis] + delta;
      mood[axis] = Math.round(
        Math.max(
          WitnessState.MOOD_RANGE.min,
          Math.min(WitnessState.MOOD_RANGE.max, rawValue)
        )
      );
    }
  }

  // Perturb a random subset of sexual axes
  for (const axis of WitnessState.SEXUAL_AXES) {
    if (Math.random() < 0.5) {
      const range = WitnessState.SEXUAL_RANGES[axis];
      const delta = (Math.random() - 0.5) * 2 * magnitude;
      const rawValue = sexual[axis] + delta;
      sexual[axis] = Math.round(
        Math.max(range.min, Math.min(range.max, rawValue))
      );
    }
  }

  // Perturb a random subset of affect trait axes
  for (const axis of WitnessState.AFFECT_TRAIT_AXES) {
    if (Math.random() < 0.5) {
      const delta = (Math.random() - 0.5) * 2 * magnitude;
      const rawValue = affectTraits[axis] + delta;
      affectTraits[axis] = Math.round(
        Math.max(
          WitnessState.TRAIT_RANGE.min,
          Math.min(WitnessState.TRAIT_RANGE.max, rawValue)
        )
      );
    }
  }

  return new WitnessState({
    mood,
    sexual,
    affectTraits,
    fitness: 0,
    isExact: false,
  });
}
```

### 6. Update WitnessState Import (if needed)

Ensure WitnessState is imported and has the new constants:

```javascript
import WitnessState from '../models/WitnessState.js';
```

## Acceptance Criteria

### Tests That Must Pass

1. **All existing WitnessStateFinder tests pass**:
   ```bash
   npm run test:unit -- --testPathPatterns="witnessStateFinder" --verbose
   ```

2. **TypeScript type checking passes**:
   ```bash
   npm run typecheck
   ```

3. **ESLint passes**:
   ```bash
   npx eslint src/expressionDiagnostics/services/WitnessStateFinder.js
   ```

### Invariants That Must Remain True

1. **Backwards compatible**: Expressions without trait gates work identically
2. **Trait search**: Traits are perturbed during neighbor generation
3. **Gate evaluation**: Trait gates properly checked in #calculateEmotions
4. **Context complete**: affectTraits always present in built context
5. **Simulated annealing**: Algorithm structure unchanged, just searches additional dimensions

## Verification Commands

```bash
# Run existing tests (must all pass)
npm run test:unit -- --testPathPatterns="witnessStateFinder" --verbose

# Type check
npm run typecheck

# Lint
npx eslint src/expressionDiagnostics/services/WitnessStateFinder.js

# Verify affectTraits handling
grep -n "affectTraits\|AFFECT_TRAIT_AXES" src/expressionDiagnostics/services/WitnessStateFinder.js
```

## Definition of Done

- [x] `#buildContext` includes affectTraits from state
- [x] `#calculateEmotions` accepts and uses normalized traits
- [x] `#generateNeighbor` perturbs affect trait axes
- [x] Gate checking supports trait axes
- [x] Context object includes affectTraits
- [x] Uses WitnessState.AFFECT_TRAIT_AXES and TRAIT_RANGE constants
- [x] All existing tests pass
- [x] JSDoc documentation updated
- [x] `npm run typecheck` passes (unrelated cli/ errors exist)
- [x] `npx eslint` passes

## Outcome

**Status: COMPLETED**

All implementation requirements have been satisfied:

### Code Changes

1. **`#buildContext` (~line 368)**: Already updated to normalize affect traits from [0, 100] to [0, 1] and include them in evaluation context

2. **`#parseGate` (new, ~line 533)**: Added method to parse gate strings like "affective_empathy >= 0.25" into structured objects

3. **`#checkGates` (new, ~line 545)**: Added method to evaluate gate arrays against normalized axis values (mood + traits combined)

4. **`#calculateEmotions` (~line 427)**: Updated to accept `normalizedTraits` parameter, combine with mood axes, and check gates before calculating emotion intensity

5. **`#generateNeighbor` (~line 299)**: Updated to copy and perturb affect trait axes (50% probability per axis) using `WitnessState.AFFECT_TRAIT_AXES` and `TRAIT_RANGE` constants

### Tests Added (8 new tests)

- `should include affectTraits in built context`
- `should perturb affect traits in neighbor generation`
- `should find witness for trait-gated expressions`
- `should return low fitness for trait-gated expression with low traits`
- `should produce integer trait values after perturbation`
- `should check trait gates before calculating emotion intensity`
- `should support trait axes in emotion weight calculations`
- `should include all three trait axes in context`

### Verification Results

- **Tests**: 72 passed, 0 failed
- **TypeScript**: Passes (unrelated cli/ errors pre-existing)
- **ESLint**: 0 errors, 0 warnings (after JSDoc fixes)

### Assumption Corrections

The ticket's Section 1 ("Update findWitness Method") was already satisfied - `WitnessState.createRandom()` already includes random affect traits. No code changes were needed for that section.
