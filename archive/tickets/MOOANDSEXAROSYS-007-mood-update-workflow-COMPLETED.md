# MOOANDSEXAROSYS-007: Mood/Sexual State Persistence Listener

## Summary

Create a new persistence listener that processes `moodUpdate` and `sexualUpdate` from LLM responses and updates the actor's `core:mood` and `core:sexual_state` components accordingly.

**Note**: This ticket originally proposed a "workflow" pattern, but after code analysis, the correct approach is a **listener pattern** following `ThoughtPersistenceListener` and `NotesPersistenceListener`.

## Outcome

**Status**: ✅ COMPLETED

### Implementation Summary

1. **Created MoodSexualPersistenceListener** (`src/ai/moodSexualPersistenceListener.js`)
   - Handles ACTION_DECIDED_ID events with moodUpdate/sexualUpdate in extractedData
   - Uses `entity.modifyComponent()` for component updates (corrected from initial `updateComponent` assumption)
   - Preserves `baseline_libido` when updating sexual_state
   - Graceful error handling - logs warnings/errors without throwing

2. **Fixed LLMChooser Gap** (`src/turns/adapters/llmChooser.js`)
   - Added `moodUpdate: extractedData?.moodUpdate ?? null` to return object
   - Added `sexualUpdate: extractedData?.sexualUpdate ?? null` to return object

3. **DI Registration** (`src/dependencyInjection/registrations/orchestrationRegistrations.js`)
   - Created MoodSexualPersistenceListener instance with logger and entityManager
   - Passed to InitializationService via persistence config

4. **Event Subscription** (`src/initializers/services/initializationService.js`)
   - Added moodSexualListener to constructor validation
   - Subscribed to ACTION_DECIDED_ID via setupPersistenceListeners

### Tests Created

- **Unit tests** (`tests/unit/ai/moodSexualPersistenceListener.test.js`): 16 tests
  - Constructor validation
  - Mood updates
  - Sexual updates with baseline_libido preservation
  - Combined updates
  - No-op scenarios
  - Error handling

- **Integration tests** (`tests/integration/ai/moodSexualPersistenceListener.integration.test.js`): 10 tests
  - Real EntityManager integration
  - Component update verification
  - Missing component handling
  - Entity not found handling

### Key Technical Decisions

1. **Method name correction**: Entity class uses `modifyComponent()`, not `updateComponent()`. This was discovered during integration testing.

2. **baseline_libido preservation**: Sexual state updates explicitly preserve the existing `baseline_libido` value since it's a character trait, not an LLM-modifiable state.

3. **Graceful error handling**: All errors are caught and logged without throwing, ensuring the turn flow is never interrupted by state persistence failures.

## Files Touched

### CREATED

- `src/ai/moodSexualPersistenceListener.js`
- `tests/unit/ai/moodSexualPersistenceListener.test.js`
- `tests/integration/ai/moodSexualPersistenceListener.integration.test.js`

### MODIFIED

- `src/turns/adapters/llmChooser.js` - Added moodUpdate/sexualUpdate to return object
- `src/dependencyInjection/registrations/orchestrationRegistrations.js` - Created listener instance
- `src/initializers/services/initializationService.js` - Added listener parameter, subscribed to ACTION_DECIDED_ID

## Out of Scope

- UI panel updates (happen via component update events) - see MOOANDSEXAROSYS-009, MOOANDSEXAROSYS-010
- Prompt instruction updates - see MOOANDSEXAROSYS-008
- Schema changes - see MOOANDSEXAROSYS-006
- ActorDataExtractor/CharacterDataXmlBuilder - see MOOANDSEXAROSYS-004, MOOANDSEXAROSYS-005
- EmotionCalculatorService - see MOOANDSEXAROSYS-003

## Technical Specification

### Architecture Pattern

This implementation follows the established **listener pattern** used by:
- `ThoughtPersistenceListener` - handles thoughts from LLM responses
- `NotesPersistenceListener` - handles notes from LLM responses

All listeners subscribe to `ACTION_DECIDED_ID` events via `setupPersistenceListeners`.

### Listener Responsibilities

1. Receive `ACTION_DECIDED_ID` event with `extractedData` in payload
2. Get entity instance from EntityManager using `actorId`
3. If `moodUpdate` present AND actor has `core:mood` component → update component
4. If `sexualUpdate` present AND actor has `core:sexual_state` component → update (preserving `baseline_libido`)
5. Log debug information about updates
6. Handle errors gracefully (don't throw - allow turn to continue)

### Graceful Error Handling

Critical requirement: The listener MUST NOT throw errors that would interrupt the turn flow.

- Missing entity → warn and return
- Missing component → warn and return
- Update failure → log error and return
- Any exception → catch, log, and return

### baseline_libido Preservation

The `baseline_libido` field is a character trait that should NOT be modified by the LLM. When applying `sexualUpdate`, always preserve the existing `baseline_libido` value.

## Acceptance Criteria

### Listener Implementation

- [x] New file created at `src/ai/moodSexualPersistenceListener.js`
- [x] Class follows project conventions (private fields, dependency injection)
- [x] Constructor validates `logger` and `entityManager` dependencies

### LLMChooser Fix

- [x] `llmChooser.js` returns moodUpdate and sexualUpdate in return object

### Mood Update Logic

- [x] Updates `core:mood` component when `moodUpdate` present
- [x] Skips mood update if actor lacks `core:mood` component (warn, don't throw)
- [x] All 7 axes updated from `moodUpdate`
- [x] Debug log includes key axis values

### Sexual Update Logic

- [x] Updates `core:sexual_state` component when `sexualUpdate` present
- [x] Skips sexual update if actor lacks `core:sexual_state` component (warn, don't throw)
- [x] Preserves `baseline_libido` from existing component
- [x] Only updates `sex_excitation` and `sex_inhibition`
- [x] Debug log includes updated values

### Graceful Error Handling

- [x] No exceptions thrown that would interrupt turn flow
- [x] Missing entity → warn and return (don't throw)
- [x] Missing component → warn and return (don't throw)
- [x] Any error → catch, log, and return (don't throw)

### Integration

- [x] Listener created in orchestrationRegistrations.js
- [x] Listener passed to InitializationService
- [x] Listener subscribed to ACTION_DECIDED_ID event

### Unit Tests

- [x] Test mood update with valid data
- [x] Test sexual update with valid data
- [x] Test both updates together
- [x] Test graceful handling when entity not found
- [x] Test graceful handling when mood component missing
- [x] Test graceful handling when sexual_state component missing
- [x] Test baseline_libido preservation
- [x] Test no-op when no updates in extractedData
- [x] Test error handling doesn't throw

### Integration Tests

- [x] Test full flow: LLM response → extraction → listener → component updated
- [x] Test component update triggers events (for UI panels)

### Test Commands

```bash
# Run listener tests
npm run test:unit -- --testPathPattern="moodSexualPersistenceListener"

# Run integration tests
npm run test:integration -- --testPathPattern="moodSexualPersistenceListener"

# Run LLMChooser tests
npm run test:unit -- --testPathPattern="llmChooser"
```

## Dependencies

- MOOANDSEXAROSYS-001 (component definitions must exist)
- MOOANDSEXAROSYS-006 (schema must include moodUpdate/sexualUpdate fields)

## Dependent Tickets

- MOOANDSEXAROSYS-009 (EmotionalStatePanel listens for component updates)
- MOOANDSEXAROSYS-010 (SexualStatePanel listens for component updates)
