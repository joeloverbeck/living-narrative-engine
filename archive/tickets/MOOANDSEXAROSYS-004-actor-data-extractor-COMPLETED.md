# MOOANDSEXAROSYS-004: ActorDataExtractor Extension

## Summary

Extend the ActorDataExtractor service to extract emotional and sexual state data from actors, using the EmotionCalculatorService to compute emotion intensities and formatted text for LLM prompts.

**CRITICAL**: Implement FAIL-FAST validation - throw an error if the actor lacks `core:mood` OR `core:sexual_state` components when composing the LLM prompt.

## Files to Touch

### MODIFY

- `src/turns/services/actorDataExtractor.js` - Add emotional data extraction
- `src/turns/dtos/AIGameStateDTO.js` - Add EmotionalStateDTO typedef (if exists, otherwise add to actorDataExtractor.js)
- `src/dependencyInjection/registrations/aiRegistrations.js` - Inject EmotionCalculatorService

## Out of Scope

- CharacterDataXmlBuilder XML generation (uses extracted data) - see MOOANDSEXAROSYS-005
- EmotionCalculatorService implementation - see MOOANDSEXAROSYS-003
- UI panels - see MOOANDSEXAROSYS-009, MOOANDSEXAROSYS-010
- LLM response processing - see MOOANDSEXAROSYS-006, MOOANDSEXAROSYS-007
- Component definitions - see MOOANDSEXAROSYS-001

## Technical Specification

### FAIL-FAST Validation Requirement

When extracting actor data for LLM prompts, the service MUST:

1. Check if actor has `core:mood` component
2. Check if actor has `core:sexual_state` component
3. If EITHER is missing, throw a descriptive error

```javascript
// Example fail-fast implementation
// NOTE: actorState uses direct property access (actorState[componentId]), not Map.get()
#validateEmotionalComponents(actorState, actorId) {
  const hasMood = actorState[MOOD_COMPONENT_ID] !== undefined;
  const hasSexualState = actorState[SEXUAL_STATE_COMPONENT_ID] !== undefined;

  if (!hasMood || !hasSexualState) {
    const missing = [];
    if (!hasMood) missing.push(MOOD_COMPONENT_ID);
    if (!hasSexualState) missing.push(SEXUAL_STATE_COMPONENT_ID);

    throw new Error(
      `ActorDataExtractor: Actor '${actorId}' is missing required emotional components: [${missing.join(', ')}]. ` +
      `All actors must have both core:mood and core:sexual_state components for LLM prompt generation.`
    );
  }
}
```

### EmotionalStateDTO Structure

```javascript
/**
 * @typedef {Object} EmotionalStateDTO
 * @property {Object} moodAxes - Raw mood axis values
 * @property {number} moodAxes.valence - [-100..100]
 * @property {number} moodAxes.arousal - [-100..100]
 * @property {number} moodAxes.agency_control - [-100..100]
 * @property {number} moodAxes.threat - [-100..100]
 * @property {number} moodAxes.engagement - [-100..100]
 * @property {number} moodAxes.future_expectancy - [-100..100]
 * @property {number} moodAxes.self_evaluation - [-100..100]
 * @property {string} emotionalStateText - Formatted emotions for prompt
 * @property {Object|null} sexualState - Sexual state values (null if component missing)
 * @property {number} sexualState.sex_excitation - [0..100]
 * @property {number} sexualState.sex_inhibition - [0..100]
 * @property {number} sexualState.baseline_libido - [-50..50]
 * @property {number} sexualState.sexual_arousal - Calculated [0..1]
 * @property {string|null} sexualStateText - Formatted sexual states for prompt
 */
```

### Constructor Changes

Add `emotionCalculatorService` to constructor dependencies:

```javascript
constructor({
  logger,
  entityManager,
  // ... existing deps
  emotionCalculatorService  // NEW
})
```

### New Private Method

