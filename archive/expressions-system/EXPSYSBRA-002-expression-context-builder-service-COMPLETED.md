# EXPSYSBRA-002: Expression Context Builder Service

## Summary

Create the `ExpressionContextBuilder` service that constructs the evaluation context containing calculated emotions, sexual states, mood axes, and actor data for expression prerequisite evaluation.

## Background

Expression prerequisites need access to:
- Calculated emotion intensities (from `EmotionCalculatorService`)
- Calculated sexual state intensities
- Raw mood axes values
- Sexual arousal value
- Actor entity and components
- Previous state for detecting changes

This service bridges the emotion calculation system with the expression evaluation system.

### Assumptions (Updated)

- `EmotionCalculatorService.calculateEmotions()` and `.calculateSexualStates()` return `Map` entries only for intensities > 0 (not a full 40/13 keyset).
- `EmotionCalculatorService.calculateSexualArousal()` returns `null` when sexual state data is missing.
- `baseline_libido` ranges from -50 to +50 (per `core:sexual_state` schema).
- `createEntityContext()` relies on an entity manager that can provide component access (`getComponentData`, `hasComponent`, `getAllComponentTypesForEntity`).

## File List (Expected to Touch)

### New Files
- `src/expressions/expressionContextBuilder.js` - Context builder service

### Files to Read (NOT modify)
- `src/emotions/emotionCalculatorService.js` - Source of emotion calculations
- `src/actions/validation/actionValidationContextBuilder.js` - Pattern reference
- `src/logic/contextAssembler.js` - Entity context creation patterns
- `src/logic/componentAccessor.js` - Component proxy patterns
- `data/mods/core/components/mood.component.json` - Mood data structure
- `data/mods/core/components/sexual_state.component.json` - Sexual state structure

## Out of Scope (MUST NOT Change)

- `src/emotions/emotionCalculatorService.js` - Use as-is
- `src/actions/validation/actionValidationContextBuilder.js` - Reference only
- `src/logic/contextAssembler.js` - Reference only
- `src/logic/componentAccessor.js` - Reference only
- Any component definitions
- Any existing context builders
- DI registration (separate ticket EXPSYSBRA-006)

## Implementation Details

### Class: `ExpressionContextBuilder`

```javascript
/**
 * @file Expression Context Builder - Constructs evaluation context for expressions
 */

import { validateDependency } from '../utils/dependencyUtils.js';
import { createEntityContext } from '../logic/contextAssembler.js';

class ExpressionContextBuilder {
  #emotionCalculatorService;
  #entityManager;
  #logger;

  constructor({ emotionCalculatorService, entityManager, logger }) {
    validateDependency(emotionCalculatorService, 'IEmotionCalculatorService', logger);
    validateDependency(entityManager, 'IEntityManager', logger);
    // ...
  }

  /**
   * Build complete evaluation context for expression prerequisites
   * @param {string} actorId - Actor entity ID
   * @param {object} moodData - Current mood component data
   * @param {object} sexualStateData - Current sexual state component data
   * @param {object|null} previousState - Previous emotion/sexual state (optional)
   * @returns {ExpressionEvaluationContext}
   */
  buildContext(actorId, moodData, sexualStateData, previousState = null) {
    // Calculate sexual arousal
    const sexualArousal = this.#emotionCalculatorService.calculateSexualArousal(sexualStateData);

    // Calculate emotions
    const emotions = this.#emotionCalculatorService.calculateEmotions(moodData, sexualArousal);

    // Calculate sexual states
    const sexualStates = this.#emotionCalculatorService.calculateSexualStates(moodData, sexualArousal);

    // Build actor context (reuse existing pattern)
    const actorContext = createEntityContext(actorId, this.#entityManager, this.#logger);

    return {
      actor: actorContext,
      emotions: this.#mapToObject(emotions),
      sexualStates: this.#mapToObject(sexualStates),
      moodAxes: this.#extractMoodAxes(moodData),
      sexualArousal,
      previousEmotions: previousState?.emotions ?? null,
      previousSexualStates: previousState?.sexualStates ?? null,
      previousMoodAxes: previousState?.moodAxes ?? null
    };
  }

  /**
   * Extract mood axes from mood component data
   * @private
   */
  #extractMoodAxes(moodData) {
    return {
      valence: moodData.valence ?? 0,
      arousal: moodData.arousal ?? 0,
      agency_control: moodData.agency_control ?? 0,
      threat: moodData.threat ?? 0,
      engagement: moodData.engagement ?? 0,
      future_expectancy: moodData.future_expectancy ?? 0,
      self_evaluation: moodData.self_evaluation ?? 0
    };
  }

  /**
   * Convert Map to plain object for JSON Logic
   * @private
   */
  #mapToObject(map) {
    const obj = {};
    for (const [key, value] of map) {
      obj[key] = value;
    }
    return obj;
  }
}
```

