# EXPDIA-010: Create WitnessState Model

## Summary

Create the data model for representing satisfying states (witnesses) that cause an expression to trigger. A witness state contains concrete mood axis values and sexual state values that, when applied, would make the expression fire.

## Priority: Medium | Effort: Small

## Rationale

When content authors need to debug an expression, they need to see concrete examples of states that would trigger it. The WitnessState model provides a structured, validated representation that can be displayed in the UI and copied for testing.

## Dependencies

- **EXPDIA-001** (AxisInterval model for understanding value ranges)
- No service dependencies - this is a pure data model

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/models/WitnessState.js` | **Create** |
| `src/expressionDiagnostics/models/index.js` | **Modify** (add export) |
| `tests/unit/expressionDiagnostics/models/WitnessState.test.js` | **Create** |

## Out of Scope

- **DO NOT** implement WitnessStateFinder service - that's EXPDIA-011
- **DO NOT** create UI components - that's EXPDIA-012
- **DO NOT** implement any search algorithms
- **DO NOT** create DI registration for this model

## Implementation Details

### WitnessState Model

```javascript
/**
 * @file WitnessState - Represents a satisfying state for expression triggering
 * @see specs/expression-diagnostics.md Layer D
 */

/**
 * @typedef {Object} MoodState
 * @property {number} valence - [-100, 100]
 * @property {number} energy - [-100, 100]
 * @property {number} dominance - [-100, 100]
 * @property {number} novelty - [-100, 100]
 * @property {number} threat - [-100, 100]
 */

/**
 * @typedef {Object} SexualState
 * @property {number} sex_excitation - [0, 100]
 * @property {number} sex_inhibition - [0, 100]
 * @property {number} baseline_libido - [0, 100]
 */

const MOOD_AXES = Object.freeze(['valence', 'energy', 'dominance', 'novelty', 'threat']);
const SEXUAL_AXES = Object.freeze(['sex_excitation', 'sex_inhibition', 'baseline_libido']);

const MOOD_RANGE = Object.freeze({ min: -100, max: 100 });
const SEXUAL_RANGE = Object.freeze({ min: 0, max: 100 });

class WitnessState {
  /** @type {MoodState} */
  #mood;

  /** @type {SexualState} */
  #sexual;

  /** @type {number} */
  #fitness;

  /** @type {boolean} */
  #isExact;

  /** @type {string|null} */
  #expressionId;

  /**
   * @param {Object} params
   * @param {MoodState} params.mood
   * @param {SexualState} params.sexual
   * @param {number} [params.fitness=1] - How well this state satisfies (1 = perfect)
   * @param {boolean} [params.isExact=true] - True if this is an exact witness, false if nearest miss
   * @param {string} [params.expressionId] - The expression this witnesses
   */
  constructor({ mood, sexual, fitness = 1, isExact = true, expressionId = null }) {
    this.#validateMood(mood);
    this.#validateSexual(sexual);

    this.#mood = { ...mood };
    this.#sexual = { ...sexual };
    this.#fitness = fitness;
    this.#isExact = isExact;
    this.#expressionId = expressionId;
  }