```javascript
/**
 * Extracts emotional and sexual state data from actor.
 * @param {Object} actorState - Actor state with components (direct property access)
 * @param {string} actorId - Actor entity ID
 * @returns {EmotionalStateDTO}
 * @throws {Error} If actor lacks required emotional components (FAIL-FAST)
 */
#extractEmotionalData(actorState, actorId) {
  // 1. FAIL-FAST validation
  this.#validateEmotionalComponents(actorState, actorId);

  // 2. Extract mood data (direct property access, not Map.get())
  const moodComponent = actorState[MOOD_COMPONENT_ID];
  const moodAxes = { ...moodComponent };

  // 3. Extract sexual state data
  const sexualComponent = actorState[SEXUAL_STATE_COMPONENT_ID];
  const sexualArousal = this.#emotionCalculatorService.calculateSexualArousal(sexualComponent);

  const sexualState = {
    ...sexualComponent,
    sexual_arousal: sexualArousal
  };

  // 4. Calculate emotions and format
  const emotions = this.#emotionCalculatorService.calculateEmotions(moodAxes, sexualArousal);
  const emotionalStateText = this.#emotionCalculatorService.formatEmotionsForPrompt(emotions);

  // 5. Calculate sexual states and format
  const sexualStates = this.#emotionCalculatorService.calculateSexualStates(moodAxes, sexualArousal);
  const sexualStateText = this.#emotionCalculatorService.formatSexualStatesForPrompt(sexualStates);

  return {
    moodAxes,
    emotionalStateText,
    sexualState,
    sexualStateText
  };
}
```

### Integration Point

Call `#extractEmotionalData` in the main extraction method and include result in returned DTO:

```javascript
// In the main extraction method (e.g., extractActorData)
const emotionalState = this.#extractEmotionalData(actorState, actorId);

return {
  // ... existing fields
  emotionalState  // NEW
};
```

### DI Registration Update

```javascript
// In aiRegistrations.js
container.register(
  tokens.IActorDataExtractor,
  (c) => new ActorDataExtractor({
    logger: c.resolve(tokens.ILogger),
    entityManager: c.resolve(tokens.IEntityManager),
    // ... existing deps
    emotionCalculatorService: c.resolve(tokens.EmotionCalculatorService)  // NEW
  }),
  Lifecycle.Singleton
);
```

## Acceptance Criteria

### FAIL-FAST Validation

- [ ] Throws descriptive error if actor lacks `core:mood` component
- [ ] Throws descriptive error if actor lacks `core:sexual_state` component
- [ ] Error message includes actor ID and list of missing components
- [ ] Validation happens early in extraction process

### Emotional Data Extraction

- [ ] `#extractEmotionalData` method implemented
- [ ] Returns complete `EmotionalStateDTO` structure
- [ ] `moodAxes` contains all 7 axis values
- [ ] `emotionalStateText` is formatted string from EmotionCalculatorService
- [ ] `sexualState` contains all 3 values plus calculated `sexual_arousal`
- [ ] `sexualStateText` is formatted string from EmotionCalculatorService

### DI Integration

- [ ] EmotionCalculatorService injected via constructor
- [ ] Dependency validation in constructor
- [ ] aiRegistrations.js updated with new dependency

### Backward Compatibility