### Context Structure Output

```javascript
{
  // Actor reference (reuses existing pattern)
  actor: {
    id: "entity_id",
    components: Proxy { /* lazy component access */ }
  },

  // Calculated emotions (Map converted to object; only includes keys with intensity > 0)
  emotions: {
    joy: 0.45,           // intensity [0, 1]
    sadness: 0.10,
    anger: 0.72,
    // ... included keys only when intensity > 0
  },

  // Calculated sexual states (only includes keys with intensity > 0)
  sexualStates: {
    sexual_lust: 0.60,
    romantic_yearning: 0.25,
    // ... included keys only when intensity > 0
  },

  // Raw mood axes (for direct comparisons)
  moodAxes: {
    valence: -25,          // [-100, 100]
    arousal: 45,
    agency_control: -60,
    threat: 20,
    engagement: 30,
    future_expectancy: -40,
    self_evaluation: -15
  },

  // Calculated sexual arousal
  sexualArousal: 0.40,     // [0, 1] or null if sexual state is missing

  // Previous state (null on first evaluation)
  previousEmotions: { ... } | null,
  previousSexualStates: { ... } | null,
  previousMoodAxes: { ... } | null
}
```

Notes:
- `emotions` / `sexualStates` may be empty objects when no intensities pass gates.
- `sexualArousal` may be `null` when sexual state data is missing.

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Test: `tests/unit/expressions/expressionContextBuilder.test.js`**
   - `should build context with all required fields`
   - `should calculate emotions using EmotionCalculatorService`
   - `should calculate sexual states using EmotionCalculatorService`
   - `should extract mood axes from mood data`
   - `should calculate sexual arousal correctly`
   - `should include actor context with component accessor`
   - `should handle null previous state gracefully`
   - `should include previous state when provided`
   - `should convert emotion Map to plain object`
   - `should validate dependencies in constructor`
   - `should handle missing mood axes with defaults`
   - `should allow null sexual arousal when sexual state is missing`

### Invariants That Must Remain True

1. **Context always includes all required top-level fields** - Never undefined required fields (`actor`, `emotions`, `sexualStates`, `moodAxes`, `sexualArousal`, `previousEmotions`, `previousSexualStates`, `previousMoodAxes`)
2. **Emotion values are [0, 1] when present** - Normalized intensity values for included keys
3. **Mood axes are [-100, 100]** - Raw values from component
4. **Sexual arousal is [0, 1] or null** - Calculated value or null when sexual state is missing
5. **Actor context is compatible with JSON Logic** - Uses existing pattern
6. **Previous state fields are null if not provided** - Not undefined
7. **No modification to input data** - Pure function behavior

## Estimated Size

- ~80-120 lines of code
- Single file addition
- Depends on existing EmotionCalculatorService

## Dependencies

- Depends on: EXPSYSBRA-001 (conceptually, not code)
- Uses: `EmotionCalculatorService`, `createEntityContext`

## Notes

- Reuse `createEntityContext` from `src/logic/contextAssembler.js`
- EmotionCalculatorService already exists and is tested
- Map to object conversion needed for JSON Logic compatibility
- Default mood axes to 0 if missing (defensive coding)
- Context structure must match what expression prerequisites expect

## Status

Completed.

## Outcome

Implemented `ExpressionContextBuilder` with dependency validation, mood-axis defaults, map-to-object conversion, and null-safe previous state handling; added unit tests covering context composition, dependency validation, and null sexual arousal propagation. Updated assumptions to reflect actual `EmotionCalculatorService` behavior (sparse Map outputs, null sexual arousal) and component schema ranges.