  // Getters
  get mood() { return { ...this.#mood }; }
  get sexual() { return { ...this.#sexual }; }
  get fitness() { return this.#fitness; }
  get isExact() { return this.#isExact; }
  get expressionId() { return this.#expressionId; }

  /**
   * Check if this is a valid triggering witness
   * @returns {boolean}
   */
  get isWitness() {
    return this.#isExact && this.#fitness === 1;
  }

  /**
   * Get a specific mood axis value
   * @param {string} axis
   * @returns {number|undefined}
   */
  getMoodAxis(axis) {
    return this.#mood[axis];
  }

  /**
   * Get a specific sexual axis value
   * @param {string} axis
   * @returns {number|undefined}
   */
  getSexualAxis(axis) {
    return this.#sexual[axis];
  }

  /**
   * Create a copy with modified values
   * @param {Object} changes
   * @returns {WitnessState}
   */
  withChanges(changes) {
    return new WitnessState({
      mood: { ...this.#mood, ...(changes.mood || {}) },
      sexual: { ...this.#sexual, ...(changes.sexual || {}) },
      fitness: changes.fitness ?? this.#fitness,
      isExact: changes.isExact ?? this.#isExact,
      expressionId: changes.expressionId ?? this.#expressionId
    });
  }

  /**
   * Convert to human-readable format for display
   * @returns {string}
   */
  toDisplayString() {
    const moodLines = MOOD_AXES.map(axis =>
      `  ${axis}: ${this.#mood[axis]?.toFixed(1) ?? 'N/A'}`
    ).join('\n');

    const sexualLines = SEXUAL_AXES.map(axis =>
      `  ${axis}: ${this.#sexual[axis]?.toFixed(1) ?? 'N/A'}`
    ).join('\n');

    return `Mood:\n${moodLines}\n\nSexual:\n${sexualLines}`;
  }

  /**
   * Convert to JSON for serialization
   * @returns {Object}
   */
  toJSON() {
    return {
      mood: { ...this.#mood },
      sexual: { ...this.#sexual },
      fitness: this.#fitness,
      isExact: this.#isExact,
      expressionId: this.#expressionId
    };
  }

  /**
   * Convert to compact JSON for clipboard
   * @returns {string}
   */
  toClipboardJSON() {
    return JSON.stringify({
      mood: this.#mood,
      sexual: this.#sexual
    }, null, 2);
  }

  /**
   * Create from JSON
   * @param {Object} json
   * @returns {WitnessState}
   */
  static fromJSON(json) {
    return new WitnessState({
      mood: json.mood,
      sexual: json.sexual,
      fitness: json.fitness ?? 1,
      isExact: json.isExact ?? true,
      expressionId: json.expressionId ?? null
    });
  }

  /**
   * Create a random state within valid ranges
   * @returns {WitnessState}
   */
  static createRandom() {
    const mood = {};
    const sexual = {};

    for (const axis of MOOD_AXES) {
      mood[axis] = MOOD_RANGE.min + Math.random() * (MOOD_RANGE.max - MOOD_RANGE.min);
    }

    for (const axis of SEXUAL_AXES) {
      sexual[axis] = SEXUAL_RANGE.min + Math.random() * (SEXUAL_RANGE.max - SEXUAL_RANGE.min);
    }

    return new WitnessState({ mood, sexual, fitness: 0, isExact: false });
  }

  /**
   * Create a neutral state (all zeros)
   * @returns {WitnessState}
   */
  static createNeutral() {
    const mood = {};
    const sexual = {};

    for (const axis of MOOD_AXES) {
      mood[axis] = 0;
    }

    for (const axis of SEXUAL_AXES) {
      sexual[axis] = SEXUAL_RANGE.max / 2; // Middle of range
    }

    return new WitnessState({ mood, sexual, fitness: 0, isExact: false });
  }

  /**
   * Validate mood state
   * @private
   */
  #validateMood(mood) {
    if (!mood || typeof mood !== 'object') {
      throw new Error('WitnessState requires mood object');
    }

    for (const axis of MOOD_AXES) {
      const value = mood[axis];
      if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new Error(`Mood axis "${axis}" must be a number`);
      }
      if (value < MOOD_RANGE.min || value > MOOD_RANGE.max) {
        throw new Error(`Mood axis "${axis}" must be in range [${MOOD_RANGE.min}, ${MOOD_RANGE.max}], got ${value}`);
      }
    }
  }

  /**
   * Validate sexual state
   * @private
   */
  #validateSexual(sexual) {
    if (!sexual || typeof sexual !== 'object') {
      throw new Error('WitnessState requires sexual object');
    }

    for (const axis of SEXUAL_AXES) {
      const value = sexual[axis];
      if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new Error(`Sexual axis "${axis}" must be a number`);
      }
      if (value < SEXUAL_RANGE.min || value > SEXUAL_RANGE.max) {
        throw new Error(`Sexual axis "${axis}" must be in range [${SEXUAL_RANGE.min}, ${SEXUAL_RANGE.max}], got ${value}`);
      }
    }
  }
}

// Export constants for external use
WitnessState.MOOD_AXES = MOOD_AXES;
WitnessState.SEXUAL_AXES = SEXUAL_AXES;
WitnessState.MOOD_RANGE = MOOD_RANGE;
WitnessState.SEXUAL_RANGE = SEXUAL_RANGE;

export default WitnessState;
```

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/models/WitnessState.test.js --verbose
```

### Unit Test Coverage Requirements

**WitnessState.test.js:**
- Constructor throws if mood is missing
- Constructor throws if sexual is missing
- Constructor throws if mood axis is out of range
- Constructor throws if sexual axis is out of range
- Constructor throws if mood axis is NaN
- Constructor accepts valid mood and sexual state
- `mood` getter returns copy, not reference
- `sexual` getter returns copy, not reference
- `isWitness` returns true when isExact and fitness=1
- `isWitness` returns false when isExact=false
- `isWitness` returns false when fitness<1
- `getMoodAxis()` returns correct value
- `getSexualAxis()` returns correct value
- `withChanges()` creates new instance with modifications
- `withChanges()` preserves unchanged values
- `toDisplayString()` formats correctly
- `toJSON()` includes all fields
- `toClipboardJSON()` returns valid JSON string
- `fromJSON()` reconstructs state correctly
- `createRandom()` returns valid state
- `createNeutral()` returns state with expected values
- Static constants are frozen
- Mood axes in correct range [-100, 100]
- Sexual axes in correct range [0, 100]

### Invariants That Must Remain True

1. **Mood axes in [-100, 100]** - Always validated on construction
2. **Sexual axes in [0, 100]** - Always validated on construction
3. **Immutable getters** - Return copies, not references
4. **Valid JSON output** - toJSON() and toClipboardJSON() produce parseable JSON
5. **fromJSON roundtrip** - fromJSON(toJSON()) equals original
6. **Constants are frozen** - Cannot be modified at runtime

## Verification Commands

```bash
# Run unit tests
npm run test:unit -- tests/unit/expressionDiagnostics/models/WitnessState.test.js --verbose

# Type checking
npm run typecheck

# Quick verification
node -e "
import WitnessState from './src/expressionDiagnostics/models/WitnessState.js';
const state = WitnessState.createRandom();
console.log(state.toDisplayString());
console.log(state.toClipboardJSON());
"
```

## Definition of Done

- [ ] `WitnessState.js` created with all methods implemented
- [ ] `models/index.js` updated with export
- [ ] Unit tests cover all public methods
- [ ] Tests cover validation edge cases
- [ ] Tests verify JSON roundtrip
- [ ] Static factory methods work correctly
- [ ] JSDoc documentation complete
- [ ] All tests pass
- [ ] Constants exported and frozen