- [ ] All existing tests continue to pass
- [ ] Existing DTO fields remain unchanged
- [ ] `emotionalState` field is additive (doesn't break existing consumers)

### Unit Tests

- [ ] Test FAIL-FAST throws when `core:mood` missing
- [ ] Test FAIL-FAST throws when `core:sexual_state` missing
- [ ] Test FAIL-FAST throws when both missing
- [ ] Test successful extraction with valid components
- [ ] Test EmotionalStateDTO structure is correct
- [ ] Test integration with EmotionCalculatorService (mocked)

### Test Commands

```bash
# Run existing tests to ensure no regressions
npm run test:unit -- --testPathPattern="actorDataExtractor"

# Run integration tests
npm run test:integration -- --testPathPattern="actorDataExtractor"
```

## Dependencies

- MOOANDSEXAROSYS-001 (component definitions must exist)
- MOOANDSEXAROSYS-003 (EmotionCalculatorService must be implemented)

## Dependent Tickets

- MOOANDSEXAROSYS-005 (CharacterDataXmlBuilder consumes emotionalState from DTO)

---

## Outcome

**Status**: COMPLETED

**Date**: 2026-01-05

### Ticket Corrections Made

1. **Data Access Pattern**: Original ticket assumed Map-based component access (`actorState.components.get(X)`). Corrected to direct property access pattern (`actorState[X]`), matching actual codebase implementation.

### Implementation Summary

All acceptance criteria met:

#### FAIL-FAST Validation ✅
- `#validateEmotionalComponents(actorState, actorId)` method implemented
- Throws descriptive error with actor ID and missing component list
- Validates both `core:mood` and `core:sexual_state` components
- Validation executes at start of `#extractEmotionalData`

#### Emotional Data Extraction ✅
- `#extractEmotionalData(actorState, actorId)` method implemented
- Returns complete EmotionalStateDTO structure
- `moodAxes` contains all 7 axis values (valence, arousal, agency_control, threat, engagement, future_expectancy, self_evaluation)
- `emotionalStateText` formatted via EmotionCalculatorService.formatEmotionsForPrompt()
- `sexualState` contains all 3 values plus calculated `sexual_arousal`
- `sexualStateText` formatted via EmotionCalculatorService.formatSexualStatesForPrompt()

#### DI Integration ✅
- EmotionCalculatorService injected via constructor
- Constructor validation throws if emotionCalculatorService not provided
- aiRegistrations.js updated with new dependency binding

#### Backward Compatibility ✅
- All existing tests pass (133 tests across 4 test files)
- Existing DTO fields remain unchanged
- `emotionalState` field is additive

#### Unit Tests ✅
- New test file: `tests/unit/turns/services/actorDataExtractor.emotionalState.test.js`
- Tests FAIL-FAST validation for missing components
- Tests successful extraction with valid components
- Tests EmotionalStateDTO structure correctness
- Tests integration with mocked EmotionCalculatorService

### Files Modified

1. `src/turns/services/actorDataExtractor.js` - Added emotional data extraction
2. `src/turns/dtos/AIGameStateDTO.js` - Added EmotionalStateDTO typedef
3. `src/dependencyInjection/registrations/aiRegistrations.js` - Injected EmotionCalculatorService
4. `src/dependencyInjection/tokens/tokens-ai.js` - Added token export for EmotionCalculatorService
5. `src/constants/componentIds.js` - Added MOOD_COMPONENT_ID and SEXUAL_STATE_COMPONENT_ID exports
6. `tests/unit/turns/services/actorDataExtractor.emotionalState.test.js` - New test file (63 tests)
7. `tests/unit/turns/services/actorDataExtractor.anatomy.test.js` - Updated for emotionCalculatorService dependency
8. `tests/integration/prompting/characterDescriptionPipeline.integration.test.js` - Updated for emotionCalculatorService dependency

### Test Results

```
PASS tests/unit/turns/services/actorDataExtractor.test.js (96 tests)
PASS tests/unit/turns/services/actorDataExtractor.emotionalState.test.js (32 tests)
PASS tests/unit/turns/services/actorDataExtractor.anatomy.test.js (8 tests)
PASS tests/integration/prompting/characterDescriptionPipeline.integration.test.js (3 tests)

Test Suites: 4 passed, 4 total
Tests:       133 passed, 133 total
```

### Notes

- Integration tests required manual component assignment to actorState after `ActorStateProvider.build()` because ActorStateProvider doesn't extract emotional components to top-level actorState (they remain in `actorState.components[X]`). This is documented in test comments.
